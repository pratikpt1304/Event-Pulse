import { applyForVolunteer } from '../services/volunteers';
import { getCurrentUser } from '../services/auth';

export function openVolunteerModal(event, onSuccess = null) {
  const user = getCurrentUser();
  const existing = document.getElementById('volunteer-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'volunteer-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 520px; padding: 1.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.45rem;">
            🙋 Volunteer for Event
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Join the core organizing team for <strong style="color: var(--primary);">${event.title}</strong>
          </div>
        </div>
        <button id="btn-close-vol-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-tertiary);">✕</button>
      </div>

      ${!user ? `
        <div style="padding: 2rem 1rem; text-align: center; background: #f8fafc; border-radius: var(--radius-md);">
          <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">🔑</div>
          <p style="font-weight: 600; margin-bottom: 1rem;">Please sign in to submit a volunteer application.</p>
          <button id="btn-vol-signin" class="btn btn-primary btn-sm">Sign In</button>
        </div>
      ` : `
        <form id="form-volunteer-apply">
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 1.25rem; font-size: 0.825rem; line-height: 1.5;">
            <div>👤 <strong>Applicant:</strong> ${user.name} (<code>${user.prn || 'N/A'}</code>)</div>
            <div>🎓 <strong>Department:</strong> ${user.department} • ${user.year} (Div ${user.division || 'A'})</div>
            <div>🎁 <strong>Perks:</strong> Official Volunteer Certificate & VIP Access</div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.95rem;">
            <div>
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Select Preferred Role *</label>
              <select id="vol-role" class="form-control" required>
                <option value="📋 Registration & QR Desk">📋 Registration & QR Check-in Desk</option>
                <option value="🎙️ Stage, AV & Anchor Support">🎙️ Stage, AV & Anchor Support</option>
                <option value="👥 Crowd Management & Hospitality">👥 Crowd Management & Hospitality</option>
                <option value="📦 Logistics & Refreshments">📦 Logistics & Refreshments</option>
                <option value="📸 Photography & Social Media">📸 Photography & Social Media</option>
                <option value="💻 Technical & Scoring Support">💻 Technical & Scoring Support</option>
              </select>
            </div>

            <div>
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">WhatsApp Mobile Number *</label>
              <input type="tel" id="vol-phone" class="form-control" placeholder="e.g. 9876543210" required />
            </div>

            <div>
              <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Why do you want to volunteer? (Optional)</label>
              <textarea id="vol-reason" class="form-control" rows="3" placeholder="Tell the organizer about your past experience or motivation..."></textarea>
            </div>

            <div id="vol-form-error" class="alert alert-danger" style="display: none; font-size: 0.8rem; padding: 0.5rem;"></div>

            <button type="submit" id="btn-submit-vol" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%; justify-content: center;">
              🚀 Submit Volunteer Application
            </button>
          </div>
        </form>
      `}
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-vol-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#btn-vol-signin')?.addEventListener('click', () => {
    close();
    window.location.hash = 'login';
  });

  modal.querySelector('#form-volunteer-apply')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.querySelector('#btn-submit-vol');
    const errEl = modal.querySelector('#vol-form-error');
    if (errEl) errEl.style.display = 'none';

    const preferredRole = modal.querySelector('#vol-role').value;
    const phone = modal.querySelector('#vol-phone').value;
    const reason = modal.querySelector('#vol-reason')?.value;

    btn.disabled = true;
    btn.textContent = 'Submitting Application...';

    try {
      const res = await applyForVolunteer({
        eventId: event.id,
        eventTitle: event.title,
        user,
        preferredRole,
        reason,
        phone
      });

      if (res && res.success) {
        alert(`🎉 Application Submitted!\nThe event organizer will review your application and contact you on WhatsApp (${phone}). You can track this in your Wallet!`);
        close();
        if (onSuccess) onSuccess();
      } else {
        btn.disabled = false;
        btn.textContent = '🚀 Submit Volunteer Application';
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = res?.error || 'Failed to submit application.';
        }
      }
    } catch (err) {
      console.error('Volunteer application error:', err);
      btn.disabled = false;
      btn.textContent = '🚀 Submit Volunteer Application';
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Network error while submitting application. Please try again.';
      }
    }
  });
}
