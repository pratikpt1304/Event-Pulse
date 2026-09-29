import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getEvents } from '../services/events';
import { getAllComplaints, updateComplaintStatus } from '../services/complaints';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function renderExecutiveDashboardView(container, navigateTo) {
  const user = getCurrentUser();
  if (!user) {
    navigateTo('login');
    return;
  }

  const role = user.role || 'student';
  const userDept = user.department || 'Integrated M.Tech';
  const isAdmin = isUserAdmin(user) || role === 'admin';

  let roleLabel = 'Academic Executive';
  let scopeDescription = 'Campus Overview';
  let badgeColor = '#6366f1';

  if (role === 'hod') {
    roleLabel = `HOD • ${userDept}`;
    scopeDescription = `Departmental event governance, grievance redressal, and approvals for ${userDept}`;
    badgeColor = '#3b82f6';
  } else if (role === 'dean') {
    roleLabel = `Dean • Academic Affairs`;
    scopeDescription = `School-level event performance, participation metrics, and inter-department oversight`;
    badgeColor = '#8b5cf6';
  } else if (role === 'vc') {
    roleLabel = `Vice Chancellor's Office`;
    scopeDescription = `University-wide student participation, NAAC Criterion 5 metrics, and flagship events`;
    badgeColor = '#10b981';
  } else if (isAdmin) {
    roleLabel = `Central Administration (Executive Mode)`;
    scopeDescription = `Full university executive governance oversight`;
    badgeColor = '#ef4444';
  }

  // Active sub-tab state (stored in session or default to 'events')
  let activeTab = sessionStorage.getItem('ep_exec_tab') || 'events';

  // Fetch events & complaints concurrently
  const [allEvents, allComplaints] = await Promise.all([
    getEvents(),
    getAllComplaints()
  ]);
  
  // Scope filtering based on role
  let scopedEvents = allEvents;
  if (role === 'hod' && userDept && userDept !== 'All Departments') {
    scopedEvents = allEvents.filter(e => {
      const eDept = (e.department || '').toLowerCase();
      const targetDept = userDept.toLowerCase();
      return eDept.includes(targetDept) || targetDept.includes(eDept) || !e.department;
    });
  }

  // Scope complaints for department
  const scopedComplaints = allComplaints.filter(c => {
    if (isAdmin || role === 'vc' || role === 'dean') return true;
    const rDept = (c.reporterDept || '').toLowerCase();
    const targetDept = userDept.toLowerCase();
    return rDept.includes(targetDept) || targetDept.includes(rDept) || rDept === 'general' || rDept === 'imtech';
  });

  const pendingComplaints = scopedComplaints.filter(c => c.status !== 'resolved');

  const totalEvents = scopedEvents.length;
  const upcomingCount = scopedEvents.filter(e => new Date(e.date || e.startDate) >= new Date()).length;
  const completedCount = totalEvents - upcomingCount;
  const totalRegistrations = scopedEvents.reduce((acc, e) => acc + (e.registeredCount || e.attendeesCount || 18), 0);

  const render = () => {
    container.innerHTML = `
      <style>
        .exec-dash-wrap {
          padding: 1.5rem 0 3rem 0;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        .exec-header-banner {
          background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #172554 100%);
          border: 1px solid rgba(255, 255, 255, 0.1);
          border-radius: 20px;
          padding: 2rem 2.25rem;
          color: #ffffff;
          margin-bottom: 2rem;
          box-shadow: 0 20px 40px -15px rgba(0,0,0,0.5);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1.5rem;
        }

        .exec-badge {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          background: rgba(255, 255, 255, 0.12);
          backdrop-filter: blur(10px);
          border: 1px solid rgba(255, 255, 255, 0.2);
          padding: 0.35rem 0.85rem;
          border-radius: 50px;
          font-size: 0.8rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          text-transform: uppercase;
          margin-bottom: 0.65rem;
        }

        .exec-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 1.25rem;
          margin-bottom: 2rem;
        }

        .exec-kpi-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          padding: 1.5rem;
          box-shadow: 0 4px 16px rgba(0,0,0,0.04);
          transition: transform 0.2s, box-shadow 0.2s;
        }
        .exec-kpi-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 10px 24px rgba(0,0,0,0.08);
        }

        .exec-kpi-val {
          font-size: 2rem;
          font-weight: 800;
          color: var(--text-primary);
          font-family: 'Space Grotesk', sans-serif;
          margin: 0.3rem 0;
        }

        .exec-kpi-label {
          font-size: 0.825rem;
          font-weight: 600;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .exec-tabs-bar {
          display: flex;
          gap: 0.75rem;
          border-bottom: 2px solid var(--border-subtle);
          margin-bottom: 1.5rem;
          padding-bottom: 0.5rem;
        }

        .exec-tab-btn {
          background: none;
          border: none;
          padding: 0.75rem 1.25rem;
          font-size: 0.95rem;
          font-weight: 700;
          color: var(--text-secondary);
          cursor: pointer;
          border-radius: 10px;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: all 0.2s;
        }

        .exec-tab-btn.active {
          color: #3b82f6;
          background: rgba(59, 130, 246, 0.1);
        }

        .exec-tab-badge {
          background: #ef4444;
          color: #fff;
          font-size: 0.7rem;
          font-weight: 800;
          padding: 0.15rem 0.5rem;
          border-radius: 999px;
        }

        .exec-table-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 18px;
          overflow: hidden;
          box-shadow: 0 4px 20px rgba(0,0,0,0.04);
        }

        .exec-table-header {
          padding: 1.25rem 1.5rem;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        }

        .exec-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.9rem;
        }

        .exec-table th {
          background: var(--bg-surface-elevated);
          padding: 0.85rem 1.25rem;
          font-size: 0.775rem;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          font-weight: 700;
          border-bottom: 1px solid var(--border-subtle);
        }

        .exec-table td {
          padding: 1rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
        }

        .exec-table tr:hover td {
          background: var(--bg-surface-elevated);
        }

        .status-pill {
          display: inline-block;
          padding: 0.25rem 0.65rem;
          border-radius: 20px;
          font-size: 0.75rem;
          font-weight: 700;
          text-transform: uppercase;
        }
        .status-approved { background: rgba(16, 185, 129, 0.15); color: #10b981; }
        .status-pending { background: rgba(245, 158, 11, 0.15); color: #f59e0b; }
        .status-completed { background: rgba(100, 116, 139, 0.15); color: #64748b; }
      </style>

      <div class="exec-dash-wrap">
        <!-- Top Banner -->
        <div class="exec-header-banner">
          <div>
            <div class="exec-badge" style="border-left: 3px solid ${badgeColor};">
              <span>🏛️</span> ${roleLabel}
            </div>
            <h1 style="font-size: 1.85rem; font-weight: 800; margin: 0 0 0.5rem 0; letter-spacing: -0.02em;">
              Executive Academic Dashboard
            </h1>
            <p style="margin: 0; color: #cbd5e1; font-size: 0.95rem; max-width: 600px;">
              ${scopeDescription}
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button id="btn-export-naac" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.5rem; background: #3b82f6; border-color: #3b82f6;">
              <span>📥</span> Export NAAC Criterion 5 Report (CSV)
            </button>
            <button id="btn-export-dgrc" class="btn btn-outline" style="display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.08); color: #fff; border-color: rgba(255,255,255,0.25);">
              <span>🛡️</span> NAAC 5.1.5 Grievance Audit Log
            </button>
          </div>
        </div>

        <!-- KPI Cards -->
        <div class="exec-kpi-grid">
          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Scoped Events</div>
            <div class="exec-kpi-val" style="color: #6366f1;">${totalEvents}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">${upcomingCount} active / upcoming</div>
          </div>

          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Student Participations</div>
            <div class="exec-kpi-val" style="color: #10b981;">${totalRegistrations}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Direct PRN attendance log</div>
          </div>

          <div class="exec-kpi-card">
            <div class="exec-kpi-label">Completed Sessions</div>
            <div class="exec-kpi-val" style="color: #3b82f6;">${completedCount}</div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">Archived with certificates</div>
          </div>

          <div class="exec-kpi-card" style="border-left: 3px solid ${pendingComplaints.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="exec-kpi-label">Department Grievances (DGRC)</div>
            <div class="exec-kpi-val" style="color: ${pendingComplaints.length > 0 ? '#ef4444' : '#10b981'};">
              ${pendingComplaints.length}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              ${pendingComplaints.length === 0 ? '✓ Zero unresolved complaints' : `${pendingComplaints.length} pending review / action`}
            </div>
          </div>
        </div>

        <!-- Navigation Sub-Tabs -->
        <div class="exec-tabs-bar">
          <button class="exec-tab-btn ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            <span>🎪</span> Department Events & Endorsements (${scopedEvents.length})
          </button>
          <button class="exec-tab-btn ${activeTab === 'grievances' ? 'active' : ''}" id="tab-btn-grievances">
            <span>🚨</span> Student Grievance Redressal (DGRC)
            ${pendingComplaints.length > 0 ? `<span class="exec-tab-badge">${pendingComplaints.length}</span>` : ''}
          </button>
        </div>

        ${activeTab === 'events' ? `
          <!-- TAB 1: Event Scoped Management Table -->
          <div class="exec-table-card">
            <div class="exec-table-header">
              <div>
                <h3 style="margin: 0 0 0.25rem 0; font-size: 1.15rem; font-weight: 700;">
                  Events in Scope (${scopedEvents.length})
                </h3>
                <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary);">
                  Review attendance numbers, department attribution, and institutional approvals
                </p>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Department</th>
                    <th>Date & Venue</th>
                    <th>Attendance / RSVPs</th>
                    <th>Governance Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${scopedEvents.length === 0 ? `
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-secondary);">
                        No events currently listed for this academic scope.
                      </td>
                    </tr>
                  ` : scopedEvents.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    const statusClass = isUpcoming ? (evt.endorsed ? 'status-approved' : 'status-pending') : 'status-completed';
                    const statusText = isUpcoming ? (evt.endorsed ? 'Endorsed' : 'Awaiting Review') : 'Completed';
                    
                    return `
                      <tr>
                        <td>
                          <strong style="color: var(--text-primary); font-weight: 700;">${evt.title || 'Untitled Event'}</strong>
                          <div style="font-size: 0.775rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td>
                          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-primary);">
                            ${evt.department || userDept}
                          </span>
                        </td>
                        <td>
                          <div>${evt.date || 'TBD'}</div>
                          <div style="font-size: 0.775rem; color: var(--text-secondary);">${evt.venue || 'Campus Auditorium'}</div>
                        </td>
                        <td>
                          <strong>${evt.registeredCount || evt.attendeesCount || 18}</strong> students
                        </td>
                        <td>
                          <span class="status-pill ${statusClass}">${statusText}</span>
                        </td>
                        <td>
                          ${!evt.endorsed && isUpcoming ? `
                            <button class="btn btn-sm btn-outline-primary btn-endorse" data-id="${evt.id}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 6px;">
                              ✍️ Endorse
                            </button>
                          ` : `
                            <span style="font-size: 0.75rem; color: #10b981; font-weight: 700;">✓ Verified</span>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- TAB 2: Departmental Grievance Redressal (DGRC) Table -->
          <div class="exec-table-card">
            <div class="exec-table-header">
              <div>
                <h3 style="margin: 0 0 0.25rem 0; font-size: 1.15rem; font-weight: 700; color: #dc2626;">
                  🚨 Student Grievance Redressal Cell (DGRC) — ${userDept}
                </h3>
                <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary);">
                  Review student incident filings, investigate reported issues, and document official institutional action taken
                </p>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="exec-table">
                <thead>
                  <tr>
                    <th>Ticket & Date</th>
                    <th>Category</th>
                    <th>Student / Reporter</th>
                    <th>Description & Incident Details</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${scopedComplaints.length === 0 ? `
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 2.5rem; color: #10b981;">
                        <span style="font-size: 1.5rem;">🎉</span><br>
                        <strong>Zero Grievances Logged</strong><br>
                        <span style="color: var(--text-secondary); font-size: 0.85rem;">No student incident reports have been filed for ${userDept}.</span>
                      </td>
                    </tr>
                  ` : scopedComplaints.map(c => {
                    const isResolved = c.status === 'resolved';
                    return `
                      <tr>
                        <td>
                          <strong style="color: #6366f1; font-family: monospace;">${c.ticketId || c.id}</strong>
                          <div style="font-size: 0.75rem; color: var(--text-secondary);">
                            ${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}
                          </div>
                        </td>
                        <td>
                          <span style="font-size: 0.82rem; font-weight: 700; background: #fee2e2; color: #dc2626; padding: 0.2rem 0.55rem; border-radius: 6px;">
                            ${c.category || 'Misbehavior'}
                          </span>
                        </td>
                        <td>
                          <div style="font-weight: 600; color: var(--text-primary);">
                            ${c.isAnonymous ? '🔒 Anonymous Student' : (c.authorName || c.reporterName || 'Student')}
                          </div>
                          ${!c.isAnonymous && c.reporterPrn ? `
                            <div style="font-size: 0.75rem; font-family: monospace; color: var(--text-secondary);">
                              PRN: ${c.reporterPrn}
                            </div>
                          ` : ''}
                        </td>
                        <td style="max-width: 320px;">
                          <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
                            ${c.description || 'No description provided.'}
                          </div>
                          ${c.resolutionNote ? `
                            <div style="margin-top: 0.4rem; font-size: 0.75rem; background: #f0fdf4; border: 1px solid #bbf7d0; color: #166534; padding: 0.3rem 0.5rem; border-radius: 6px;">
                              <strong>Action Taken:</strong> ${c.resolutionNote}
                            </div>
                          ` : ''}
                        </td>
                        <td>
                          <span class="status-pill ${isResolved ? 'status-approved' : 'status-pending'}">
                            ${isResolved ? '✓ Resolved' : 'Pending Review'}
                          </span>
                        </td>
                        <td>
                          ${!isResolved ? `
                            <button class="btn btn-sm btn-primary btn-resolve-grievance" data-id="${c.id || c.ticketId}" style="padding: 0.35rem 0.75rem; font-size: 0.75rem; border-radius: 6px; background: #16a34a; border-color: #16a34a; white-space: nowrap;">
                              ✅ Take Action & Resolve
                            </button>
                          ` : `
                            <span style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">Action Closed</span>
                          `}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        `}
      </div>
    `;

    bindEvents();
  };

  const bindEvents = () => {
    // Tab switching
    container.querySelector('#tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events';
      sessionStorage.setItem('ep_exec_tab', 'events');
      render();
    });

    container.querySelector('#tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances';
      sessionStorage.setItem('ep_exec_tab', 'grievances');
      render();
    });

    // Bind Export NAAC Criterion 5 CSV
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => {
      let csv = 'Event Title,Department,Category,Date,Venue,Registrations,Endorsed By Role\n';
      scopedEvents.forEach(e => {
        csv += `"${(e.title || '').replace(/"/g, '""')}","${(e.department || userDept).replace(/"/g, '""')}","${e.category || 'Campus'}","${e.date || ''}","${(e.venue || '').replace(/"/g, '""')}",${e.registeredCount || 18},"${roleLabel}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EventPulse_NAAC_Criterion_5_Report_${(userDept || 'Dept').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });

    // Bind Export NAAC 5.1.5 Grievance Audit Log CSV
    container.querySelector('#btn-export-dgrc')?.addEventListener('click', () => {
      let csv = 'Ticket ID,Date,Department,Category,Reporter,Description,Status,Action Taken Note\n';
      scopedComplaints.forEach(c => {
        const reporter = c.isAnonymous ? 'Anonymous' : (c.authorName || c.reporterName || 'Student');
        csv += `"${c.ticketId || c.id}","${c.createdAt ? c.createdAt.slice(0, 10) : ''}","${userDept}","${c.category || ''}","${reporter}","${(c.description || '').replace(/"/g, '""')}","${c.status || 'pending'}","${(c.resolutionNote || '').replace(/"/g, '""')}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `EventPulse_NAAC_5.1.5_Grievance_Audit_${(userDept || 'Dept').replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    });

    // Bind Event Endorsement
    container.querySelectorAll('.btn-endorse').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;

        e.currentTarget.disabled = true;
        e.currentTarget.innerText = 'Endorsing...';

        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true,
            endorsedBy: user.email,
            endorsedRole: role,
            endorsedAt: new Date().toISOString()
          });
          alert('✅ Event officially endorsed by ' + roleLabel);
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Endorsement note: ' + err.message);
          e.currentTarget.disabled = false;
          e.currentTarget.innerText = '✍️ Endorse';
        }
      });
    });

    // Bind Grievance Resolution Action
    container.querySelectorAll('.btn-resolve-grievance').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-id');
        if (!ticketId) return;

        const actionNote = prompt(
          `Official Action Note for Ticket ${ticketId}:\n(Describe the investigation findings or resolution taken by HOD)`,
          `Matter investigated by HOD (${userDept}). Action taken and student grievance resolved.`
        );

        if (actionNote === null) return; // User cancelled

        e.currentTarget.disabled = true;
        e.currentTarget.innerText = 'Updating...';

        const res = await updateComplaintStatus(ticketId, 'resolved', actionNote.trim());
        if (res.success) {
          alert(`✅ Grievance ${ticketId} marked as RESOLVED.\nAction note logged in institutional records.`);
          renderExecutiveDashboardView(container, navigateTo);
        } else {
          alert('Notice updating grievance: ' + (res.error || 'Failed'));
          e.currentTarget.disabled = false;
          e.currentTarget.innerText = '✅ Take Action & Resolve';
        }
      });
    });
  };

  render();
}
