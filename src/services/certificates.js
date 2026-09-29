import { db } from '../firebase';
import { collection, doc, getDoc, getDocs, query, where } from 'firebase/firestore';
import { buildCertificatePDF } from './pdfGenerator';

export function getCachedCertificatesSync(userId) {
  try {
    const raw = localStorage.getItem(`ep_cached_certs_${userId}`);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return [];
}

/**
 * Fetch all certificates earned by a student (Cache-First)
 */
export async function getStudentCertificates(userId) {
  try {
    const q = query(
      collection(db, 'certificates'),
      where('userId', '==', userId)
    );
    const snap = await getDocs(q);
    if (snap && !snap.empty) {
      const fetched = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      try {
        localStorage.setItem(`ep_cached_certs_${userId}`, JSON.stringify(fetched));
      } catch (e) {}
      return fetched;
    }
  } catch (e) {
    console.warn('Certificate query fallback:', e.message);
  }
  return getCachedCertificatesSync(userId);
}

/**
 * Fetch all certificates across the university/school (Dean/VC/Admin View)
 */
export async function getAllCertificates() {
  try {
    const snap = await Promise.race([
      getDocs(collection(db, 'certificates')),
      new Promise(res => setTimeout(() => res(null), 3500))
    ]);
    if (snap && snap.docs) {
      return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }
  } catch (e) {
    console.warn('getAllCertificates fallback:', e.message);
  }
  return [];
}

/**
 * Public lookup for Certificate Verification Page (No login required)
 */
export async function getCertificateByVerificationId(verificationId) {
  try {
    const d = await getDoc(doc(db, 'certificates', verificationId));
    if (d.exists()) {
      return { id: d.id, ...d.data(), valid: true };
    }
  } catch (e) {}
  return null;
}

/**
 * Open styled HTML certificate in a new window — user can Save as PDF via Print dialog
 */
export async function downloadCertificatePDF(certData) {
  // Build the styled HTML certificate
  const html = await buildCertificatePDF({
    studentName: certData.studentName || certData.userName || 'Student',
    prn: certData.prn || certData.studentPRN || '',
    eventTitle: certData.eventTitle || certData.eventName || 'Event',
    eventDate: certData.eventDate || certData.date || '',
    verificationId: certData.verificationId || certData.id
  });

  // Open in a new window and trigger print dialog
  const win = window.open('', '_blank', 'width=1100,height=800,scrollbars=no');
  if (!win) {
    alert('Pop-up blocked! Please allow pop-ups for this site to download the certificate.');
    return false;
  }
  win.document.open();
  win.document.write(html);
  win.document.close();
  return true;
}
