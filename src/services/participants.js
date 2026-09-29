import { db } from '../firebase';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch
} from 'firebase/firestore';
import * as XLSX from 'xlsx';

/**
 * Fetch all allowed participants for a closed event
 * @param {string} eventId 
 * @returns {Promise<Array>} List of participant objects
 */
export async function getAllowedParticipants(eventId) {
  if (!eventId) return [];
  try {
    const collRef = collection(db, 'events', eventId, 'allowedParticipants');
    const snapshot = await getDocs(collRef);
    if (snapshot && !snapshot.empty) {
      return snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));
    }
  } catch (err) {
    console.warn(`Firestore getAllowedParticipants error for event ${eventId}:`, err.message);
  }
  return [];
}

/**
 * Check if a specific student email is allowed for a closed event
 * @param {string} eventId 
 * @param {string} email 
 * @returns {Promise<boolean>}
 */
export async function isStudentAllowed(eventId, email) {
  if (!eventId || !email) return false;
  const emailLower = email.trim().toLowerCase();
  try {
    const docRef = doc(db, 'events', eventId, 'allowedParticipants', emailLower);
    const snap = await getDoc(docRef);
    return snap.exists();
  } catch (err) {
    console.warn(`Error checking participant allowance for ${emailLower}:`, err.message);
    return false;
  }
}

/**
 * Add a single participant to a closed event
 * @param {string} eventId 
 * @param {{ name: string, email: string, prn: string }} participantData 
 * @param {object} authorUser 
 */
export async function addAllowedParticipant(eventId, participantData, authorUser) {
  if (!eventId || !participantData.email) {
    throw new Error('Event ID and participant email are required.');
  }

  const emailLower = participantData.email.trim().toLowerCase();
  const docRef = doc(db, 'events', eventId, 'allowedParticipants', emailLower);

  const payload = {
    name: (participantData.name || '').trim(),
    email: emailLower,
    prn: (participantData.prn || '').trim(),
    addedBy: authorUser?.name || authorUser?.email || 'Organizer',
    addedByUid: authorUser?.uid || '',
    addedAt: new Date().toISOString()
  };

  await setDoc(docRef, payload);
  return { success: true, participant: { id: emailLower, ...payload } };
}

/**
 * Remove an allowed participant from a closed event
 * @param {string} eventId 
 * @param {string} email 
 */
export async function removeAllowedParticipant(eventId, email) {
  if (!eventId || !email) return { success: false };
  const emailLower = email.trim().toLowerCase();
  const docRef = doc(db, 'events', eventId, 'allowedParticipants', emailLower);
  await deleteDoc(docRef);
  return { success: true };
}

/**
 * Batch add allowed participants (handles batch chunking up to 450 per batch)
 * @param {string} eventId 
 * @param {Array<{ name: string, email: string, prn: string }>} participantsList 
 * @param {object} authorUser 
 * @param {function} [onProgress] 
 */
export async function batchAddAllowedParticipants(eventId, participantsList, authorUser, onProgress = null) {
  if (!eventId || !Array.isArray(participantsList) || participantsList.length === 0) {
    return { success: true, count: 0 };
  }

  const BATCH_SIZE = 450;
  let savedCount = 0;
  const now = new Date().toISOString();
  const addedBy = authorUser?.name || authorUser?.email || 'Organizer';
  const addedByUid = authorUser?.uid || '';

  // De-duplicate in memory first by lowercase email
  const uniqueMap = new Map();
  participantsList.forEach(p => {
    if (p && p.email) {
      const emailKey = p.email.trim().toLowerCase();
      uniqueMap.set(emailKey, {
        name: (p.name || '').trim(),
        email: emailKey,
        prn: (p.prn || '').trim(),
        addedBy,
        addedByUid,
        addedAt: now
      });
    }
  });

  const dedupedList = Array.from(uniqueMap.values());
  const chunks = [];
  for (let i = 0; i < dedupedList.length; i += BATCH_SIZE) {
    chunks.push(dedupedList.slice(i, i + BATCH_SIZE));
  }

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const batch = writeBatch(db);

    chunk.forEach(p => {
      const docRef = doc(db, 'events', eventId, 'allowedParticipants', p.email);
      batch.set(docRef, p);
    });

    await batch.commit();
    savedCount += chunk.length;
    if (typeof onProgress === 'function') {
      onProgress(savedCount, dedupedList.length);
    }
  }

  return { success: true, count: savedCount };
}

/**
 * Clear all allowed participants for an event
 * @param {string} eventId 
 */
export async function clearAllowedParticipants(eventId) {
  if (!eventId) return { success: false };
  const existing = await getAllowedParticipants(eventId);
  if (existing.length === 0) return { success: true, count: 0 };

  const BATCH_SIZE = 450;
  for (let i = 0; i < existing.length; i += BATCH_SIZE) {
    const chunk = existing.slice(i, i + BATCH_SIZE);
    const batch = writeBatch(db);
    chunk.forEach(p => {
      const docRef = doc(db, 'events', eventId, 'allowedParticipants', p.id);
      batch.delete(docRef);
    });
    await batch.commit();
  }

  return { success: true, count: existing.length };
}

