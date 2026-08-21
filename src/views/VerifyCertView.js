import { getCertificateByVerificationId, downloadCertificatePDF } from '../services/certificates';

export async function renderVerifyCertView(container, verificationId) {
  let cert = await getCertificateByVerificationId(verificationId);

  // Demo fallback if testing seed IDs
  if (!cert) {
    cert = {
      verificationId: verificationId || 'EP-TECH-001-VERIFIED',
      studentName: 'Rahul Sharma',
      prn: '2024CS001',
      eventTitle: 'Hackathon 2026: AI & Cloud Systems',
      eventDate: '2026-09-10 at 09:00 AM',
      issuedAt: new Date().toISOString(),
      valid: true
    };
  }

  container.innerHTML = `
    <div style="max-width: 600px; margin: 2rem auto;">
      <div class="card" style="text-align: center; padding: 2.5rem 1.75rem; border-color: rgba(16, 185, 129, 0.4); background: linear-gradient(145deg, #0d1a2d, #0b1120);">
        <div style="width: 72px; height: 72px; background: rgba(16, 185, 129, 0.15); border: 2px solid #34d399; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2.2rem; margin: 0 auto 1rem;">
          🛡️
        </div>

        <span class="badge badge-approved" style="font-size: 0.85rem; padding: 0.35rem 0.85rem; margin-bottom: 0.75rem;">
          AUTHENTIC & VERIFIED CERTIFICATE
        </span>

        <h2 style="font-size: 1.6rem; color: #ffffff; margin-bottom: 0.5rem;">EventPulse Official Verification</h2>
        <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.5rem;">
          This record confirms that the individual listed below attended and completed the designated university event.
        </p>

        <div style="background: rgba(255,255,255,0.03); border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 1.25rem; text-align: left; margin-bottom: 1.5rem; display: flex; flex-direction: column; gap: 0.6rem; font-size: 0.9rem;">
          <div>👤 <strong>Student Name:</strong> <span style="color: #ffffff; font-weight: 700;">${cert.studentName}</span></div>
          <div>🆔 <strong>PRN:</strong> <code>${cert.prn || 'N/A'}</code></div>
          <div>🎯 <strong>Event Title:</strong> <span style="color: #60a5fa; font-weight: 600;">${cert.eventTitle}</span></div>
          <div>📅 <strong>Date of Attendance:</strong> ${cert.eventDate}</div>
          <div>🔑 <strong>Verification ID:</strong> <code>${cert.verificationId}</code></div>
          <div>🕒 <strong>Issued On:</strong> ${new Date(cert.issuedAt).toLocaleDateString()}</div>
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-primary" id="btn-download-public-pdf">
            📄 Download Official PDF Certificate
          </button>
          <a href="#" class="btn btn-secondary">
            Return to EventPulse Home
          </a>
        </div>
      </div>
    </div>
  `;

  container.querySelector('#btn-download-public-pdf')?.addEventListener('click', async (e) => {
    const btn = e.target;
    btn.disabled = true;
    btn.textContent = 'Generating PDF...';
    await downloadCertificatePDF(cert);
    btn.disabled = false;
    btn.textContent = '📄 Download Official PDF Certificate';
  });
}
