import { updateUserProfile, getCurrentUser } from '../services/auth';
import { openComplaintModal, openGrievanceSuccessModal } from './ComplaintModal';
import { fileGrievance } from '../services/complaints';

/**
 * Modal to Edit Student Profile
 */
export function openEditProfileModal(user, onUpdated) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-container" style="max-width: 460px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <h3 style="font-size: 1.25rem;">👤 Edit Student Profile</h3>
        <button class="btn btn-secondary btn-sm" id="close-profile-x" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
      </div>

      <form id="edit-profile-form">
        <div class="form-group">
          <label>Full Name</label>
          <input type="text" id="edit-name" class="form-control" value="${user.name || ''}" required />
        </div>

        <div class="form-group">
          <label>PRN / Student ID (Read Only)</label>
          <input type="text" class="form-control" value="${user.prn || 'N/A'}" disabled style="opacity: 0.6; background: rgba(255,255,255,0.05);" />
        </div>

        <div class="form-group">
          <label>Department</label>
          <select id="edit-dept" class="form-control" required>
            <option value="Computer Science & Engineering" ${user.department === 'Computer Science & Engineering' ? 'selected' : ''}>Computer Science & Engineering</option>
            <option value="Information Technology" ${user.department === 'Information Technology' ? 'selected' : ''}>Information Technology</option>
            <option value="AIML" ${user.department === 'AIML' ? 'selected' : ''}>AI & Machine Learning (AIML)</option>
            <option value="AIDS" ${user.department === 'AIDS' ? 'selected' : ''}>AI & Data Science (AIDS)</option>
            <option value="Cyber Security" ${user.department === 'Cyber Security' ? 'selected' : ''}>Cyber Security</option>
            <option value="IMtech" ${user.department === 'IMtech' ? 'selected' : ''}>Integrated M.Tech (IMtech)</option>
            <option value="Robotics & Automation" ${user.department === 'Robotics & Automation' ? 'selected' : ''}>Robotics & Automation</option>
            <option value="Mechanical Engineering" ${user.department === 'Mechanical Engineering' ? 'selected' : ''}>Mechanical Engineering</option>
            <option value="Civil Engineering" ${user.department === 'Civil Engineering' ? 'selected' : ''}>Civil Engineering</option>
          </select>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Academic Year</label>
            <select id="edit-year" class="form-control" required>
              <option value="1st Year" ${user.year === '1st Year' ? 'selected' : ''}>1st Year</option>
              <option value="2nd Year" ${user.year === '2nd Year' ? 'selected' : ''}>2nd Year</option>
              <option value="3rd Year" ${user.year === '3rd Year' ? 'selected' : ''}>3rd Year</option>
              <option value="4th Year" ${user.year === '4th Year' ? 'selected' : ''}>4th Year</option>
            </select>
          </div>
          <div class="form-group">
            <label>Division</label>
            <input type="text" id="edit-div" class="form-control" value="${user.division || 'A'}" required />
          </div>
        </div>

        <div style="margin-top: 1.5rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-profile">Cancel</button>
          <button type="submit" class="btn btn-primary" id="btn-save-profile">Save Changes</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-profile-x')?.addEventListener('click', close);
  overlay.querySelector('#btn-cancel-profile')?.addEventListener('click', close);

  overlay.querySelector('#edit-profile-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = overlay.querySelector('#edit-name').value.trim();
    const department = overlay.querySelector('#edit-dept').value;
    const year = overlay.querySelector('#edit-year').value;
    const division = overlay.querySelector('#edit-div').value.trim();

    const saveBtn = overlay.querySelector('#btn-save-profile');
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';

    const res = await updateUserProfile({ name, department, year, division });
    if (res.success) {
      close();
      if (onUpdated) onUpdated();
    } else {
      alert('Error updating profile: ' + res.error);
      saveBtn.disabled = false;
      saveBtn.textContent = 'Save Changes';
    }
  });
}

/**
 * Modal for Helpdesk & Support
 */