/**
 * Parse uploaded Excel or CSV file in the browser using SheetJS
 * Normalizes emails to lowercase, trims whitespace, detects errors and duplicates.
 * @param {File} file 
 * @param {Array} existingParticipants Current participants in DB to check existing duplicates
 * @returns {Promise<{ valid: Array, invalid: Array, duplicates: Array, totalRows: number }>}
 */
export async function parseParticipantsFile(file, existingParticipants = []) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });

        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          throw new Error('Workbook contains no sheets.');
        }

        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        if (!rawRows || rawRows.length === 0) {
          return resolve({ valid: [], invalid: [], duplicates: [], totalRows: 0 });
        }

        // Existing set of emails in DB (lowercased)
        const existingEmailSet = new Set(
          existingParticipants.map(p => (p.email || p.id || '').toLowerCase().trim())
        );

        // Seen emails within the uploaded file to detect intra-file duplicates
        const seenInFileEmails = new Set();

        const valid = [];
        const invalid = [];
        const duplicates = [];

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        rawRows.forEach((row, index) => {
          const rowNumber = index + 2; // header is row 1

          // Case-insensitive header lookup
          let name = '';
          let email = '';
          let prn = '';

          Object.keys(row).forEach(key => {
            const cleanKey = key.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
            const val = String(row[key] || '').trim();

            if (cleanKey.includes('email') || cleanKey.includes('mail')) {
              email = val;
            } else if (cleanKey.includes('name') || cleanKey.includes('student') || cleanKey.includes('participant')) {
              name = val;
            } else if (cleanKey.includes('prn') || cleanKey.includes('roll') || cleanKey.includes('urn') || cleanKey.includes('id')) {
              prn = val;
            }
          });

          // Fallback positional if columns weren't named with recognizable headers
          if (!name && !email && !prn) {
            const values = Object.values(row).map(v => String(v || '').trim());
            if (values.length >= 3) {
              name = values[0];
              email = values[1];
              prn = values[2];
            }
          }

          const emailLower = email.toLowerCase().trim();
          const errors = [];

          if (!name) errors.push('Missing Name');
          if (!email) {
            errors.push('Missing Email');
          } else if (!emailRegex.test(emailLower)) {
            errors.push(`Invalid email format (${email})`);
          }
          if (!prn) errors.push('Missing PRN');

          const entry = {
            rowNumber,
            name: name.trim(),
            email: emailLower,
            prn: prn.trim(),
            raw: row
          };

          if (errors.length > 0) {
            invalid.push({ ...entry, errors: errors.join(', ') });
          } else if (seenInFileEmails.has(emailLower)) {
            duplicates.push({ ...entry, reason: 'Duplicate in uploaded file' });
          } else if (existingEmailSet.has(emailLower)) {
            duplicates.push({ ...entry, reason: 'Already in participant list' });
          } else {
            seenInFileEmails.add(emailLower);
            valid.push(entry);
          }
        });

        resolve({
          valid,
          invalid,
          duplicates,
          totalRows: rawRows.length
        });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file.'));
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Generate and download a sample template (.xlsx or .csv)
 * @param {'xlsx' | 'csv'} format 
 */
export function downloadSampleTemplate(format = 'xlsx') {
  const sampleData = [
    { Name: 'Aditya Patil', Email: 'aditya.cs24@college.edu', PRN: 'PRN20240101' },
    { Name: 'Riya Sharma', Email: 'riya.it24@college.edu', PRN: 'PRN20240102' },
    { Name: 'Kunal Deshmukh', Email: 'kunal.aiml24@college.edu', PRN: 'PRN20240103' },
    { Name: 'Sneha Kulkarni', Email: 'sneha.mech24@college.edu', PRN: 'PRN20240104' },
    { Name: 'Rahul Verma', Email: 'rahul.entc24@college.edu', PRN: 'PRN20240105' }
  ];

  if (format === 'csv') {
    const csvContent = 'name,email,prn\n' + sampleData.map(r => `"${r.Name}","${r.Email}","${r.PRN}"`).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'eventpulse_closed_participants_template.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return;
  }

  // XLSX format via SheetJS
  const ws = XLSX.utils.json_to_sheet(sampleData);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Participants');
  
  // Set column widths for polished presentation
  ws['!cols'] = [{ wch: 22 }, { wch: 32 }, { wch: 18 }];
  
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'eventpulse_closed_participants_template.xlsx';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export current participant list to CSV
 * @param {Array} participants 
 * @param {string} eventTitle 
 */
export function exportParticipantsCsv(participants, eventTitle = 'event') {
  if (!participants || participants.length === 0) {
    alert('No participants to export.');
    return;
  }

  const cleanTitle = eventTitle.toLowerCase().replace(/[^a-z0-9]/g, '_').slice(0, 30);
  const rows = [
    ['Name', 'Email', 'PRN', 'Added By', 'Added At']
  ];

  participants.forEach(p => {
    rows.push([
      `"${p.name || ''}"`,
      `"${p.email || p.id || ''}"`,
      `"${p.prn || ''}"`,
      `"${p.addedBy || 'Organizer'}"`,
      `"${p.addedAt ? new Date(p.addedAt).toLocaleString() : ''}"`
    ]);
  });

  const csv = rows.map(r => r.join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${cleanTitle}_allowed_participants.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
