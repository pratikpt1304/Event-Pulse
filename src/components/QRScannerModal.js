import { Html5QrcodeScanner } from 'html5-qrcode';
import { submitScannedQRToken } from '../services/qr';

export function openQRScannerModal(scannerUser, onAttendanceSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-container" style="max-width: 480px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <div>
          <h3 style="font-size: 1.25rem; color: #ffffff;">📷 Scan Student Digital Pass</h3>
          <p style="font-size: 0.8rem; color: var(--text-tertiary);">Align student pass QR code within the viewfinder</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="close-scanner-x" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
      </div>

      <div id="qr-reader" style="width: 100%; border-radius: var(--radius-md); overflow: hidden; background: #000; border: 1px solid var(--border-strong);"></div>

      <div id="scan-result-card" style="margin-top: 1.25rem; display: none;"></div>

      <!-- Quick Manual Token Simulator for Dev/Testing -->
      <div style="margin-top: 1.25rem; border-top: 1px solid var(--border-subtle); padding-top: 1rem;">
        <label style="font-size: 0.775rem; color: var(--text-tertiary); font-weight: 600;">Manual Token Verification Test (For testing without camera):</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.4rem;">
          <input type="text" id="manual-token-input" class="form-control" placeholder="Paste Base64 QR Token..." style="font-size: 0.8rem;" />
          <button class="btn btn-primary btn-sm" id="btn-submit-manual-token">Verify Token</button>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <button class="btn btn-secondary btn-block" id="btn-close-scanner">Close Scanner</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const resultCard = overlay.querySelector('#scan-result-card');

  const handleScanToken = async (decodedText) => {
    resultCard.style.display = 'block';
    resultCard.innerHTML = `<div class="card" style="text-align: center; color: var(--text-secondary);">Verifying HMAC signature with Cloud Function...</div>`;

    const res = await submitScannedQRToken(decodedText, scannerUser);

    if (res.success) {
      resultCard.innerHTML = `
        <div class="card" style="border-color: var(--emerald); background: var(--emerald-light);">
          <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.5rem;">
            <div style="width: 40px; height: 40px; background: var(--emerald); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #fff;">✓</div>
            <div>
              <h3 style="color: #34d399; font-size: 1.1rem; margin: 0;">Attendance Marked!</h3>
              <span style="font-size: 0.8rem; color: var(--text-secondary);">${new Date(res.checkInTime).toLocaleTimeString()}</span>
            </div>
          </div>

          <div style="font-size: 1.15rem; font-weight: 700; color: #ffffff; margin-top: 0.5rem;">${res.studentName}</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary);">PRN: <code>${res.prn || 'N/A'}</code></div>
          
          <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.1); padding-top: 0.5rem;">
            Certificate Issued: <code>${res.verificationId}</code>
          </div>
        </div>
      `;
      if (onAttendanceSuccess) onAttendanceSuccess(res);
    } else if (res.code === 'ALREADY_CHECKED_IN') {
      resultCard.innerHTML = `
        <div class="card" style="border-color: var(--amber); background: var(--amber-light);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; background: var(--amber); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #fff;">⚠️</div>
            <div>
              <h3 style="color: #fbbf24; font-size: 1.1rem; margin: 0;">Already Checked In</h3>
              <p style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.2rem;">${res.message}</p>
            </div>
          </div>
        </div>
      `;
    } else {
      resultCard.innerHTML = `
        <div class="card" style="border-color: var(--rose); background: var(--rose-light);">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="width: 40px; height: 40px; background: var(--rose); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.2rem; color: #fff;">✕</div>
            <div>
              <h3 style="color: #f87171; font-size: 1.1rem; margin: 0;">Verification Failed</h3>
              <p style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.2rem;">${res.message}</p>
            </div>
          </div>
        </div>
      `;
    }
  };

  // Initialize camera scanner
  let html5QrcodeScanner = null;
  try {
    html5QrcodeScanner = new Html5QrcodeScanner("qr-reader", { fps: 10, qrbox: { width: 240, height: 240 } }, false);
    html5QrcodeScanner.render((decodedText) => {
      handleScanToken(decodedText);
    }, (error) => {});
  } catch (err) {
    console.warn('Camera scanner fallback:', err);
  }

  overlay.querySelector('#btn-submit-manual-token')?.addEventListener('click', () => {
    const val = overlay.querySelector('#manual-token-input')?.value.trim();
    if (val) handleScanToken(val);
  });

  const cleanup = () => {
    if (html5QrcodeScanner) {
      try { html5QrcodeScanner.clear(); } catch (e) {}
    }
    overlay.remove();
  };

  overlay.querySelector('#close-scanner-x')?.addEventListener('click', cleanup);
  overlay.querySelector('#btn-close-scanner')?.addEventListener('click', cleanup);
}
