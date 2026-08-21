import { fileGrievance } from '../services/complaints';
import { getCurrentUser } from '../services/auth';
import { getCachedEventsSync } from '../services/events';

export function openComplaintModal(preselectedEvent = null, onSuccess = null) {
  const user = getCurrentUser();
  const existing = document.getElementById('complaint-modal');
  if (existing) existing.remove();

  const allEvents = getCachedEventsSync() || [];

  const modal = document.createElement('div');
  modal.id = 'complaint-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 540px; padding: 1.75rem;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 1.25rem; font-weight: 800; color: #dc2626; display: flex; align-items: center; gap: 0.45rem;">
            🚨 Report Incident / File Grievance
          </div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Confidential campus event safety & grievance redressal
          </div>
        </div>
        <button id="btn-close-complaint-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-tertiary);">✕</button>
      </div>

      <form id="form-complaint-submit">
        <!-- Emergency Alert Banner -->
        <div style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); border-radius: var(--radius-sm); padding: 0.65rem 0.85rem; margin-bottom: 1.25rem; font-size: 0.775rem; color: #991b1b; line-height: 1.4;">
          ⚠️ <strong>Campus Safety Notice:</strong> For immediate medical emergencies or physical safety, visit the on-campus Helpdesk in <strong>Classroom 707 & Lab 506</strong> or contact campus security.
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.95rem;">
          <!-- Event Selector -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Related Event *</label>
            <select id="comp-event" class="form-control" required>
              ${preselectedEvent ? `
                <option value="${preselectedEvent.id}" selected>${preselectedEvent.title} (${preselectedEvent.department})</option>
              ` : `
                <option value="general_campus">General Campus Event Issue</option>
                ${allEvents.map(e => `
                  <option value="${e.id}">${e.title} (${e.department})</option>
                `).join('')}
              `}
            </select>
          </div>

          <!-- Grievance Category -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Category of Grievance *</label>
            <select id="comp-category" class="form-control" required>
              <option value="🚫 Misbehavior / Harassment / Discipline">🚫 Misbehavior / Harassment / Unfair Conduct</option>
              <option value="⚖️ Unfair Judging or Cheating">⚖️ Unfair Judging / Scoring Dispute</option>
              <option value="🎫 Pass / Registration Fraud">🎫 Pass / Registration / QR Scanning Issue</option>
              <option value="📦 Logistics / Refreshment / Facility">📦 Logistics / Refreshment / Venue Facility</option>
              <option value="⚠️ Safety & Security Hazard">⚠️ Safety & Security Hazard</option>
              <option value="❓ Other Issue">❓ Other Grievance</option>
            </select>
          </div>

          <!-- Incident Details -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Incident Description & Details *</label>
            <textarea id="comp-desc" class="form-control" rows="4" placeholder="Please clearly describe what occurred, names or roles involved, time, and location..." required></textarea>
          </div>

          <!-- Anonymous Option -->
          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem; display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.825rem; font-weight: 700; cursor: pointer; margin-bottom: 0;">
              <input type="checkbox" id="comp-anonymous" style="width: 16px; height: 16px;" />
              <span>🔒 Submit Anonymously (Hide my Name & PRN)</span>
            </label>
            <div style="font-size: 0.75rem; color: var(--text-secondary); margin-left: 1.5rem;">
              Your identity will not be shared with organizers. Only university disciplinary authorities can review the incident report.
            </div>
          </div>

          <!-- Optional Phone for Followup -->
          <div id="phone-group">
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Optional Contact Number (For Resolution Updates)</label>
            <input type="tel" id="comp-phone" class="form-control" placeholder="e.g. 9876543210 (Optional)" />
          </div>

          <div id="comp-form-error" class="alert alert-danger" style="display: none; font-size: 0.8rem; padding: 0.5rem;"></div>

          <button type="submit" id="btn-submit-comp" class="btn" style="background: #dc2626; color: #ffffff; border: none; font-weight: 800; width: 100%; justify-content: center; padding: 0.75rem; margin-top: 0.5rem; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.3);">
            🚨 Submit Confidential Grievance
          </button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => modal.remove();
  modal.querySelector('#btn-close-complaint-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

  modal.querySelector('#form-complaint-submit')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.querySelector('#btn-submit-comp');
    const errEl = modal.querySelector('#comp-form-error');
    if (errEl) errEl.style.display = 'none';

    const eventSelect = modal.querySelector('#comp-event');
    const eventId = eventSelect.value;
    const eventTitle = eventSelect.options[eventSelect.selectedIndex].text;
    const category = modal.querySelector('#comp-category').value;
    const description = modal.querySelector('#comp-desc').value;
    const isAnonymous = modal.querySelector('#comp-anonymous').checked;
    const contactPhone = modal.querySelector('#comp-phone').value;

    btn.disabled = true;
    btn.textContent = 'Submitting Confidential Report...';

    const res = await fileGrievance({
      eventId,
      eventTitle,
      category,
      description,
      isAnonymous,
      user,
      contactPhone
    });

    if (res.success) {
      close();
      openGrievanceSuccessModal(res.ticketId, () => {
        if (onSuccess) onSuccess(res.ticketId);
      });
    } else {
      btn.disabled = false;
      btn.textContent = '🚨 Submit Confidential Grievance';
      if (errEl) {
        errEl.style.display = 'block';
        errEl.textContent = 'Failed to submit grievance. Please try again.';
      }
    }
  });
}

