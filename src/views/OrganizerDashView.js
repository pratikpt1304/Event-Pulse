import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getOrganizerEvents, getAllEvents, createEvent, markEventCompleted, reopenEvent, getCachedEventsSync } from '../services/events';
import { getEventRegistrations, updateRegistrationStatus, bulkUpdateRegistrations, updateAttendance, bulkUpdateAttendance, awardCertificate } from '../services/registrations';
import { getEventVolunteers, updateVolunteerStatus } from '../services/volunteers';
import { getComplaints, updateComplaintStatus } from '../services/complaints';
import { openQRScannerModal } from '../components/QRScannerModal';
import { generateEventDescriptionAI } from '../services/ai';
import { openCompletedEventModal } from '../components/CompletedEventModal';

export async function renderOrganizerDashView(container, navigateTo) {
  const user = getCurrentUser();
  const isAdmin = isUserAdmin(user);
  if (!user || (user.role !== 'organizer' && !isAdmin)) {
    navigateTo('login');
    return;
  }

  // Instant Cache-First Initialization
  let events = getCachedEventsSync() || [];
  let selectedEventId = events.length > 0 ? events[0].id : null;
  let registrations = [];
  let volunteers = [];
  let complaints = [];

  let activeTab = 'registrations'; // 'registrations' | 'volunteers' | 'grievances' | 'history'
  let regSubTab = 'pending'; // 'pending' | 'approved' | 'rejected'
  let searchFilter = '';
  let selectedRegIds = new Set();

  const render = () => {
    const selectedEvent = events.find(e => e.id === selectedEventId);
    
    // Categorize Registrations
    const pendingRegs = registrations.filter(r => r.status === 'pending');
    const approvedRegs = registrations.filter(r => r.status === 'approved' || r.status === 'attended');
    const rejectedRegs = registrations.filter(r => r.status === 'rejected' || r.status === 'cancelled');

    // Attendance stats
    const presentCount = approvedRegs.filter(r => r.attendance === 'present' || r.status === 'attended').length;
    const absentCount = approvedRegs.filter(r => r.attendance === 'absent').length;
    const pendingAttendanceCount = approvedRegs.length - presentCount - absentCount;

    // Completed events for history
    const completedEvents = events.filter(e => e.status === 'completed');

    // Filtered arrays based on search
    const filterBySearch = (list) => list.filter(r => {
      const q = searchFilter.toLowerCase();
      return !q || (r.studentName || '').toLowerCase().includes(q) || (r.prn || '').toLowerCase().includes(q) || (r.department || '').toLowerCase().includes(q);
    });

    const activeList = regSubTab === 'pending' ? filterBySearch(pendingRegs) : (regSubTab === 'approved' ? filterBySearch(approvedRegs) : filterBySearch(rejectedRegs));

    const filteredVolunteers = volunteers.filter(v => {
      const q = searchFilter.toLowerCase();
      return !q || (v.studentName || '').toLowerCase().includes(q) || (v.prn || '').toLowerCase().includes(q);
    });

    const filteredComplaints = complaints.filter(c => {
      const q = searchFilter.toLowerCase();
      return !q || (c.reporterName || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q) || (c.ticketId || '').toLowerCase().includes(q);
    });

    container.innerHTML = `
      <div>
        <!-- Top Title & Action Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.75rem;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(124, 58, 237, 0.1); border: 1px solid rgba(124, 58, 237, 0.25); padding: 0.2rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; color: #7c3aed; text-transform: uppercase;">
              🎛️ Event Operations & Attendance Console
            </div>
            <h1 style="font-size: 2rem; margin-top: 0.35rem; color: var(--text-primary);">Organizer Command Hub</h1>
            <p style="color: var(--text-secondary); font-size: 0.925rem; margin-top: 0.2rem;">
              Review pending student approvals, mark present/absent attendance for certificates, and manage completed archives.
            </p>
          </div>

          <div style="display: flex; gap: 0.6rem; flex-wrap: wrap;">
            <button class="btn btn-primary" id="btn-scan-qr" style="box-shadow: 0 4px 14px rgba(124, 58, 237, 0.35); font-weight: 700;">
              📷 Scan Student QR
            </button>
            <button class="btn btn-secondary" id="btn-sync-organizer-live" style="font-weight: 700; background: #ffffff; color: var(--primary); border: 1.5px solid var(--primary); display: inline-flex; align-items: center; gap: 0.35rem;" title="Fetch fresh registrations & volunteers from cloud database">
              🔄 Sync Live Data
            </button>
            <button class="btn btn-secondary" id="btn-export-master" style="font-weight: 700; background: #ffffff; color: var(--text-primary);">
              📊 Master CSV Report
            </button>
            <button class="btn btn-secondary" id="btn-create-event" style="font-weight: 700; background: #ffffff; color: var(--text-primary);">
              ➕ Create Event
            </button>
          </div>
        </div>

        <!-- Event Selector Banner Card -->
        <div class="card" style="padding: 1.25rem 1.5rem; margin-bottom: 1.5rem; background: #ffffff; border: 1px solid var(--border-strong);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div style="display: flex; align-items: center; gap: 1rem; flex: 1; min-width: 280px;">
              <label style="font-weight: 800; font-size: 0.95rem; white-space: nowrap; color: var(--text-primary);">Target Event:</label>
              <select id="event-select-dropdown" class="form-control" style="font-weight: 700; font-size: 0.95rem; max-width: 500px;">
                ${events.length === 0 ? `<option value="">No events found. Click "Create Event" to post one.</option>` : ''}
                ${events.map(e => `
                  <option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>
                    ${e.status === 'completed' ? '🏁 [COMPLETED] ' : (e.status === 'approved' ? '🟢 [ACTIVE] ' : '⏳ [PENDING] ')} ${e.title} (${e.department})
                  </option>
                `).join('')}
              </select>
            </div>

            ${selectedEvent ? `
              <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
                ${selectedEvent.status === 'completed' ? `
                  <span class="badge" style="background: #334155; color: #ffffff; font-weight: 800; padding: 0.35rem 0.75rem;">
                    🏁 COMPLETED ARCHIVE
                  </span>
                  <button id="btn-reopen-event" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; font-weight: 700;">
                    ↺ Reopen Event
                  </button>
                ` : `
                  <span class="badge badge-${selectedEvent.status === 'approved' ? 'approved' : 'pending'}" style="font-weight: 800; padding: 0.35rem 0.75rem;">
                    Status: ${selectedEvent.status.toUpperCase()}
                  </span>
                  <button id="btn-complete-event" class="btn btn-sm" style="background: linear-gradient(135deg, #059669, #10b981); color: #ffffff; font-weight: 800; border: none; border-radius: var(--radius-sm); padding: 0.4rem 0.85rem;" title="Move event to history and lock registrations">
                    🏁 Mark Event Completed
                  </button>
                `}
                <button id="btn-export-this-event" class="btn btn-secondary btn-sm" style="font-weight: 700;" title="Download complete attendance sheet for HOD">
                  📥 Export Event CSV (for HOD)
                </button>
              </div>
            ` : ''}
          </div>
        </div>

        <!-- Quick Summary Stat Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="card" style="padding: 1.1rem; border-left: 4px solid #f59e0b; background: #ffffff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">⏳ Pending Approvals</div>
            <div style="font-size: 1.65rem; font-weight: 900; color: #f59e0b; margin-top: 0.2rem;">${pendingRegs.length}</div>
          </div>
          <div class="card" style="padding: 1.1rem; border-left: 4px solid #3b82f6; background: #ffffff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">✅ Approved Passes</div>
            <div style="font-size: 1.65rem; font-weight: 900; color: #3b82f6; margin-top: 0.2rem;">${approvedRegs.length}</div>
          </div>
          <div class="card" style="padding: 1.1rem; border-left: 4px solid #10b981; background: #ffffff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">🟢 Marked Present</div>
            <div style="font-size: 1.65rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">${presentCount}</div>
          </div>
          <div class="card" style="padding: 1.1rem; border-left: 4px solid #ef4444; background: #ffffff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">🔴 Marked Absent</div>
            <div style="font-size: 1.65rem; font-weight: 900; color: #ef4444; margin-top: 0.2rem;">${absentCount}</div>
          </div>
          <div class="card" style="padding: 1.1rem; border-left: 4px solid #64748b; background: #ffffff;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">❌ Rejected Apps</div>
            <div style="font-size: 1.65rem; font-weight: 900; color: #64748b; margin-top: 0.2rem;">${rejectedRegs.length}</div>
          </div>
        </div>

        <!-- Section Switcher Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; flex-wrap: wrap; border-bottom: 1px solid var(--border-subtle); padding-bottom: 0.5rem;">
          <button class="cat-tab ${activeTab === 'registrations' ? 'active' : ''}" data-tab="registrations">
            📋 Registrations & Attendance (${registrations.length})
          </button>
          <button class="cat-tab ${activeTab === 'volunteers' ? 'active' : ''}" data-tab="volunteers">
            🙋 Volunteer Crew (${volunteers.length})
          </button>
          <button class="cat-tab ${activeTab === 'grievances' ? 'active' : ''}" data-tab="grievances" style="${complaints.length > 0 ? 'border-color: rgba(239, 68, 68, 0.4);' : ''}">
            🚨 Incident Grievances (${complaints.length})
          </button>
          <button class="cat-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
            📚 Event History & Archives (${completedEvents.length})
          </button>
        </div>

        <!-- ========================================== -->
        <!-- TAB 1: REGISTRATIONS & ATTENDANCE         -->
        <!-- ========================================== -->
        ${activeTab === 'registrations' ? `
          <div class="card" style="padding: 1.5rem; background: #ffffff;">
            
            <!-- Registration Sub-Tabs (Pending, Approved, Rejected) -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem; border-bottom: 2px solid var(--border-subtle); padding-bottom: 0.85rem;">
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <button class="btn btn-sm ${regSubTab === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-reg-subtab" data-subtab="pending" style="font-weight: 800; border-radius: var(--radius-full); padding: 0.35rem 0.9rem;">
                  ⏳ Pending Approvals (${pendingRegs.length})
                </button>
                <button class="btn btn-sm ${regSubTab === 'approved' ? 'btn-primary' : 'btn-secondary'} btn-reg-subtab" data-subtab="approved" style="font-weight: 800; border-radius: var(--radius-full); padding: 0.35rem 0.9rem;">
                  ✅ Approved Attendees & Attendance (${approvedRegs.length})
                </button>
                <button class="btn btn-sm ${regSubTab === 'rejected' ? 'btn-primary' : 'btn-secondary'} btn-reg-subtab" data-subtab="rejected" style="font-weight: 800; border-radius: var(--radius-full); padding: 0.35rem 0.9rem;">
                  ❌ Rejected Applications (${rejectedRegs.length})
                </button>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button id="btn-export-subtab" class="btn btn-secondary btn-sm" style="font-size: 0.775rem; font-weight: 700; background: #f8fafc; border: 1px solid var(--border-strong);" title="Export CSV for this specific list">
                  📥 Export ${regSubTab === 'pending' ? 'Pending List' : (regSubTab === 'approved' ? 'Approved & Attendance' : 'Rejected List')} (CSV)
                </button>
                <!-- Search Bar -->
                <input type="text" id="reg-search-input" class="form-control form-control-sm" placeholder="🔍 Search student name or PRN..." value="${searchFilter}" style="max-width: 230px;" />
              </div>
            </div>

            <!-- Bulk Control Actions Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem; background: #f8fafc; padding: 0.65rem 0.9rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
              <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; font-weight: 700;">
                <input type="checkbox" id="select-all-regs-cb" ${selectedRegIds.size > 0 && selectedRegIds.size === activeList.length ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                <label for="select-all-regs-cb" style="cursor: pointer; margin: 0;">Select All (${selectedRegIds.size} selected)</label>
              </div>

              <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                ${regSubTab === 'pending' ? `
                  <button id="btn-bulk-approve-all" class="btn btn-primary btn-sm" ${selectedRegIds.size === 0 ? 'disabled' : ''} style="font-weight: 700; font-size: 0.775rem;">
                    ✓ Approve Selected (${selectedRegIds.size})
                  </button>
                  <button id="btn-bulk-reject-all" class="btn btn-danger btn-sm" ${selectedRegIds.size === 0 ? 'disabled' : ''} style="font-weight: 700; font-size: 0.775rem;">
                    ✕ Reject Selected (${selectedRegIds.size})
                  </button>
                ` : ''}

                ${regSubTab === 'approved' ? `
                  <button id="btn-bulk-mark-present" class="btn btn-sm" ${selectedRegIds.size === 0 ? 'disabled' : ''} style="background: #10b981; color: #ffffff; font-weight: 700; font-size: 0.775rem; border: none;">
                    🟢 Mark Selected Present (Issue Certs)
                  </button>
                  <button id="btn-bulk-mark-absent" class="btn btn-danger btn-sm" ${selectedRegIds.size === 0 ? 'disabled' : ''} style="font-weight: 700; font-size: 0.775rem;">
                    🔴 Mark Selected Absent
                  </button>
                ` : ''}

                ${regSubTab === 'rejected' ? `
                  <button id="btn-bulk-restore" class="btn btn-secondary btn-sm" ${selectedRegIds.size === 0 ? 'disabled' : ''} style="font-weight: 700; font-size: 0.775rem;">
                    ↺ Move Selected to Pending
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Main Table Content -->
            ${activeList.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">
                  ${regSubTab === 'pending' ? '✨' : (regSubTab === 'approved' ? '👥' : '📂')}
                </div>
                <div style="font-weight: 700; font-size: 1.05rem;">
                  ${regSubTab === 'pending' ? 'No Pending Approvals in Queue' : (regSubTab === 'approved' ? 'No Approved Attendees Yet' : 'No Rejected Applications')}
                </div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">
                  ${regSubTab === 'pending' ? 'When students register for this event, their pending passes will appear here.' : (regSubTab === 'approved' ? 'Approve pending student registrations to manage their attendance and issue certificates.' : '')}
                </div>
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-secondary); height: 42px;">
                      <th style="width: 40px;"></th>
                      <th>Student Name</th>
                      <th>PRN</th>
                      <th>Department & Year</th>
                      ${regSubTab === 'approved' ? `
                        <th>Attendance Status</th>
                        <th>Certificate Status</th>
                        <th>Mark Attendance</th>
                      ` : ''}
                      ${regSubTab === 'pending' ? `
                        <th>Registration Date</th>
                        <th>Actions</th>
                      ` : ''}
                      ${regSubTab === 'rejected' ? `
                        <th>Status</th>
                        <th>Actions</th>
                      ` : ''}
                    </tr>
                  </thead>
                  <tbody>
                    ${activeList.map(r => `
                      <tr style="border-bottom: 1px solid var(--border-subtle); height: 52px; background: ${selectedRegIds.has(r.id) ? 'rgba(124, 58, 237, 0.04)' : 'transparent'};">
                        <td>
                          <input type="checkbox" class="row-reg-cb" data-reg-id="${r.id}" ${selectedRegIds.has(r.id) ? 'checked' : ''} style="cursor: pointer; width: 16px; height: 16px;" />
                        </td>
                        <td>
                          <div style="font-weight: 700; color: var(--text-primary);">${r.studentName}</div>
                        </td>
                        <td><code>${r.prn || 'N/A'}</code></td>
                        <td>${r.department || 'General'} (${r.year || '1st Year'})</td>

                        <!-- SUBTAB: APPROVED & ATTENDANCE -->
                        ${regSubTab === 'approved' ? `
                          <td>
                            ${r.attendance === 'present' || r.status === 'attended' ? `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #dcfce7; color: #16a34a; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.25rem;">
                                🟢 Present
                              </span>
                            ` : (r.attendance === 'absent' ? `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #fee2e2; color: #dc2626; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.25rem;">
                                🔴 Absent
                              </span>
                            ` : `
                              <span style="font-size: 0.75rem; font-weight: 700; background: #f1f5f9; color: #64748b; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                                ⚪ Not Marked
                              </span>
                            `)}
                          </td>

                          <td>
                            ${r.attendance === 'present' || r.status === 'attended' ? (
                              r.certificateId ? `
                                <span style="font-size: 0.75rem; font-weight: 700; color: #059669; display: inline-flex; align-items: center; gap: 0.2rem;">
                                  🏆 Cert Awarded
                                </span>
                              ` : `
                                <button class="btn-award-cert" 
                                  data-reg-id="${r.id}" 
                                  data-user-id="${r.userId}" 
                                  data-student-name="${(r.studentName||'').replace(/"/g,'')}"
                                  data-prn="${r.prn||''}"
                                  data-event-id="${r.eventId||selectedEventId}"
                                  data-event-title="${(r.eventTitle||'').replace(/"/g,'')}"
                                  data-event-date="${r.eventDate||''}"
                                  style="font-size: 0.72rem; font-weight: 800; background: linear-gradient(135deg, #fef3c7, #fde68a); color: #92400e; border: 1px solid #f59e0b; padding: 0.2rem 0.55rem; border-radius: 6px; cursor: pointer;" 
                                  title="Award winner certificate">
                                  🏆 Award Cert
                                </button>
                              `
                            ) : `
                              <span style="font-size: 0.75rem; color: var(--text-tertiary);">
                                🔒 Mark Present first
                              </span>
                            `}
                          </td>

                          <td>
                            <div style="display: flex; gap: 0.35rem;">
                              <button class="btn btn-sm btn-mark-present" data-reg-id="${r.id}" style="font-size: 0.725rem; font-weight: 800; background: #dcfce7; color: #16a34a; border: 1px solid #86efac; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);" title="Mark Present and unlock certificate">
                                🟢 Present
                              </button>
                              <button class="btn btn-sm btn-mark-absent" data-reg-id="${r.id}" style="font-size: 0.725rem; font-weight: 800; background: #fee2e2; color: #dc2626; border: 1px solid #fca5a5; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);" title="Mark Absent">
                                🔴 Absent
                              </button>
                            </div>
                          </td>
                        ` : ''}

                        <!-- SUBTAB: PENDING APPROVALS -->
                        ${regSubTab === 'pending' ? `
                          <td style="color: var(--text-tertiary); font-size: 0.8rem;">
                            ${new Date(r.registeredAt).toLocaleString()}
                          </td>
                          <td>
                            <div style="display: flex; gap: 0.35rem;">
                              <button class="btn btn-primary btn-sm btn-single-approve" data-reg-id="${r.id}" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem;">
                                ✓ Approve
                              </button>
                              <button class="btn btn-danger btn-sm btn-single-reject" data-reg-id="${r.id}" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem;">
                                ✕ Reject
                              </button>
                            </div>
                          </td>
                        ` : ''}

                        <!-- SUBTAB: REJECTED -->
                        ${regSubTab === 'rejected' ? `
                          <td><span class="badge badge-rejected">${r.status}</span></td>
                          <td>
                            <button class="btn btn-secondary btn-sm btn-single-restore" data-reg-id="${r.id}" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem;">
                              ↺ Move to Pending
                            </button>
                          </td>
                        ` : ''}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- ========================================== -->
        <!-- TAB 2: VOLUNTEER CREW                     -->
        <!-- ========================================== -->
        ${activeTab === 'volunteers' ? `
          <div class="card" style="padding: 1.5rem; background: #ffffff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 style="font-size: 1.2rem; margin: 0;">Volunteer Crew Applications (${filteredVolunteers.length})</h3>
                <p style="font-size: 0.8rem; color: var(--text-secondary); margin: 0.2rem 0 0;">Review student volunteer applications and assign event crew duties.</p>
              </div>
            </div>

            ${filteredVolunteers.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🙋</div>
                <div style="font-weight: 700;">No volunteer applications filed yet</div>
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-secondary); height: 42px;">
                      <th>Volunteer Name</th>
                      <th>PRN</th>
                      <th>Dept & Year</th>
                      <th>Preferred Role</th>
                      <th>Contact</th>
                      <th>Reason / Note</th>
                      <th>Status</th>
                      <th style="text-align: right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredVolunteers.map(v => {
                      const isPending = !v.status || v.status === 'pending' || v.status === 'applied';
                      const isAccepted = v.status === 'accepted' || v.status === 'approved';
                      const isRejected = v.status === 'rejected';

                      return `
                      <tr style="border-bottom: 1px solid var(--border-subtle); height: 50px;">
                        <td style="font-weight: 700; color: var(--text-primary);">${v.studentName}</td>
                        <td><code>${v.prn || 'N/A'}</code></td>
                        <td>${v.department || ''} ${v.year ? `(${v.year})` : ''}</td>
                        <td><span style="font-weight: 700; color: #7c3aed; background: #ede9fe; padding: 0.2rem 0.6rem; border-radius: var(--radius-full); font-size: 0.775rem;">${v.preferredRole}</span></td>
                        <td>${v.phone ? `<a href="https://wa.me/${v.phone.replace(/[^0-9]/g, '')}" target="_blank" style="color: #16a34a; font-weight: 700; text-decoration: none;">💬 ${v.phone}</a>` : v.studentEmail || 'N/A'}</td>
                        <td style="max-width: 180px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${v.reason || ''}">${v.reason || '—'}</td>
                        <td>
                          ${isPending ? `<span class="badge" style="background: #fef9c3; color: #854d0e; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">⏳ PENDING</span>` : ''}
                          ${isAccepted ? `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">✅ APPROVED</span>` : ''}
                          ${isRejected ? `<span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">❌ REJECTED</span>` : ''}
                        </td>
                        <td style="text-align: right;">
                          <div style="display: flex; gap: 0.35rem; justify-content: flex-end; align-items: center;">
                            ${isPending ? `
                              <button class="btn btn-sm btn-approve-vol" data-vol-id="${v.id}" style="background: #16a34a; color: #ffffff; font-weight: 800; font-size: 0.75rem; padding: 0.3rem 0.65rem; border: none; border-radius: var(--radius-sm); cursor: pointer;" title="Accept Volunteer into Crew">
                                ✓ Approve
                              </button>
                              <button class="btn btn-sm btn-reject-vol" data-vol-id="${v.id}" style="background: #dc2626; color: #ffffff; font-weight: 800; font-size: 0.75rem; padding: 0.3rem 0.65rem; border: none; border-radius: var(--radius-sm); cursor: pointer;" title="Reject Application">
                                ✕ Reject
                              </button>
                            ` : ''}
                            ${isAccepted ? `
                              <button class="btn btn-sm btn-reject-vol" data-vol-id="${v.id}" style="background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; font-size: 0.725rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer;">
                                Remove
                              </button>
                            ` : ''}
                            ${isRejected ? `
                              <button class="btn btn-sm btn-approve-vol" data-vol-id="${v.id}" style="background: #f0fdf4; color: #16a34a; border: 1px solid #bbf7d0; font-size: 0.725rem; font-weight: 700; padding: 0.25rem 0.5rem; border-radius: var(--radius-sm); cursor: pointer;">
                                Re-Approve
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                    }).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- TAB 3: INCIDENT GRIEVANCES                -->
        <!-- ========================================== -->
        ${activeTab === 'grievances' ? `
          <div class="card" style="padding: 1.5rem; background: #ffffff;">
            <div style="margin-bottom: 1.25rem;">
              <h3 style="font-size: 1.2rem; color: #dc2626;">🚨 Event Grievances & Incident Reports (${complaints.length})</h3>
            </div>

            ${filteredComplaints.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🛡️</div>
                <div style="font-weight: 700;">No incident reports logged for this event</div>
              </div>
            ` : filteredComplaints.map(c => `
              <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); padding: 1.25rem;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                  <div style="display: flex; gap: 0.45rem; align-items: center;">
                    <span style="font-family: monospace; font-weight: 800; font-size: 0.75rem; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);">${c.ticketId || c.id}</span>
                    <span style="font-size: 0.75rem; font-weight: 800; background: #fef2f2; color: #dc2626; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">${c.category}</span>
                  </div>
                  <div>
                    <span class="badge badge-${c.status}">${c.status}</span>
                  </div>
                </div>

                <div style="background: #ffffff; border: 1px solid var(--border-subtle); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.75rem;">
                  ${c.description}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.775rem; color: var(--text-tertiary);">
                  <div>Reported by: <strong>${c.isAnonymous ? 'Confidential Student' : c.reporterName}</strong> | ${new Date(c.createdAt).toLocaleString()}</div>
                  <div>
                    ${c.status !== 'resolved' ? `
                      <button class="btn btn-primary btn-sm btn-resolve-comp" data-ticket-id="${c.id}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem;">
                        ✓ Mark Resolved
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- TAB 4: EVENT HISTORY & PAST ARCHIVES      -->
        <!-- ========================================== -->
        ${activeTab === 'history' ? `
          <div class="card" style="padding: 1.5rem; background: #ffffff;">
            <div style="margin-bottom: 1.25rem;">
              <h3 style="font-size: 1.2rem; color: #334155;">📚 University Event History & Completed Archives</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Inspect past completed events, audit attendance rates, and download historical reports for HODs.</p>
            </div>

            ${completedEvents.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🏁</div>
                <div style="font-weight: 700;">No completed events in archive yet</div>
                <div style="font-size: 0.85rem; margin-top: 0.2rem;">When an event concludes, click "Mark Event Completed" to preserve all attendance and certificates in history.</div>
              </div>
            ` : completedEvents.map(ce => `
              <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding: 1.25rem;">
                <div style="flex: 1; min-width: 260px;">
                  <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                    <span style="font-size: 0.75rem; font-weight: 800; background: #e2e8f0; color: #334155; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">
                      🏁 COMPLETED
                    </span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${ce.department}</span>
                  </div>
                  <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">${ce.title}</h3>
                  <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                    📅 Date: <strong>${ce.date} (${ce.time})</strong> | 📍 Venue: <strong>${ce.venue}</strong>
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center;">
                  <button class="btn btn-secondary btn-sm btn-inspect-archive" data-event-id="${ce.id}" style="font-weight: 700;">
                    🔍 Inspect Event Data
                  </button>
                  <button class="btn btn-secondary btn-sm btn-reopen-archive" data-event-id="${ce.id}" style="font-weight: 700;">
                    ↺ Reopen
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

      </div>
    `;

    // =========================================================================
    // EVENT LISTENERS & ACTIONS
    // =========================================================================

    // Tab Navigation
    container.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        activeTab = e.currentTarget.getAttribute('data-tab');
        render();
      });
    });

    // Registration Sub-Tab Navigation
    container.querySelectorAll('.btn-reg-subtab').forEach(btn => {
      btn.addEventListener('click', (e) => {
        regSubTab = e.currentTarget.getAttribute('data-subtab');
        selectedRegIds.clear();
        render();
      });
    });

    // Event Selector
    container.querySelector('#event-select-dropdown')?.addEventListener('change', async (e) => {
      selectedEventId = e.target.value;
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      volunteers = await getEventVolunteers(selectedEventId);
      complaints = await getComplaints(selectedEventId);
      render();
    });

    // Search Input (Preserves Keyboard & Focus)
    const regSearchInput = container.querySelector('#reg-search-input');
    if (regSearchInput) {
      regSearchInput.addEventListener('input', (e) => {
        searchFilter = e.target.value;
        render();
        const refreshedInput = container.querySelector('#reg-search-input');
        if (refreshedInput) {
          refreshedInput.focus();
          refreshedInput.setSelectionRange(refreshedInput.value.length, refreshedInput.value.length);
        }
      });
    }

    // Select All Checkbox
    container.querySelector('#select-all-regs-cb')?.addEventListener('change', (e) => {
      if (e.target.checked) {
        activeList.forEach(r => selectedRegIds.add(r.id));
      } else {
        selectedRegIds.clear();
      }
      render();
    });

    // Row Checkbox
    container.querySelectorAll('.row-reg-cb').forEach(cb => {
      cb.addEventListener('change', (e) => {
        const id = e.target.getAttribute('data-reg-id');
        if (e.target.checked) selectedRegIds.add(id);
        else selectedRegIds.delete(id);
        render();
      });
    });

    // Single Approve / Reject / Restore
    container.querySelectorAll('.btn-single-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-reg-id');
        await updateRegistrationStatus(id, 'approved', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
      });
    });

    container.querySelectorAll('.btn-single-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-reg-id');
        await updateRegistrationStatus(id, 'rejected', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
      });
    });

    container.querySelectorAll('.btn-single-restore').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-reg-id');
        await updateRegistrationStatus(id, 'pending', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
      });
    });

    // Single Present / Absent
    container.querySelectorAll('.btn-mark-present').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-reg-id');
        await updateAttendance(id, 'present', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
      });
    });

    container.querySelectorAll('.btn-mark-absent').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-reg-id');
        await updateAttendance(id, 'absent', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
      });
    });

    // Award Certificate to Winner
    container.querySelectorAll('.btn-award-cert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const b = e.currentTarget;
        const regId = b.getAttribute('data-reg-id');
        const userId = b.getAttribute('data-user-id');
        const studentName = b.getAttribute('data-student-name');
        const prn = b.getAttribute('data-prn');
        const eventId = b.getAttribute('data-event-id');
        const eventTitle = b.getAttribute('data-event-title');
        const eventDate = b.getAttribute('data-event-date');

        if (!confirm(`🏆 Award official winner certificate to "${studentName}"?\n\nThis certificate will appear in their profile.`)) return;

        b.disabled = true;
        b.textContent = '⏳ Awarding...';
        const result = await awardCertificate({ regId, userId, studentName, prn, eventId, eventTitle, eventDate, organizerName: user.name });
        if (result.success) {
          registrations = await getEventRegistrations(selectedEventId);
          render();
        } else {
          alert('Failed to award certificate. Please try again.');
          b.disabled = false;
          b.textContent = '🏆 Award Cert';
        }
      });
    });

    // Bulk Actions
    container.querySelector('#btn-bulk-approve-all')?.addEventListener('click', async () => {
      if (selectedRegIds.size === 0) return;
      await bulkUpdateRegistrations(Array.from(selectedRegIds), 'approved', user);
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      render();
    });

    container.querySelector('#btn-bulk-reject-all')?.addEventListener('click', async () => {
      if (selectedRegIds.size === 0) return;
      await bulkUpdateRegistrations(Array.from(selectedRegIds), 'rejected', user);
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      render();
    });

    container.querySelector('#btn-bulk-mark-present')?.addEventListener('click', async () => {
      if (selectedRegIds.size === 0) return;
      await bulkUpdateAttendance(Array.from(selectedRegIds), 'present', user);
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      render();
    });

    container.querySelector('#btn-bulk-mark-absent')?.addEventListener('click', async () => {
      if (selectedRegIds.size === 0) return;
      await bulkUpdateAttendance(Array.from(selectedRegIds), 'absent', user);
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      render();
    });

    container.querySelector('#btn-bulk-restore')?.addEventListener('click', async () => {
      if (selectedRegIds.size === 0) return;
      await bulkUpdateRegistrations(Array.from(selectedRegIds), 'pending', user);
      selectedRegIds.clear();
      registrations = await getEventRegistrations(selectedEventId);
      render();
    });

    // Mark Event Completed
    container.querySelector('#btn-complete-event')?.addEventListener('click', async () => {
      if (confirm(`Are you sure you want to mark "${selectedEvent.title}" as Completed? It will be archived in the Event History for HOD reporting.`)) {
        await markEventCompleted(selectedEventId, user);
        events = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
        render();
      }
    });

    // Reopen Event
    container.querySelector('#btn-reopen-event')?.addEventListener('click', async () => {
      await reopenEvent(selectedEventId, user);
      events = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
      render();
    });

    // Inspect Archive
    container.querySelectorAll('.btn-inspect-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-event-id');
        selectedEventId = id;
        registrations = await getEventRegistrations(selectedEventId);
        volunteers = await getEventVolunteers(selectedEventId);
        complaints = await getComplaints(selectedEventId);
        activeTab = 'registrations';
        render();
      });
    });

    container.querySelectorAll('.btn-reopen-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-event-id');
        await reopenEvent(id, user);
        events = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
        render();
      });
    });

    // Volunteer actions (Approve / Reject)
    container.querySelectorAll('.btn-approve-vol').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const volId = e.currentTarget.getAttribute('data-vol-id');
        btn.disabled = true;
        btn.textContent = 'Approving...';
        await updateVolunteerStatus(volId, 'accepted');
        volunteers = await getEventVolunteers(selectedEventId);
        render();
      });
    });

    container.querySelectorAll('.btn-reject-vol').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const volId = e.currentTarget.getAttribute('data-vol-id');
        if (confirm('Are you sure you want to reject / remove this volunteer application?')) {
          btn.disabled = true;
          btn.textContent = 'Updating...';
          await updateVolunteerStatus(volId, 'rejected');
          volunteers = await getEventVolunteers(selectedEventId);
          render();
        }
      });
    });

    // Grievance resolve
    container.querySelectorAll('.btn-resolve-comp').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-ticket-id');
        await updateComplaintStatus(ticketId, 'resolved', 'Resolved by event coordinator');
        complaints = await getComplaints(selectedEventId);
        render();
      });
    });

    // QR Scanner
    container.querySelector('#btn-scan-qr')?.addEventListener('click', () => {
      openQRScannerModal(async (scannedPass) => {
        const regId = scannedPass.regId || scannedPass.id;
        await updateAttendance(regId, 'present', user);
        registrations = await getEventRegistrations(selectedEventId);
        render();
        alert(`✅ Verified Pass for ${scannedPass.studentName || 'Student'}! Attendance Marked: PRESENT.`);
      });
    });

    // Create Event Modal
    container.querySelector('#btn-create-event')?.addEventListener('click', () => {
      openCreateEventModal(user, async () => {
        events = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
        render();
      });
    });

    // Sub-Tab Specific CSV Export (Pending / Approved / Rejected)
    container.querySelector('#btn-export-subtab')?.addEventListener('click', () => {
      if (!selectedEvent) return;
      const evTitle = selectedEvent.title.replace(/[^a-zA-Z0-9]/g, '_');
      let csv = '';
      let filename = '';

      if (regSubTab === 'pending') {
        filename = `${evTitle}_Pending_Approvals_List.csv`;
        csv += `Event: ${selectedEvent.title} (Pending Registrations)\n`;
        csv += `Student Name,PRN,Department,Year,Applied Date,Status\n`;
        pendingRegs.forEach(r => {
          csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'N/A'}","${r.year || '1st Year'}","${r.registeredAt}","${r.status}"\n`;
        });
      } else if (regSubTab === 'approved') {
        filename = `${evTitle}_Approved_Attendees_Attendance.csv`;
        csv += `Event: ${selectedEvent.title} (Approved Attendees & Attendance)\n`;
        csv += `Student Name,PRN,Department,Year,Attendance Status,Certificate ID,Approved By,Registration Date\n`;
        approvedRegs.forEach(r => {
          csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'N/A'}","${r.year || '1st Year'}","${r.attendance || (r.status === 'attended' ? 'present' : 'pending')}","${r.certificateId || 'N/A'}","${r.decidedBy || 'Admin'}","${r.registeredAt}"\n`;
        });
      } else {
        filename = `${evTitle}_Rejected_Applications_List.csv`;
        csv += `Event: ${selectedEvent.title} (Rejected Applications)\n`;
        csv += `Student Name,PRN,Department,Year,Decision Date,Status\n`;
        rejectedRegs.forEach(r => {
          csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'N/A'}","${r.year || '1st Year'}","${r.decidedAt || r.registeredAt}","${r.status}"\n`;
        });
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Single Event CSV Export (for HOD) - Complete Combined
    container.querySelector('#btn-export-this-event')?.addEventListener('click', () => {
      if (!selectedEvent) return;
      let csv = `Event Title,${selectedEvent.title}\n`;
      csv += `Department,${selectedEvent.department}\n`;
      csv += `Date,${selectedEvent.date} (${selectedEvent.time})\n`;
      csv += `Venue,${selectedEvent.venue}\n`;
      csv += `Status,${selectedEvent.status}\n\n`;

      csv += `Student Name,PRN,Department,Year,Registration Status,Attendance,Certificate ID,Registered At\n`;
      registrations.forEach(r => {
        csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'N/A'}","${r.year || '1st Year'}","${r.status}","${r.attendance || (r.status === 'attended' ? 'present' : 'pending')}","${r.certificateId || 'N/A'}","${r.registeredAt}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selectedEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Complete_Master_Report.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Master CSV Export for All Events
    container.querySelector('#btn-export-master')?.addEventListener('click', async () => {
      let csv = `Event ID,Event Title,Department,Date,Status,Total Registrations,Total Present,Total Absent\n`;
      for (const ev of events) {
        const evRegs = await getEventRegistrations(ev.id);
        const present = evRegs.filter(r => r.attendance === 'present' || r.status === 'attended').length;
        const absent = evRegs.filter(r => r.attendance === 'absent').length;
        csv += `"${ev.id}","${ev.title}","${ev.department}","${ev.date}","${ev.status}",${evRegs.length},${present},${absent}\n`;
      }

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sanjivani_University_Master_Events_Report_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });
    // Live Sync Button
    container.querySelector('#btn-sync-organizer-live')?.addEventListener('click', async () => {
      const btn = container.querySelector('#btn-sync-organizer-live');
      if (btn) {
        btn.disabled = true;
        btn.textContent = '🔄 Syncing...';
      }
      if (selectedEventId) {
        const [regs, vols, comps] = await Promise.all([
          getEventRegistrations(selectedEventId),
          getEventVolunteers(selectedEventId),
          getComplaints(selectedEventId)
        ]);
        registrations = regs || [];
        volunteers = vols || [];
        complaints = comps || [];
      }
      render();
    });

    // Inspect Completed Archive
    container.querySelectorAll('.btn-inspect-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = events.find(ev => ev.id === evId);
        if (!targetEvent) return;
        btn.disabled = true;
        btn.textContent = 'Loading...';
        const regs = await getEventRegistrations(evId);
        btn.disabled = false;
        btn.textContent = '🔍 Inspect Event Data';
        openCompletedEventModal(targetEvent, regs);
      });
    });

    // Reopen Completed Archive
    container.querySelectorAll('.btn-reopen-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evId = e.currentTarget.getAttribute('data-event-id');
        if (confirm('Reopen this completed event back to Active?')) {
          await reopenEvent(evId);
          events = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
          render();
        }
      });
    });
  };

  // 1. Instant 0ms Synchronous Render
  render();

  // 2. Background Asynchronous Live Fetch
  (async () => {
    try {
      const fetchedEvents = isAdmin ? await getAllEvents() : await getOrganizerEvents(user.uid);
      if (fetchedEvents && fetchedEvents.length > 0) {
        events = fetchedEvents;
        if (!selectedEventId || !events.some(e => e.id === selectedEventId)) {
          selectedEventId = events[0].id;
        }
      }
      if (selectedEventId) {
        const [regs, vols, comps] = await Promise.all([
          getEventRegistrations(selectedEventId),
          getEventVolunteers(selectedEventId),
          getComplaints(selectedEventId)
        ]);
        registrations = regs || [];
        volunteers = vols || [];
        complaints = comps || [];
      }
      render();
    } catch (e) {
      console.warn('Organizer background fetch notice:', e.message);
    }
  })();
}

