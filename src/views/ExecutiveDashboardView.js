import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getEvents } from '../services/events';
import { getAllComplaints, updateComplaintStatus } from '../services/complaints';
import { renderAdminView } from './AdminView';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getAllUsers } from '../services/users';
import { getAllRegistrations } from '../services/registrations';

export async function renderExecutiveDashboardView(container, navigateTo) {
  const user = getCurrentUser();
  if (!user) { navigateTo('login'); return; }

  const role = user.role || 'student';
  const userDept = user.department || 'Integrated M.Tech';
  const isAdmin = isUserAdmin(user) || role === 'admin';

  const [allEvents, allComplaints, allUsers, allRegistrations] = await Promise.all([
    getEvents(),
    getAllComplaints(),
    getAllUsers().catch(() => []),
    getAllRegistrations().catch(() => [])
  ]);

  // ─────────────────────────────────────────────────────────────────
  //  HOD PORTAL
  // ─────────────────────────────────────────────────────────────────
  if (role === 'hod') {
    await renderHODPortal({ container, navigateTo, user, userDept, allEvents, allComplaints, allUsers, allRegistrations });
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  //  VC PORTAL — Exact Same as Admin Portal (Full Institutional Oversight)
  // ─────────────────────────────────────────────────────────────────
  if (role === 'vc') {
    await renderAdminView(container, navigateTo);
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  //  DEAN / ADMIN PORTAL
  // ─────────────────────────────────────────────────────────────────
  await renderDeanPortal({ container, navigateTo, user, role, isAdmin, allEvents, allComplaints });
}

// ═══════════════════════════════════════════════════════════════════
//  HOD PORTAL — single-department, intimate, action-focused
// ═══════════════════════════════════════════════════════════════════
async function renderHODPortal({ container, navigateTo, user, userDept, allEvents, allComplaints, allUsers = [], allRegistrations = [] }) {
  let activeTab = sessionStorage.getItem('ep_exec_tab') || 'events';
  let studentYearFilter = 'all'; // 'all', '1st Year', '2nd Year', '3rd Year', '4th Year'
  let studentStatusFilter = 'all'; // 'all', 'active', 'inactive'
  let studentScope = 'dept'; // 'dept' (HOD department) or 'all' (all university)
  let studentSearchQuery = '';
  let selectedStudentForModal = null;

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

  // Helper to match student department
  const isDeptMatch = (dept) => {
    const ud = (dept || '').toLowerCase().trim();
    const td = (userDept || '').toLowerCase().trim();
    if (!ud) return false;
    const isImtech = (td.includes('imtech') || td.includes('integrated')) && (ud.includes('imtech') || ud.includes('integrated'));
    return isImtech || ud.includes(td) || td.includes(ud);
  };

  // Enrich a student record with registration data
  const enrichStudent = (student) => {
    const sUid = (student.uid || '').trim();
    const sEmail = (student.email || '').toLowerCase().trim();
    const sPrn = (student.prn || '').toLowerCase().trim();

    const studentRegs = (allRegistrations || []).filter(r => {
      const rUid = (r.userId || '').trim();
      const rEmail = (r.email || r.studentEmail || '').toLowerCase().trim();
      const rPrn = (r.prn || r.studentPrn || '').toLowerCase().trim();
      return (sUid && rUid === sUid) ||
             (sEmail && (rEmail === sEmail || rUid.toLowerCase() === sEmail)) ||
             (sPrn && rPrn && rPrn === sPrn);
    });

    const attendedCount = studentRegs.filter(r => r.status === 'attended' || r.attendance === 'present').length;
    const isActive = studentRegs.length > 0;

    let year = (student.year || '').trim();
    if (!year) year = '1st Year';

    return {
      ...student,
      year,
      regs: studentRegs,
      registeredCount: studentRegs.length,
      attendedCount,
      isActive
    };
  };

  const allStudents = (allUsers || []).filter(u => !u.role || u.role === 'student');
  const matchedDeptStudents = allStudents.filter(u => isDeptMatch(u.department));
  const deptStudents = matchedDeptStudents.length > 0 ? matchedDeptStudents : allStudents.slice(0, 15);

  const enrichedDeptStudents = deptStudents.map(enrichStudent);
  const enrichedAllStudents = allStudents.map(enrichStudent);

  // Stats for department students
  const totalDeptStudents = enrichedDeptStudents.length;
  const activeStudentsCount = enrichedDeptStudents.filter(s => s.isActive).length;
  const inactiveStudentsCount = totalDeptStudents - activeStudentsCount;
  const activeRatePct = totalDeptStudents > 0 ? Math.round((activeStudentsCount / totalDeptStudents) * 100) : 0;
  const totalRegistrationsCount = enrichedDeptStudents.reduce((sum, s) => sum + s.registeredCount, 0);

  const yearCounts = {
    '1st Year': enrichedDeptStudents.filter(s => (s.year || '').toLowerCase().includes('1')).length,
    '2nd Year': enrichedDeptStudents.filter(s => (s.year || '').toLowerCase().includes('2')).length,
    '3rd Year': enrichedDeptStudents.filter(s => (s.year || '').toLowerCase().includes('3')).length,
    '4th Year': enrichedDeptStudents.filter(s => (s.year || '').toLowerCase().includes('4') || (s.year || '').toLowerCase().includes('final')).length
  };

  const getFilteredStudents = () => {
    const baseList = studentScope === 'all' ? enrichedAllStudents : enrichedDeptStudents;
    return baseList.filter(s => {
      // Year filter
      if (studentYearFilter !== 'all') {
        const sy = (s.year || '').toLowerCase();
        const fy = studentYearFilter.toLowerCase();
        if (fy.includes('1') && !sy.includes('1')) return false;
        if (fy.includes('2') && !sy.includes('2')) return false;
        if (fy.includes('3') && !sy.includes('3')) return false;
        if ((fy.includes('4') || fy.includes('final')) && (!sy.includes('4') && !sy.includes('final'))) return false;
      }
      // Status filter
      if (studentStatusFilter === 'active' && !s.isActive) return false;
      if (studentStatusFilter === 'inactive' && s.isActive) return false;
      // Search query
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase().trim();
        const name = (s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const prn = (s.prn || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !prn.includes(q)) return false;
      }
      return true;
    });
  };

  const renderStudentModal = (student) => {
    if (!student) return '';
    const registeredEventIds = new Set((student.regs || []).map(r => r.eventId));
    const unparticipatedUpcoming = upcoming.filter(e => !registeredEventIds.has(e.id));

    return `
      <div class="hod-modal-overlay" id="hod-student-modal">
        <div class="hod-modal-content">
          <!-- Modal Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-subtle);">
            <div style="display:flex; align-items:center; gap:0.85rem;">
              <div style="width:48px; height:48px; border-radius:50%; background:linear-gradient(135deg, #3b82f6, #6366f1); display:flex; align-items:center; justify-content:center; font-size:1.3rem; font-weight:800; color:#fff;">
                ${(student.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <span>${student.name || 'Student Profile'}</span>
                  <span class="pill ${student.isActive ? 'pill-green' : 'pill-red'}" style="font-size:0.68rem;">
                    ${student.isActive ? '🟢 Active Participant' : '⚠️ Inactive (Zero Events)'}
                  </span>
                </div>
                <div style="font-size:0.78rem; color:var(--text-secondary); margin-top:2px;">
                  ${student.email} • PRN: <strong>${student.prn || 'Not Linked'}</strong> • <strong>${student.year || '1st Year'}</strong> (${student.department || userDept})
                </div>
              </div>
            </div>
            <button class="hod-modal-close" id="btn-close-student-modal">✕</button>
          </div>

          <!-- Modal Body -->
          <div style="padding:1.25rem 1.5rem; max-height:calc(82vh - 120px); overflow-y:auto;">
            <!-- Metrics Row -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#3b82f6;">${student.registeredCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Events Enrolled</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#10b981;">${student.attendedCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Events Attended</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#f59e0b;">${student.registeredCount - student.attendedCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Pending / Absent</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#8b5cf6;">${student.registeredCount > 0 ? Math.round((student.attendedCount / student.registeredCount) * 100) : 0}%</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:600;">Attendance Rate</div>
              </div>
            </div>

            <!-- Section 1: Events Participated -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.9rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>✅ Enrolled & Participated Events</span>
                <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:600;">(${student.regs.length})</span>
              </div>
              ${student.regs.length === 0 ? `
                <div style="background:rgba(239,68,68,0.06); border:1px dashed rgba(239,68,68,0.25); border-radius:10px; padding:1.2rem; text-align:center;">
                  <div style="font-size:1.5rem; margin-bottom:0.35rem;">⚠️</div>
                  <div style="font-size:0.85rem; font-weight:700; color:#ef4444;">No Events Recorded Yet</div>
                  <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; max-width:440px; margin-inline:auto;">
                    This student has not registered for any university or departmental events this semester. Academic counseling is recommended to meet co-curricular benchmarks.
                  </div>
                </div>
              ` : `
                <table class="hod-table" style="font-size:0.82rem; border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle);">
                  <thead>
                    <tr>
                      <th>Event Title</th>
                      <th>Date & Venue</th>
                      <th>Status</th>
                      <th>Attendance</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${student.regs.map(r => `
                      <tr>
                        <td>
                          <div style="font-weight:700; color:var(--text-primary);">${r.eventTitle || 'Campus Event'}</div>
                          <div style="font-size:0.7rem; color:var(--text-secondary);">Pass ID: ${r.id}</div>
                        </td>
                        <td style="white-space:nowrap; font-size:0.78rem;">
                          <div>${r.eventDate || 'Scheduled'}</div>
                          <div style="font-size:0.7rem; color:var(--text-secondary);">${r.venue || 'Campus'}</div>
                        </td>
                        <td>
                          <span class="pill ${r.status === 'confirmed' || r.status === 'attended' ? 'pill-green' : r.status === 'cancelled' ? 'pill-red' : 'pill-amber'}">
                            ${r.status || 'Registered'}
                          </span>
                        </td>
                        <td>
                          ${r.attendance === 'present' || r.status === 'attended' ? `
                            <span class="pill pill-green">✓ Present</span>
                          ` : r.attendance === 'absent' ? `
                            <span class="pill pill-red">✗ Absent</span>
                          ` : `
                            <span class="pill pill-gray">⏳ Scheduled</span>
                          `}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Section 2: Events NOT Participated (What they are missing!) -->
            <div>
              <div style="font-size:0.9rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🎯 Upcoming Department Events Not Enrolled Yet</span>
                <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:600;">(${unparticipatedUpcoming.length} available)</span>
              </div>
              ${unparticipatedUpcoming.length === 0 ? `
                <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:0.85rem; font-size:0.8rem; color:#10b981;">
                  🎉 Outstanding! Student is registered for all upcoming department events.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${unparticipatedUpcoming.map(ev => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                      <div>
                        <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${ev.title || 'Untitled'}</div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                          📅 ${ev.date || 'TBD'} • 📍 ${ev.venue || 'Campus'} • Category: ${ev.category || 'Academic'}
                        </div>
                      </div>
                      <span class="pill pill-amber" style="font-size:0.68rem; white-space:nowrap;">
                        Not Enrolled
                      </span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

          </div>

          <!-- Modal Footer -->
          <div style="padding:0.9rem 1.5rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-elevated);">
            <div style="font-size:0.75rem; color:var(--text-secondary);">
              Academic Mentor Action: Review co-curricular compliance per NAAC/NBA standards.
            </div>
            <button class="hod-btn-sm" id="btn-modal-close-footer" style="background:rgba(255,255,255,0.08); color:var(--text-primary);">
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const render = () => {
    const filteredStudents = getFilteredStudents();

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

        /* Stat pills (4-col grid) */
        .hod-stats {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
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
        .pill-blue   { background: rgba(59,130,246,0.12); color: #3b82f6; }
        .pill-indigo { background: rgba(99,102,241,0.12); color: #818cf8; }

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

        .hod-filter-btn {
          background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.08);
          color: var(--text-secondary);
          border-radius: 8px;
          padding: 4px 10px;
          font-size: 0.75rem;
          font-weight: 700;
          font-family: inherit;
          cursor: pointer;
          transition: all 0.15s;
        }
        .hod-filter-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
        .hod-filter-btn.active {
          background: #3b82f6;
          color: #fff;
          border-color: #3b82f6;
          box-shadow: 0 1px 4px rgba(59,130,246,0.3);
        }

        /* Modal */
        .hod-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.75);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .hod-modal-content {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          width: 100%;
          max-width: 680px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: modalFadeIn 0.2s ease-out;
        }

        @keyframes modalFadeIn {
          from { opacity: 0; transform: scale(0.97); }
          to { opacity: 1; transform: scale(1); }
        }

        .hod-modal-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          line-height: 1;
        }
        .hod-modal-close:hover { color: var(--text-primary); }

        .hod-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); font-size: 0.88rem; }

        @media (max-width: 900px) {
          .hod-stats { grid-template-columns: repeat(2, 1fr); }
        }

        @media (max-width: 600px) {
          .hod-stats { grid-template-columns: 1fr; gap: 0.5rem; }
          .hod-tabs { width: 100%; }
          .hod-tab { flex: 1; justify-content: center; padding: 8px 10px; font-size: 0.78rem; }
        }
      </style>

      <div class="hod-wrap">

        <!-- Identity bar -->
        <div class="hod-identity">
          <div class="hod-avatar">📚</div>
          <div>
            <div class="hod-name">${user.name || 'Head of Department'}</div>
            <div class="hod-dept-tag">🏛️ ${userDept}</div>
          </div>
          <div class="hod-export-btn">
            <button class="hod-btn-sm" id="btn-export-students-top">📥 Student Roster</button>
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

        <!-- 4-Stat Overview Cards -->
        <div class="hod-stats">
          <div class="hod-stat">
            <div class="hod-stat-val" style="color: #6366f1;">${deptEvents.length}</div>
            <div class="hod-stat-label">Dept Events</div>
          </div>
          <div class="hod-stat">
            <div class="hod-stat-val" style="color: #3b82f6;">${upcoming.length}</div>
            <div class="hod-stat-label">Upcoming Events</div>
          </div>
          <div class="hod-stat" style="border-left: 3px solid ${activeRatePct >= 50 ? '#10b981' : '#f59e0b'};">
            <div class="hod-stat-val" style="color: #3b82f6;">${totalDeptStudents}</div>
            <div class="hod-stat-label">${activeRatePct}% Active in Events</div>
          </div>
          <div class="hod-stat" style="border-left: 3px solid ${pending.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="hod-stat-val" style="color: ${pending.length > 0 ? '#ef4444' : '#10b981'};">${pending.length}</div>
            <div class="hod-stat-label">Grievances</div>
          </div>
        </div>

        <!-- Tabs: Events, Students, Grievances -->
        <div class="hod-tabs">
          <button class="hod-tab ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            🎪 Events (${deptEvents.length})
          </button>
          <button class="hod-tab ${activeTab === 'students' ? 'active' : ''}" id="tab-btn-students">
            👨‍🎓 Students (${totalDeptStudents})
            ${inactiveStudentsCount > 0 ? `<span class="hod-badge" style="background: #f59e0b;">${inactiveStudentsCount} idle</span>` : ''}
          </button>
          <button class="hod-tab ${activeTab === 'grievances' ? 'active' : ''}" id="tab-btn-grievances">
            🚨 DGRC
            ${pending.length > 0 ? `<span class="hod-badge">${pending.length}</span>` : ''}
          </button>
        </div>

        <!-- TAB 1: EVENTS -->
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
        ` : ''}

        <!-- TAB 2: STUDENTS INTELLIGENCE & YEAR-WISE PARTICIPATION -->
        ${activeTab === 'students' ? `
          <div class="hod-card">
            <!-- Header with Title & Export -->
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
                <div>
                  <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span>👨‍🎓 ${userDept} — Student Participation Intelligence</span>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                    Track real-time event engagements, attendance compliance, and identify inactive students needing academic counseling.
                  </div>
                </div>
                <button class="hod-btn-sm" id="btn-export-students-tab" style="background: rgba(59,130,246,0.15); color: #60a5fa; border: 1px solid rgba(59,130,246,0.3);">
                  📥 Export Student Roster (CSV)
                </button>
              </div>

              <!-- Quick Insight Chips -->
              <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; font-size: 0.78rem;">
                <div style="background: var(--bg-surface-elevated); padding: 5px 12px; border-radius: 8px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                  👥 Total: <strong>${totalDeptStudents} Students</strong>
                </div>
                <div style="background: rgba(16,185,129,0.1); color: #10b981; padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(16,185,129,0.25);">
                  🟢 Active in Events: <strong>${activeStudentsCount} (${activeRatePct}%)</strong>
                </div>
                <div style="background: rgba(239,68,68,0.1); color: #ef4444; padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(239,68,68,0.25);">
                  ⚠️ Zero Events: <strong>${inactiveStudentsCount}</strong>
                </div>
                <div style="background: rgba(99,102,241,0.1); color: #818cf8; padding: 5px 12px; border-radius: 8px; border: 1px solid rgba(99,102,241,0.25);">
                  🎟️ Total Registrations: <strong>${totalRegistrationsCount} Passes</strong>
                </div>
              </div>

              <!-- Filter Bar (Search + Scope + Year + Status) -->
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; background: var(--bg-surface-elevated); padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-subtle);">
                <!-- Search Input -->
                <div style="position: relative; flex: 1; min-width: 220px;">
                  <input 
                    type="text" 
                    id="hod-student-search" 
                    value="${studentSearchQuery}" 
                    placeholder="🔍 Search name, PRN, email..." 
                    style="width: 100%; box-sizing: border-box; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; color: var(--text-primary); outline: none;"
                  />
                </div>

                <!-- Scope Toggle -->
                <div style="display: flex; gap: 4px; align-items: center;">
                  <button class="hod-filter-btn ${studentScope === 'dept' ? 'active' : ''}" data-scope="dept" title="Show students strictly in ${userDept}">
                    🏛️ ${userDept} (${enrichedDeptStudents.length})
                  </button>
                  <button class="hod-filter-btn ${studentScope === 'all' ? 'active' : ''}" data-scope="all" title="Show all registered university students">
                    🌐 All University (${allStudents.length})
                  </button>
                </div>

                <!-- Year Filter Pills -->
                <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; margin-right: 2px;">Year:</span>
                  <button class="hod-filter-btn ${studentYearFilter === 'all' ? 'active' : ''}" data-year="all">All</button>
                  <button class="hod-filter-btn ${studentYearFilter === '1st Year' ? 'active' : ''}" data-year="1st Year">1st Yr (${yearCounts['1st Year'] || 0})</button>
                  <button class="hod-filter-btn ${studentYearFilter === '2nd Year' ? 'active' : ''}" data-year="2nd Year">2nd Yr (${yearCounts['2nd Year'] || 0})</button>
                  <button class="hod-filter-btn ${studentYearFilter === '3rd Year' ? 'active' : ''}" data-year="3rd Year">3rd Yr (${yearCounts['3rd Year'] || 0})</button>
                  <button class="hod-filter-btn ${studentYearFilter === '4th Year' ? 'active' : ''}" data-year="4th Year">4th Yr (${yearCounts['4th Year'] || 0})</button>
                </div>

                <!-- Status Filter Pills -->
                <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; margin-right: 2px;">Status:</span>
                  <button class="hod-filter-btn ${studentStatusFilter === 'all' ? 'active' : ''}" data-status="all">All</button>
                  <button class="hod-filter-btn ${studentStatusFilter === 'active' ? 'active' : ''}" data-status="active">🟢 Active</button>
                  <button class="hod-filter-btn ${studentStatusFilter === 'inactive' ? 'active' : ''}" data-status="inactive">⚠️ Inactive</button>
                </div>
              </div>
            </div>

            <!-- Inactive Warning Alert -->
            ${inactiveStudentsCount > 0 && studentStatusFilter !== 'active' ? `
              <div style="background: rgba(245,158,11,0.08); border-bottom: 1px solid rgba(245,158,11,0.2); padding: 8px 16px; font-size: 0.78rem; color: #fbbf24; display: flex; align-items: center; gap: 0.5rem;">
                <span>💡</span>
                <span><strong>HOD Action Guidance:</strong> ${inactiveStudentsCount} students currently have zero event participation recorded. Click <strong>"Inspect Dossier"</strong> to review student profiles and coordinate with faculty mentors for NAAC Criterion 5 compliance.</span>
              </div>
            ` : ''}

            <!-- Students Table -->
            <div style="overflow-x: auto;">
              <table class="hod-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>PRN / Roll</th>
                    <th>Academic Year</th>
                    <th>Event Participation</th>
                    <th>Attendance</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="hod-students-tbody">
                  ${filteredStudents.length === 0 ? `
                    <tr><td colspan="7" class="hod-empty">🔍 No students found matching current filters.</td></tr>
                  ` : filteredStudents.map(student => {
                    const yearLower = (student.year || '').toLowerCase();
                    const yearPillClass = yearLower.includes('1') ? 'pill-blue' :
                                         yearLower.includes('2') ? 'pill-indigo' :
                                         yearLower.includes('3') ? 'pill-green' : 'pill-amber';

                    const sampleEvents = (student.regs || []).slice(0, 2);
                    const remainingEventsCount = (student.regs || []).length - sampleEvents.length;

                    return `
                      <tr>
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                              ${(student.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                              <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                            ${student.prn || 'Not Linked'}
                          </span>
                        </td>
                        <td>
                          <span class="pill ${yearPillClass}">
                            ${student.year || '1st Year'}
                          </span>
                        </td>
                        <td>
                          ${student.registeredCount > 0 ? `
                            <div>
                              <span class="pill pill-green" style="font-weight: 800;">
                                ${student.registeredCount} Registered
                              </span>
                              <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${sampleEvents.map(r => `
                                  <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${r.eventTitle || 'Event'}
                                  </span>
                                `).join('')}
                                ${remainingEventsCount > 0 ? `
                                  <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEventsCount} more</span>
                                ` : ''}
                              </div>
                            </div>
                          ` : `
                            <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                              ⚠️ 0 Events
                            </span>
                          `}
                        </td>
                        <td>
                          ${student.registeredCount > 0 ? `
                            <div style="font-size: 0.8rem;">
                              <span style="font-weight: 800; color: #10b981;">${student.attendedCount} Attended</span>
                              <span style="font-size: 0.72rem; color: var(--text-secondary); margin-left: 2px;">/ ${student.registeredCount}</span>
                            </div>
                          ` : `
                            <span style="font-size: 0.75rem; color: var(--text-secondary);">—</span>
                          `}
                        </td>
                        <td>
                          <span class="pill ${student.isActive ? 'pill-green' : 'pill-red'}">
                            ${student.isActive ? '🟢 Active' : '⚠️ Inactive'}
                          </span>
                        </td>
                        <td>
                          <button class="hod-action-btn btn-endorse-style btn-inspect-student" data-email="${student.email}" data-uid="${student.uid}">
                            🔍 Inspect Dossier
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 3: GRIEVANCES (DGRC) -->
        ${activeTab === 'grievances' ? `
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
        ` : ''}

        <!-- Student Inspection Modal Container -->
        ${selectedStudentForModal ? renderStudentModal(selectedStudentForModal) : ''}

      </div>
    `;

    bindHODEvents();
  };

  const bindHODEvents = () => {
    // Tab switching
    container.querySelector('#tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events'; sessionStorage.setItem('ep_exec_tab', 'events'); render();
    });
    container.querySelector('#tab-btn-students')?.addEventListener('click', () => {
      activeTab = 'students'; sessionStorage.setItem('ep_exec_tab', 'students'); render();
    });
    container.querySelector('#tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances'; sessionStorage.setItem('ep_exec_tab', 'grievances'); render();
    });

    // Exports
    container.querySelector('#btn-export-students-top')?.addEventListener('click', () => exportStudentRoster(enrichedDeptStudents, userDept));
    container.querySelector('#btn-export-students-tab')?.addEventListener('click', () => exportStudentRoster(enrichedDeptStudents, userDept));
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => exportNAAC(deptEvents, userDept, 'HOD'));
    container.querySelector('#btn-export-dgrc')?.addEventListener('click', () => exportDGRC(deptComplaints, userDept));

    // Scope filters
    container.querySelectorAll('.hod-filter-btn[data-scope]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        studentScope = e.currentTarget.getAttribute('data-scope');
        render();
      });
    });

    // Year filters
    container.querySelectorAll('.hod-filter-btn[data-year]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        studentYearFilter = e.currentTarget.getAttribute('data-year');
        render();
      });
    });

    // Status filters
    container.querySelectorAll('.hod-filter-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        studentStatusFilter = e.currentTarget.getAttribute('data-status');
        render();
      });
    });

    // Student Search Input (preserves cursor without losing focus)
    const searchInput = container.querySelector('#hod-student-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        studentSearchQuery = e.target.value;
        // Filter table rows dynamically
        const filtered = getFilteredStudents();
        const tbody = container.querySelector('#hod-students-tbody');
        if (tbody) {
          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="7" class="hod-empty">🔍 No students found matching current filters.</td></tr>`;
          } else {
            tbody.innerHTML = filtered.map(student => {
              const yearLower = (student.year || '').toLowerCase();
              const yearPillClass = yearLower.includes('1') ? 'pill-blue' :
                                   yearLower.includes('2') ? 'pill-indigo' :
                                   yearLower.includes('3') ? 'pill-green' : 'pill-amber';

              const sampleEvents = (student.regs || []).slice(0, 2);
              const remainingEventsCount = (student.regs || []).length - sampleEvents.length;

              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #3b82f6, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                        ${(student.name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                      ${student.prn || 'Not Linked'}
                    </span>
                  </td>
                  <td>
                    <span class="pill ${yearPillClass}">
                      ${student.year || '1st Year'}
                    </span>
                  </td>
                  <td>
                    ${student.registeredCount > 0 ? `
                      <div>
                        <span class="pill pill-green" style="font-weight: 800;">
                          ${student.registeredCount} Registered
                        </span>
                        <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                          ${sampleEvents.map(r => `
                            <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              ${r.eventTitle || 'Event'}
                            </span>
                          `).join('')}
                          ${remainingEventsCount > 0 ? `
                            <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEventsCount} more</span>
                          ` : ''}
                        </div>
                      </div>
                    ` : `
                      <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700; display: inline-flex; align-items: center; gap: 3px;">
                        ⚠️ 0 Events
                      </span>
                    `}
                  </td>
                  <td>
                    ${student.registeredCount > 0 ? `
                      <div style="font-size: 0.8rem;">
                        <span style="font-weight: 800; color: #10b981;">${student.attendedCount} Attended</span>
                        <span style="font-size: 0.72rem; color: var(--text-secondary); margin-left: 2px;">/ ${student.registeredCount}</span>
                      </div>
                    ` : `
                      <span style="font-size: 0.75rem; color: var(--text-secondary);">—</span>
                    `}
                  </td>
                  <td>
                    <span class="pill ${student.isActive ? 'pill-green' : 'pill-red'}">
                      ${student.isActive ? '🟢 Active' : '⚠️ Inactive'}
                    </span>
                  </td>
                  <td>
                    <button class="hod-action-btn btn-endorse-style btn-inspect-student" data-email="${student.email}" data-uid="${student.uid}">
                      🔍 Inspect Dossier
                    </button>
                  </td>
                </tr>
              `;
            }).join('');
            bindInspectButtons();
          }
        }
      });
    }

    // Bind Inspect Student Dossier Modal
    const bindInspectButtons = () => {
      container.querySelectorAll('.btn-inspect-student').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-email');
          const uid = e.currentTarget.getAttribute('data-uid');
          const found = (studentScope === 'all' ? enrichedAllStudents : enrichedDeptStudents).find(s => 
            (email && (s.email || '').toLowerCase() === email.toLowerCase()) || 
            (uid && s.uid === uid)
          );
          if (found) {
            selectedStudentForModal = found;
            render();
          }
        });
      });
    };
    bindInspectButtons();

    // Close Modal events
    container.querySelector('#btn-close-student-modal')?.addEventListener('click', () => {
      selectedStudentForModal = null;
      render();
    });
    container.querySelector('#btn-modal-close-footer')?.addEventListener('click', () => {
      selectedStudentForModal = null;
      render();
    });
    container.querySelector('#hod-student-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'hod-student-modal') {
        selectedStudentForModal = null;
        render();
      }
    });

    // Endorse event
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

    // Resolve grievance
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

function exportStudentRoster(students, dept) {
  let csv = 'Student Name,PRN,Email,Department,Academic Year,Events Registered,Events Attended,Participation Status,Enrolled Events List\n';
  students.forEach(s => {
    const eventTitles = (s.regs || []).map(r => r.eventTitle || r.eventId).join('; ');
    const status = s.isActive ? 'Active' : 'Inactive (0 Events)';
    csv += `"${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.department || dept).replace(/"/g, '""')}","${s.year || '1st Year'}",${s.registeredCount || 0},${s.attendedCount || 0},"${status}","${eventTitles.replace(/"/g, '""')}"\n`;
  });
  downloadCSV(csv, `EventPulse_Students_${dept.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