/**
 * Custom Interactive Success Modal with 1-Click Copy
 */
export function openGrievanceSuccessModal(ticketId, onFinish = null) {
  const existing = document.getElementById('grievance-success-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'grievance-success-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '10000';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 480px; padding: 2rem 1.75rem; text-align: center; background: #ffffff; border-radius: var(--radius-lg); box-shadow: 0 20px 40px -10px rgba(0,0,0,0.3);">
      <div style="width: 64px; height: 64px; border-radius: 50%; background: #ecfdf5; border: 2px solid #86efac; color: #16a34a; font-size: 2rem; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
        🛡️
      </div>

      <h2 style="font-size: 1.4rem; font-weight: 800; color: #0f172a; margin-bottom: 0.35rem;">
        Grievance Filed Confidentially!
      </h2>
      <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.45;">
        Your incident report has been securely registered with the Campus Disciplinary & Safety Committee.
      </p>

      <!-- Ticket Box with Copy Button -->
      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: var(--radius-md); padding: 1.25rem; margin-bottom: 1.5rem; position: relative;">
        <div style="font-size: 0.725rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 0.5rem;">
          Your Reference Ticket Code
        </div>
        <div style="font-family: monospace; font-size: 1.5rem; font-weight: 900; color: #0f172a; letter-spacing: 0.08em; user-select: all; margin-bottom: 0.75rem;">
          ${ticketId}
        </div>
        
        <button id="btn-copy-ticket-code" class="btn btn-primary btn-sm" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; font-size: 0.825rem; padding: 0.45rem 1.1rem; border-radius: var(--radius-full); box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);">
          📋 Copy Ticket Code
        </button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.6rem;">
        <button id="btn-view-my-grievance" class="btn btn-secondary btn-sm" style="width: 100%; justify-content: center; padding: 0.65rem; font-weight: 700; background: #f1f5f9; border-color: #cbd5e1; color: #1e293b;">
          📊 Track Status in My Grievances
        </button>
        <button id="btn-done-success-modal" style="background: none; border: none; font-size: 0.85rem; color: #64748b; cursor: pointer; padding: 0.4rem; font-weight: 600;">
          Close
        </button>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    if (onFinish) onFinish();
  };

  const copyBtn = modal.querySelector('#btn-copy-ticket-code');
  copyBtn?.addEventListener('click', async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(ticketId);
      } else {
        const temp = document.createElement('input');
        temp.value = ticketId;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      copyBtn.innerHTML = '✅ Copied to Clipboard!';
      copyBtn.style.background = '#16a34a';
      setTimeout(() => {
        if (copyBtn) {
          copyBtn.innerHTML = '📋 Copy Ticket Code';
          copyBtn.style.background = '';
        }
      }, 2500);
    } catch (e) {
      alert(`Ticket ID: ${ticketId}`);
    }
  });

  modal.querySelector('#btn-view-my-grievance')?.addEventListener('click', () => {
    close();
    window.location.hash = '#my-passes';
  });

  modal.querySelector('#btn-done-success-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
}
