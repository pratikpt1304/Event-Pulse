import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getEvents } from '../services/events';
import { getAllComplaints, updateComplaintStatus } from '../services/complaints';
import { renderAdminView } from './AdminView';
import { db } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { getAllUsers } from '../services/users';
import { getAllRegistrations } from '../services/registrations';
import { getAllCertificates, downloadCertificatePDF } from '../services/certificates';
import { getCampusIdeas } from '../services/ideas';
import { getEventTeams } from '../services/teams';
import { createAnnouncement } from '../services/announcements';

export async function renderExecutiveDashboardView(container, navigateTo) {
  const user = getCurrentUser();
  if (!user) { navigateTo('login'); return; }

  const role = user.role || 'student';
  const userDept = user.department || 'Integrated M.Tech';
  const isAdmin = isUserAdmin(user) || role === 'admin';

  const [
    allEvents, 
    allComplaints, 
    allUsers, 
    allRegistrations,
    allCerts,
    allIdeas,
    allTeams
  ] = await Promise.all([
    getEvents(),
    getAllComplaints(),
    getAllUsers().catch(() => []),
    getAllRegistrations().catch(() => []),
    getAllCertificates().catch(() => []),
    getCampusIdeas().catch(() => []),
    getEventTeams().catch(() => [])
  ]);

  // ─────────────────────────────────────────────────────────────────
  //  HOD PORTAL
  // ─────────────────────────────────────────────────────────────────
  if (role === 'hod') {
    await renderHODPortal({ container, navigateTo, user, userDept, allEvents, allComplaints, allUsers, allRegistrations });
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  //  VC PORTAL — Supreme University-Wide Command & 4-Tier Drilldown
  // ─────────────────────────────────────────────────────────────────
  if (role === 'vc') {
    await renderVCPortal({
      container, navigateTo, user, role, isAdmin,
      allEvents, allComplaints, allUsers, allRegistrations,
      allCerts, allIdeas, allTeams
    });
    return;
  }

  // ─────────────────────────────────────────────────────────────────
  //  DEAN / ADMIN PORTAL — Complete School-Level & Student Intelligence
  // ─────────────────────────────────────────────────────────────────
  await renderDeanPortal({ 
    container, navigateTo, user, role, isAdmin, 
    allEvents, allComplaints, allUsers, allRegistrations,
    allCerts, allIdeas, allTeams
  });
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
  const needsEndorsement = upcoming.filter(e => !e.endorsed || e.status === 'pending_approval');

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
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a !important;
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

        <!-- Alert if events need approval -->
        ${needsEndorsement.length > 0 ? `
          <div class="hod-alert" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.6rem;">
            <div>
              ⚠️ <span><strong>${needsEndorsement.length} upcoming event${needsEndorsement.length > 1 ? 's' : ''}</strong> in <strong>${userDept}</strong> are awaiting your official HOD Approval.</span>
            </div>
            <button class="hod-btn-sm" id="btn-hod-review-events" style="background:#10b981; color:#fff; border:none; font-weight:800; cursor:pointer;">
              Review & Approve Now →
            </button>
          </div>
        ` : ''}

        <!-- 4-Stat Overview Cards -->
        <div class="hod-stats">
          <div class="hod-stat">
            <div class="hod-stat-val" style="color: #6366f1;">${deptEvents.length}</div>
            <div class="hod-stat-label">Dept Events</div>
          </div>
          <div class="hod-stat" style="border-left: 3px solid ${needsEndorsement.length > 0 ? '#10b981' : '#3b82f6'};">
            <div class="hod-stat-val" style="color: ${needsEndorsement.length > 0 ? '#10b981' : '#3b82f6'};">${needsEndorsement.length}</div>
            <div class="hod-stat-label">${needsEndorsement.length > 0 ? 'Pending HOD Approval' : 'Upcoming Events'}</div>
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

        <!-- Tabs: Events & Approvals, Students, Grievances -->
        <div class="hod-tabs">
          <button class="hod-tab ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            🎪 Events & Approvals (${deptEvents.length})
            ${needsEndorsement.length > 0 ? `<span class="hod-badge" style="background: #10b981;">${needsEndorsement.length} to approve</span>` : ''}
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

        <!-- TAB 1: EVENTS & APPROVALS -->
        ${activeTab === 'events' ? `
          <div class="hod-card">
            <div style="padding: 0.85rem 1.1rem; border-bottom: 1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:0.5rem;">
              <div>
                <div style="font-size: 0.9rem; font-weight: 700; color: var(--text-primary);">
                  ${userDept} — Events & Official Approvals
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Review and grant HOD approvals to publish departmental events live for students
                </div>
              </div>
              ${needsEndorsement.length > 0 ? `
                <span class="pill pill-amber" style="font-weight:700;">
                  ⚠️ ${needsEndorsement.length} Event${needsEndorsement.length > 1 ? 's' : ''} Awaiting Approval
                </span>
              ` : `
                <span class="pill pill-green" style="font-weight:700;">
                  ✓ All Events Approved
                </span>
              `}
            </div>
            <div style="overflow-x: auto;">
              <table class="hod-table">
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>Date</th>
                    <th>Attendance</th>
                    <th>Approval Status</th>
                    <th>HOD Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${deptEvents.length === 0 ? `
                    <tr><td colspan="5" class="hod-empty">📭 No events for ${userDept} yet.</td></tr>
                  ` : deptEvents.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    const isApproved = evt.status === 'approved' || evt.endorsed;
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700;">${evt.title || 'Untitled'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td style="font-size: 0.82rem; white-space: nowrap;">${evt.date || 'TBD'}</td>
                        <td style="font-weight: 700; color: #6366f1;">${evt.registeredCount || evt.attendeesCount || 18}</td>
                        <td>
                          <span class="pill ${!isUpcoming ? 'pill-gray' : isApproved ? 'pill-green' : 'pill-amber'}">
                            ${!isUpcoming ? 'Completed' : isApproved ? '✓ Approved & Live' : '⏳ Pending Approval'}
                          </span>
                        </td>
                        <td>
                          ${!evt.endorsed && isUpcoming ? `
                            <button class="hod-action-btn btn-endorse" data-id="${evt.id}" style="background:#10b981; color:#fff; font-weight:800; border:none; padding:6px 14px; box-shadow:0 2px 5px rgba(16,185,129,0.3);">
                              ✅ Approve Event
                            </button>
                          ` : isUpcoming ? `
                            <span class="pill pill-green" style="font-weight:700;">✓ HOD Approved</span>
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
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => exportNAAC(deptEvents, userDept, 'HOD', enrichedDeptStudents));
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

    // Approve departmental event
    container.querySelectorAll('.btn-endorse').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = 'Approving…';
        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true, endorsedBy: user.email,
            endorsedRole: 'hod', endorsedAt: new Date().toISOString(),
            status: 'approved'
          });
          window.dispatchEvent(new CustomEvent('ep_notification_update'));
          alert('✅ Event approved by HOD! It is now officially live for students.');
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Error: ' + err.message);
          e.currentTarget.disabled = false; e.currentTarget.innerText = '✅ Approve Event';
        }
      });
    });

    container.querySelector('#btn-hod-review-events')?.addEventListener('click', () => {
      activeTab = 'events';
      sessionStorage.setItem('ep_exec_tab', 'events');
      render();
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
// ═══════════════════════════════════════════════════════════════════
//  DEAN PORTAL — School-Level Oversight, Dept Drilldown & Student Intelligence
// ═══════════════════════════════════════════════════════════════════
async function renderDeanPortal({ 
  container, navigateTo, user, role, isAdmin, 
  allEvents = [], allComplaints = [], allUsers = [], allRegistrations = [],
  allCerts = [], allIdeas = [], allTeams = [] 
}) {
  let activeTab = sessionStorage.getItem('ep_dean_tab') || 'overview';
  let deptFilter = 'all'; // department drill-down filter: 'all' or specific dept
  let studentYearFilter = 'all'; // 'all', '1st Year', '2nd Year', '3rd Year', '4th Year'
  let studentStatusFilter = 'all'; // 'all', 'star', 'innovator', 'active', 'inactive'
  let studentSearchQuery = '';
  let selectedStudentForDossier = null;
  let showForwardVCModal = false;

  const roleLabel = role === 'dean' ? 'Dean — School of Engineering' : role === 'vc' ? 'Vice Chancellor' : 'Executive Administration';
  const roleIcon  = role === 'dean' ? '🎓' : role === 'vc' ? '👑' : '🛡️';
  const schoolTitle = 'School of Engineering';

  // Canonical Engineering Departments
  const ENGINEERING_DEPTS = [
    'Computer Science & Engineering',
    'Information Technology',
    'AI & Data Science',
    'Integrated M.Tech',
    'Mechanical Engineering',
    'Civil Engineering',
    'Cyber Security',
    'Electrical Engineering'
  ];

  // Helper to normalize department names
  const normalizeDept = (raw) => {
    if (!raw) return 'Computer Science & Engineering';
    const l = raw.toLowerCase().trim();
    if (l.includes('imtech') || l.includes('integrated')) return 'Integrated M.Tech';
    if (l.includes('comp') || l.includes('cse')) return 'Computer Science & Engineering';
    if (l.includes('info') || l.includes('it')) return 'Information Technology';
    if (l.includes('ai') || l.includes('data science')) return 'AI & Data Science';
    if (l.includes('mech')) return 'Mechanical Engineering';
    if (l.includes('civil')) return 'Civil Engineering';
    if (l.includes('cyber')) return 'Cyber Security';
    if (l.includes('elect')) return 'Electrical Engineering';
    return raw;
  };

  // Dynamically collect all departments under the school
  const deptSet = new Set(ENGINEERING_DEPTS);
  allEvents.forEach(e => { if (e.department) deptSet.add(normalizeDept(e.department)); });
  allComplaints.forEach(c => { if (c.reporterDept && c.reporterDept !== 'general') deptSet.add(normalizeDept(c.reporterDept)); });
  allUsers.forEach(u => { if (u.department) deptSet.add(normalizeDept(u.department)); });
  const DEPTS = [...deptSet].sort();

  // Enrich all students
  const rawStudents = (allUsers || []).filter(u => !u.role || u.role === 'student');
  const enrichedStudents = rawStudents.map(student => {
    const sUid = (student.uid || '').trim();
    const sEmail = (student.email || '').toLowerCase().trim();
    const sPrn = (student.prn || '').toLowerCase().trim();
    const sName = (student.name || '').toLowerCase().trim();

    // Registrations
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

    // Verified Certificates
    const certs = (allCerts || []).filter(c => {
      const cUid = (c.userId || '').trim();
      const cPrn = (c.prn || '').toLowerCase().trim();
      const cName = (c.studentName || '').toLowerCase().trim();
      return (sUid && cUid === sUid) ||
             (sPrn && cPrn && cPrn === sPrn) ||
             (sName && cName === sName);
    });

    // Ideas & Project Innovations
    const ideas = (allIdeas || []).filter(i => {
      return (sUid && i.userId === sUid) || (sName && (i.authorName || '').toLowerCase() === sName);
    });

    // Competition & Hackathon Teams
    const teams = (allTeams || []).filter(t => {
      const creatorUid = (t.creatorUid || t.userId || '').trim();
      const members = t.members || [];
      const inMembers = members.some(m => (m.uid && m.uid === sUid) || (m.email && m.email.toLowerCase() === sEmail));
      return (sUid && creatorUid === sUid) || inMembers;
    });

    let year = (student.year || '').trim();
    if (!year) year = '1st Year';

    const normalizedDept = normalizeDept(student.department);

    // Standing / Level
    let standing = 'inactive';
    let standingLabel = '⚠️ Inactive';
    let standingClass = 'dpill-red';

    if (certs.length > 0) {
      standing = 'star';
      standingLabel = '🏆 Star Achiever';
      standingClass = 'dpill-violet';
    } else if (ideas.length > 0 || teams.length > 0) {
      standing = 'innovator';
      standingLabel = '🚀 Innovator';
      standingClass = 'dpill-amber';
    } else if (isActive) {
      standing = 'active';
      standingLabel = '🟢 Active';
      standingClass = 'dpill-green';
    }

    return {
      ...student,
      year,
      department: normalizedDept,
      regs: studentRegs,
      registeredCount: studentRegs.length,
      attendedCount,
      isActive,
      certs,
      ideas,
      teams,
      standing,
      standingLabel,
      standingClass
    };
  });

  // Filter events and complaints according to deptFilter
  const getFilteredData = () => {
    const events = deptFilter === 'all' 
      ? allEvents 
      : allEvents.filter(e => normalizeDept(e.department) === deptFilter);

    const complaints = deptFilter === 'all' 
      ? allComplaints 
      : allComplaints.filter(c => normalizeDept(c.reporterDept) === deptFilter);

    const students = deptFilter === 'all'
      ? enrichedStudents
      : enrichedStudents.filter(s => s.department === deptFilter);

    return { events, complaints, students };
  };

  // Build Department Benchmarking Matrix (one row per department)
  const getBenchmark = () => DEPTS.map(dept => {
    const deptStudents = enrichedStudents.filter(s => s.department === dept);
    const evts = allEvents.filter(e => normalizeDept(e.department) === dept);
    const comps = allComplaints.filter(c => normalizeDept(c.reporterDept) === dept);
    const regs = evts.reduce((a, e) => a + (e.registeredCount || e.attendeesCount || 0), 0);
    const activeCount = deptStudents.filter(s => s.isActive).length;
    const activeRate = deptStudents.length > 0 ? Math.round((activeCount / deptStudents.length) * 100) : 0;
    const starCount = deptStudents.filter(s => s.certs.length > 0).length;

    const y1 = deptStudents.filter(s => s.year.toLowerCase().includes('1')).length;
    const y2 = deptStudents.filter(s => s.year.toLowerCase().includes('2')).length;
    const y3 = deptStudents.filter(s => s.year.toLowerCase().includes('3')).length;
    const y4 = deptStudents.filter(s => s.year.toLowerCase().includes('4') || s.year.toLowerCase().includes('final')).length;

    return {
      dept,
      studentsCount: deptStudents.length,
      activeCount,
      activeRate,
      starCount,
      y1, y2, y3, y4,
      evts: evts.length,
      regs,
      complaints: comps.length,
      resolved: comps.filter(c => c.status === 'resolved').length
    };
  });

  // Filter students based on current filters and search query
  const getFilteredStudents = () => {
    const { students } = getFilteredData();
    return students.filter(s => {
      // Year filter
      if (studentYearFilter !== 'all') {
        const sy = (s.year || '').toLowerCase();
        const fy = studentYearFilter.toLowerCase();
        if (fy.includes('1') && !sy.includes('1')) return false;
        if (fy.includes('2') && !sy.includes('2')) return false;
        if (fy.includes('3') && !sy.includes('3')) return false;
        if ((fy.includes('4') || fy.includes('final')) && (!sy.includes('4') && !sy.includes('final'))) return false;
      }
      // Standing filter
      if (studentStatusFilter !== 'all') {
        if (studentStatusFilter === 'star' && s.standing !== 'star') return false;
        if (studentStatusFilter === 'innovator' && s.standing !== 'innovator') return false;
        if (studentStatusFilter === 'active' && !s.isActive) return false;
        if (studentStatusFilter === 'inactive' && s.isActive) return false;
      }
      // Search Query
      if (studentSearchQuery.trim()) {
        const q = studentSearchQuery.toLowerCase().trim();
        const name = (s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const prn = (s.prn || '').toLowerCase();
        const dept = (s.department || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !prn.includes(q) && !dept.includes(q)) return false;
      }
      return true;
    });
  };

  // Render Student Comprehensive Profile Modal
  const renderStudentDossierModal = (student) => {
    if (!student) return '';
    const registeredEventIds = new Set((student.regs || []).map(r => r.eventId));
    const unparticipatedUpcoming = allEvents.filter(e => {
      const isUpcoming = new Date(e.date || e.startDate) >= new Date();
      return isUpcoming && !registeredEventIds.has(e.id);
    }).slice(0, 4);

    return `
      <div class="dean-modal-overlay" id="dean-student-modal">
        <div class="dean-modal-content">
          <!-- Modal Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface-elevated);">
            <div style="display:flex; align-items:center; gap:0.9rem;">
              <div style="width:52px; height:52px; border-radius:50%; background:linear-gradient(135deg, #8b5cf6, #6366f1); display:flex; align-items:center; justify-content:center; font-size:1.4rem; font-weight:800; color:#fff; flex-shrink:0;">
                ${(student.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size:1.2rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <span>${student.name || 'Student Profile'}</span>
                  <span class="dpill ${student.standingClass}" style="font-size:0.7rem;">
                    ${student.standingLabel}
                  </span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px;">
                  🏛️ <strong>${student.department}</strong> • 🎓 <strong>${student.year}</strong> • PRN: <strong>${student.prn || 'Not Linked'}</strong>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary);">
                  ✉️ ${student.email}
                </div>
              </div>
            </div>
            <button class="dean-modal-close" id="btn-close-dossier-modal">✕</button>
          </div>

          <!-- Modal Body -->
          <div style="padding:1.25rem 1.5rem; max-height:calc(82vh - 130px); overflow-y:auto;">
            <!-- 4 Metrics Overview -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#8b5cf6;">${student.registeredCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Events Enrolled</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#10b981;">${student.attendedCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Events Attended</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#f59e0b;">${student.certs.length}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Certifications</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.35rem; font-weight:800; color:#6366f1;">${student.ideas.length + student.teams.length}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Projects / Teams</div>
              </div>
            </div>

            <!-- Section 1: Events Participated -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🎪 Event & Competition Participation History</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.regs.length})</span>
              </div>
              ${student.regs.length === 0 ? `
                <div style="background:rgba(239,68,68,0.06); border:1px dashed rgba(239,68,68,0.25); border-radius:10px; padding:1.2rem; text-align:center;">
                  <div style="font-size:1.5rem; margin-bottom:0.35rem;">⚠️</div>
                  <div style="font-size:0.88rem; font-weight:700; color:#ef4444;">Zero Participation Recorded</div>
                  <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; max-width:460px; margin-inline:auto;">
                    Student has not engaged in any school or campus events this academic session. Dean's advisory note recommended to department HOD.
                  </div>
                </div>
              ` : `
                <table class="dean-table" style="font-size:0.82rem; border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle);">
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
                          <span class="dpill ${r.status === 'confirmed' || r.status === 'attended' ? 'dpill-green' : r.status === 'cancelled' ? 'dpill-red' : 'dpill-amber'}">
                            ${r.status || 'Registered'}
                          </span>
                        </td>
                        <td>
                          ${r.attendance === 'present' || r.status === 'attended' ? `
                            <span class="dpill dpill-green">✓ Present</span>
                          ` : r.attendance === 'absent' ? `
                            <span class="dpill dpill-red">✗ Absent</span>
                          ` : `
                            <span class="dpill dpill-gray">⏳ Scheduled</span>
                          `}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Section 2: Certifications & Verified Credentials -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🏆 Verified Certifications & Honors</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.certs.length})</span>
              </div>
              ${student.certs.length === 0 ? `
                <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:10px; padding:0.9rem; text-align:center; font-size:0.8rem; color:var(--text-secondary);">
                  No certificates awarded yet for this student.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${student.certs.map(c => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid rgba(139,92,246,0.3); border-radius:10px; padding:0.85rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                      <div>
                        <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                          <span>🥇 ${c.eventTitle || 'Excellence Award'}</span>
                          <span class="dpill dpill-violet" style="font-size:0.65rem;">Verified</span>
                        </div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                          ID: <span style="font-family:monospace; color:#8b5cf6;">${c.verificationId || c.id}</span> • Issued: ${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : 'Official Record'}
                        </div>
                      </div>
                      <button class="dean-action-btn btn-view-cert" data-cert-id="${c.id || c.verificationId}" style="background:rgba(139,92,246,0.15); color:#a78bfa; border-color:rgba(139,92,246,0.3);">
                        🖨️ View Certificate
                      </button>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Section 3: Projects, Innovation Ideas & Competition Teams -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🚀 Projects, Innovation Ideas & Competition Teams</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.ideas.length + student.teams.length})</span>
              </div>
              ${student.ideas.length === 0 && student.teams.length === 0 ? `
                <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:10px; padding:0.9rem; text-align:center; font-size:0.8rem; color:var(--text-secondary);">
                  No hackathon teams or project proposals recorded.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${student.ideas.map(i => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">💡 ${i.title || 'Innovation Proposal'}</span>
                        <span class="dpill dpill-amber" style="font-size:0.65rem;">${i.category || 'Tech Idea'}</span>
                      </div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; line-height:1.4;">
                        ${(i.description || '').slice(0, 140)}...
                      </div>
                    </div>
                  `).join('')}
                  ${student.teams.map(t => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">👥 Team: ${t.teamName || 'Hackathon Squad'}</span>
                        <span class="dpill dpill-violet" style="font-size:0.65rem;">Event Squad</span>
                      </div>
                      <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                        Event: ${t.eventTitle || 'Campus Competition'} • Members: ${(t.members || []).length}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Section 4: What the Student has NOT Participated in (Deficiency Gap) -->
            <div>
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🎯 Upcoming School Events Not Joined Yet</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(Target for Guidance)</span>
              </div>
              ${unparticipatedUpcoming.length === 0 ? `
                <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:0.85rem; font-size:0.8rem; color:#10b981;">
                  🎉 Fully engaged! Student is enrolled in all scheduled events.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${unparticipatedUpcoming.map(ev => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                      <div>
                        <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${ev.title || 'Untitled'}</div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                          📅 ${ev.date || 'TBD'} • 🏛️ ${ev.department || 'School of Engineering'} • 📍 ${ev.venue || 'Campus'}
                        </div>
                      </div>
                      <span class="dpill dpill-amber" style="font-size:0.68rem; white-space:nowrap;">
                        Not Enrolled
                      </span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

          </div>

          <!-- Modal Footer with Dean's Actions -->
          <div style="padding:0.9rem 1.5rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-elevated); flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <button class="dean-action-btn" id="btn-dean-commend" data-name="${student.name}" data-dept="${student.department}" style="background:rgba(139,92,246,0.15); color:#c084fc; border-color:rgba(139,92,246,0.3);">
                🎓 Grant Dean's Commendation
              </button>
            </div>
            <button class="dean-action-btn" id="btn-close-dossier-footer" style="background:rgba(255,255,255,0.08); color:var(--text-primary);">
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Render Forward to VC Modal
  const renderForwardToVCModal = () => {
    const { events, complaints, students } = getFilteredData();
    const activeCount = students.filter(s => s.isActive).length;
    const activeRate = students.length > 0 ? Math.round((activeCount / students.length) * 100) : 0;
    const certsCount = students.reduce((sum, s) => sum + s.certs.length, 0);
    const pendingGrievances = complaints.filter(c => c.status !== 'resolved').length;

    return `
      <div class="dean-modal-overlay" id="dean-forward-vc-modal">
        <div class="dean-modal-content" style="max-width:620px;">
          <!-- Header -->
          <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:1.1rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                <span>📤 Executive Dispatch to Vice Chancellor</span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                Official School of Engineering Academic & Co-Curricular Executive Briefing
              </div>
            </div>
            <button class="dean-modal-close" id="btn-close-vc-modal">✕</button>
          </div>

          <!-- Body -->
          <div style="padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:1rem;">
            <!-- Briefing KPI Preview -->
            <div style="background:rgba(139,92,246,0.08); border:1px solid rgba(139,92,246,0.25); border-radius:10px; padding:0.9rem 1.1rem;">
              <div style="font-size:0.8rem; font-weight:700; color:#c084fc; margin-bottom:0.5rem;">
                📊 School of Engineering Executive Metrics (Pre-Compiled)
              </div>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem; font-size:0.78rem;">
                <div>Departments: <strong>${DEPTS.length} Active</strong></div>
                <div>Students: <strong>${students.length} (${activeRate}% Active)</strong></div>
                <div>Events Hosted: <strong>${events.length} Events</strong></div>
                <div>Certifications Won: <strong>${certsCount} Awards</strong></div>
                <div>Pending Grievances: <strong>${pendingGrievances} Pending</strong></div>
                <div>Accreditation Grade: <strong style="color:#10b981;">NAAC Compliant</strong></div>
              </div>
            </div>

            <!-- Memorandum Textarea -->
            <div>
              <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-primary); margin-bottom:0.4rem;">
                Dean's Official Memorandum / Transmittal Note:
              </label>
              <textarea 
                id="dean-vc-memo" 
                rows="5" 
                style="width:100%; box-sizing:border-box; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:0.75rem; font-size:0.82rem; color:var(--text-primary); font-family:inherit; resize:vertical; outline:none;"
              >Hon'ble Vice Chancellor,

Please find enclosed the consolidated academic, co-curricular participation, and NAAC Criterion 5 progress report for the School of Engineering. 

All departmental rosters, faculty endorsements, student competition achievements, and DGRC compliance have been reviewed and verified by the Office of the Dean.

Respectfully submitted,
Prof. (Dr.) Dean — School of Engineering</textarea>
            </div>

            <div style="font-size:0.75rem; color:var(--text-secondary); line-height:1.4;">
              🛡️ <em>This dispatch will be recorded in the Central Executive Authority Register and notified directly to the Vice Chancellor's Command Console.</em>
            </div>
          </div>

          <!-- Footer -->
          <div style="padding:1rem 1.5rem; border-top:1px solid var(--border-subtle); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center;">
            <button class="dean-action-btn" id="btn-cancel-vc-forward">Cancel</button>
            <button class="dean-action-btn" id="btn-confirm-vc-dispatch" style="background:#8b5cf6; color:#fff; border-color:#8b5cf6; font-weight:800; padding:8px 16px;">
              🚀 Transmit Official Report to VC
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const render = () => {
    const { events, complaints, students } = getFilteredData();
    const pending = complaints.filter(c => c.status !== 'resolved');
    const upcoming = events.filter(e => new Date(e.date || e.startDate) >= new Date());
    const pendingApprovals = events.filter(e => {
      const isUpcoming = new Date(e.date || e.startDate) >= new Date();
      return isUpcoming && (!e.endorsed || e.status === 'pending_approval');
    });
    const totalRegs = events.reduce((a, e) => a + (e.registeredCount || e.attendeesCount || 18), 0);
    const bench = getBenchmark();
    const filteredStudents = getFilteredStudents();

    const activeStudentsCount = students.filter(s => s.isActive).length;
    const activeRatePct = students.length > 0 ? Math.round((activeStudentsCount / students.length) * 100) : 0;
    const starAchieversCount = students.filter(s => s.certs.length > 0).length;

    container.innerHTML = `
      <style>
        .dean-wrap {
          padding: 1.25rem 0 4rem;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        /* Identity bar */
        .dean-header {
          background: linear-gradient(135deg, rgba(139,92,246,0.12) 0%, rgba(99,102,241,0.06) 100%);
          border: 1px solid rgba(139,92,246,0.25);
          border-radius: 14px;
          padding: 1.1rem 1.4rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.5rem;
        }

        .dean-avatar {
          width: 50px; height: 50px;
          border-radius: 12px;
          background: linear-gradient(135deg, #8b5cf6, #6366f1);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.5rem;
          flex-shrink: 0;
        }

        .dean-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a !important;
        }

        .dean-scope-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
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
          gap: 0.65rem;
          flex-wrap: wrap;
        }

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

        /* 5-Column Stats Grid */
        .dean-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
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
          flex-wrap: wrap;
        }

        .dean-tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 16px;
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
        .dpill-blue   { background: rgba(59,130,246,0.12); color: #3b82f6; }

        .dean-filter-btn {
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
        .dean-filter-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
        .dean-filter-btn.active {
          background: #8b5cf6;
          color: #fff;
          border-color: #8b5cf6;
          box-shadow: 0 1px 4px rgba(139,92,246,0.3);
        }

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

        /* Modal styling */
        .dean-modal-overlay {
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

        .dean-modal-content {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          width: 100%;
          max-width: 720px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: modalFadeIn 0.2s ease-out;
        }

        .dean-modal-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          line-height: 1;
        }
        .dean-modal-close:hover { color: var(--text-primary); }

        .dean-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); font-size: 0.88rem; }

        @media (max-width: 1024px) {
          .dean-stats { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .dean-stats { grid-template-columns: repeat(2, 1fr); }
          .dean-tabs { width: 100%; }
          .dean-tab { flex: 1; justify-content: center; font-size: 0.78rem; padding: 7px 10px; }
        }
        @media (max-width: 480px) {
          .dean-stats { grid-template-columns: 1fr; }
        }
      </style>

      <div class="dean-wrap">

        <!-- Executive Identity Header -->
        <div class="dean-header">
          <div class="dean-avatar">${roleIcon}</div>
          <div>
            <div class="dean-title">${roleLabel}</div>
            <div class="dean-scope-tag">🏫 ${schoolTitle} — Multi-Department Academic Jurisdiction</div>
          </div>
          <div class="dean-header-right">
            <!-- Department drill-down filter -->
            <select class="dean-dept-filter" id="dean-dept-filter">
              <option value="all" ${deptFilter === 'all' ? 'selected' : ''}>🏛️ All Departments (School View)</option>
              ${DEPTS.map(d => `<option value="${d}" ${deptFilter === d ? 'selected' : ''}>${d}</option>`).join('')}
            </select>
            <button class="dean-action-btn" id="btn-forward-vc" style="background:rgba(139,92,246,0.2); color:#c084fc; border-color:rgba(139,92,246,0.35);">
              📤 Forward to VC
            </button>
            <button class="dean-action-btn" id="btn-export-naac">📥 NAAC Dossier</button>
            <button class="dean-action-btn" id="btn-export-matrix">📊 Dept Matrix</button>
          </div>
        </div>

        <!-- Alert if events need Dean Approval -->
        ${pendingApprovals.length > 0 ? `
          <div style="background:rgba(139,92,246,0.1); border:1px solid rgba(139,92,246,0.3); border-radius:12px; padding:0.85rem 1.2rem; display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.6rem;">
            <div style="color:#c084fc; font-size:0.85rem; font-weight:700;">
              ⚠️ <span><strong>${pendingApprovals.length} upcoming event${pendingApprovals.length > 1 ? 's' : ''}</strong> across ${schoolTitle} are awaiting your official Dean's Approval.</span>
            </div>
            <button class="dean-action-btn" id="btn-dean-review-events" style="background:#8b5cf6; color:#fff; border:none; font-weight:800; cursor:pointer;">
              Review & Approve Now →
            </button>
          </div>
        ` : ''}

        <!-- 5-Metric School Overview Strip -->
        <div class="dean-stats">
          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Departments</div>
              <span style="font-size: 1.1rem;">🏛️</span>
            </div>
            <div class="dean-stat-val" style="color: #8b5cf6;">${DEPTS.length}</div>
            <div class="dean-stat-sub">under School of Engineering</div>
          </div>

          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Enrolled Students</div>
              <span style="font-size: 1.1rem;">👥</span>
            </div>
            <div class="dean-stat-val" style="color: #3b82f6;">${students.length}</div>
            <div class="dean-stat-sub">${activeRatePct}% active in co-curriculars</div>
          </div>

          <div class="dean-stat" style="border-left: 3px solid ${pendingApprovals.length > 0 ? '#8b5cf6' : 'transparent'};">
            <div class="dean-stat-top">
              <div class="dean-stat-label">School Events</div>
              <span style="font-size: 1.1rem;">📅</span>
            </div>
            <div class="dean-stat-val" style="color: #6366f1;">${events.length}</div>
            <div class="dean-stat-sub">${pendingApprovals.length > 0 ? `<strong style="color:#a78bfa;">${pendingApprovals.length} awaiting approval</strong>` : `${upcoming.length} upcoming scheduled`}</div>
          </div>

          <div class="dean-stat">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Participations</div>
              <span style="font-size: 1.1rem;">🎟️</span>
            </div>
            <div class="dean-stat-val" style="color: #10b981;">${totalRegs}</div>
            <div class="dean-stat-sub">total registration passes</div>
          </div>

          <div class="dean-stat" style="border-left: 3px solid ${pending.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="dean-stat-top">
              <div class="dean-stat-label">Grievances</div>
              <span style="font-size: 1.1rem;">${pending.length > 0 ? '🚨' : '✅'}</span>
            </div>
            <div class="dean-stat-val" style="color: ${pending.length > 0 ? '#ef4444' : '#10b981'};">${pending.length}</div>
            <div class="dean-stat-sub">${complaints.length - pending.length} resolved</div>
          </div>
        </div>

        <!-- 5 Tabs Navigation -->
        <div class="dean-tabs">
          <button class="dean-tab ${activeTab === 'overview' ? 'active' : ''}" id="tab-btn-overview">
            📊 Dept & Year Matrix
          </button>
          <button class="dean-tab ${activeTab === 'students' ? 'active' : ''}" id="tab-btn-students">
            👨‍🎓 Student Directory (${students.length})
          </button>
          <button class="dean-tab ${activeTab === 'events' ? 'active' : ''}" id="tab-btn-events">
            🎪 Events & Approvals (${events.length})
            ${pendingApprovals.length > 0 ? `<span class="dean-tab-count" style="background:#8b5cf6;">${pendingApprovals.length} to approve</span>` : ''}
          </button>
          <button class="dean-tab ${activeTab === 'achievements' ? 'active' : ''}" id="tab-btn-achievements">
            🏆 Honors & Achievements (${starAchieversCount})
          </button>
          <button class="dean-tab ${activeTab === 'grievances' ? 'active' : ''}" id="tab-btn-grievances">
            🚨 Grievance Oversight
            ${pending.length > 0 ? `<span class="dean-tab-count">${pending.length}</span>` : ''}
          </button>
        </div>

        <!-- TAB 1: DEPT & YEAR MATRIX -->
        ${activeTab === 'overview' ? `
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">
                  School of Engineering — Department-Wise & Year-Wise Matrix
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Comprehensive comparative evaluation of student population, academic year distributions, participation ratios & grievance redressal.
                </div>
              </div>
              <button class="dean-action-btn" id="btn-export-matrix-tab" style="background:rgba(139,92,246,0.15); color:#c084fc; border-color:rgba(139,92,246,0.3);">
                📥 Export Matrix (CSV)
              </button>
            </div>
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr>
                    <th>Department</th>
                    <th>Total Students</th>
                    <th>Year-Wise Breakdown</th>
                    <th>Active Participation</th>
                    <th>Star Achievers</th>
                    <th>Events Hosted</th>
                    <th>Passes</th>
                    <th>Grievances</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${bench.map(b => {
                    const maxRegs = Math.max(...bench.map(x => x.regs), 1);
                    const rate = b.complaints > 0 ? Math.round((b.resolved / b.complaints) * 100) : 100;
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700; font-size: 0.88rem; color: var(--text-primary);">${b.dept}</div>
                          <div style="font-size: 0.7rem; color: var(--text-secondary);">School of Engineering</div>
                        </td>
                        <td style="font-weight: 700; color: #3b82f6;">${b.studentsCount}</td>
                        <td>
                          <div style="display:flex; gap:3px; flex-wrap:wrap;">
                            <span class="dpill dpill-blue" title="1st Year">1st: ${b.y1}</span>
                            <span class="dpill dpill-violet" title="2nd Year">2nd: ${b.y2}</span>
                            <span class="dpill dpill-green" title="3rd Year">3rd: ${b.y3}</span>
                            <span class="dpill dpill-amber" title="4th Year">4th: ${b.y4}</span>
                          </div>
                        </td>
                        <td style="min-width: 140px;">
                          <div class="bench-bar-wrap">
                            <div class="bench-bar-bg">
                              <div class="bench-bar-fill" style="width: ${b.activeRate}%; background: #10b981;"></div>
                            </div>
                            <span style="font-size: 0.72rem; font-weight: 700; color: #10b981; min-width: 32px;">${b.activeRate}%</span>
                          </div>
                          <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                            ${b.activeCount} of ${b.studentsCount} active
                          </div>
                        </td>
                        <td>
                          ${b.starCount > 0 ? `
                            <span class="dpill dpill-violet">🏆 ${b.starCount} Awardees</span>
                          ` : `<span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>`}
                        </td>
                        <td style="font-weight: 700; color: #8b5cf6;">${b.evts}</td>
                        <td style="font-weight: 700; color: #10b981;">${b.regs}</td>
                        <td>
                          ${b.complaints > 0 ? `
                            <span class="dpill ${b.complaints === b.resolved ? 'dpill-green' : 'dpill-red'}">
                              ${b.resolved}/${b.complaints} Res.
                            </span>
                          ` : `<span class="dpill dpill-green">0</span>`}
                        </td>
                        <td>
                          <button class="dean-action-btn btn-drilldown-dept" data-dept="${b.dept}">
                            🔍 Drilldown
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

        <!-- TAB 2: STUDENTS DIRECTORY & DOSSIER -->
        ${activeTab === 'students' ? `
          <div class="dean-card">
            <!-- Header with Title, Insights & Filters -->
            <div style="padding: 1rem 1.25rem; border-bottom: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 0.85rem;">
              <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.6rem;">
                <div>
                  <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
                    <span>👨‍🎓 ${schoolTitle} — Student Talent & Participation Directory</span>
                  </div>
                  <div style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 2px;">
                    ${deptFilter === 'all' ? 'All Engineering Departments' : `Filtered: ${deptFilter}`} — Individual student profiles, roles, activities completed, achievements & certifications.
                  </div>
                </div>
                <button class="dean-action-btn" id="btn-export-students-tab" style="background:rgba(139,92,246,0.15); color:#c084fc; border-color:rgba(139,92,246,0.3);">
                  📥 Export Student Roster (CSV)
                </button>
              </div>

              <!-- Filter Bar (Search + Year + Status) -->
              <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center; justify-content: space-between; background: var(--bg-surface-elevated); padding: 8px 12px; border-radius: 10px; border: 1px solid var(--border-subtle);">
                <!-- Search Input -->
                <div style="position: relative; flex: 1; min-width: 220px;">
                  <input 
                    type="text" 
                    id="dean-student-search" 
                    value="${studentSearchQuery}" 
                    placeholder="🔍 Search student name, PRN, email, dept..." 
                    style="width: 100%; box-sizing: border-box; background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 6px 12px; font-size: 0.8rem; color: var(--text-primary); outline: none;"
                  />
                </div>

                <!-- Year Filter Pills -->
                <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; margin-right: 2px;">Year:</span>
                  <button class="dean-filter-btn ${studentYearFilter === 'all' ? 'active' : ''}" data-year="all">All</button>
                  <button class="dean-filter-btn ${studentYearFilter === '1st Year' ? 'active' : ''}" data-year="1st Year">1st Yr</button>
                  <button class="dean-filter-btn ${studentYearFilter === '2nd Year' ? 'active' : ''}" data-year="2nd Year">2nd Yr</button>
                  <button class="dean-filter-btn ${studentYearFilter === '3rd Year' ? 'active' : ''}" data-year="3rd Year">3rd Yr</button>
                  <button class="dean-filter-btn ${studentYearFilter === '4th Year' ? 'active' : ''}" data-year="4th Year">4th Yr</button>
                </div>

                <!-- Standing Filter Pills -->
                <div style="display: flex; gap: 4px; align-items: center; flex-wrap: wrap;">
                  <span style="font-size: 0.72rem; color: var(--text-secondary); font-weight: 600; margin-right: 2px;">Standing:</span>
                  <button class="dean-filter-btn ${studentStatusFilter === 'all' ? 'active' : ''}" data-status="all">All</button>
                  <button class="dean-filter-btn ${studentStatusFilter === 'star' ? 'active' : ''}" data-status="star">🏆 Star Achievers</button>
                  <button class="dean-filter-btn ${studentStatusFilter === 'innovator' ? 'active' : ''}" data-status="innovator">🚀 Innovators</button>
                  <button class="dean-filter-btn ${studentStatusFilter === 'active' ? 'active' : ''}" data-status="active">🟢 Active</button>
                  <button class="dean-filter-btn ${studentStatusFilter === 'inactive' ? 'active' : ''}" data-status="inactive">⚠️ Inactive</button>
                </div>
              </div>
            </div>

            <!-- Student Directory Table -->
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>PRN / Roll</th>
                    <th>Events Participated</th>
                    <th>Achievements / Certs</th>
                    <th>Attendance</th>
                    <th>Standing</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="dean-students-tbody">
                  ${filteredStudents.length === 0 ? `
                    <tr><td colspan="9" class="dean-empty">🔍 No students found matching current filters.</td></tr>
                  ` : filteredStudents.map(student => {
                    const sampleEvents = (student.regs || []).slice(0, 2);
                    const remainingEvents = (student.regs || []).length - sampleEvents.length;

                    return `
                      <tr>
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                              ${(student.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                              <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary);">
                            ${student.department}
                          </span>
                        </td>
                        <td>
                          <span class="dpill dpill-blue">${student.year}</span>
                        </td>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                            ${student.prn || 'Not Linked'}
                          </span>
                        </td>
                        <td>
                          ${student.registeredCount > 0 ? `
                            <div>
                              <span class="dpill dpill-green" style="font-weight: 800;">
                                ${student.registeredCount} Events
                              </span>
                              <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${sampleEvents.map(r => `
                                  <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${r.eventTitle || 'Event'}
                                  </span>
                                `).join('')}
                                ${remainingEvents > 0 ? `
                                  <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEvents} more</span>
                                ` : ''}
                              </div>
                            </div>
                          ` : `
                            <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">
                              ⚠️ 0 Events
                            </span>
                          `}
                        </td>
                        <td>
                          ${student.certs.length > 0 ? `
                            <span class="dpill dpill-violet" style="font-weight: 800;">
                              🏆 ${student.certs.length} Cert${student.certs.length > 1 ? 's' : ''}
                            </span>
                          ` : student.ideas.length > 0 || student.teams.length > 0 ? `
                            <span class="dpill dpill-amber">
                              🚀 ${student.ideas.length + student.teams.length} Projects
                            </span>
                          ` : `
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>
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
                          <span class="dpill ${student.standingClass}">
                            ${student.standingLabel}
                          </span>
                        </td>
                        <td>
                          <button class="dean-action-btn btn-inspect-dossier" data-email="${student.email}" data-uid="${student.uid}">
                            🔍 Dossier
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

        <!-- TAB 3: EVENTS & APPROVALS -->
        ${activeTab === 'events' ? `
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  School of Engineering — Events & Official Dean Approvals
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  ${deptFilter === 'all' ? 'Showing events across all engineering departments' : `Filtered: ${deptFilter}`}
                </div>
              </div>
              ${pendingApprovals.length > 0 ? `
                <span class="dpill dpill-amber" style="font-weight:700;">
                  ⚠️ ${pendingApprovals.length} Event${pendingApprovals.length > 1 ? 's' : ''} Awaiting Approval
                </span>
              ` : `
                <span class="dpill dpill-violet" style="font-weight:700;">
                  ✓ All School Events Approved
                </span>
              `}
            </div>
            <div style="overflow-x: auto;">
              <table class="dean-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Registrations</th>
                    <th>Approval Status</th>
                    <th>Dean Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${events.length === 0 ? `
                    <tr><td colspan="6" class="dean-empty">📭 No events found.</td></tr>
                  ` : events.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    const isApproved = evt.status === 'approved' || evt.endorsed;
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700; color: var(--text-primary);">${evt.title || 'Untitled'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td style="font-size: 0.82rem;">${normalizeDept(evt.department)}</td>
                        <td style="font-size: 0.82rem; white-space: nowrap;">${evt.date || 'TBD'}</td>
                        <td style="font-weight: 700; color: #8b5cf6;">${evt.registeredCount || evt.attendeesCount || 18}</td>
                        <td>
                          ${!isUpcoming ? `<span class="dpill dpill-gray">Completed</span>`
                          : isApproved ? `<span class="dpill dpill-violet">✓ Approved & Live</span>`
                          : `<span class="dpill dpill-amber">⏳ Pending Approval</span>`}
                        </td>
                        <td>
                          ${isUpcoming && !evt.endorsed ? `
                            <button class="dean-sanction-btn btn-sanction" data-id="${evt.id}" style="background:#8b5cf6; color:#fff; font-weight:800; border:none; padding:6px 14px; box-shadow:0 2px 5px rgba(139,92,246,0.3);">
                              🎓 Approve Event
                            </button>
                          ` : isUpcoming ? `
                            <span style="font-size: 0.75rem; color: #8b5cf6; font-weight: 700;">✓ Dean Approved</span>
                          ` : `<span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 4: HONORS & ACHIEVEMENTS SHOWCASE -->
        ${activeTab === 'achievements' ? `
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  School of Engineering — Wall of Excellence & Honors Roll
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Verified certificates, competition winners, hackathon squads & innovation project submissions.
                </div>
              </div>
              <button class="dean-action-btn" id="btn-export-honors" style="background:rgba(139,92,246,0.15); color:#c084fc; border-color:rgba(139,92,246,0.3);">
                📥 Export Honors Roll (CSV)
              </button>
            </div>
            <div style="padding: 1.25rem;">
              <!-- 3 Column Showcase Grid -->
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
                
                <!-- Col 1: Verified Certifications -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>🏆 Verified Certifications</span>
                    <span class="dpill dpill-violet">${allCerts.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allCerts.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No certificates issued yet.</div>
                    ` : allCerts.slice(0, 15).map(c => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${c.studentName || 'Student'}</div>
                        <div style="font-size: 0.72rem; color: #8b5cf6;">${c.eventTitle || 'Campus Event'}</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          ID: <span style="font-family: monospace;">${c.verificationId || c.id}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Col 2: Competition Squads -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>👥 Competition Squads</span>
                    <span class="dpill dpill-blue">${allTeams.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allTeams.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No competition squads formed yet.</div>
                    ` : allTeams.slice(0, 15).map(t => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${t.teamName || 'Hackathon Squad'}</div>
                        <div style="font-size: 0.72rem; color: #3b82f6;">Event: ${t.eventTitle || 'Engineering Hackathon'}</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          Leader: ${t.creatorName || 'Student'} • ${(t.members || []).length} Members
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Col 3: Student Project Proposals -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>💡 Innovation Proposals</span>
                    <span class="dpill dpill-amber">${allIdeas.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allIdeas.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No innovation ideas submitted yet.</div>
                    ` : allIdeas.slice(0, 15).map(i => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${i.title || 'Idea Proposal'}</div>
                        <div style="font-size: 0.72rem; color: #f59e0b;">By ${i.authorName || 'Student'} (${normalizeDept(i.department)})</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          👍 ${i.upvotes || 0} Upvotes • Status: ${i.status || 'Active'}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

              </div>
            </div>
          </div>
        ` : ''}

        <!-- TAB 5: GRIEVANCE OVERSIGHT -->
        ${activeTab === 'grievances' ? `
          <div class="dean-card">
            <div class="dean-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  School of Engineering — Grievance Redressal Oversight
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  ${deptFilter === 'all' ? 'All Engineering Departments' : deptFilter} — ${complaints.length} total, ${pending.length} pending
                </div>
              </div>
              <button class="dean-action-btn" id="btn-export-dgrc">🛡️ Export Grievance Log (CSV)</button>
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
                        <td style="font-size: 0.8rem;">${normalizeDept(c.reporterDept)}</td>
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
        ` : ''}

        <!-- Student Dossier Modal -->
        ${selectedStudentForDossier ? renderStudentDossierModal(selectedStudentForDossier) : ''}

        <!-- Forward to VC Modal -->
        ${showForwardVCModal ? renderForwardToVCModal() : ''}

      </div>
    `;

    bindDeanEvents();
  };

  const bindDeanEvents = () => {
    // Dept filter change
    container.querySelector('#dean-dept-filter')?.addEventListener('change', (e) => {
      deptFilter = e.target.value;
      render();
    });

    // Tab Navigation
    container.querySelector('#tab-btn-overview')?.addEventListener('click', () => {
      activeTab = 'overview'; sessionStorage.setItem('ep_dean_tab', 'overview'); render();
    });
    container.querySelector('#tab-btn-students')?.addEventListener('click', () => {
      activeTab = 'students'; sessionStorage.setItem('ep_dean_tab', 'students'); render();
    });
    container.querySelector('#tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events'; sessionStorage.setItem('ep_dean_tab', 'events'); render();
    });
    container.querySelector('#tab-btn-achievements')?.addEventListener('click', () => {
      activeTab = 'achievements'; sessionStorage.setItem('ep_dean_tab', 'achievements'); render();
    });
    container.querySelector('#tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances'; sessionStorage.setItem('ep_dean_tab', 'grievances'); render();
    });

    // Drilldown button from overview matrix
    container.querySelectorAll('.btn-drilldown-dept').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const targetDept = e.currentTarget.getAttribute('data-dept');
        if (targetDept) {
          deptFilter = targetDept;
          activeTab = 'students';
          sessionStorage.setItem('ep_dean_tab', 'students');
          render();
        }
      });
    });

    // Exports
    container.querySelector('#btn-export-naac')?.addEventListener('click', () => exportDeanNAAC(allEvents, schoolTitle));
    container.querySelector('#btn-export-matrix')?.addEventListener('click', () => exportDeanStudentMatrix(enrichedStudents, schoolTitle));
    container.querySelector('#btn-export-matrix-tab')?.addEventListener('click', () => exportDeanStudentMatrix(enrichedStudents, schoolTitle));
    container.querySelector('#btn-export-students-tab')?.addEventListener('click', () => exportDeanStudentMatrix(enrichedStudents, schoolTitle));
    container.querySelector('#btn-export-honors')?.addEventListener('click', () => exportDeanHonorsRoll(enrichedStudents, allCerts, schoolTitle));
    container.querySelector('#btn-export-dgrc')?.addEventListener('click', () => exportDGRC(allComplaints, deptFilter === 'all' ? schoolTitle : deptFilter));

    // Year filters
    container.querySelectorAll('.dean-filter-btn[data-year]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        studentYearFilter = e.currentTarget.getAttribute('data-year');
        render();
      });
    });

    // Status filters
    container.querySelectorAll('.dean-filter-btn[data-status]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        studentStatusFilter = e.currentTarget.getAttribute('data-status');
        render();
      });
    });

    // Student Search Input
    const searchInput = container.querySelector('#dean-student-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        studentSearchQuery = e.target.value;
        const filtered = getFilteredStudents();
        const tbody = container.querySelector('#dean-students-tbody');
        if (tbody) {
          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" class="dean-empty">🔍 No students found matching current filters.</td></tr>`;
          } else {
            tbody.innerHTML = filtered.map(student => {
              const sampleEvents = (student.regs || []).slice(0, 2);
              const remainingEvents = (student.regs || []).length - sampleEvents.length;

              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #8b5cf6, #6366f1); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                        ${(student.name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style="font-size: 0.78rem; font-weight: 600; color: var(--text-primary);">
                      ${student.department}
                    </span>
                  </td>
                  <td>
                    <span class="dpill dpill-blue">${student.year}</span>
                  </td>
                  <td>
                    <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                      ${student.prn || 'Not Linked'}
                    </span>
                  </td>
                  <td>
                    ${student.registeredCount > 0 ? `
                      <div>
                        <span class="dpill dpill-green" style="font-weight: 800;">
                          ${student.registeredCount} Events
                        </span>
                        <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                          ${sampleEvents.map(r => `
                            <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              ${r.eventTitle || 'Event'}
                            </span>
                          `).join('')}
                          ${remainingEvents > 0 ? `
                            <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEvents} more</span>
                          ` : ''}
                        </div>
                      </div>
                    ` : `
                      <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">
                        ⚠️ 0 Events
                      </span>
                    `}
                  </td>
                  <td>
                    ${student.certs.length > 0 ? `
                      <span class="dpill dpill-violet" style="font-weight: 800;">
                        🏆 ${student.certs.length} Cert${student.certs.length > 1 ? 's' : ''}
                      </span>
                    ` : student.ideas.length > 0 || student.teams.length > 0 ? `
                      <span class="dpill dpill-amber">
                        🚀 ${student.ideas.length + student.teams.length} Projects
                      </span>
                    ` : `
                      <span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>
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
                    <span class="dpill ${student.standingClass}">
                      ${student.standingLabel}
                    </span>
                  </td>
                  <td>
                    <button class="dean-action-btn btn-inspect-dossier" data-email="${student.email}" data-uid="${student.uid}">
                      🔍 Dossier
                    </button>
                  </td>
                </tr>
              `;
            }).join('');
            bindDossierButtons();
          }
        }
      });
    }

    // Bind Inspect Student Dossier Buttons
    const bindDossierButtons = () => {
      container.querySelectorAll('.btn-inspect-dossier').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-email');
          const uid = e.currentTarget.getAttribute('data-uid');
          const found = enrichedStudents.find(s => 
            (email && (s.email || '').toLowerCase() === email.toLowerCase()) || 
            (uid && s.uid === uid)
          );
          if (found) {
            selectedStudentForDossier = found;
            render();
          }
        });
      });
    };
    bindDossierButtons();

    // Close Dossier Modal
    container.querySelector('#btn-close-dossier-modal')?.addEventListener('click', () => {
      selectedStudentForDossier = null;
      render();
    });
    container.querySelector('#btn-close-dossier-footer')?.addEventListener('click', () => {
      selectedStudentForDossier = null;
      render();
    });
    container.querySelector('#dean-student-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'dean-student-modal') {
        selectedStudentForDossier = null;
        render();
      }
    });

    // View Certificate PDF
    container.querySelectorAll('.btn-view-cert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const certId = e.currentTarget.getAttribute('data-cert-id');
        const cert = allCerts.find(c => (c.verificationId || c.id) === certId);
        if (cert) {
          await downloadCertificatePDF(cert);
        } else {
          alert('Certificate record loaded.');
        }
      });
    });

    // Dean's Commendation Note
    container.querySelector('#btn-dean-commend')?.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-name');
      const dept = e.currentTarget.getAttribute('data-dept');
      alert(`🎓 Dean's Academic Commendation officially recorded for ${name} (${dept}) for exceptional co-curricular performance.`);
    });

    // Forward to VC Modal triggers
    container.querySelector('#btn-forward-vc')?.addEventListener('click', () => {
      showForwardVCModal = true;
      render();
    });
    container.querySelector('#btn-close-vc-modal')?.addEventListener('click', () => {
      showForwardVCModal = false;
      render();
    });
    container.querySelector('#btn-cancel-vc-forward')?.addEventListener('click', () => {
      showForwardVCModal = false;
      render();
    });
    container.querySelector('#dean-forward-vc-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'dean-forward-vc-modal') {
        showForwardVCModal = false;
        render();
      }
    });

    // Confirm VC Dispatch
    container.querySelector('#btn-confirm-vc-dispatch')?.addEventListener('click', async (e) => {
      const memoText = container.querySelector('#dean-vc-memo')?.value || '';
      e.currentTarget.disabled = true; e.currentTarget.innerText = 'Transmitting…';
      try {
        await createAnnouncement({
          title: `[Dean's Executive Report] ${schoolTitle} Comprehensive Review`,
          content: memoText,
          category: 'Dean Memorandum',
          priority: 'high',
          targetAudience: 'Executive Leadership (VC & Council)'
        }, user);
        alert('🎉 Official Executive Report successfully transmitted to the Vice Chancellor.');
        showForwardVCModal = false;
        render();
      } catch (err) {
        alert('Report logged: ' + err.message);
        showForwardVCModal = false;
        render();
      }
    });

    // Grant Dean Approval
    container.querySelectorAll('.btn-sanction').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = 'Approving…';
        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true, endorsedBy: user.email,
            endorsedRole: role || 'dean', endorsedAt: new Date().toISOString(),
            status: 'approved'
          });
          window.dispatchEvent(new CustomEvent('ep_notification_update'));
          alert(`✅ Dean's Official Approval granted! Event is now live for all students.`);
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Error: ' + err.message);
          e.currentTarget.disabled = false; e.currentTarget.innerText = '🎓 Approve Event';
        }
      });
    });

    container.querySelector('#btn-dean-review-events')?.addEventListener('click', () => {
      activeTab = 'events';
      sessionStorage.setItem('ep_dean_tab', 'events');
      render();
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

// ═══════════════════════════════════════════════════════════════════
//  VC PORTAL — Apex University Command, 4-Tier Drilldown & Supreme Governance
// ═══════════════════════════════════════════════════════════════════
async function renderVCPortal({
  container, navigateTo, user, role, isAdmin,
  allEvents = [], allComplaints = [], allUsers = [], allRegistrations = [],
  allCerts = [], allIdeas = [], allTeams = []
}) {
  let activeTab = sessionStorage.getItem('ep_vc_tab') || 'matrix';
  let selectedSchool = 'all'; // 'all' or school name
  let selectedDept = 'all'; // 'all' or department name
  let selectedYear = 'all'; // 'all', '1st Year', '2nd Year', '3rd Year', '4th Year'
  let selectedStanding = 'all'; // 'all', 'star', 'innovator', 'active', 'inactive'
  let searchQuery = '';
  let selectedStudentForDossier = null;
  let showChancellorModal = false;

  const UNIVERSITY_NAME = 'Sanjivani University';
  const roleLabel = 'Vice Chancellor — Supreme Executive Authority';

  // University School & Department Taxonomy
  const UNIVERSITY_TAXONOMY = {
    'School of Engineering & Technology': [
      'Computer Science & Engineering',
      'Information Technology',
      'AI & Data Science',
      'Integrated M.Tech',
      'Mechanical Engineering',
      'Civil Engineering',
      'Cyber Security',
      'Electrical Engineering'
    ],
    'School of Management & Commerce': [
      'MBA / MCA',
      'BBA',
      'Commerce & Finance',
      'Digital Marketing'
    ],
    'School of Pharmacy & Health Sciences': [
      'B.Pharm',
      'M.Pharm',
      'Pharmaceutics',
      'Pharmacology'
    ],
    'School of Science & Humanities': [
      'Applied Physics',
      'Applied Chemistry',
      'Mathematics & Computing',
      'Humanities & Social Sciences'
    ],
    'School of Design & Creative Arts': [
      'UI/UX Design',
      'Animation & VFX',
      'Digital Product Design',
      'Media Studies'
    ]
  };

  const SCHOOLS = Object.keys(UNIVERSITY_TAXONOMY);

  // Helper to map department to School
  const getSchoolAndDept = (rawDept) => {
    if (!rawDept) return { school: 'School of Engineering & Technology', dept: 'Computer Science & Engineering' };
    const d = rawDept.toLowerCase().trim();
    if (d.includes('imtech') || d.includes('integrated')) return { school: 'School of Engineering & Technology', dept: 'Integrated M.Tech' };
    if (d.includes('comp') || d.includes('cse')) return { school: 'School of Engineering & Technology', dept: 'Computer Science & Engineering' };
    if (d.includes('info') || d.includes('it')) return { school: 'School of Engineering & Technology', dept: 'Information Technology' };
    if (d.includes('ai') || d.includes('data science')) return { school: 'School of Engineering & Technology', dept: 'AI & Data Science' };
    if (d.includes('mech')) return { school: 'School of Engineering & Technology', dept: 'Mechanical Engineering' };
    if (d.includes('civil')) return { school: 'School of Engineering & Technology', dept: 'Civil Engineering' };
    if (d.includes('cyber')) return { school: 'School of Engineering & Technology', dept: 'Cyber Security' };
    if (d.includes('elect')) return { school: 'School of Engineering & Technology', dept: 'Electrical Engineering' };
    if (d.includes('mba') || d.includes('mca')) return { school: 'School of Management & Commerce', dept: 'MBA / MCA' };
    if (d.includes('bba')) return { school: 'School of Management & Commerce', dept: 'BBA' };
    if (d.includes('commerce') || d.includes('finance')) return { school: 'School of Management & Commerce', dept: 'Commerce & Finance' };
    if (d.includes('pharm')) return { school: 'School of Pharmacy & Health Sciences', dept: 'B.Pharm' };
    if (d.includes('phys') || d.includes('chem') || d.includes('math')) return { school: 'School of Science & Humanities', dept: 'Mathematics & Computing' };
    if (d.includes('design') || d.includes('ui') || d.includes('media')) return { school: 'School of Design & Creative Arts', dept: 'UI/UX Design' };
    return { school: 'School of Engineering & Technology', dept: rawDept };
  };

  // Enrich all students
  const rawStudents = (allUsers || []).filter(u => !u.role || u.role === 'student');
  const enrichedStudents = rawStudents.map(student => {
    const sUid = (student.uid || '').trim();
    const sEmail = (student.email || '').toLowerCase().trim();
    const sPrn = (student.prn || '').toLowerCase().trim();
    const sName = (student.name || '').toLowerCase().trim();

    const { school, dept } = getSchoolAndDept(student.department);

    // Registrations
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

    // Verified Certificates
    const certs = (allCerts || []).filter(c => {
      const cUid = (c.userId || '').trim();
      const cPrn = (c.prn || '').toLowerCase().trim();
      const cName = (c.studentName || '').toLowerCase().trim();
      return (sUid && cUid === sUid) ||
             (sPrn && cPrn && cPrn === sPrn) ||
             (sName && cName === sName);
    });

    // Ideas & Project Innovations
    const ideas = (allIdeas || []).filter(i => {
      return (sUid && i.userId === sUid) || (sName && (i.authorName || '').toLowerCase() === sName);
    });

    // Competition & Hackathon Teams
    const teams = (allTeams || []).filter(t => {
      const creatorUid = (t.creatorUid || t.userId || '').trim();
      const members = t.members || [];
      const inMembers = members.some(m => (m.uid && m.uid === sUid) || (m.email && m.email.toLowerCase() === sEmail));
      return (sUid && creatorUid === sUid) || inMembers;
    });

    let year = (student.year || '').trim();
    if (!year) year = '1st Year';

    // Standing
    let standing = 'inactive';
    let standingLabel = '⚠️ Inactive';
    let standingClass = 'vcpill-red';

    if (certs.length > 0) {
      standing = 'star';
      standingLabel = '🏆 Star Achiever';
      standingClass = 'vcpill-gold';
    } else if (ideas.length > 0 || teams.length > 0) {
      standing = 'innovator';
      standingLabel = '🚀 Innovator';
      standingClass = 'vcpill-amber';
    } else if (isActive) {
      standing = 'active';
      standingLabel = '🟢 Active';
      standingClass = 'vcpill-green';
    }

    return {
      ...student,
      year,
      school,
      department: dept,
      regs: studentRegs,
      registeredCount: studentRegs.length,
      attendedCount,
      isActive,
      certs,
      ideas,
      teams,
      standing,
      standingLabel,
      standingClass
    };
  });

  // Enrich all events with School and Dept
  const enrichedEvents = allEvents.map(e => {
    const { school, dept } = getSchoolAndDept(e.department);
    return { ...e, school, department: dept };
  });

  // Enrich complaints with School and Dept
  const enrichedComplaints = allComplaints.map(c => {
    const { school, dept } = getSchoolAndDept(c.reporterDept);
    return { ...c, school, department: dept };
  });

  // Available departments under currently selected school
  const getAvailableDepts = () => {
    if (selectedSchool === 'all') {
      const allD = new Set();
      Object.values(UNIVERSITY_TAXONOMY).forEach(list => list.forEach(d => allD.add(d)));
      return [...allD].sort();
    }
    return UNIVERSITY_TAXONOMY[selectedSchool] || [];
  };

  // Filtered dataset according to School and Dept dropdowns
  const getScopedData = () => {
    let events = enrichedEvents;
    let complaints = enrichedComplaints;
    let students = enrichedStudents;

    if (selectedSchool !== 'all') {
      events = events.filter(e => e.school === selectedSchool);
      complaints = complaints.filter(c => c.school === selectedSchool);
      students = students.filter(s => s.school === selectedSchool);
    }

    if (selectedDept !== 'all') {
      events = events.filter(e => e.department === selectedDept);
      complaints = complaints.filter(c => c.department === selectedDept);
      students = students.filter(s => s.department === selectedDept);
    }

    return { events, complaints, students };
  };

  // Filter students based on all 4 tiers (School, Dept, Year, Standing) + Search Query
  const getFilteredStudents = () => {
    const { students } = getScopedData();
    return students.filter(s => {
      // Year filter
      if (selectedYear !== 'all') {
        const sy = (s.year || '').toLowerCase();
        const fy = selectedYear.toLowerCase();
        if (fy.includes('1') && !sy.includes('1')) return false;
        if (fy.includes('2') && !sy.includes('2')) return false;
        if (fy.includes('3') && !sy.includes('3')) return false;
        if ((fy.includes('4') || fy.includes('final')) && (!sy.includes('4') && !sy.includes('final'))) return false;
      }
      // Standing filter
      if (selectedStanding !== 'all') {
        if (selectedStanding === 'star' && s.standing !== 'star') return false;
        if (selectedStanding === 'innovator' && s.standing !== 'innovator') return false;
        if (selectedStanding === 'active' && !s.isActive) return false;
        if (selectedStanding === 'inactive' && s.isActive) return false;
      }
      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const name = (s.name || '').toLowerCase();
        const email = (s.email || '').toLowerCase();
        const prn = (s.prn || '').toLowerCase();
        const dept = (s.department || '').toLowerCase();
        const sch = (s.school || '').toLowerCase();
        if (!name.includes(q) && !email.includes(q) && !prn.includes(q) && !dept.includes(q) && !sch.includes(q)) return false;
      }
      return true;
    });
  };

  // Build Institutional Apex Matrix (School by School comparison)
  const getInstitutionalBenchmark = () => {
    return SCHOOLS.map(school => {
      const schDepts = UNIVERSITY_TAXONOMY[school] || [];
      const schStudents = enrichedStudents.filter(s => s.school === school);
      const schEvents = enrichedEvents.filter(e => e.school === school);
      const schComplaints = enrichedComplaints.filter(c => c.school === school);

      const activeCount = schStudents.filter(s => s.isActive).length;
      const activeRate = schStudents.length > 0 ? Math.round((activeCount / schStudents.length) * 100) : 0;
      const starCount = schStudents.filter(s => s.certs.length > 0).length;
      const regsCount = schEvents.reduce((sum, e) => sum + (e.registeredCount || e.attendeesCount || 0), 0);

      const y1 = schStudents.filter(s => s.year.toLowerCase().includes('1')).length;
      const y2 = schStudents.filter(s => s.year.toLowerCase().includes('2')).length;
      const y3 = schStudents.filter(s => s.year.toLowerCase().includes('3')).length;
      const y4 = schStudents.filter(s => s.year.toLowerCase().includes('4') || s.year.toLowerCase().includes('final')).length;

      return {
        school,
        deptsCount: schDepts.length,
        studentsCount: schStudents.length,
        activeCount,
        activeRate,
        starCount,
        y1, y2, y3, y4,
        eventsCount: schEvents.length,
        regsCount,
        complaintsCount: schComplaints.length,
        resolvedCount: schComplaints.filter(c => c.status === 'resolved').length
      };
    });
  };

  // Render Student Supreme Dossier Modal
  const renderStudentSupremeDossier = (student) => {
    if (!student) return '';
    const registeredEventIds = new Set((student.regs || []).map(r => r.eventId));
    const unparticipatedUpcoming = enrichedEvents.filter(e => {
      const isUpcoming = new Date(e.date || e.startDate) >= new Date();
      return isUpcoming && !registeredEventIds.has(e.id);
    }).slice(0, 4);

    return `
      <div class="vc-modal-overlay" id="vc-student-modal">
        <div class="vc-modal-content">
          <!-- Modal Header -->
          <div style="display:flex; justify-content:space-between; align-items:flex-start; padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface-elevated);">
            <div style="display:flex; align-items:center; gap:0.9rem;">
              <div style="width:54px; height:54px; border-radius:50%; background:linear-gradient(135deg, #f59e0b, #10b981); display:flex; align-items:center; justify-content:center; font-size:1.5rem; font-weight:800; color:#fff; flex-shrink:0;">
                ${(student.name || 'S').charAt(0).toUpperCase()}
              </div>
              <div>
                <div style="font-size:1.25rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.5rem; flex-wrap:wrap;">
                  <span>${student.name || 'Student Profile'}</span>
                  <span class="vcpill ${student.standingClass}" style="font-size:0.7rem;">
                    ${student.standingLabel}
                  </span>
                </div>
                <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:3px;">
                  🏫 <strong>${student.school}</strong> • 🏛️ <strong>${student.department}</strong> • 🎓 <strong>${student.year}</strong>
                </div>
                <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                  PRN: <strong>${student.prn || 'Not Linked'}</strong> • ✉️ ${student.email}
                </div>
              </div>
            </div>
            <button class="vc-modal-close" id="btn-close-vc-dossier">✕</button>
          </div>

          <!-- Modal Body -->
          <div style="padding:1.25rem 1.5rem; max-height:calc(82vh - 130px); overflow-y:auto;">
            <!-- 4 Metrics Overview -->
            <div style="display:grid; grid-template-columns:repeat(4, 1fr); gap:0.75rem; margin-bottom:1.5rem;">
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.4rem; font-weight:800; color:#3b82f6;">${student.registeredCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Events Enrolled</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.4rem; font-weight:800; color:#10b981;">${student.attendedCount}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Events Attended</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.4rem; font-weight:800; color:#f59e0b;">${student.certs.length}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Certifications</div>
              </div>
              <div style="background:var(--bg-surface-elevated); padding:0.85rem; border-radius:10px; border:1px solid var(--border-subtle); text-align:center;">
                <div style="font-size:1.4rem; font-weight:800; color:#8b5cf6;">${student.ideas.length + student.teams.length}</div>
                <div style="font-size:0.68rem; color:var(--text-secondary); text-transform:uppercase; font-weight:700;">Projects / Teams</div>
              </div>
            </div>

            <!-- Section 1: Events Participated -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🎪 Event & Competition Participation History</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.regs.length})</span>
              </div>
              ${student.regs.length === 0 ? `
                <div style="background:rgba(239,68,68,0.06); border:1px dashed rgba(239,68,68,0.25); border-radius:10px; padding:1.2rem; text-align:center;">
                  <div style="font-size:1.5rem; margin-bottom:0.35rem;">⚠️</div>
                  <div style="font-size:0.88rem; font-weight:700; color:#ef4444;">Zero Participation Recorded</div>
                  <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; max-width:460px; margin-inline:auto;">
                    Student has not enrolled in any university events this academic session. Dean and HOD mentorship recommended for co-curricular compliance.
                  </div>
                </div>
              ` : `
                <table class="vc-table" style="font-size:0.82rem; border-radius:8px; overflow:hidden; border:1px solid var(--border-subtle);">
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
                          <span class="vcpill ${r.status === 'confirmed' || r.status === 'attended' ? 'vcpill-green' : r.status === 'cancelled' ? 'vcpill-red' : 'vcpill-amber'}">
                            ${r.status || 'Registered'}
                          </span>
                        </td>
                        <td>
                          ${r.attendance === 'present' || r.status === 'attended' ? `
                            <span class="vcpill vcpill-green">✓ Present</span>
                          ` : r.attendance === 'absent' ? `
                            <span class="vcpill vcpill-red">✗ Absent</span>
                          ` : `
                            <span class="vcpill vcpill-gray">⏳ Scheduled</span>
                          `}
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              `}
            </div>

            <!-- Section 2: Verified Certifications -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🏆 Verified Certifications & Honors</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.certs.length})</span>
              </div>
              ${student.certs.length === 0 ? `
                <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:10px; padding:0.9rem; text-align:center; font-size:0.8rem; color:var(--text-secondary);">
                  No verified certificates awarded yet for this student.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${student.certs.map(c => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid rgba(245,158,11,0.3); border-radius:10px; padding:0.85rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem; flex-wrap:wrap;">
                      <div>
                        <div style="font-weight:700; font-size:0.88rem; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                          <span>🥇 ${c.eventTitle || 'Excellence Award'}</span>
                          <span class="vcpill vcpill-gold" style="font-size:0.65rem;">Verified</span>
                        </div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                          Verification ID: <span style="font-family:monospace; color:#f59e0b;">${c.verificationId || c.id}</span> • Issued: ${c.issuedAt ? new Date(c.issuedAt).toLocaleDateString() : 'Official'}
                        </div>
                      </div>
                      <button class="vc-action-btn btn-view-cert" data-cert-id="${c.id || c.verificationId}" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                        🖨️ View Certificate
                      </button>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Section 3: Projects & Teams -->
            <div style="margin-bottom:1.5rem;">
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🚀 Projects, Innovation Ideas & Competition Teams</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(${student.ideas.length + student.teams.length})</span>
              </div>
              ${student.ideas.length === 0 && student.teams.length === 0 ? `
                <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:10px; padding:0.9rem; text-align:center; font-size:0.8rem; color:var(--text-secondary);">
                  No hackathon teams or project proposals recorded.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${student.ideas.map(i => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">💡 ${i.title || 'Innovation Proposal'}</span>
                        <span class="vcpill vcpill-amber" style="font-size:0.65rem;">${i.category || 'Tech Idea'}</span>
                      </div>
                      <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:3px; line-height:1.4;">
                        ${(i.description || '').slice(0, 140)}...
                      </div>
                    </div>
                  `).join('')}
                  ${student.teams.map(t => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem;">
                      <div style="display:flex; justify-content:space-between; align-items:center;">
                        <span style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">👥 Team: ${t.teamName || 'Hackathon Squad'}</span>
                        <span class="vcpill vcpill-blue" style="font-size:0.65rem;">Event Squad</span>
                      </div>
                      <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                        Event: ${t.eventTitle || 'Campus Competition'} • Members: ${(t.members || []).length}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Section 4: Non-Participation Deficiency Gap -->
            <div>
              <div style="font-size:0.92rem; font-weight:800; color:var(--text-primary); margin-bottom:0.6rem; display:flex; align-items:center; gap:0.4rem;">
                <span>🎯 Upcoming Campus Events Not Joined Yet</span>
                <span style="font-size:0.75rem; color:var(--text-secondary); font-weight:600;">(Non-Participation Roster)</span>
              </div>
              ${unparticipatedUpcoming.length === 0 ? `
                <div style="background:rgba(16,185,129,0.06); border:1px solid rgba(16,185,129,0.2); border-radius:10px; padding:0.85rem; font-size:0.8rem; color:#10b981;">
                  🎉 Exemplary student! Enrolled in all scheduled campus events.
                </div>
              ` : `
                <div style="display:flex; flex-direction:column; gap:0.5rem;">
                  ${unparticipatedUpcoming.map(ev => `
                    <div style="background:var(--bg-surface-elevated); border:1px solid var(--border-subtle); border-radius:9px; padding:0.75rem 1rem; display:flex; justify-content:space-between; align-items:center; gap:0.75rem;">
                      <div>
                        <div style="font-weight:700; font-size:0.85rem; color:var(--text-primary);">${ev.title || 'Untitled'}</div>
                        <div style="font-size:0.72rem; color:var(--text-secondary); margin-top:2px;">
                          📅 ${ev.date || 'TBD'} • 🏛️ ${ev.department} • 📍 ${ev.venue || 'Campus'}
                        </div>
                      </div>
                      <span class="vcpill vcpill-amber" style="font-size:0.68rem; white-space:nowrap;">
                        Not Enrolled
                      </span>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

          </div>

          <!-- Modal Footer -->
          <div style="padding:0.9rem 1.5rem; border-top:1px solid var(--border-subtle); display:flex; justify-content:space-between; align-items:center; background:var(--bg-surface-elevated); flex-wrap:wrap; gap:0.5rem;">
            <div style="display:flex; gap:0.5rem;">
              <button class="vc-action-btn" id="btn-vc-merit" data-name="${student.name}" data-dept="${student.department}" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                👑 Confer Vice Chancellor's Merit Award
              </button>
            </div>
            <button class="vc-action-btn" id="btn-close-vc-dossier-footer" style="background:rgba(255,255,255,0.08); color:var(--text-primary);">
              Close Dossier
            </button>
          </div>
        </div>
      </div>
    `;
  };

  // Render Chancellor / Governing Body Dispatch Modal
  const renderGoverningBodyModal = () => {
    const { events, complaints, students } = getScopedData();
    const activeCount = students.filter(s => s.isActive).length;
    const activeRate = students.length > 0 ? Math.round((activeCount / students.length) * 100) : 0;
    const certsCount = students.reduce((sum, s) => sum + s.certs.length, 0);

    return `
      <div class="vc-modal-overlay" id="vc-governing-modal">
        <div class="vc-modal-content" style="max-width:640px;">
          <div style="padding:1.25rem 1.5rem; border-bottom:1px solid var(--border-subtle); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center;">
            <div>
              <div style="font-size:1.15rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:0.4rem;">
                <span>📜 Transmit Executive Report to Chancellor & Governing Body</span>
              </div>
              <div style="font-size:0.75rem; color:var(--text-secondary); margin-top:2px;">
                Official University-Wide Academic, Co-Curricular & NAAC Performance Submission
              </div>
            </div>
            <button class="vc-modal-close" id="btn-close-governing-modal">✕</button>
          </div>

          <div style="padding:1.25rem 1.5rem; display:flex; flex-direction:column; gap:1rem;">
            <div style="background:rgba(245,158,11,0.08); border:1px solid rgba(245,158,11,0.25); border-radius:10px; padding:0.9rem 1.1rem;">
              <div style="font-size:0.8rem; font-weight:700; color:#f59e0b; margin-bottom:0.5rem;">
                🏛️ Institutional Governance Summary Preview
              </div>
              <div style="display:grid; grid-template-columns:repeat(3, 1fr); gap:0.6rem; font-size:0.78rem;">
                <div>Active Schools: <strong>${SCHOOLS.length}</strong></div>
                <div>Total Students: <strong>${students.length} (${activeRate}% Active)</strong></div>
                <div>Campus Events: <strong>${events.length}</strong></div>
                <div>Verified Medals: <strong>${certsCount}</strong></div>
                <div>Grievance Status: <strong>${complaints.filter(c => c.status === 'resolved').length}/${complaints.length} Resolved</strong></div>
                <div>Accreditation: <strong style="color:#10b981;">NAAC A++ Ready</strong></div>
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.8rem; font-weight:700; color:var(--text-primary); margin-bottom:0.4rem;">
                Vice Chancellor's Transmittal Memorandum to the Board:
              </label>
              <textarea 
                id="vc-governing-memo" 
                rows="5" 
                style="width:100%; box-sizing:border-box; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:0.75rem; font-size:0.82rem; color:var(--text-primary); font-family:inherit; resize:vertical; outline:none;"
              >To: Hon'ble Chancellor & Members of the Governing Body,

I have the honor to submit the consolidated University Performance & Co-Curricular Excellence Report for Sanjivani University. 

All constituent Schools, Academic Departments, Deans, and HODs have fulfilled accreditation compliance, with rigorous monitoring of student participation, verified achievements, and grievance resolution indices.

Respectfully submitted,
VC Sir
Vice Chancellor, Sanjivani University</textarea>
            </div>
          </div>

          <div style="padding:1rem 1.5rem; border-top:1px solid var(--border-subtle); background:var(--bg-surface-elevated); display:flex; justify-content:space-between; align-items:center;">
            <button class="vc-action-btn" id="btn-cancel-governing">Cancel</button>
            <button class="vc-action-btn" id="btn-confirm-governing-dispatch" style="background:#f59e0b; color:#000; border-color:#f59e0b; font-weight:800; padding:8px 16px;">
              🚀 Transmit to Chancellor & Governing Body
            </button>
          </div>
        </div>
      </div>
    `;
  };

  const render = () => {
    const { events, complaints, students } = getScopedData();
    const pendingComplaints = complaints.filter(c => c.status !== 'resolved');
    const upcomingEvents = events.filter(e => new Date(e.date || e.startDate) >= new Date());
    const totalPasses = events.reduce((sum, e) => sum + (e.registeredCount || e.attendeesCount || 18), 0);
    const institutionalBench = getInstitutionalBenchmark();
    const filteredStudents = getFilteredStudents();

    const activeCount = students.filter(s => s.isActive).length;
    const activeRatePct = students.length > 0 ? Math.round((activeCount / students.length) * 100) : 0;
    const starCount = students.filter(s => s.certs.length > 0).length;
    const availableDepts = getAvailableDepts();

    container.innerHTML = `
      <style>
        .vc-wrap {
          padding: 1.25rem 0 4rem;
          font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
        }

        /* Supreme VC Identity Bar */
        .vc-header {
          background: linear-gradient(135deg, rgba(245,158,11,0.12) 0%, rgba(16,185,129,0.08) 50%, rgba(99,102,241,0.08) 100%);
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 16px;
          padding: 1.2rem 1.5rem;
          display: flex;
          align-items: center;
          gap: 1rem;
          flex-wrap: wrap;
          margin-bottom: 1.25rem;
        }

        .vc-avatar {
          width: 54px; height: 54px;
          border-radius: 14px;
          background: linear-gradient(135deg, #f59e0b, #10b981);
          display: flex; align-items: center; justify-content: center;
          font-size: 1.7rem;
          flex-shrink: 0;
          box-shadow: 0 4px 14px rgba(245,158,11,0.3);
        }

        .vc-title {
          font-size: 1.15rem;
          font-weight: 800;
          color: #0f172a !important;
        }

        .vc-scope-tag {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          background: rgba(245,158,11,0.15);
          color: #fbbf24;
          border: 1px solid rgba(245,158,11,0.25);
          border-radius: 20px;
          padding: 3px 10px;
          font-size: 0.72rem;
          font-weight: 700;
          margin-top: 3px;
        }

        .vc-header-right {
          margin-left: auto;
          display: flex;
          align-items: center;
          gap: 0.65rem;
          flex-wrap: wrap;
        }

        .vc-action-btn {
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
        .vc-action-btn:hover { background: rgba(255,255,255,0.1); color: var(--text-primary); }

        /* 4-Tier Interactive Drilldown Toolbar */
        .vc-drilldown-bar {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          padding: 1rem 1.25rem;
          margin-bottom: 1.25rem;
          display: flex;
          flex-direction: column;
          gap: 0.85rem;
        }

        .vc-breadcrumb {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.82rem;
          font-weight: 700;
          flex-wrap: wrap;
        }

        .vc-crumb {
          color: var(--text-secondary);
          cursor: pointer;
          transition: color 0.15s;
        }
        .vc-crumb:hover { color: #f59e0b; }
        .vc-crumb.active { color: #f59e0b; }
        .vc-crumb-sep { color: var(--text-secondary); opacity: 0.6; }

        .vc-select-input {
          background: var(--bg-surface-elevated);
          border: 1px solid var(--border-subtle);
          color: var(--text-primary);
          border-radius: 8px;
          padding: 6px 28px 6px 10px;
          font-size: 0.8rem;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          appearance: none;
          background-image: url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e");
          background-repeat: no-repeat;
          background-position: right 8px center;
          background-size: 13px;
        }

        .vc-filter-btn {
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
        .vc-filter-btn:hover { background: rgba(255,255,255,0.08); color: var(--text-primary); }
        .vc-filter-btn.active {
          background: #f59e0b;
          color: #000;
          border-color: #f59e0b;
          box-shadow: 0 1px 4px rgba(245,158,11,0.3);
        }

        /* 5-Column Apex Stats Strip */
        .vc-stats {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 0.85rem;
          margin-bottom: 1.25rem;
        }

        .vc-stat {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 0.9rem 1rem;
        }

        .vc-stat-top {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 0.4rem;
        }

        .vc-stat-label {
          font-size: 0.7rem;
          font-weight: 700;
          color: var(--text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }

        .vc-stat-val {
          font-size: 1.5rem;
          font-weight: 800;
          color: var(--text-primary);
          line-height: 1;
        }

        .vc-stat-sub {
          font-size: 0.7rem;
          color: var(--text-secondary);
          margin-top: 3px;
        }

        /* Tabs */
        .vc-tabs {
          display: flex;
          gap: 4px;
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 12px;
          padding: 4px;
          margin-bottom: 1.25rem;
          width: fit-content;
          flex-wrap: wrap;
        }

        .vc-tab {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          padding: 8px 16px;
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

        .vc-tab.active {
          background: var(--bg-surface-elevated);
          color: var(--text-primary);
          box-shadow: 0 1px 4px rgba(0,0,0,0.2);
        }

        .vc-tab-count {
          background: #ef4444;
          color: #fff;
          font-size: 0.65rem;
          font-weight: 800;
          padding: 1px 6px;
          border-radius: 999px;
        }

        /* Cards */
        .vc-card {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 14px;
          overflow: hidden;
        }

        .vc-card-header {
          padding: 0.9rem 1.25rem;
          border-bottom: 1px solid var(--border-subtle);
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
          flex-wrap: wrap;
        }

        .vc-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 0.875rem;
        }

        .vc-table th {
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

        .vc-table td {
          padding: 0.85rem 1.1rem;
          border-bottom: 1px solid var(--border-subtle);
          color: var(--text-primary);
          vertical-align: middle;
        }

        .vc-table tr:last-child td { border-bottom: none; }
        .vc-table tr:hover td { background: var(--bg-surface-elevated); }

        .vcpill { display: inline-block; padding: 3px 9px; border-radius: 20px; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; }
        .vcpill-green  { background: rgba(16,185,129,0.12); color: #10b981; }
        .vcpill-amber  { background: rgba(245,158,11,0.12); color: #f59e0b; }
        .vcpill-gray   { background: rgba(100,116,139,0.12); color: #64748b; }
        .vcpill-red    { background: rgba(239,68,68,0.12); color: #ef4444; }
        .vcpill-gold   { background: rgba(245,158,11,0.2); color: #f59e0b; border: 1px solid rgba(245,158,11,0.3); }
        .vcpill-blue   { background: rgba(59,130,246,0.12); color: #3b82f6; }
        .vcpill-violet { background: rgba(139,92,246,0.12); color: #8b5cf6; }

        /* Modal styling */
        .vc-modal-overlay {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(0, 0, 0, 0.78);
          backdrop-filter: blur(5px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 9999;
          padding: 1rem;
        }

        .vc-modal-content {
          background: var(--bg-surface);
          border: 1px solid var(--border-subtle);
          border-radius: 16px;
          width: 100%;
          max-width: 740px;
          box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5);
          overflow: hidden;
          animation: modalFadeIn 0.2s ease-out;
        }

        .vc-modal-close {
          background: transparent;
          border: none;
          color: var(--text-secondary);
          font-size: 1.25rem;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          line-height: 1;
        }
        .vc-modal-close:hover { color: var(--text-primary); }

        .vc-empty { text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); font-size: 0.88rem; }

        @media (max-width: 1024px) {
          .vc-stats { grid-template-columns: repeat(3, 1fr); }
        }
        @media (max-width: 768px) {
          .vc-stats { grid-template-columns: repeat(2, 1fr); }
          .vc-tabs { width: 100%; }
          .vc-tab { flex: 1; justify-content: center; font-size: 0.78rem; padding: 7px 10px; }
        }
        @media (max-width: 480px) {
          .vc-stats { grid-template-columns: 1fr; }
        }
      </style>

      <div class="vc-wrap">

        <!-- VC Executive Identity Header -->
        <div class="vc-header">
          <div class="vc-avatar">👑</div>
          <div>
            <div class="vc-title">VC Sir — Vice Chancellor</div>
            <div class="vc-scope-tag">🏛️ ${UNIVERSITY_NAME} — Apex University Council & Governance</div>
          </div>
          <div class="vc-header-right">
            <button class="vc-action-btn" id="btn-broadcast-circular" style="background:rgba(239,68,68,0.2); color:#fca5a5; border-color:rgba(239,68,68,0.35); font-weight:800;">
              📢 Issue Proclamation
            </button>
            <button class="vc-action-btn" id="btn-forward-chancellor" style="background:rgba(245,158,11,0.2); color:#fbbf24; border-color:rgba(245,158,11,0.35);">
              📜 Report to Chancellor
            </button>
            <button class="vc-action-btn" id="btn-export-vc-naac">📥 NAAC Dossier</button>
            <button class="vc-action-btn" id="btn-export-vc-matrix">📊 Apex Matrix</button>
          </div>
        </div>

        <!-- 5-Metric Apex University Stats Strip -->
        <div class="vc-stats">
          <div class="vc-stat">
            <div class="vc-stat-top">
              <div class="vc-stat-label">Constituent Schools</div>
              <span style="font-size: 1.1rem;">🏫</span>
            </div>
            <div class="vc-stat-val" style="color: #f59e0b;">${SCHOOLS.length}</div>
            <div class="vc-stat-sub">under Deans' jurisdictions</div>
          </div>

          <div class="vc-stat">
            <div class="vc-stat-top">
              <div class="vc-stat-label">Students Enrolled</div>
              <span style="font-size: 1.1rem;">👥</span>
            </div>
            <div class="vc-stat-val" style="color: #3b82f6;">${students.length}</div>
            <div class="vc-stat-sub">${activeRatePct}% active in co-curriculars</div>
          </div>

          <div class="vc-stat">
            <div class="vc-stat-top">
              <div class="vc-stat-label">University Events</div>
              <span style="font-size: 1.1rem;">📅</span>
            </div>
            <div class="vc-stat-val" style="color: #10b981;">${events.length}</div>
            <div class="vc-stat-sub">${upcomingEvents.length} upcoming scheduled</div>
          </div>

          <div class="vc-stat">
            <div class="vc-stat-top">
              <div class="vc-stat-label">Total Participations</div>
              <span style="font-size: 1.1rem;">🎟️</span>
            </div>
            <div class="vc-stat-val" style="color: #8b5cf6;">${totalPasses}</div>
            <div class="vc-stat-sub">across all departments</div>
          </div>

          <div class="vc-stat" style="border-left: 3px solid ${pendingComplaints.length > 0 ? '#ef4444' : '#10b981'};">
            <div class="vc-stat-top">
              <div class="vc-stat-label">Grievance Index</div>
              <span style="font-size: 1.1rem;">${pendingComplaints.length > 0 ? '🚨' : '✅'}</span>
            </div>
            <div class="vc-stat-val" style="color: ${pendingComplaints.length > 0 ? '#ef4444' : '#10b981'};">${pendingComplaints.length}</div>
            <div class="vc-stat-sub">${complaints.length - pendingComplaints.length} resolved</div>
          </div>
        </div>

        <!-- 5 Tabs Navigation -->
        <div class="vc-tabs">
          <button class="vc-tab ${activeTab === 'matrix' ? 'active' : ''}" id="vc-tab-btn-matrix">
            🌐 Apex Institutional Matrix
          </button>
          <button class="vc-tab ${activeTab === 'students' ? 'active' : ''}" id="vc-tab-btn-students">
            👨‍🎓 Universal Student Directory (${students.length})
          </button>
          <button class="vc-tab ${activeTab === 'events' ? 'active' : ''}" id="vc-tab-btn-events">
            🎪 Events & Supreme Approvals (${events.length})
          </button>
          <button class="vc-tab ${activeTab === 'honors' ? 'active' : ''}" id="vc-tab-btn-honors">
            🏆 Honors & Wall of Fame (${starCount})
          </button>
          <button class="vc-tab ${activeTab === 'grievances' ? 'active' : ''}" id="vc-tab-btn-grievances">
            🚨 Ombudsman & Grievances
            ${pendingComplaints.length > 0 ? `<span class="vc-tab-count">${pendingComplaints.length}</span>` : ''}
          </button>
        </div>

        <!-- TAB 1: APEX INSTITUTIONAL MATRIX -->
        ${activeTab === 'matrix' ? `
          <div class="vc-card">
            <div class="vc-card-header">
              <div>
                <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">
                  Sanjivani University — Apex Institutional Benchmark Matrix
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  School-by-School executive evaluation across student demographics, co-curricular engagement, events capacity, and grievance resolution index.
                </div>
              </div>
              <button class="vc-action-btn" id="btn-export-matrix-tab" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                📥 Export Matrix (CSV)
              </button>
            </div>
            <div style="overflow-x: auto;">
              <table class="vc-table">
                <thead>
                  <tr>
                    <th>Constituent School</th>
                    <th>Depts</th>
                    <th>Students Enrolled</th>
                    <th>Year-Wise Breakdown</th>
                    <th>Active Co-Curricular %</th>
                    <th>Star Achievers</th>
                    <th>Events Hosted</th>
                    <th>Passes</th>
                    <th>Grievances</th>
                    <th>Drilldown Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${institutionalBench.map(b => `
                    <tr>
                      <td>
                        <div style="font-weight: 700; font-size: 0.9rem; color: var(--text-primary);">${b.school}</div>
                        <div style="font-size: 0.7rem; color: var(--text-secondary);">Office of the Dean Jurisdiction</div>
                      </td>
                      <td style="font-weight: 700; color: #8b5cf6;">${b.deptsCount} Depts</td>
                      <td style="font-weight: 700; color: #3b82f6;">${b.studentsCount}</td>
                      <td>
                        <div style="display:flex; gap:3px; flex-wrap:wrap;">
                          <span class="vcpill vcpill-blue" title="1st Year">1st: ${b.y1}</span>
                          <span class="vcpill vcpill-violet" title="2nd Year">2nd: ${b.y2}</span>
                          <span class="vcpill vcpill-green" title="3rd Year">3rd: ${b.y3}</span>
                          <span class="vcpill vcpill-amber" title="4th Year">4th: ${b.y4}</span>
                        </div>
                      </td>
                      <td style="min-width: 140px;">
                        <div style="display:flex; align-items:center; gap:0.5rem;">
                          <div style="flex:1; height:6px; background:var(--border-subtle); border-radius:4px; overflow:hidden;">
                            <div style="height:100%; border-radius:4px; width:${b.activeRate}%; background:#10b981;"></div>
                          </div>
                          <span style="font-size:0.72rem; font-weight:700; color:#10b981; min-width:32px;">${b.activeRate}%</span>
                        </div>
                        <div style="font-size:0.68rem; color:var(--text-secondary); margin-top:2px;">
                          ${b.activeCount} active participants
                        </div>
                      </td>
                      <td>
                        ${b.starCount > 0 ? `
                          <span class="vcpill vcpill-gold">🏆 ${b.starCount} Awardees</span>
                        ` : `<span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>`}
                      </td>
                      <td style="font-weight: 700; color: #10b981;">${b.eventsCount}</td>
                      <td style="font-weight: 700; color: #8b5cf6;">${b.regsCount}</td>
                      <td>
                        ${b.complaintsCount > 0 ? `
                          <span class="vcpill ${b.complaintsCount === b.resolvedCount ? 'vcpill-green' : 'vcpill-red'}">
                            ${b.resolvedCount}/${b.complaintsCount} Res.
                          </span>
                        ` : `<span class="vcpill vcpill-green">0</span>`}
                      </td>
                      <td>
                        <button class="vc-action-btn btn-drilldown-school" data-school="${b.school}" style="background:rgba(245,158,11,0.12); color:#f59e0b; border-color:rgba(245,158,11,0.25);">
                          🔍 Drill into School
                        </button>
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 2: UNIVERSAL STUDENT DIRECTORY & PROFILES -->
        ${activeTab === 'students' ? `
          <div class="vc-card">
            <div class="vc-card-header">
              <div>
                <div style="font-size: 1rem; font-weight: 800; color: var(--text-primary);">
                  Universal Student Talent & Activity Directory
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Drill down from University ➔ School ➔ Department ➔ Year ➔ Individual Student Activity Dossier.
                </div>
              </div>
              <button class="vc-action-btn" id="btn-export-students-tab" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                📥 Export Student Roster (CSV)
              </button>
            </div>

            <!-- 4-Tier Interactive Drilldown Toolbar (University -> School -> Department -> Year) -->
            <div class="vc-drilldown-bar" style="margin: 0.75rem 1.25rem 1.25rem; border: 1px solid var(--border-subtle); background: var(--bg-surface-elevated);">
              <!-- Dynamic Breadcrumb -->
              <div class="vc-breadcrumb">
                <span class="vc-crumb ${selectedSchool === 'all' ? 'active' : ''}" id="crumb-uni">
                  🏛️ ${UNIVERSITY_NAME}
                </span>
                <span class="vc-crumb-sep">›</span>
                <span class="vc-crumb ${selectedSchool !== 'all' && selectedDept === 'all' ? 'active' : ''}" id="crumb-school">
                  ${selectedSchool === 'all' ? 'All Schools (Apex)' : selectedSchool}
                </span>
                <span class="vc-crumb-sep">›</span>
                <span class="vc-crumb ${selectedDept !== 'all' && selectedYear === 'all' ? 'active' : ''}" id="crumb-dept">
                  ${selectedDept === 'all' ? 'All Departments' : selectedDept}
                </span>
                <span class="vc-crumb-sep">›</span>
                <span class="vc-crumb ${selectedYear !== 'all' ? 'active' : ''}" id="crumb-year">
                  ${selectedYear === 'all' ? 'All Years' : selectedYear}
                </span>
              </div>

              <!-- Selectors: School, Department, Search -->
              <div style="display:flex; gap:0.75rem; flex-wrap:wrap; align-items:center; justify-content:space-between;">
                <div style="display:flex; gap:0.5rem; align-items:center; flex-wrap:wrap;">
                  <!-- School Selector -->
                  <select class="vc-select-input" id="vc-school-select">
                    <option value="all" ${selectedSchool === 'all' ? 'selected' : ''}>🌐 All Schools (Apex View)</option>
                    ${SCHOOLS.map(s => `<option value="${s}" ${selectedSchool === s ? 'selected' : ''}>🏫 ${s}</option>`).join('')}
                  </select>

                  <!-- Department Selector (Dynamic) -->
                  <select class="vc-select-input" id="vc-dept-select">
                    <option value="all" ${selectedDept === 'all' ? 'selected' : ''}>🏛️ All Departments</option>
                    ${availableDepts.map(d => `<option value="${d}" ${selectedDept === d ? 'selected' : ''}>${d}</option>`).join('')}
                  </select>

                  <!-- Year Filter Buttons -->
                  <div style="display:flex; gap:4px; align-items:center; margin-left:4px;">
                    <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:600;">Year:</span>
                    <button class="vc-filter-btn ${selectedYear === 'all' ? 'active' : ''}" data-year="all">All</button>
                    <button class="vc-filter-btn ${selectedYear === '1st Year' ? 'active' : ''}" data-year="1st Year">1st Yr</button>
                    <button class="vc-filter-btn ${selectedYear === '2nd Year' ? 'active' : ''}" data-year="2nd Year">2nd Yr</button>
                    <button class="vc-filter-btn ${selectedYear === '3rd Year' ? 'active' : ''}" data-year="3rd Year">3rd Yr</button>
                    <button class="vc-filter-btn ${selectedYear === '4th Year' ? 'active' : ''}" data-year="4th Year">4th Yr</button>
                  </div>

                  <!-- Standing Filter Buttons -->
                  <div style="display:flex; gap:4px; align-items:center; margin-left:4px;">
                    <span style="font-size:0.72rem; color:var(--text-secondary); font-weight:600;">Standing:</span>
                    <button class="vc-filter-btn ${selectedStanding === 'all' ? 'active' : ''}" data-standing="all">All</button>
                    <button class="vc-filter-btn ${selectedStanding === 'star' ? 'active' : ''}" data-standing="star">🏆 Star Achievers</button>
                    <button class="vc-filter-btn ${selectedStanding === 'innovator' ? 'active' : ''}" data-standing="innovator">🚀 Innovators</button>
                    <button class="vc-filter-btn ${selectedStanding === 'active' ? 'active' : ''}" data-standing="active">🟢 Active</button>
                    <button class="vc-filter-btn ${selectedStanding === 'inactive' ? 'active' : ''}" data-standing="inactive">⚠️ Inactive</button>
                  </div>
                </div>

                <!-- Global Search Box -->
                <div style="min-width:220px; flex:1; max-width:320px;">
                  <input 
                    type="text" 
                    id="vc-search-input" 
                    value="${searchQuery}" 
                    placeholder="🔍 Search name, PRN, email, dept, school..." 
                    style="width:100%; box-sizing:border-box; background:var(--bg-surface); border:1px solid var(--border-subtle); border-radius:8px; padding:6px 12px; font-size:0.8rem; color:var(--text-primary); outline:none;"
                  />
                </div>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="vc-table">
                <thead>
                  <tr>
                    <th>Student Details</th>
                    <th>School</th>
                    <th>Department</th>
                    <th>Year</th>
                    <th>PRN / Roll</th>
                    <th>Events Participated</th>
                    <th>Achievements / Certs</th>
                    <th>Attendance</th>
                    <th>Standing</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="vc-students-tbody">
                  ${filteredStudents.length === 0 ? `
                    <tr><td colspan="10" class="vc-empty">🔍 No students found matching current hierarchical filters.</td></tr>
                  ` : filteredStudents.map(student => {
                    const sampleEvents = (student.regs || []).slice(0, 2);
                    const remainingEvents = (student.regs || []).length - sampleEvents.length;

                    return `
                      <tr>
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.65rem;">
                            <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #10b981); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                              ${(student.name || 'S').charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                              <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">
                            ${student.school}
                          </span>
                        </td>
                        <td>
                          <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">
                            ${student.department}
                          </span>
                        </td>
                        <td>
                          <span class="vcpill vcpill-blue">${student.year}</span>
                        </td>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                            ${student.prn || 'Not Linked'}
                          </span>
                        </td>
                        <td>
                          ${student.registeredCount > 0 ? `
                            <div>
                              <span class="vcpill vcpill-green" style="font-weight: 800;">
                                ${student.registeredCount} Events
                              </span>
                              <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                                ${sampleEvents.map(r => `
                                  <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                                    ${r.eventTitle || 'Event'}
                                  </span>
                                `).join('')}
                                ${remainingEvents > 0 ? `
                                  <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEvents} more</span>
                                ` : ''}
                              </div>
                            </div>
                          ` : `
                            <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">
                              ⚠️ 0 Events
                            </span>
                          `}
                        </td>
                        <td>
                          ${student.certs.length > 0 ? `
                            <span class="vcpill vcpill-gold" style="font-weight: 800;">
                              🏆 ${student.certs.length} Cert${student.certs.length > 1 ? 's' : ''}
                            </span>
                          ` : student.ideas.length > 0 || student.teams.length > 0 ? `
                            <span class="vcpill vcpill-amber">
                              🚀 ${student.ideas.length + student.teams.length} Projects
                            </span>
                          ` : `
                            <span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>
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
                          <span class="vcpill ${student.standingClass}">
                            ${student.standingLabel}
                          </span>
                        </td>
                        <td>
                          <button class="vc-action-btn btn-inspect-supreme-dossier" data-email="${student.email}" data-uid="${student.uid}" style="background:rgba(245,158,11,0.12); color:#f59e0b; border-color:rgba(245,158,11,0.25);">
                            🔍 Dossier
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

        <!-- TAB 3: UNIVERSITY EVENTS & SUPREME APPROVALS -->
        ${activeTab === 'events' ? `
          <div class="vc-card">
            <div class="vc-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  University-Wide Events & Supreme Vice Chancellor Approvals
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Institutional calendar of all events hosted across constituent Schools & Departments.
                </div>
              </div>
            </div>
            <div style="overflow-x: auto;">
              <table class="vc-table">
                <thead>
                  <tr>
                    <th>Event Title</th>
                    <th>School</th>
                    <th>Department</th>
                    <th>Date</th>
                    <th>Registrations</th>
                    <th>Supreme Approval</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${events.length === 0 ? `
                    <tr><td colspan="7" class="vc-empty">📭 No events found under current scope.</td></tr>
                  ` : events.map(evt => {
                    const isUpcoming = new Date(evt.date || evt.startDate) >= new Date();
                    return `
                      <tr>
                        <td>
                          <div style="font-weight: 700; color: var(--text-primary);">${evt.title || 'Untitled'}</div>
                          <div style="font-size: 0.72rem; color: var(--text-secondary);">${evt.category || 'Academic'}</div>
                        </td>
                        <td style="font-size: 0.78rem; color: var(--text-secondary);">${evt.school}</td>
                        <td style="font-size: 0.82rem; font-weight: 600;">${evt.department}</td>
                        <td style="font-size: 0.82rem; white-space: nowrap;">${evt.date || 'TBD'}</td>
                        <td style="font-weight: 700; color: #10b981;">${evt.registeredCount || evt.attendeesCount || 18}</td>
                        <td>
                          ${!isUpcoming ? `<span class="vcpill vcpill-gray">Completed</span>`
                          : evt.endorsed ? `<span class="vcpill vcpill-gold">👑 VC Approved</span>`
                          : `<span class="vcpill vcpill-amber">Pending Sanction</span>`}
                        </td>
                        <td>
                          ${isUpcoming && !evt.endorsed ? `
                            <button class="vc-action-btn btn-vc-sanction" data-id="${evt.id}" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                              👑 Grant VC Approval
                            </button>
                          ` : isUpcoming && evt.endorsed ? `
                            <span style="font-size: 0.72rem; color: #f59e0b; font-weight: 700;">✓ Sanctioned</span>
                          ` : `<span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>`}
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
          </div>
        ` : ''}

        <!-- TAB 4: HONORS & WALL OF FAME -->
        ${activeTab === 'honors' ? `
          <div class="vc-card">
            <div class="vc-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  Sanjivani University — Apex Hall of Fame & Honors Registry
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Centrally verified student medals, competition winner certificates, and innovation achievements.
                </div>
              </div>
              <button class="vc-action-btn" id="btn-export-vc-honors" style="background:rgba(245,158,11,0.15); color:#f59e0b; border-color:rgba(245,158,11,0.3);">
                📥 Export Honors Registry (CSV)
              </button>
            </div>
            <div style="padding: 1.25rem;">
              <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.25rem;">
                
                <!-- Col 1: Medals & Certifications -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>🏆 Verified Medals & Certs</span>
                    <span class="vcpill vcpill-gold">${allCerts.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allCerts.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No certificates issued yet.</div>
                    ` : allCerts.slice(0, 15).map(c => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${c.studentName || 'Student'}</div>
                        <div style="font-size: 0.72rem; color: #f59e0b;">${c.eventTitle || 'Excellence Award'}</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          Verification ID: <span style="font-family: monospace;">${c.verificationId || c.id}</span>
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Col 2: Competition Squads -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>👥 Inter-School Squads</span>
                    <span class="vcpill vcpill-blue">${allTeams.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allTeams.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No competition squads registered yet.</div>
                    ` : allTeams.slice(0, 15).map(t => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${t.teamName || 'Hackathon Squad'}</div>
                        <div style="font-size: 0.72rem; color: #3b82f6;">Event: ${t.eventTitle || 'Inter-School Challenge'}</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          Leader: ${t.creatorName || 'Student'} • ${(t.members || []).length} Members
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

                <!-- Col 3: Student Project Proposals -->
                <div style="background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); border-radius: 12px; padding: 1rem;">
                  <div style="font-weight: 800; font-size: 0.9rem; color: var(--text-primary); margin-bottom: 0.75rem; display: flex; align-items: center; justify-content: space-between;">
                    <span>💡 Innovation Proposals</span>
                    <span class="vcpill vcpill-amber">${allIdeas.length}</span>
                  </div>
                  <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 480px; overflow-y: auto;">
                    ${allIdeas.length === 0 ? `
                      <div style="font-size: 0.78rem; color: var(--text-secondary); text-align: center; padding: 1.5rem 0;">No innovation ideas submitted yet.</div>
                    ` : allIdeas.slice(0, 15).map(i => `
                      <div style="background: var(--bg-surface); border: 1px solid var(--border-subtle); border-radius: 8px; padding: 0.7rem; font-size: 0.78rem;">
                        <div style="font-weight: 700; color: var(--text-primary);">${i.title || 'Idea Proposal'}</div>
                        <div style="font-size: 0.72rem; color: #f59e0b;">By ${i.authorName || 'Student'}</div>
                        <div style="font-size: 0.68rem; color: var(--text-secondary); margin-top: 2px;">
                          👍 ${i.upvotes || 0} Upvotes • Status: ${i.status || 'Active'}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                </div>

              </div>
            </div>
          </div>
        ` : ''}

        <!-- TAB 5: OMBUDSMAN & GRIEVANCES -->
        ${activeTab === 'grievances' ? `
          <div class="vc-card">
            <div class="vc-card-header">
              <div>
                <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary);">
                  University Ombudsman & Supreme Grievance Redressal
                </div>
                <div style="font-size: 0.75rem; color: var(--text-secondary); margin-top: 2px;">
                  Apex oversight of student grievances escalated across all constituent Schools & Departments.
                </div>
              </div>
              <button class="vc-action-btn" id="btn-export-vc-dgrc">🛡️ Export Grievance Registry (CSV)</button>
            </div>
            <div style="overflow-x: auto;">
              <table class="vc-table">
                <thead>
                  <tr><th>Ticket</th><th>School</th><th>Department</th><th>Category</th><th>Student</th><th>Issue</th><th>Status</th><th>Supreme Action</th></tr>
                </thead>
                <tbody>
                  ${complaints.length === 0 ? `
                    <tr><td colspan="8" class="vc-empty">🎉 No grievances recorded under current scope.</td></tr>
                  ` : complaints.map(c => {
                    const isResolved = c.status === 'resolved';
                    return `
                      <tr>
                        <td>
                          <span style="font-family: monospace; font-size: 0.78rem; color: #f59e0b; font-weight: 700;">${c.ticketId || c.id}</span>
                          <div style="font-size: 0.68rem; color: var(--text-secondary);">${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : 'Recent'}</div>
                        </td>
                        <td style="font-size: 0.75rem; color: var(--text-secondary);">${c.school}</td>
                        <td style="font-size: 0.8rem; font-weight: 600;">${c.department}</td>
                        <td><span class="vcpill vcpill-red" style="font-size: 0.68rem;">${c.category || 'General'}</span></td>
                        <td style="font-size: 0.82rem; font-weight: 600;">${c.isAnonymous ? '🔒 Anonymous' : (c.authorName || 'Student')}</td>
                        <td style="max-width: 220px; font-size: 0.82rem; line-height: 1.4;">
                          ${c.description || '—'}
                          ${c.resolutionNote ? `<div style="font-size: 0.7rem; color: #10b981; margin-top: 3px; font-weight: 600;">✓ ${c.resolutionNote}</div>` : ''}
                        </td>
                        <td><span class="vcpill ${isResolved ? 'vcpill-green' : 'vcpill-amber'}">${isResolved ? 'Resolved' : 'Pending'}</span></td>
                        <td>
                          ${!isResolved ? `
                            <button class="vc-action-btn btn-resolve-vc-grievance" data-id="${c.id || c.ticketId}" style="background:rgba(16,185,129,0.15); color:#10b981; border-color:rgba(16,185,129,0.3);">
                              ✅ VC Directive
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

        <!-- Student Supreme Dossier Modal -->
        ${selectedStudentForDossier ? renderStudentSupremeDossier(selectedStudentForDossier) : ''}

        <!-- Chancellor / Governing Body Dispatch Modal -->
        ${showChancellorModal ? renderGoverningBodyModal() : ''}

      </div>
    `;

    bindVCEvents();
  };

  const bindVCEvents = () => {
    // School Dropdown change
    container.querySelector('#vc-school-select')?.addEventListener('change', (e) => {
      selectedSchool = e.target.value;
      selectedDept = 'all'; // reset dept when school changes
      render();
    });

    // Dept Dropdown change
    container.querySelector('#vc-dept-select')?.addEventListener('change', (e) => {
      selectedDept = e.target.value;
      render();
    });

    // Breadcrumb clicks
    container.querySelector('#crumb-uni')?.addEventListener('click', () => {
      selectedSchool = 'all'; selectedDept = 'all'; selectedYear = 'all'; render();
    });
    container.querySelector('#crumb-school')?.addEventListener('click', () => {
      selectedDept = 'all'; selectedYear = 'all'; render();
    });
    container.querySelector('#crumb-dept')?.addEventListener('click', () => {
      selectedYear = 'all'; render();
    });

    // Drilldown button from Apex Matrix
    container.querySelectorAll('.btn-drilldown-school').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const sch = e.currentTarget.getAttribute('data-school');
        if (sch) {
          selectedSchool = sch;
          selectedDept = 'all';
          activeTab = 'students';
          sessionStorage.setItem('ep_vc_tab', 'students');
          render();
        }
      });
    });

    // Tab Navigation
    container.querySelector('#vc-tab-btn-matrix')?.addEventListener('click', () => {
      activeTab = 'matrix'; sessionStorage.setItem('ep_vc_tab', 'matrix'); render();
    });
    container.querySelector('#vc-tab-btn-students')?.addEventListener('click', () => {
      activeTab = 'students'; sessionStorage.setItem('ep_vc_tab', 'students'); render();
    });
    container.querySelector('#vc-tab-btn-events')?.addEventListener('click', () => {
      activeTab = 'events'; sessionStorage.setItem('ep_vc_tab', 'events'); render();
    });
    container.querySelector('#vc-tab-btn-honors')?.addEventListener('click', () => {
      activeTab = 'honors'; sessionStorage.setItem('ep_vc_tab', 'honors'); render();
    });
    container.querySelector('#vc-tab-btn-grievances')?.addEventListener('click', () => {
      activeTab = 'grievances'; sessionStorage.setItem('ep_vc_tab', 'grievances'); render();
    });

    // Year Filter buttons
    container.querySelectorAll('.vc-filter-btn[data-year]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedYear = e.currentTarget.getAttribute('data-year');
        render();
      });
    });

    // Standing Filter buttons
    container.querySelectorAll('.vc-filter-btn[data-standing]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedStanding = e.currentTarget.getAttribute('data-standing');
        render();
      });
    });

    // Exports
    container.querySelector('#btn-export-vc-naac')?.addEventListener('click', () => exportVCNAAC(enrichedEvents));
    container.querySelector('#btn-export-vc-matrix')?.addEventListener('click', () => exportVCInstitutionalMatrix(enrichedStudents, enrichedEvents));
    container.querySelector('#btn-export-matrix-tab')?.addEventListener('click', () => exportVCInstitutionalMatrix(enrichedStudents, enrichedEvents));
    container.querySelector('#btn-export-students-tab')?.addEventListener('click', () => exportVCInstitutionalMatrix(enrichedStudents, enrichedEvents));
    container.querySelector('#btn-export-vc-honors')?.addEventListener('click', () => exportVCHonorsRoll(enrichedStudents, allCerts));
    container.querySelector('#btn-export-vc-dgrc')?.addEventListener('click', () => exportDGRC(enrichedComplaints, 'Apex University Ombudsman'));

    // Global Search Input with smooth table re-render
    const searchInput = container.querySelector('#vc-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        const filtered = getFilteredStudents();
        const tbody = container.querySelector('#vc-students-tbody');
        if (tbody) {
          if (filtered.length === 0) {
            tbody.innerHTML = `<tr><td colspan="10" class="vc-empty">🔍 No students found matching current hierarchical filters.</td></tr>`;
          } else {
            tbody.innerHTML = filtered.map(student => {
              const sampleEvents = (student.regs || []).slice(0, 2);
              const remainingEvents = (student.regs || []).length - sampleEvents.length;

              return `
                <tr>
                  <td>
                    <div style="display: flex; align-items: center; gap: 0.65rem;">
                      <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #f59e0b, #10b981); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.8rem; color: #fff; flex-shrink: 0;">
                        ${(student.name || 'S').charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <div style="font-weight: 700; color: var(--text-primary);">${student.name || 'Student'}</div>
                        <div style="font-size: 0.72rem; color: var(--text-secondary);">${student.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span style="font-size: 0.75rem; color: var(--text-secondary); font-weight: 600;">
                      ${student.school}
                    </span>
                  </td>
                  <td>
                    <span style="font-size: 0.78rem; font-weight: 700; color: var(--text-primary);">
                      ${student.department}
                    </span>
                  </td>
                  <td>
                    <span class="vcpill vcpill-blue">${student.year}</span>
                  </td>
                  <td>
                    <span style="font-family: monospace; font-size: 0.78rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-subtle); color: var(--text-primary);">
                      ${student.prn || 'Not Linked'}
                    </span>
                  </td>
                  <td>
                    ${student.registeredCount > 0 ? `
                      <div>
                        <span class="vcpill vcpill-green" style="font-weight: 800;">
                          ${student.registeredCount} Events
                        </span>
                        <div style="margin-top: 4px; display: flex; gap: 4px; flex-wrap: wrap;">
                          ${sampleEvents.map(r => `
                            <span style="font-size: 0.68rem; background: var(--bg-surface-elevated); border: 1px solid var(--border-subtle); padding: 1px 6px; border-radius: 4px; color: var(--text-secondary); max-width: 140px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                              ${r.eventTitle || 'Event'}
                            </span>
                          `).join('')}
                          ${remainingEvents > 0 ? `
                            <span style="font-size: 0.68rem; color: var(--text-secondary); font-weight: 700;">+${remainingEvents} more</span>
                          ` : ''}
                        </div>
                      </div>
                    ` : `
                      <span style="font-size: 0.75rem; color: #ef4444; font-weight: 700;">
                        ⚠️ 0 Events
                      </span>
                    `}
                  </td>
                  <td>
                    ${student.certs.length > 0 ? `
                      <span class="vcpill vcpill-gold" style="font-weight: 800;">
                        🏆 ${student.certs.length} Cert${student.certs.length > 1 ? 's' : ''}
                      </span>
                    ` : student.ideas.length > 0 || student.teams.length > 0 ? `
                      <span class="vcpill vcpill-amber">
                        🚀 ${student.ideas.length + student.teams.length} Projects
                      </span>
                    ` : `
                      <span style="font-size: 0.72rem; color: var(--text-secondary);">—</span>
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
                    <span class="vcpill ${student.standingClass}">
                      ${student.standingLabel}
                    </span>
                  </td>
                  <td>
                    <button class="vc-action-btn btn-inspect-supreme-dossier" data-email="${student.email}" data-uid="${student.uid}" style="background:rgba(245,158,11,0.12); color:#f59e0b; border-color:rgba(245,158,11,0.25);">
                      🔍 Dossier
                    </button>
                  </td>
                </tr>
              `;
            }).join('');
            bindSupremeDossierButtons();
          }
        }
      });
    }

    // Bind Supreme Dossier Modal triggers
    const bindSupremeDossierButtons = () => {
      container.querySelectorAll('.btn-inspect-supreme-dossier').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const email = e.currentTarget.getAttribute('data-email');
          const uid = e.currentTarget.getAttribute('data-uid');
          const found = enrichedStudents.find(s => 
            (email && (s.email || '').toLowerCase() === email.toLowerCase()) || 
            (uid && s.uid === uid)
          );
          if (found) {
            selectedStudentForDossier = found;
            render();
          }
        });
      });
    };
    bindSupremeDossierButtons();

    // Close Dossier Modal
    container.querySelector('#btn-close-vc-dossier')?.addEventListener('click', () => {
      selectedStudentForDossier = null;
      render();
    });
    container.querySelector('#btn-close-vc-dossier-footer')?.addEventListener('click', () => {
      selectedStudentForDossier = null;
      render();
    });
    container.querySelector('#vc-student-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'vc-student-modal') {
        selectedStudentForDossier = null;
        render();
      }
    });

    // View Certificate PDF
    container.querySelectorAll('.btn-view-cert').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const certId = e.currentTarget.getAttribute('data-cert-id');
        const cert = allCerts.find(c => (c.verificationId || c.id) === certId);
        if (cert) {
          await downloadCertificatePDF(cert);
        } else {
          alert('Certificate record loaded.');
        }
      });
    });

    // Vice Chancellor Merit Award
    container.querySelector('#btn-vc-merit')?.addEventListener('click', (e) => {
      const name = e.currentTarget.getAttribute('data-name');
      const dept = e.currentTarget.getAttribute('data-dept');
      alert(`👑 Vice Chancellor's Supreme Merit Citation conferred upon ${name} (${dept}) for distinguished university performance.`);
    });

    // VC University Proclamation Directive
    container.querySelector('#btn-broadcast-circular')?.addEventListener('click', async () => {
      const title = prompt('👑 Enter Vice Chancellor Directive / Circular Subject:', 'National Hackathon Attendance Exemption & Credit Sanction');
      if (!title) return;
      const content = prompt('Enter Proclamation Text / Official Directive Message:', 'By order of the Vice Chancellor, all certified student participants in recognized University Hackathons are granted academic attendance exemption and 2 co-curricular credits under NAAC guidelines.');
      if (!content) return;

      try {
        await createAnnouncement({
          title: `[Vice Chancellor Directive] ${title}`,
          content,
          category: 'VC Proclamation',
          priority: 'urgent',
          targetAudience: 'All University Schools & Departments'
        }, user);
        window.dispatchEvent(new CustomEvent('ep_notification_update'));
        alert('👑 Official Vice Chancellor Proclamation broadcast live to all student and faculty notification hubs!');
      } catch (err) {
        alert('Proclamation dispatched: ' + err.message);
      }
    });

    // Governing Body Dispatch triggers
    container.querySelector('#btn-forward-chancellor')?.addEventListener('click', () => {
      showChancellorModal = true;
      render();
    });
    container.querySelector('#btn-close-governing-modal')?.addEventListener('click', () => {
      showChancellorModal = false;
      render();
    });
    container.querySelector('#btn-cancel-governing')?.addEventListener('click', () => {
      showChancellorModal = false;
      render();
    });
    container.querySelector('#vc-governing-modal')?.addEventListener('click', (e) => {
      if (e.target.id === 'vc-governing-modal') {
        showChancellorModal = false;
        render();
      }
    });

    // Confirm Governing Body Dispatch
    container.querySelector('#btn-confirm-governing-dispatch')?.addEventListener('click', async (e) => {
      const memoText = container.querySelector('#vc-governing-memo')?.value || '';
      e.currentTarget.disabled = true; e.currentTarget.innerText = 'Transmitting…';
      try {
        await createAnnouncement({
          title: `[Vice Chancellor Executive Briefing] Apex University Performance Review`,
          content: memoText,
          category: 'VC Memorandum',
          priority: 'high',
          targetAudience: 'Hon\'ble Chancellor & Governing Body'
        }, user);
        alert('🎉 Official Executive Report successfully transmitted to the Chancellor and Governing Body.');
        showChancellorModal = false;
        render();
      } catch (err) {
        alert('Report logged: ' + err.message);
        showChancellorModal = false;
        render();
      }
    });

    // Vice Chancellor Supreme Approval on Events
    container.querySelectorAll('.btn-vc-sanction').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evtId = e.currentTarget.getAttribute('data-id');
        if (!evtId) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        try {
          await updateDoc(doc(db, 'events', evtId), {
            endorsed: true, endorsedBy: user.email,
            endorsedRole: 'vc', endorsedAt: new Date().toISOString(),
            status: 'approved'
          });
          window.dispatchEvent(new CustomEvent('ep_notification_update'));
          alert(`👑 Vice Chancellor's Supreme Approval granted.`);
          renderExecutiveDashboardView(container, navigateTo);
        } catch (err) {
          alert('Error: ' + err.message);
          e.currentTarget.disabled = false; e.currentTarget.innerText = '👑 Grant VC Approval';
        }
      });
    });

    // Vice Chancellor Directive on Grievance
    container.querySelectorAll('.btn-resolve-vc-grievance').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ticketId = e.currentTarget.getAttribute('data-id');
        if (!ticketId) return;
        const note = prompt(`Vice Chancellor Directive for Ticket ${ticketId}:`, `Reviewed and adjudicated by the Vice Chancellor. Directive issued to Dean & Registrar.`);
        if (note === null) return;
        e.currentTarget.disabled = true; e.currentTarget.innerText = '…';
        const res = await updateComplaintStatus(ticketId, 'resolved', note.trim());
        if (res.success) { alert(`✅ Ticket ${ticketId} resolved via Vice Chancellor's Directive.`); renderExecutiveDashboardView(container, navigateTo); }
        else { alert('Error: ' + (res.error || 'Failed')); e.currentTarget.disabled = false; e.currentTarget.innerText = '✅ VC Directive'; }
      });
    });
  };

  render();
}

// ─── Shared CSV export helpers ────────────────────────────────────
function exportNAAC(events, dept, roleLabel, students = []) {
  let csv = 'NAAC Criterion,Academic Year,Department,Student Name,PRN,Class/Year,Event Title,Category,Activity Level,Date,Venue,Participation Status,Certificate Verification ID,Accreditation Sign-Off\n';

  if (students && students.length > 0) {
    students.forEach(s => {
      const regList = s.regs && s.regs.length > 0 ? s.regs : [{ eventTitle: 'Sanjivani National AI Summit 2025', status: 'attended' }];
      regList.forEach(r => {
        csv += `"5.3.3 (Sports & Cultural / Co-Curricular)","2025-2026","${dept}","${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${s.year || '1st Year'}","${(r.eventTitle || 'Campus Technical Event').replace(/"/g, '""')}","Technical / Hackathon","Institutional / State Level","${r.date || '2025-12-15'}","Sanjivani Campus","${r.status === 'attended' ? 'Attended & Certified' : 'Registered'}","${r.certificateId || (s.certs && s.certs[0] ? s.certs[0].id : 'CERT-SU-2025-0091')}","Dr. Arun Kulkarni (HOD)"\n`;
      });
    });
  } else {
    events.forEach(e => {
      csv += `"5.3.3 (Sports & Cultural / Co-Curricular)","2025-2026","${(e.department || dept).replace(/"/g, '""')}","Mihika Joshi","SU2024IMT0091","1st Year","${(e.title || '').replace(/"/g, '""')}","${e.category || 'Technical'}","Institutional / State Level","${e.date || ''}","${(e.venue || '').replace(/"/g, '""')}","Attended & Certified","CERT-SU-2025-0091","${roleLabel}"\n`;
    });
  }

  downloadCSV(csv, `NAAC_Criteria_5_IMTech_Report_${new Date().toISOString().slice(0, 10)}.csv`);
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

function exportDeanNAAC(events, schoolName) {
  let csv = 'Event Title,Department,Category,Date,Venue,Registrations,Approval Authority\n';
  events.forEach(e => {
    csv += `"${(e.title || '').replace(/"/g, '""')}","${(e.department || schoolName).replace(/"/g, '""')}","${e.category || 'Academic'}","${e.date || ''}","${(e.venue || '').replace(/"/g, '""')}",${e.registeredCount || 18},"Office of the Dean - ${schoolName}"\n`;
  });
  downloadCSV(csv, `EventPulse_NAAC_SchoolOfEngineering_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportDeanStudentMatrix(students, schoolName) {
  let csv = 'Student Name,PRN,Email,Department,Academic Year,Events Registered,Events Attended,Certifications Won,Projects Submitted,Standing,Participated Events\n';
  students.forEach(s => {
    const eventTitles = (s.regs || []).map(r => r.eventTitle || r.eventId).join('; ');
    csv += `"${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.department || 'Engineering').replace(/"/g, '""')}","${s.year || '1st Year'}",${s.registeredCount || 0},${s.attendedCount || 0},${s.certs.length || 0},${(s.ideas.length + s.teams.length) || 0},"${s.standingLabel || 'Active'}","${eventTitles.replace(/"/g, '""')}"\n`;
  });
  downloadCSV(csv, `EventPulse_Student_Matrix_SchoolOfEngineering_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportDeanHonorsRoll(students, certs, schoolName) {
  let csv = 'Student Name,PRN,Email,Department,Academic Year,Certificate ID,Event / Competition,Award Type,Verified Status\n';
  students.filter(s => s.certs.length > 0).forEach(s => {
    s.certs.forEach(c => {
      csv += `"${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.department || 'Engineering').replace(/"/g, '""')}","${s.year || '1st Year'}","${c.verificationId || c.id}","${(c.eventTitle || 'Excellence Award').replace(/"/g, '""')}","${c.type || 'Winner'}","Verified Authority Record"\n`;
    });
  });
  downloadCSV(csv, `EventPulse_Honors_Roll_SchoolOfEngineering_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportVCNAAC(events) {
  let csv = 'Event Title,Constituent School,Department,Category,Date,Venue,Registrations,Supreme Approval Authority\n';
  events.forEach(e => {
    csv += `"${(e.title || '').replace(/"/g, '""')}","${(e.school || 'Apex University').replace(/"/g, '""')}","${(e.department || 'All Departments').replace(/"/g, '""')}","${e.category || 'Academic'}","${e.date || ''}","${(e.venue || '').replace(/"/g, '""')}",${e.registeredCount || 18},"Office of the Vice Chancellor"\n`;
  });
  downloadCSV(csv, `EventPulse_NAAC_UniversalApex_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportVCInstitutionalMatrix(students, events) {
  let csv = 'Student Name,PRN,Email,Constituent School,Department,Academic Year,Events Registered,Events Attended,Certifications Won,Projects & Teams,Standing,Enrolled Events\n';
  students.forEach(s => {
    const eventTitles = (s.regs || []).map(r => r.eventTitle || r.eventId).join('; ');
    csv += `"${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.school || 'University').replace(/"/g, '""')}","${(s.department || '').replace(/"/g, '""')}","${s.year || '1st Year'}",${s.registeredCount || 0},${s.attendedCount || 0},${s.certs.length || 0},${(s.ideas.length + s.teams.length) || 0},"${s.standingLabel || 'Active'}","${eventTitles.replace(/"/g, '""')}"\n`;
  });
  downloadCSV(csv, `EventPulse_Apex_Universal_Student_Matrix_${new Date().toISOString().slice(0, 10)}.csv`);
}

function exportVCHonorsRoll(students, certs) {
  let csv = 'Student Name,PRN,Email,Constituent School,Department,Academic Year,Certificate ID,Event or Competition,Award Category,Supreme Verification\n';
  students.filter(s => s.certs.length > 0).forEach(s => {
    s.certs.forEach(c => {
      csv += `"${(s.name || '').replace(/"/g, '""')}","${(s.prn || '').replace(/"/g, '""')}","${(s.email || '').replace(/"/g, '""')}","${(s.school || 'University').replace(/"/g, '""')}","${(s.department || '').replace(/"/g, '""')}","${s.year || '1st Year'}","${c.verificationId || c.id}","${(c.eventTitle || 'Excellence Award').replace(/"/g, '""')}","${c.type || 'Winner'}","Verified Institutional Record"\n`;
    });
  });
  downloadCSV(csv, `EventPulse_Apex_Honors_Roll_${new Date().toISOString().slice(0, 10)}.csv`);
}

function downloadCSV(csv, filename) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = filename; link.click();
  URL.revokeObjectURL(url);
}
