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

import { generateClientCertificatePDF } from './clientPdfService';

/**
 * Direct PDF download using pdf-lib with fallback to styled HTML print dialog
 */
export async function downloadCertificatePDF(certData) {
  const studentName = certData.studentName || certData.userName || 'Student';
  const prn = certData.prn || certData.studentPRN || '';
  const eventTitle = certData.eventTitle || certData.eventName || 'Campus Technical Event';
  const eventDate = certData.eventDate || certData.date || 'Academic Year 2025-2026';
  const verificationId = certData.verificationId || certData.id || 'SU-CERT-VERIFIED';
  const department = certData.department || 'Integrated M.Tech (AIML)';
  const organizerName = certData.organizerName || 'Department Event Cell';

  try {
    const pdfBytes = await generateClientCertificatePDF({
      studentName,
      prn,
      eventTitle,
      eventDate,
      verificationId,
      department,
      organizerName
    });

    const blob = new Blob([pdfBytes], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeTitle = eventTitle.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30);
    const safeName = studentName.replace(/[^a-zA-Z0-9]/g, '_');
    a.download = `Certificate_${safeName}_${safeTitle}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return true;
  } catch (err) {
    console.warn('Direct PDF download failed, falling back to printable HTML view:', err);
    try {
      const html = await buildCertificatePDF({
        studentName,
        prn,
        eventTitle,
        eventDate,
        verificationId
      });

      const win = window.open('', '_blank', 'width=1100,height=800,scrollbars=no');
      if (win) {
        win.document.open();
        win.document.write(html);
        win.document.close();
        return true;
      }
    } catch (e2) {
      console.error('All certificate download strategies failed:', e2);
    }
    return false;
  }
}
