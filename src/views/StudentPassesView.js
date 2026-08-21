import { getCurrentUser } from '../services/auth';
import { getStudentRegistrations, getCachedRegistrationsSync, deleteStudentRegistration } from '../services/registrations';
import { getStudentCertificates, getCachedCertificatesSync, downloadCertificatePDF } from '../services/certificates';
import { getStudentVolunteering, getCachedVolunteersSync, deleteVolunteerApplication } from '../services/volunteers';
import { getStudentComplaints, getCachedStudentComplaintsSync, recordMyTicketId, deleteComplaint } from '../services/complaints';
import { openDigitalPassModal } from '../components/DigitalPassModal';
import { openComplaintModal } from '../components/ComplaintModal';

export async function renderStudentPassesView(container, navigateTo) {
  const user = getCurrentUser();
  if (!user) {
    navigateTo('login');
    return;
  }

  const hash = (window.location.hash || '').toLowerCase();
  let activeTab = 'passes'; // 'passes' | 'certs' | 'volunteering' | 'grievances'
  if (hash.includes('grievance') || hash.includes('support') || hash.includes('ticket')) {
    activeTab = 'grievances';
  } else if (hash.includes('cert')) {
    activeTab = 'certs';
  } else if (hash.includes('volunt')) {
    activeTab = 'volunteering';
  }
  
  // Instant Cache-First Load (0ms delay)
  let registrations = getCachedRegistrationsSync(user.uid) || [];
  let certificates = getCachedCertificatesSync(user.uid) || [];
  let volunteering = getCachedVolunteersSync(user.uid) || [];
  let complaints = getCachedStudentComplaintsSync(user) || [];

  const render = () => {
    container.innerHTML = `
      <div style="max-width: 900px; margin: 0 auto;">
        <div style="margin-bottom: 1.25rem;">
          <button class="btn btn-secondary btn-sm" id="btn-back-home" style="display: inline-flex; align-items: center; gap: 0.4rem; border-radius: var(--radius-full);">
            ← Back to Campus Events
          </button>
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h1 style="font-size: 1.75rem;">My Passes & Student Dossier</h1>
            <p style="color: var(--text-secondary); font-size: 0.9rem;">View your active event passes, earned certificates, volunteering, and grievance resolution status</p>
          </div>

          <!-- Quadruple Tab Controls -->
          <div style="display: flex; background: var(--bg-surface-elevated); padding: 0.25rem; border-radius: var(--radius-md); border: 1px solid var(--border-subtle); flex-wrap: wrap; gap: 0.25rem;">
            <button class="btn btn-sm ${activeTab === 'passes' ? 'btn-primary' : 'btn-secondary'}" id="tab-passes-btn" style="border: none;">
              🎫 Passes (${registrations.length})
            </button>
            <button class="btn btn-sm ${activeTab === 'certs' ? 'btn-primary' : 'btn-secondary'}" id="tab-certs-btn" style="border: none;">
              🏆 Certificates (${certificates.length})
            </button>
            <button class="btn btn-sm ${activeTab === 'volunteering' ? 'btn-primary' : 'btn-secondary'}" id="tab-vol-btn" style="border: none;">
              🙋 Volunteering (${volunteering.length})
            </button>
            <button class="btn btn-sm ${activeTab === 'grievances' ? 'btn-primary' : 'btn-secondary'}" id="tab-grievances-btn" style="border: none; background: ${activeTab === 'grievances' ? '#dc2626' : 'transparent'}; color: ${activeTab === 'grievances' ? '#ffffff' : 'inherit'};">
              🚨 My Grievances (${complaints.length})
            </button>
          </div>
        </div>

        ${activeTab === 'passes' ? `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${registrations.length === 0 ? `
              <div class="card" style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎫</div>
                <h3>No Registrations Yet</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">Browse approved events to register and get your digital pass!</p>
                <button class="btn btn-primary btn-sm" id="btn-goto-events" style="margin-top: 1rem;">Discover Events</button>
              </div>
            ` : registrations.map(r => `
              <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <span class="badge badge-${r.status}">${r.status}</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Reg ID: ${r.id}</span>
                  </div>
                  <h3 style="font-size: 1.15rem; color: var(--text-primary);">${r.eventTitle}</h3>
                  <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    📍 ${r.venue || 'Campus Main Venue'} | 📅 Registered on ${new Date(r.registeredAt).toLocaleDateString()}
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  ${(r.status === 'approved' || r.status === 'attended') ? `
                    <button class="btn btn-primary btn-sm btn-view-pass" data-reg-id="${r.id}">
                      🎟️ View Digital Pass
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm" disabled style="opacity: 0.7;">
                      ⏳ Pending Approval
                    </button>
                  `}
                  <button class="btn btn-sm btn-delete-registration" data-reg-id="${r.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); cursor: pointer;" title="Cancel registration and delete pass">
                    🗑️ Cancel Pass
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : (activeTab === 'certs' ? `
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${certificates.length === 0 ? `
              <div class="card" style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📜</div>
                <h3>No Certificates Earned Yet</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">Attend registered events to receive your official cryptographically verified PDF certificate.</p>
              </div>
            ` : certificates.map(c => `
              <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-left: 4px solid var(--emerald);">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                    <span class="badge badge-approved">VERIFIED CERTIFICATE</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary); font-family: monospace;">${c.id}</span>
                  </div>
                  <h3 style="font-size: 1.15rem; color: var(--text-primary);">${c.eventTitle}</h3>
                  <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    🎓 Issued to <strong>${c.studentName}</strong> on ${new Date(c.issuedAt).toLocaleDateString()}
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem;">
                  <button class="btn btn-primary btn-sm btn-download-cert" data-cert-id="${c.id}">
                    📥 Download PDF
                  </button>
                  <a class="btn btn-secondary btn-sm" href="#verify/${c.id}" target="_blank">
                    🔗 Verify Link
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        ` : (activeTab === 'volunteering' ? `
          <!-- Volunteering Applications Tab -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${volunteering.length === 0 ? `
              <div class="card" style="text-align: center; padding: 3rem 1rem;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🙋</div>
                <h3>No Volunteering Applications</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">Volunteer for upcoming campus hackathons and sports events to earn certificates & leadership experience!</p>
                <button class="btn btn-primary btn-sm" id="btn-goto-events-vol" style="margin-top: 1rem;">Browse Events</button>
              </div>
            ` : volunteering.map(v => `
              <div class="card" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; border-left: 4px solid #a855f7;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                    <span class="badge badge-${v.status === 'accepted' ? 'approved' : (v.status === 'completed' ? 'attended' : (v.status === 'rejected' ? 'rejected' : 'pending'))}">
                      VOLUNTEER: ${(v.status || 'pending').toUpperCase()}
                    </span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Role: <strong>${v.preferredRole}</strong></span>
                  </div>
                  <h3 style="font-size: 1.15rem; color: var(--text-primary); margin: 0.2rem 0;">${v.eventTitle}</h3>
                  <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.25rem;">
                    📅 Applied on ${new Date(v.appliedAt).toLocaleDateString()} | 🎁 Perk: Official Volunteer Certificate
                  </div>
                </div>

                <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                  ${v.status === 'accepted' ? `
                    <span style="background: rgba(34, 197, 94, 0.12); color: #15803d; border: 1px solid rgba(34, 197, 94, 0.3); padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700;">
                      🎉 Accepted into Crew
                    </span>
                  ` : (v.status === 'completed' ? `
                    <span style="background: rgba(59, 130, 246, 0.12); color: #1d4ed8; border: 1px solid rgba(59, 130, 246, 0.3); padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700;">
                      ✅ Duty Completed
                    </span>
                  ` : (v.status === 'rejected' ? `
                    <span style="background: rgba(239, 68, 68, 0.12); color: #b91c1c; border: 1px solid rgba(239, 68, 68, 0.3); padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700;">
                      ❌ Application Rejected
                    </span>
                  ` : `
                    <span style="background: rgba(234, 179, 8, 0.12); color: #a16207; border: 1px solid rgba(234, 179, 8, 0.3); padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 700;">
                      ⏳ Under Organizer Review
                    </span>
                  `))}

                  <button class="btn btn-secondary btn-sm btn-withdraw-vol" data-vol-id="${v.id}" style="color: #dc2626; border-color: #fca5a5; background: #fff5f5; font-size: 0.725rem; font-weight: 700; padding: 0.3rem 0.65rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.25rem; cursor: pointer;" title="Withdraw volunteer application">
                    🗑️ Withdraw
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : `
          <!-- TAB 4: MY GRIEVANCES & RESOLUTION STATUS -->
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div style="font-size: 0.85rem; color: var(--text-secondary);">
                Track real-time progress and official resolution notes from the University Disciplinary Committee.
              </div>
              <button class="btn btn-sm" id="btn-file-new-grievance" style="background: #dc2626; color: #ffffff; border: none; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: var(--radius-full); padding: 0.35rem 0.85rem;">
                🚨 File New Grievance
              </button>
            </div>

            <!-- Reference Ticket ID Auto-Link Bar -->
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.65rem 0.95rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; flex-wrap: wrap;">
              <div style="font-size: 0.825rem; color: var(--text-secondary); display: flex; align-items: center; gap: 0.4rem;">
                <span>🔒</span>
                <span>Submitted anonymously or on another device? Enter your Reference Ticket ID:</span>
              </div>
              <div style="display: flex; gap: 0.4rem; align-items: center;">
                <input type="text" id="input-track-ticket-id" class="form-control form-control-sm" placeholder="e.g. GRV-DE4D83" style="width: 155px; font-family: monospace; font-size: 0.82rem; font-weight: 700; text-transform: uppercase;" />
                <button class="btn btn-secondary btn-sm" id="btn-do-track-ticket" style="font-size: 0.775rem; padding: 0.3rem 0.75rem; font-weight: 700;">
                  🔍 Link Ticket
                </button>
              </div>
            </div>

            ${complaints.length === 0 ? `
              <div class="card" style="text-align: center; padding: 3.5rem 1.5rem; background: #ffffff;">
                <div style="font-size: 2.75rem; margin-bottom: 0.5rem;">🛡️</div>
                <h3 style="color: var(--text-primary); margin-bottom: 0.35rem;">No Grievance Reports Filed</h3>
                <p style="color: var(--text-secondary); font-size: 0.9rem; max-width: 500px; margin: 0 auto 1.25rem;">
                  If you encounter unfair judging, cheating, pass issues, or safety concerns during campus events, you can submit a confidential report here.
                </p>
                <button class="btn btn-sm" id="btn-file-first-grievance" style="background: #dc2626; color: #ffffff; border: none; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: var(--radius-full); box-shadow: 0 4px 12px rgba(220, 38, 38, 0.25);">
                  🚨 File Incident Grievance
                </button>
              </div>
            ` : complaints.map(c => `
              <div class="card" style="background: #ffffff; border-left: 4.5px solid ${c.status === 'resolved' ? '#16a34a' : '#eab308'}; padding: 1.25rem; display: flex; flex-direction: column; gap: 0.85rem; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.75rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span style="font-family: monospace; font-weight: 800; font-size: 0.8rem; background: #0f172a; color: #ffffff; padding: 0.2rem 0.55rem; border-radius: 4px;">
                      ${c.ticketId || c.id}
                    </span>
                    <span style="font-size: 0.8rem; font-weight: 700; color: #dc2626; background: #fee2e2; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                      ${c.category}
                    </span>
                    ${c.isAnonymous ? `
                      <span style="font-size: 0.75rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); border: 1px solid #cbd5e1;">
                        🔒 Anonymous Report
                      </span>
                    ` : ''}
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
                    <span style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; padding: 0.25rem 0.75rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.35rem; ${c.status === 'resolved' ? 'background: #dcfce7; color: #15803d; border: 1.5px solid #86efac;' : 'background: #fef9c3; color: #854d0e; border: 1.5px solid #fde047;'}">
                      ${c.status === 'resolved' ? '✅ Solved / Resolved' : '⏳ Under Investigation'}
                    </span>
                    <button class="btn btn-secondary btn-sm btn-student-delete-complaint" data-id="${c.ticketId || c.id}" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; color: #dc2626; border: 1.5px solid #fca5a5; background: #fef2f2; border-radius: var(--radius-full); cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="Delete & Withdraw this grievance report">
                      🗑️ Delete
                    </button>
                  </div>
                </div>

                <div>
                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
                    📍 Event: <strong>${c.eventTitle || 'Campus General Issue'}</strong>
                  </div>
                  <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: #334155; line-height: 1.5;">
                    "${c.description}"
                  </div>
                </div>

                <!-- Admin Official Resolution Box (When Solved) -->
                ${c.status === 'resolved' ? `
                  <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: var(--radius-sm); padding: 0.75rem 1rem; display: flex; align-items: flex-start; gap: 0.6rem;">
                    <div style="font-size: 1.25rem;">🏛️</div>
                    <div style="flex: 1;">
                      <div style="font-size: 0.825rem; font-weight: 800; color: #166534;">
                        Official Administration Action:
                      </div>
                      <div style="font-size: 0.825rem; color: #15803d; margin-top: 0.15rem;">
                        ${c.resolutionNote || 'This matter has been reviewed and concluded by the University Disciplinary & Safety Committee.'}
                      </div>
                    </div>
                  </div>
                ` : `
                  <div style="font-size: 0.775rem; color: #854d0e; background: #fffbeb; border: 1px solid #fef08a; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); display: flex; align-items: center; gap: 0.4rem;">
                    <span>⏳</span>
                    <span>Your incident report is currently under review with Campus Disciplinary Authorities. Resolution updates will appear here.</span>
                  </div>
                `}

                <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem; border-top: 1px dashed #e2e8f0; padding-top: 0.5rem; margin-top: 0.2rem;">
                  <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    <span>📅 Submitted on: <strong>${new Date(c.createdAt).toLocaleString()}</strong></span>
                    ${c.contactPhone ? `<span style="color: #047857;">📞 Contact: ${c.contactPhone}</span>` : ''}
                  </div>
                  <button class="btn btn-secondary btn-sm btn-student-delete-complaint" data-id="${c.ticketId || c.id}" style="font-size: 0.725rem; padding: 0.2rem 0.55rem; color: #dc2626; border-color: #fca5a5; background: #fff5f5;" title="Withdraw this report">
                    🗑️ Withdraw Report
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        `))}
      </div>
    `;

    // Event Handlers
    container.querySelector('#btn-back-home')?.addEventListener('click', () => navigateTo('events'));
    container.querySelector('#tab-passes-btn')?.addEventListener('click', () => { activeTab = 'passes'; render(); });
    container.querySelector('#tab-certs-btn')?.addEventListener('click', () => { activeTab = 'certs'; render(); });
    container.querySelector('#tab-vol-btn')?.addEventListener('click', () => { activeTab = 'volunteering'; render(); });
    container.querySelector('#tab-grievances-btn')?.addEventListener('click', () => { activeTab = 'grievances'; render(); });
    container.querySelector('#btn-goto-events')?.addEventListener('click', () => navigateTo('events'));
    container.querySelector('#btn-goto-events-vol')?.addEventListener('click', () => navigateTo('events'));

    // Cancel / Delete Registration Pass
    container.querySelectorAll('.btn-delete-registration').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const regId = e.currentTarget.getAttribute('data-reg-id');
        const target = registrations.find(r => r.id === regId);
        const title = target ? target.eventTitle : 'this event';
        if (confirm(`Are you sure you want to cancel your pass/registration for "${title}"?`)) {
          btn.disabled = true;
          btn.textContent = 'Cancelling...';
          await deleteStudentRegistration(regId, user.uid);
          registrations = await getStudentRegistrations(user.uid);
          render();
        }
      });
    });

    const handleFileGrievance = () => {
      openComplaintModal(null, async () => {
        complaints = await getStudentComplaints(user);
        activeTab = 'grievances';
        render();
      });
    };

    container.querySelector('#btn-file-new-grievance')?.addEventListener('click', handleFileGrievance);
    container.querySelector('#btn-file-first-grievance')?.addEventListener('click', handleFileGrievance);

    container.querySelector('#btn-do-track-ticket')?.addEventListener('click', async () => {
      const input = container.querySelector('#input-track-ticket-id');
      const val = input ? input.value.trim().toUpperCase() : '';
      if (!val) {
        alert('Please enter a Reference Ticket ID (e.g. GRV-DE4D83)');
        return;
      }
      recordMyTicketId(val);
      complaints = await getStudentComplaints(user);
      render();
      alert(`🛡️ Reference Ticket ${val} linked to your Grievance Dossier.`);
    });

    container.querySelectorAll('.btn-student-delete-complaint').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm(`Are you sure you want to withdraw and remove grievance report ${id}?`)) {
          await deleteComplaint(id, user);
          complaints = await getStudentComplaints(user);
          render();
        }
      });
    });

    // Volunteer Application Withdrawal
    container.querySelectorAll('.btn-withdraw-vol').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const volId = e.currentTarget.getAttribute('data-vol-id');
        if (confirm('Are you sure you want to withdraw and delete your volunteer crew application?')) {
          btn.disabled = true;
          btn.textContent = 'Withdrawing...';
          await deleteVolunteerApplication(volId);
          volunteering = await getStudentVolunteering(user.uid);
          render();
        }
      });
    });

    container.querySelectorAll('.btn-view-pass').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const regId = e.currentTarget.getAttribute('data-reg-id');
        const reg = registrations.find(r => r.id === regId);
        if (reg) {
          openDigitalPassModal(reg, user);
        }
      });
    });

    container.querySelectorAll('.btn-download-cert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const certId = e.currentTarget.getAttribute('data-cert-id');
        const cert = certificates.find(c => c.id === certId);
        if (cert) {
          btn.disabled = true;
          btn.textContent = 'Generating PDF...';
          await downloadCertificatePDF(cert);
          btn.disabled = false;
          btn.textContent = '📥 Download PDF';
        }
      });
    });
  };

  // Instant zero-delay render
  render();

  // Background async sync with Firestore
  Promise.all([
    getStudentRegistrations(user.uid),
    getStudentCertificates(user.uid),
    getStudentVolunteering(user.uid),
    getStudentComplaints(user)
  ]).then(([freshRegs, freshCerts, freshVol, freshComplaints]) => {
    if (freshRegs) registrations = freshRegs;
    if (freshCerts) certificates = freshCerts;
    if (freshVol) volunteering = freshVol;
    if (freshComplaints) complaints = freshComplaints;
    render();
  }).catch(() => {});
}
