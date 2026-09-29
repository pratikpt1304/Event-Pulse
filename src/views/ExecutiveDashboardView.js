import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getEvents } from '../services/events';
import { getAllComplaints, updateComplaintStatus } from '../services/complaints';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';

export async function renderExecutiveDashboardView(container, navigateTo) {
  const user = getCurrentUser();
  if (!user) { navigateTo('login'); return; }

  const role = user.role || 'student';
  const userDept = user.department || 'Integrated M.Tech';
  const isAdmin = isUserAdmin(user) || role === 'admin';

  const [allEvents, allComplaints] = await Promise.all([getEvents(), getAllComplaints()]);

  // ─────────────────────────────────────────────────────────────────
  //  HOD PORTAL
  // ─────────────────────────────────────────────────────────────────
  if (role === 'hod') {
    await renderHODPortal({ container, navigateTo, user, userDept, allEvents, allComplaints });
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  //  DEAN / VC / ADMIN PORTAL
  // ─────────────────────────────────────────────────────────────────
  await renderDeanPortal({ container, navigateTo, user, role, isAdmin, allEvents, allComplaints });
}

// ═══════════════════════════════════════════════════════════════════
//  HOD PORTAL — single-department, intimate, action-focused
// ═══════════════════════════════════════════════════════════════════
async function renderHODPortal({ container, navigateTo, user, userDept, allEvents, allComplaints }) {
  let activeTab = sessionStorage.getItem('ep_exec_tab') || 'events';

  const deptEvents = allEvents.filter(e => {
    const eDept = (e.department || '').toLowerCase();
    const td = userDept.toLowerCase();
    return eDept.includes(td) || td.includes(eDept) || !e.department;
  });

  const deptComplaints = allComplaints.filter(c => {
    const rDept = (c.reporterDept || '').toLowerCase();
    const td = userDept.toLowerCase();
    return rDept.includes(td) || td.includes(rDept) || rDept === 'general' || rDept === 'imtech';
  });

  const pending = deptComplaints.filter(c => c.status !== 'resolved');
  const upcoming = deptEvents.filter(e => new Date(e.date || e.startDate) >= new Date());
  const needsEndorsement = upcoming.filter(e => !e.endorsed);

  const render = () => {
    container.innerHTML = `
      <style>
        .hod-wrap {
          padding: 1.25rem 0 4rem;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        /* Top identity bar */
        .hod-identity {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem 1.25rem;
          background: linear-gradient(135deg, rgba(59,130,246,0.12) 0%, rgba(99,102,241,0.08) 100%);
          border: 1px solid rgba(59,130,246,0.2);
          border-radius: 14px;
          margin-bottom: 1.5rem;
        }

        .hod-avatar {
          width: 48px; height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #3b82f6, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          flex-shrink: 0;
        }

        .hod-name {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .hod-dept-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(59,130,246,0.15);
          color: #60a5fa;
          border: 1px solid rgba(59,130,246,0.25);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 0.72rem;
          font-weight: 700;
          letter-spacing: 0.03em;
          margin-top: 3px;
        }

        .hod-export-btn {
          margin-left: auto;
          display: flex;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .hod-btn-sm {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--text-secondary);
          border-radius: 9px;
          padding: 7px 12px;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .hod-btn-sm:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

        /* Alert banner if endorsements pending */
        .hod-alert {
          background: rgba(245,158,11,0.1);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 11px;
          padding: 0.75rem 1rem;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          margin-bottom: 1.25rem;
          font-size: 0.85rem;
          color: #fbbf24;
          font-weight: 600;
        }

        /* Stat pills */
        .hod-stats {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }

        .hod-stat {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 1rem;
          text-align: center;
        }

        .hod-stat-val {
          font-size: 1.6rem;
          font-weight: 800;
          line-height: 1;
          margin-bottom: 4px;
        }

        .hod-stat-label {
          font-size: 0.72rem;
          color: var(--text-secondary);
          font-weight: 500;
        }

        /* Tabs */
        .hod-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.25rem;
          width: fit-content;
        }

        .hod-tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 18px;
          font-size: 0.85rem;
          font-weight: 700;
          font-family: inherit;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .hod-tab.active {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }

        .hod-badge {
          background: #ef4444;
          color: #fff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
        }

        /* Table card */
        .hod-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          overflow: hidden;
        }

        .hod-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .hod-table th {
          padding: 0.7rem 1.1rem;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          background: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-subtle);
          text-align: left;
        }

        .hod-table td {
          padding: 0.85rem 1.1rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          vertical-align: middle;
        }

        .hod-table tr:last-child td { border-bottom: none; }
        .hod-table tr:hover td { background: var(--bg-surface-elevated); }

        .pill { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
        .pill-green  { background: rgba(16,185,129,0.12); color: #10b981; }
        .pill-amber  { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .pill-gray   { background: rgba(100,116,139,0.12); color: #64748b; }
        .pill-red    { background: rgba(239,68,68,0.12); color: #ef4444; }

        .hod-action-btn {
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 0.75rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          border: none;
          transition: all 0.15s;
          white-space: nowrap;
        }

        .btn-endorse-style { background: rgba(59,130,246,0.12); color: #3b82f6; border: 1px solid rgba(59,130,246,0.25); }
        .btn-endorse-style:hover { background: rgba(59,130,246,0.22); }
        .btn-resolve-style { background: rgba(16,185,129,0.12); color: #10b981; border: 1px solid rgba(16,185,129,0.25); }
        .btn-resolve-style:hover { background: rgba(16,185,129,0.22); }

        .hod-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); font-size: 0.88rem; }

        @media (max-width: 600px) {
          .hod-stats { grid-template-columns: repeat(3, 1fr); gap: 0.5rem; }
          .hod-tabs { width: 100%; }
          .hod-tab { flex: 1; justify-content: center; }
        }
      </style>

      <div class="hod-wrap">

        <!-- Identity bar -->
        <div class="hod-identity">
          <div class="hod-avatar">📚</div>
          <div>
            <div class="hod-name">${user.name || 'HOD'}</div>
            <div class="hod-dept-tag">🏛️ ${userDept}</div>
          </div>
          <div class="hod-export-btn">
            <button class="hod-btn-sm" id="btn-export-naac">📥 NAAC Report</button>
            <button class="hod-btn-sm" id="btn-export-dgrc">🛡️ Grievance Log</button>
          </div>
        </div>

        <!-- Alert if events need endorsement -->
        ${needsEndorsement.length > 0 ? `
          <div class="hod-alert">
            ⚠️ <span>${needsEndorsement.length} upcoming event${needsEndorsement.length > 1 ? 's' : ''} in <strong>${userDept}</strong> are awaiting your endorsement.</span>
          </div>
        ` : ''}

        <!-- Stats -->
        <div class="hod-stats">
          <div class="hod-stat">
            <div class="hod-stat-val" style="color: #6366f1;">${deptEvents.length}</div>
            <div class="hod-stat-label">Dept Events</div>
          </div>
          <div class="hod-stat">
            <div class="hod-stat-val" style="color: #3b82f6;">${upcoming.length}</div>
            <div class="hod-stat-label">Upcoming</div>
          </div>
          <div class="hod-stat" style="border-left: 3px solid ${pending.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="hod-stat-val" style="color: ${pending.length > 0 ? '#ef4444' : '#10b981'};">${pending.length}</div>
            <div class="hod-stat-label">Grievances</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="hod-tabs">
          <button class="hod-tab ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            🎪 Events (${deptEvents.length})
          </button>
          <button class="hod-tab ${activeTab === 'grievances' ? 'active' : ''}" id="tab-btn-grievances">
            🚨 DGRC
            ${pending.length > 0 ? `<span class="hod-badge">${pending.length}</span>` : ''}
          </button>
        </div>

        ${activeTab === 'events' ? `
          <div class="hod-card">
            <div style="padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                ${userDept} — Events & Endorsements
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                Only events mapped to your department are shown
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="hod-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th>Endorsement</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptEvents.length === 0 ? `
                    <tr><td colspan="5" class="hod-empty">📭 No events for ${userDept} yet.</td></tr>
                  ` : deptEvents.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700;">${evt.title || 'Untitled'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td style="font-size: 0.82rem; white-space: nowrap;">${evt.date || 'TBD'}</td>
                        <td style="font-weight: 700; color: #6366f1;">${evt.registeredCount || evt.attendeesCount || 18}</td>
                        <td>
                          <span class="pill ${isUpcoming ? 'pill-amber' : 'pill-gray'}">
                            ${isUpcoming ? 'Upcoming' : 'Completed'}
                          </span>
                        </td>
                        <td>
                          ${!evt.endorsed && isUpcoming ? `
                            <button class="hod-action-btn btn-endorse-style btn-endorse" data-id="${evt.id}">
                              ✍️ Endorse
                            </button>
                          ` : isUpcoming ? `
                            <span class="pill pill-green">✓ Endorsed</span>
                          ` : `
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">—</span>
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
          <div class="hod-card">
            <div style="padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border-subtle);">
              <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                DGRC — Departmental Grievance Redressal
              </div>
              <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                Student complaints filed under ${userDept}
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="hod-table">
                <thead>
                  <tr><th>Ticket</th><th>Category</th><th>Student</th><th>Issue</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${deptComplaints.length === 0 ? `
                    <tr><td colspan="6" class="hod-empty">🎉 No grievances filed in ${userDept}.</td></tr>
                  ` : deptComplaints.map(c => {
                    const isResolved = c.status === 'resolved';
                    return `
                      <tr>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; color: #6366f1; font-weight: 700;">${c.ticketId || c.id}</span>
                          <div style="font-size: 0.68rem; color: var(--text-secondary);">${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}</div>
                        </td>
                        <td><span class="pill pill-red" style="font-size: 0.68rem;">${c.category || 'General'}</span></td>
                        <td style="font-size: 0.83rem;">
                          <div style="font-weight: 600;">${c.isAnonymous ? '🔒 Anonymous' : (c.authorName || 'Student')}</div>
                          ${!c.isAnonymous && c.reporterPrn ? `<div style="font-size: 0.68rem; font-family: monospace; color: var(--text-secondary);">${c.reporterPrn}</div>` : ''}
                        </td>
                        <td style="max-width: 240px; font-size: 0.82rem; line-height: 1.4;">
                          ${c.description || '—'}
                          ${c.resolutionNote ? `<div style="font-size: 0.7rem; color: #10b981; margin-top: 3px; font-weight: 600;">✓ ${c.resolutionNote}</div>` : ''}
                        </td>
                        <td><span class="pill ${isResolved ? 'pill-green' : 'pill-amber'}">${isResolved ? 'Resolved' : 'Pending'}</span></td>
                        <td>
                          ${!isResolved ? `
                            <button class="hod-action-btn btn-resolve-style btn-resolve-grievance" data-id="${c.id || c.ticketId}">
                              ✅ Resolve
                            </button>
                          ` : `<span style="font-size: 0.72rem; color: #10b981; font-weight: 700;">Closed</span>`}
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
    bindHODEvents();
  };

  const bindHODEvents = () => {
    container.querySelector('#tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events'; sessionStorage.setItem('ep_exec_tab', 'events'); render();
    });
    container.querySelector('#tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances'; sessionStorage.setItem('ep_exec_tab', 'grievances'); render();
    });
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => exportNAAC(deptEvents, userDept, 'HOD'));
    container.querySelector('#btn-export-dgrc')?.addEventListener('click', () => exportDGRC(deptComplaints, userDept));

    container.querySelectorAll('.btn-endorse').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true, endorsedBy: user.email,
            endorsedRole: 'hod', endorsedAt: new Date().toISOString()
          });
          alert('✅ Event endorsed by HOD — ' + userDept);
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Error: ' + err.message);
          e.currentTarget.disabled = false; e.currentTarget.innerText = '✍️ Endorse';
        }
      });
    });

    container.querySelectorAll('.btn-resolve-grievance').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-id');
        if (!ticketId) return;
        const note = prompt(`Action note for Ticket ${ticketId}:`, `Investigated by HOD (${userDept}). Grievance resolved.`);
        if (note === null) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        const res = await updateComplaintStatus(ticketId, 'resolved', note.trim());
        if (res.success) { alert(`✅ Ticket ${ticketId} resolved.`); renderExecutiveDashboardView(container, navigateTo); }
        else { alert('Error: ' + (res.error || 'Failed')); e.currentTarget.disabled = false; e.currentTarget.innerText = '✅ Resolve'; }
      });
    });
  };

  render();
}

// ═══════════════════════════════════════════════════════════════════
//  DEAN / VC / ADMIN PORTAL — school-wide, multi-dept view
// ═══════════════════════════════════════════════════════════════════
async function renderDeanPortal({ container, navigateTo, user, role, isAdmin, allEvents, allComplaints }) {
  let activeTab = sessionStorage.getItem('ep_exec_tab') || 'overview';
  let deptFilter = 'all'; // department drill-down filter

  const roleLabel = role === 'dean' ? 'Dean — School of Engineering' : role === 'vc' ? 'Vice Chancellor' : 'Administration';
  const roleIcon  = role === 'dean' ? '🎓' : role === 'vc' ? '👑' : '🛡️';
  const accentColor = role === 'dean' ? '#8b5cf6' : role === 'vc' ? '#10b981' : '#ef4444';

  // Dynamically extract ALL unique departments from events + complaints data
  const deptSet = new Set();
  allEvents.forEach(e => { if (e.department) deptSet.add(e.department); });
  allComplaints.forEach(c => { if (c.reporterDept && c.reporterDept !== 'general') deptSet.add(c.reporterDept); });
  // Ensure baseline departments are always present even if no data yet
  ['Computer Science & Engineering', 'Information Technology', 'AI & Data Science',
   'Integrated M.Tech', 'BBA', 'Mechanical Engineering',
   'Cyber Security', 'MBA / MCA'].forEach(d => deptSet.add(d));
  const DEPTS = [...deptSet].sort();

  const getFiltered = () => {
    const events = deptFilter === 'all' ? allEvents : allEvents.filter(e => (e.department || '') === deptFilter);
    const complaints = deptFilter === 'all' ? allComplaints : allComplaints.filter(c => (c.reporterDept || '') === deptFilter);
    return { events, complaints };
  };

  // Build benchmarking — one row per department, exact match
  const getBenchmark = () => DEPTS.map(dept => {
    const evts = allEvents.filter(e => (e.department || '') === dept);
    const comps = allComplaints.filter(c => (c.reporterDept || '') === dept);
    const regs = evts.reduce((a, e) => a + (e.registeredCount || e.attendeesCount || 0), 0);
    return { dept, evts: evts.length, regs, complaints: comps.length, resolved: comps.filter(c => c.status === 'resolved').length };
  });

  const render = () => {
    const { events, complaints } = getFiltered();
    const pending = complaints.filter(c => c.status !== 'resolved');
    const upcoming = events.filter(e => new Date(e.date || e.startDate) >= new Date());
    const totalRegs = events.reduce((a, e) => a + (e.registeredCount || e.attendeesCount || 18), 0);
    const bench = getBenchmark();

    container.innerHTML = `
      <style>
        .dean-wrap {
          padding: 1.25rem 0 4rem;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        /* Identity bar — wider scope emphasis */
        .dean-header {
          background: linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.06) 100%);
          border: 1px solid rgba(139,92,246,0.2);
          border-radius: 14px;
          padding: 1.1rem 1.4rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .dean-avatar {
          width: 48px; height: 48px;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.4rem;
          flex-shrink: 0;
        }

        .dean-title {
          font-size: 1.05rem;
          font-weight: 800;
          color: var(--text-primary);
        }

        .dean-scope-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.3rem;
          background: rgba(139,92,246,0.15);
          color: #c084fc;
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 0.72rem;
          font-weight: 700;
          margin-top: 3px;
        }

        .dean-header-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 0.75rem;
          flex-wrap: wrap;
        }

        /* Dept filter select */
        .dean-dept-filter {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          border-radius: 9px;
          padding: 7px 30px 7px 12px;
          font-size: 0.82rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 14px;
        }

        .dean-action-btn {
          background: rgba(255,255,255,0.06);
          border: 1px solid rgba(255,255,255,0.12);
          color: var(--text-secondary);
          border-radius: 9px;
          padding: 7px 12px;
          font-size: 0.78rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
          white-space: nowrap;
        }
        .dean-action-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

        /* Summary stats — wider */
        .dean-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 0.85rem;
          margin-bottom: 1.5rem;
        }

        .dean-stat {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 0.9rem 1rem;
        }

        .dean-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.4rem;
        }

        .dean-stat-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .dean-stat-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .dean-stat-sub {
          font-size: 0.7rem;
          color: var(--text-secondary);
          margin-top: 3px;
        }

        /* Tabs */
        .dean-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.25rem;
          width: fit-content;
        }

        .dean-tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 18px;
          font-size: 0.85rem;
          font-weight: 700;
          font-family: inherit;
          border-radius: 9px;
          cursor: pointer;
          transition: all 0.15s;
          display: flex;
          align-items: center;
          gap: 0.4rem;
          white-space: nowrap;
        }

        .dean-tab.active {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }

        .dean-tab-count {
          background: #ef4444;
          color: #fff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
        }

        /* Cards */
        .dean-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          overflow: hidden;
        }

        .dean-card-header {
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .dean-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .dean-table th {
          padding: 0.7rem 1.1rem;
          font-size: 0.68rem;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: var(--text-secondary);
          background: var(--bg-surface-elevated);
          border-bottom: 1px solid var(--border-subtle);
          text-align: left;
          white-space: nowrap;
        }

        .dean-table td {
          padding: 0.85rem 1.1rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          vertical-align: middle;
        }

        .dean-table tr:last-child td { border-bottom: none; }
        .dean-table tr:hover td { background: var(--bg-surface-elevated); }

        /* Benchmark bar */
        .bench-bar-wrap { display: flex; align-items: center; gap: 0.5rem; }
        .bench-bar-bg { flex: 1; height: 6px; background: var(--border-subtle); border-radius: 4px; overflow: hidden; }
        .bench-bar-fill { height: 100%; border-radius: 4px; transition: width 0.4s ease; }

        .dpill { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
        .dpill-green  { background: rgba(16,185,129,0.12); color: #10b981; }
        .dpill-amber  { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .dpill-gray   { background: rgba(100,116,139,0.12); color: #64748b; }
        .dpill-red    { background: rgba(239,68,68,0.12); color: #ef4444; }
        .dpill-violet { background: rgba(139,92,246,0.12); color: #8b5cf6; }

        .dean-sanction-btn {
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 0.75rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          background: rgba(139,92,246,0.12);
          color: #a78bfa;
          border: 1px solid rgba(139,92,246,0.25);
          transition: all 0.15s;
          white-space: nowrap;
        }
        .dean-sanction-btn:hover { background: rgba(139,92,246,0.22); }

        .dean-resolve-btn {
          padding: 5px 12px;
          border-radius: 7px;
          font-size: 0.75rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          background: rgba(16,185,129,0.12);
          color: #10b981;
          border: 1px solid rgba(16,185,129,0.25);
          transition: all 0.15s;
        }
        .dean-resolve-btn:hover { background: rgba(16,185,129,0.22); }

        .dean-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); font-size: 0.88rem; }

        @media (max-width: 768px) {
          .dean-stats { grid-template-columns: repeat(2, 1fr); }
          .dean-tabs { width: 100%; }
          .dean-tab { flex: 1; justify-content: center; font-size: 0.78rem; }
        }
      </style>

      <div class="dean-wrap">

        <!-- Header -->
        <div class="dean-header">
          <div class="dean-avatar">${roleIcon}</div>
          <div>
            <div class="dean-title">${roleLabel}</div>
            <div class="dean-scope-tag">🏫 School of Engineering — All Departments</div>
          </div>
          <div class="dean-header-right">
            <!-- Department drill-down filter -->
            <select class="dean-dept-filter" id="dean-dept-filter">
              <option value="all" ${deptFilter === 'all' ? 'selected' : ''}>All Departments</option>
              ${DEPTS.map(d => `<option value="${d}" ${deptFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <button class="dean-action-btn" id="btn-export-naac">📥 NAAC Report</button>
            <button class="dean-action-btn" id="btn-export-dgrc">🛡️ Grievance Log</button>
          </div>
        </div>

        <!-- Stats — 4 wide -->
        <div class="dean-stats">
          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Total Events</div>
              <span style="font-size: 1.1rem;">📅</span>
            </div>
            <div class="dean-stat-val" style="color: #8b5cf6;">${events.length}</div>
            <div class="dean-stat-sub">${upcoming.length} upcoming</div>
          </div>
          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Participations</div>
              <span style="font-size: 1.1rem;">👥</span>
            </div>
            <div class="dean-stat-val" style="color: #10b981;">${totalRegs}</div>
            <div class="dean-stat-sub">across all departments</div>
          </div>
          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Active Dept.</div>
              <span style="font-size: 1.1rem;">🏛️</span>
            </div>
            <div class="dean-stat-val" style="color: #6366f1;">${DEPTS.length}</div>
            <div class="dean-stat-sub">under School of Engineering</div>
          </div>
          <div class="dean-stat" style="border-left: 3px solid ${pending.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Grievances</div>
              <span style="font-size: 1.1rem;">${pending.length > 0 ? '🚨' : '✅'}</span>
            </div>
            <div class="dean-stat-val" style="color: ${pending.length > 0 ? '#ef4444' : '#10b981'};">${pending.length}</div>
            <div class="dean-stat-sub">school-wide pending</div>
          </div>
        </div>

        <!-- Tabs -->
        <div class="dean-tabs">
          <button class="dean-tab ${activeTab === 'overview' ? 'active' : ''}" id="tab-btn-overview">
            📊 Dept. Overview
          </button>
          <button class="dean-tab ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            🎪 Events (${events.length})
          </button>
          <button class="dean-tab ${activeTab === 'grievances' ? 'active' : ''}" id="tab-btn-grievances">
            🚨 Grievances
            ${pending.length > 0 ? `<span class="dean-tab-count">${pending.length}</span>` : ''}
          </button>
        </div>

        ${activeTab === 'overview' ? `
          <!-- Department Benchmarking Table -->
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">Department Benchmarking</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">Compare event activity and grievance resolution across all departments</div>
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Events</th>
                    <th>Participations</th>
                    <th>Activity</th>
                    <th>Complaints</th>
                    <th>Resolution Rate</th>
                  </tr>
                </thead>
                <tbody>
                  ${bench.map(b => {
                    const maxRegs = Math.max(...bench.map(x => x.regs), 1);
                    const rate = b.complaints > 0 ? Math.round((b.resolved / b.complaints) * 100) : 100;
                    const barWidth = Math.round((b.regs / maxRegs) * 100);
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700; font-size: 0.85rem;">${b.dept}</div>
                        </td>
                        <td style="font-weight: 700; color: #8b5cf6;">${b.evts}</td>
                        <td style="font-weight: 700; color: #10b981;">${b.regs}</td>
                        <td style="min-width: 120px;">
                          <div class="bench-bar-wrap">
                            <div class="bench-bar-bg">
                              <div class="bench-bar-fill" style="width: ${barWidth}%; background: #8b5cf6;"></div>
                            </div>
                            <span style="font-size: 0.7rem; color: var(--text-secondary); min-width: 28px;">${barWidth}%</span>
                          </div>
                        </td>
                        <td>${b.complaints > 0 ? `<span class="dpill dpill-red">${b.complaints}</span>` : `<span class="dpill dpill-green">0</span>`}</td>
                        <td>
                          <span class="dpill ${rate === 100 ? 'dpill-green' : rate >= 50 ? 'dpill-amber' : 'dpill-red'}">
                            ${rate}%
                          </span>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : activeTab === 'events' ? `
          <!-- Events with Dean's Sanction (not Endorse like HOD) -->
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">All Events — Dean's Sanction</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  ${deptFilter === 'all' ? 'Showing events across all departments' : `Filtered: ${deptFilter}`}
                </div>
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Attendance</th>
                    <th>Sanction Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${events.length === 0 ? `
                    <tr><td colspan="6" class="dean-empty">📭 No events found.</td></tr>
                  ` : events.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700;">${evt.title || 'Untitled'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td style="font-size: 0.82rem;">${evt.department || '—'}</td>
                        <td style="font-size: 0.82rem; white-space: nowrap;">${evt.date || 'TBD'}</td>
                        <td style="font-weight: 700; color: #8b5cf6;">${evt.registeredCount || evt.attendeesCount || 18}</td>
                        <td>
                          ${!isUpcoming ? `<span class="dpill dpill-gray">Completed</span>`
                          : evt.endorsed ? `<span class="dpill dpill-violet">✓ Sanctioned</span>`
                          : `<span class="dpill dpill-amber">Awaiting</span>`}
                        </td>
                        <td>
                          ${isUpcoming && !evt.endorsed ? `
                            <button class="dean-sanction-btn btn-sanction" data-id="${evt.id}">
                              🎓 Grant Sanction
                            </button>
                          ` : isUpcoming && evt.endorsed ? `
                            <span style="font-size: 0.72rem; color: #8b5cf6; font-weight: 700;">✓ Done</span>
                          ` : `<span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- Grievances — all departments -->
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">School-wide Grievance Oversight</div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  ${deptFilter === 'all' ? 'All departments' : deptFilter} — ${complaints.length} total, ${pending.length} pending
                </div>
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr><th>Ticket</th><th>Department</th><th>Category</th><th>Student</th><th>Issue</th><th>Status</th><th>Action</th></tr>
                </thead>
                <tbody>
                  ${complaints.length === 0 ? `
                    <tr><td colspan="7" class="dean-empty">🎉 No grievances filed.</td></tr>
                  ` : complaints.map(c => {
                    const isResolved = c.status === 'resolved';
                    return `
                      <tr>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; color: #8b5cf6; font-weight: 700;">${c.ticketId || c.id}</span>
                          <div style="font-size: 0.68rem; color: var(--text-secondary);">${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}</div>
                        </td>
                        <td style="font-size: 0.8rem;">${c.reporterDept || '—'}</td>
                        <td><span class="dpill dpill-red" style="font-size: 0.68rem;">${c.category || 'General'}</span></td>
                        <td style="font-size: 0.82rem; font-weight: 600;">${c.isAnonymous ? '🔒 Anonymous' : (c.authorName || 'Student')}</td>
                        <td style="max-width: 220px; font-size: 0.82rem; line-height: 1.4;">
                          ${c.description || '—'}
                          ${c.resolutionNote ? `<div style="font-size: 0.7rem; color: #10b981; margin-top: 3px; font-weight: 600;">✓ ${c.resolutionNote}</div>` : ''}
                        </td>
                        <td><span class="dpill ${isResolved ? 'dpill-green' : 'dpill-amber'}">${isResolved ? 'Resolved' : 'Pending'}</span></td>
                        <td>
                          ${!isResolved ? `
                            <button class="dean-resolve-btn btn-resolve-grievance" data-id="${c.id || c.ticketId}">
                              ✅ Resolve
                            </button>
                          ` : `<span style="font-size: 0.72rem; color: #10b981; font-weight: 700;">Closed</span>`}
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
    bindDeanEvents({ events, complaints, bench });
  };

  const bindDeanEvents = ({ events, complaints }) => {
    // Dept filter change
    container.querySelector('#dean-dept-filter')?.addEventListener('change', (e) => {
      deptFilter = e.target.value;
      render();
    });

    // Tabs
    container.querySelector('#tab-btn-overview')?.addEventListener('click', () => {
      activeTab = 'overview'; sessionStorage.setItem('ep_exec_tab', 'overview'); render();
    });
    container.querySelector('#tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events'; sessionStorage.setItem('ep_exec_tab', 'events'); render();
    });
    container.querySelector('#tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances'; sessionStorage.setItem('ep_exec_tab', 'grievances'); render();
    });

    // Exports
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => exportNAAC(events, deptFilter === 'all' ? 'All Departments' : deptFilter, roleLabel));
    container.querySelector('#btn-export-dgrc')?.addEventListener('click', () => exportDGRC(complaints, deptFilter === 'all' ? 'All Departments' : deptFilter));

    // Dean Sanction (same as endorse in DB, but labeled differently)
    container.querySelectorAll('.btn-sanction').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true, endorsedBy: user.email,
            endorsedRole: role, endorsedAt: new Date().toISOString()
          });
          alert(`✅ Dean's Sanction granted.`);
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Error: ' + err.message);
          e.currentTarget.disabled = false; e.currentTarget.innerText = '🎓 Grant Sanction';
        }
      });
    });

    // Resolve grievance
    container.querySelectorAll('.btn-resolve-grievance').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-id');
        if (!ticketId) return;
        const note = prompt(`Action note for Ticket ${ticketId}:`, `Reviewed by ${roleLabel}. Grievance resolved.`);
        if (note === null) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        const res = await updateComplaintStatus(ticketId, 'resolved', note.trim());
        if (res.success) { alert(`✅ Ticket ${ticketId} resolved.`); renderExecutiveDashboardView(container, navigateTo); }
        else { alert('Error: ' + (res.error || 'Failed')); e.currentTarget.disabled = false; e.currentTarget.innerText = '✅ Resolve'; }
      });
    });
  };

  render();
}

// ─── Shared CSV export helpers ────────────────────────────────────
function exportNAAC(events, dept, roleLabel) {
  let csv = 'Event Title,Department,Category,Date,Venue,Registrations,Approved By\n';
  events.forEach(e => {
    csv += `"${(e.title || '').replace(/"/g, '""')}","${(e.department || dept).replace(/"/g, '""')}","${e.category || 'Campus'}","${e.date || ''}","${(e.venue || '').replace(/"/g, '""')}",${e.registeredCount || 18},"${roleLabel}"\n`;
  });
  downloadCSV(csv, `EventPulse_NAAC_C5_${dept.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportDGRC(complaints, dept) {
  let csv = 'Ticket ID,Date,Department,Category,Reporter,Description,Status,Action Taken\n';
  complaints.forEach(c => {
    const reporter = c.isAnonymous ? 'Anonymous' : (c.authorName || c.reporterName || 'Student');
    csv += `"${c.ticketId || c.id}","${c.createdAt ? c.createdAt.slice(0, 10) : ''}","${dept}","${c.category || ''}","${reporter}","${(c.description || '').replace(/"/g, '""')}","${c.status || 'pending'}","${(c.resolutionNote || '').replace(/"/g, '""')}"\n`;
  });
  downloadCSV(csv, `EventPulse_DGRC_${dept.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