function openCreateEventModal(organizerUser, onSuccess) {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  
  overlay.innerHTML = `
    <div class="modal-container">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
        <h3 style="font-size: 1.3rem;">➕ Create New Event</h3>
        <button class="btn btn-secondary btn-sm" id="close-create-x" style="border-radius: 50%; width: 32px; height: 32px; padding: 0;">✕</button>
      </div>

      <form id="create-event-form">
        <div class="form-group">
          <label>Event Title</label>
          <input type="text" id="ev-title" class="form-control" placeholder="Annual University Hackathon 2026" required />
        </div>

        <div class="form-group">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
            <label style="margin-bottom: 0;">Description *</label>
            <button type="button" id="btn-ai-draft-desc" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(6, 182, 212, 0.15)); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-full); padding: 0.2rem 0.65rem; font-size: 0.75rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem;">
              ⚡ Auto-Draft with NEX
            </button>
          </div>
          <textarea id="ev-desc" class="form-control" rows="4" placeholder="Detailed event agenda, target outcomes, and rules..." required></textarea>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Event Category</label>
            <select id="ev-cat" class="form-control" required>
              <option value="technical">💻 Technical</option>
              <option value="sports">🏆 Sports</option>
              <option value="social">🎉 Social & Cultural</option>
              <option value="notice">📢 Campus Notice</option>
            </select>
          </div>
          <div class="form-group">
            <label>Department</label>
            <select id="ev-dept" class="form-control" required>
              <option value="Computer Science & Engineering">Computer Science & Engineering</option>
              <option value="Information Technology">Information Technology</option>
              <option value="AIML">AI & Machine Learning (AIML)</option>
              <option value="AIDS">AI & Data Science (AIDS)</option>
              <option value="Cyber Security">Cyber Security</option>
              <option value="IMtech">Integrated M.Tech (IMtech)</option>
              <option value="Robotics & Automation">Robotics & Automation</option>
              <option value="Mechanical Engineering">Mechanical Engineering</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label>Venue</label>
          <input type="text" id="ev-venue" class="form-control" placeholder="Main Auditorium" required />
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Event Date</label>
            <input type="date" id="ev-date" class="form-control" value="2026-09-25" required />
          </div>
          <div class="form-group">
            <label>Time</label>
            <input type="text" id="ev-time" class="form-control" value="10:00 AM" required />
          </div>
        </div>

        <div class="form-row">
          <div class="form-group">
            <label>Max Participant Capacity</label>
            <input type="number" id="ev-max" class="form-control" value="100" required />
          </div>
          <div class="form-group">
            <label>Registration Deadline</label>
            <input type="date" id="ev-deadline" class="form-control" value="2026-09-23" required />
          </div>
        </div>

        <div class="form-group">
          <label>External Link / Rulebook PDF / Unstop URL (Optional)</label>
          <input type="url" id="ev-link" class="form-control" placeholder="e.g. https://unstop.com/... or Google Form / Drive link" />
        </div>

        <div style="margin-top: 1.75rem; display: flex; gap: 0.75rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" id="btn-cancel-create">Cancel</button>
          <button type="submit" class="btn btn-primary">Submit for Admin Review</button>
        </div>
      </form>
    </div>
  `;

  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('#close-create-x').addEventListener('click', close);
  overlay.querySelector('#btn-cancel-create').addEventListener('click', close);

  // AI Description Draft Handler
  overlay.querySelector('#btn-ai-draft-desc')?.addEventListener('click', async () => {
    const title = overlay.querySelector('#ev-title').value.trim() || 'Campus Championship & Hackathon';
    const cat = overlay.querySelector('#ev-cat').value;
    const dept = overlay.querySelector('#ev-dept').value;
    const descBox = overlay.querySelector('#ev-desc');
    
    descBox.value = '⚡ Generating high-impact event description with NEX...';
    const draft = await generateEventDescriptionAI(title, cat, dept);
    descBox.value = draft;
  });

  overlay.querySelector('#create-event-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const eventPayload = {
      title: overlay.querySelector('#ev-title').value.trim(),
      description: overlay.querySelector('#ev-desc').value.trim(),
      category: overlay.querySelector('#ev-cat').value,
      department: overlay.querySelector('#ev-dept').value,
      venue: overlay.querySelector('#ev-venue').value.trim(),
      externalLink: (overlay.querySelector('#ev-link')?.value || '').trim(),
      date: overlay.querySelector('#ev-date').value,
      time: overlay.querySelector('#ev-time').value.trim(),
      maxParticipants: parseInt(overlay.querySelector('#ev-max').value, 10),
      registrationDeadline: overlay.querySelector('#ev-deadline').value,
      eligibleDepartments: ['Computer Science', 'Information Technology', 'AI & Data Science', 'Robotics'],
      eligibleYears: ['1st Year', '2nd Year', '3rd Year', '4th Year']
    };

    await createEvent(eventPayload, organizerUser);
    alert('🎉 Event submitted! Set to status: pending_approval.');
    close();
    if (onSuccess) onSuccess();
  });
}
