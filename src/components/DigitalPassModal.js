import { getSignedPassQRToken, generateQRDataUrl } from '../services/qr';

export async function openDigitalPassModal(registration, student) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-container" style="max-width: 420px; text-align: center; padding: 1.5rem; background: #ffffff;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
        <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-tertiary); letter-spacing: 0.05em; text-transform: uppercase;">
          OFFICIAL DIGITAL PASS
        </div>
        <button class="btn btn-secondary btn-sm" id="close-modal-x" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
      </div>
      
      <div class="pass-ticket" style="background: #ffffff; border-color: var(--border-strong);">
        <div class="pass-notch-left"></div>
        <div class="pass-notch-right"></div>

        <div style="font-size: 0.75rem; font-weight: 800; color: var(--primary); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 0.25rem;">
          EVENTPULSE VERIFIED TICKET
        </div>

        <h2 style="margin: 0.5rem 0 0.25rem; font-size: 1.35rem; color: var(--text-primary);">${registration.eventTitle}</h2>
        <div style="font-size: 0.85rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
          📍 ${registration.venue} | 📅 ${registration.eventDate}
        </div>

        <div class="qr-frame" id="pass-qr-container">
          <div style="color: #64748b; font-size: 0.8rem; padding: 3.5rem 1rem;">
            Generating Secure Token...
          </div>
        </div>

        <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; align-items: center; justify-content: center; gap: 0.4rem; margin-top: 0.5rem;">
          <span style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; display: inline-block;"></span>
          Cryptographically Signed & Single-Use Enforcement
        </div>

        <div style="border-top: 1px dashed var(--border-strong); margin-top: 1.25rem; padding-top: 1rem; text-align: left; font-size: 0.85rem; color: var(--text-secondary); display: grid; grid-template-columns: 1fr 1fr; gap: 0.6rem;">
          <div><span style="color: var(--text-tertiary); display: block; font-size: 0.75rem;">STUDENT NAME</span> <strong style="color: var(--text-primary);">${student.name}</strong></div>
          <div><span style="color: var(--text-tertiary); display: block; font-size: 0.75rem;">PRN</span> <strong style="color: var(--text-primary);">${student.prn || 'N/A'}</strong></div>
          <div><span style="color: var(--text-tertiary); display: block; font-size: 0.75rem;">DEPARTMENT</span> <strong style="color: var(--text-primary);">${student.department}</strong></div>
          <div><span style="color: var(--text-tertiary); display: block; font-size: 0.75rem;">STATUS</span> <span class="badge badge-${registration.status}">${registration.status}</span></div>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <button class="btn btn-secondary btn-block" id="btn-close-pass">Close Pass View</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  // Generate QR Code dynamically
  const qrData = await getSignedPassQRToken(registration.eventId, registration.userId);
  if (qrData && qrData.token) {
    const qrDataUrl = await generateQRDataUrl(qrData.token);
    const container = overlay.querySelector('#pass-qr-container');
    if (container && qrDataUrl) {
      container.innerHTML = `<img src="${qrDataUrl}" alt="Event Pass QR Code" onerror="this.onerror=null;this.parentElement.innerHTML='<div class=\\'error-notice\\'>QR Unavailable</div>';" />`;
    }
  }

  const close = () => overlay.remove();
  overlay.querySelector('#close-modal-x')?.addEventListener('click', close);
  overlay.querySelector('#btn-close-pass')?.addEventListener('click', close);
}