export function openHelpDeskModal() {
  const currentUser = getCurrentUser();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-container" style="max-width: 500px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
        <div>
          <h3 style="font-size: 1.25rem;">🎧 EventPulse Helpdesk & Support</h3>
          <p style="font-size: 0.8rem; color: var(--text-tertiary);">University Event Support Office</p>
        </div>
        <button class="btn btn-secondary btn-sm" id="close-help-x" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
      </div>

      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: var(--primary-light); border: 1px solid var(--primary); padding: 1rem; border-radius: var(--radius-sm);">
          <div style="font-weight: 700; color: var(--primary); font-size: 0.9rem; margin-bottom: 0.25rem;">📍 Student Event Desk Contact</div>
          <div style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
            Email: <strong>eventpulsesupport@gmail.com</strong><br/>
            Office: <strong>Main Building ,Sanjivani University , Classroom No.707 and Lab No. 506</strong><br/>
            Hours: <strong>Mon–Fri, 8:00 AM – 7:00 PM</strong>
          </div>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">❓ Frequently Asked Questions</h4>
          
          <details style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">How do I get my Digital QR Pass?</summary>
            <p style="margin-top: 0.35rem; padding-left: 0.5rem;">Once the event organizer approves your registration, your pass will appear under <strong>My Passes & Certs</strong> with a live signed QR code.</p>
          </details>

          <details style="margin-bottom: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">
            <summary style="cursor: pointer; font-weight: 600; color: var(--text-primary);">How are certificates verified?</summary>
            <p style="margin-top: 0.35rem; padding-left: 0.5rem;">Upon check-in scan, an official certificate with a unique <code>EP-XXXX-XXXX</code> ID is generated and publicly verifiable at <code>/#verify/YOUR_ID</code>.</p>
          </details>
        </div>

        <!-- Grievance Redressal Banner -->
        <div style="background: rgba(220, 38, 38, 0.08); border: 1px solid rgba(220, 38, 38, 0.25); padding: 0.85rem; border-radius: var(--radius-sm); display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <div>
            <div style="font-weight: 700; color: #dc2626; font-size: 0.85rem;">🚨 Event Grievance or Misbehavior?</div>
            <div style="font-size: 0.75rem; color: var(--text-secondary);">Report misconduct or safety concerns confidentially.</div>
          </div>
          <button type="button" class="btn btn-sm" id="btn-open-grievance" style="background: #dc2626; color: #fff; border: none; font-size: 0.75rem; font-weight: 700; white-space: nowrap;">
            Report Incident
          </button>
        </div>

        <div style="border-top: 1px solid var(--border-subtle); padding-top: 0.75rem;">
          <h4 style="font-size: 0.95rem; margin-bottom: 0.5rem;">💬 Send Support Message</h4>
          <form id="helpdesk-form">
            ${currentUser ? `
              <div style="font-size: 0.775rem; color: #475569; background: #f1f5f9; padding: 0.45rem 0.75rem; border-radius: var(--radius-sm); margin-bottom: 0.75rem; display: flex; justify-content: space-between; align-items: center;">
                <span>👤 Submitting as: <strong>${currentUser.name || currentUser.displayName || currentUser.email}</strong></span>
                <span style="color: #64748b;">${currentUser.prn ? `PRN: ${currentUser.prn}` : currentUser.department || ''}</span>
              </div>
            ` : `
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.65rem;">
                <input type="text" id="help-guest-name" class="form-control form-control-sm" placeholder="Your Full Name" required />
                <input type="text" id="help-guest-contact" class="form-control form-control-sm" placeholder="PRN or Email ID" required />
              </div>
            `}

            <div class="form-group" style="margin-bottom: 0.65rem;">
              <textarea id="help-msg" class="form-control" rows="3" placeholder="Describe your query or event pass issue in detail..." required></textarea>
            </div>

            <div class="form-group" style="margin-bottom: 0.75rem;">
              <input type="tel" id="help-phone" class="form-control form-control-sm" placeholder="WhatsApp / Callback Phone (Optional)" value="${currentUser?.phone || ''}" />
            </div>

            <button type="submit" class="btn btn-primary btn-sm btn-block" style="font-weight: 800;">🚀 Submit Ticket to Helpdesk</button>
          </form>
        </div>
      </div>

      <div style="margin-top: 1.25rem;">
        <button class="btn btn-secondary btn-block" id="btn-close-help">Close Helpdesk</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-help-x')?.addEventListener('click', close);
  overlay.querySelector('#btn-close-help')?.addEventListener('click', close);

  overlay.querySelector('#btn-open-grievance')?.addEventListener('click', () => {
    close();
    openComplaintModal();
  });

  overlay.querySelector('#helpdesk-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = overlay.querySelector('#helpdesk-form button[type="submit"]');
    const msg = overlay.querySelector('#help-msg').value.trim();
    const phone = (overlay.querySelector('#help-phone')?.value || '').trim();
    if (!msg) return;

    btn.disabled = true;
    btn.textContent = 'Submitting Support Ticket...';

    let sender = currentUser;
    if (!sender) {
      const guestName = overlay.querySelector('#help-guest-name')?.value.trim() || 'Student';
      const guestContact = overlay.querySelector('#help-guest-contact')?.value.trim() || 'N/A';
      sender = {
        uid: 'guest_' + Date.now(),
        name: guestName,
        displayName: guestName,
        email: guestContact.includes('@') ? guestContact : 'N/A',
        prn: guestContact.includes('@') ? 'N/A' : guestContact,
        department: 'General',
        phone: phone
      };
    }

    const res = await fileGrievance({
      eventId: 'helpdesk_query',
      eventTitle: '🎧 Helpdesk & General Campus Support',
      category: '💬 Helpdesk & Student Support',
      description: msg,
      isAnonymous: false,
      user: sender,
      contactPhone: phone || sender?.phone || ''
    });

    close();
    if (res && res.ticketId) {
      openGrievanceSuccessModal(res.ticketId);
    } else {
      alert('📩 Support ticket submitted! A coordinator will review your query.');
    }
  });
}
