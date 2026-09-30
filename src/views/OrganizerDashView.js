import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getOrganizerEvents, getAllEvents, createEvent, markEventCompleted, reopenEvent, updateEventVisibility, getCachedEventsSync } from '../services/events';
import { getEventRegistrations, updateRegistrationStatus, bulkUpdateRegistrations, updateAttendance, bulkUpdateAttendance, awardCertificate } from '../services/registrations';
import { getEventVolunteers, updateVolunteerStatus } from '../services/volunteers';
import { getComplaints, updateComplaintStatus } from '../services/complaints';
import { openQRScannerModal } from '../components/QRScannerModal';
import { generateEventDescriptionAI } from '../services/ai';
import { openCompletedEventModal } from '../components/CompletedEventModal';
import {
  getAllowedParticipants,
  addAllowedParticipant,
  removeAllowedParticipant,
  batchAddAllowedParticipants,
  clearAllowedParticipants,
  parseParticipantsFile,
  downloadSampleTemplate,
  exportParticipantsCsv
} from '../services/participants';

export async function renderOrganizerDashView(container, navigateTo) {
  const user = getCurrentUser();
  const isAdmin = isUserAdmin(user);
  if (!user || (user.role !== 'organizer' && !isAdmin)) {
    navigateTo('login');
    return;
  }

  // Instant Cache-First Initialization
  let events = getCachedEventsSync() || [];
  const defaultEvent = events.find(e => e.status === 'approved') || (events.length > 0 ? events[0] : null);
  let selectedEventId = defaultEvent ? defaultEvent.id : null;
  let registrations = [];
  let volunteers = [];
  let complaints = [];

  let activeTab = 'registrations'; // 'registrations' | 'participants' | 'volunteers' | 'grievances' | 'history'
  let regSubTab = 'pending'; // 'pending' | 'approved' | 'rejected'
  let searchFilter = '';
  let participantSearchFilter = '';
  let selectedRegIds = new Set();
  let allowedParticipantsList = [];

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

    // Filtered allowed participants for closed roster
    const filteredParticipants = allowedParticipantsList.filter(p => {
      const q = participantSearchFilter.toLowerCase().trim();
      return !q ||
        (p.name || '').toLowerCase().includes(q) ||
        (p.email || p.id || '').toLowerCase().includes(q) ||
        (p.prn || '').toLowerCase().includes(q);
    });

    const filteredVolunteers = volunteers.filter(v => {
      const q = searchFilter.toLowerCase();
      return !q || (v.studentName || '').toLowerCase().includes(q) || (v.prn || '').toLowerCase().includes(q);
    });

    const filteredComplaints = complaints.filter(c => {
      const q = searchFilter.toLowerCase();
      return !q || (c.reporterName || '').toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q) || (c.ticketId || '').toLowerCase().includes(q);
    });

    // Auto-adjust subtab if pending is empty but approved has attendees
    if (regSubTab === 'pending' && pendingRegs.length === 0 && approvedRegs.length > 0) {
      regSubTab = 'approved';
    }

    container.innerHTML = `
      <div class="org-hub-wrap">
        <style>
          .org-hub-wrap { font-family: inherit; }

          /* ── Modern Hero Banner ── */
          .org-hero {
            background: linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #4338ca 100%);
            border-radius: 18px;
            padding: 1.75rem 2rem;
            margin-bottom: 1.5rem;
            position: relative;
            overflow: hidden;
            box-shadow: 0 10px 30px -5px rgba(49, 46, 129, 0.25);
            border: 1px solid rgba(255, 255, 255, 0.1);
          }
          .org-hero::before {
            content: '';
            position: absolute;
            top: -50px; right: -50px;
            width: 220px; height: 220px;
            background: radial-gradient(circle, rgba(167, 139, 250, 0.25) 0%, transparent 70%);
            pointer-events: none;
          }
          .org-hero-top {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            flex-wrap: wrap;
            gap: 1.25rem;
            position: relative;
            z-index: 1;
          }
          .org-badge {
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            background: rgba(255, 255, 255, 0.12);
            backdrop-filter: blur(8px);
            border: 1px solid rgba(255, 255, 255, 0.25);
            padding: 0.25rem 0.75rem;
            border-radius: 999px;
            font-size: 0.72rem;
            font-weight: 800;
            color: #e0e7ff;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            margin-bottom: 0.6rem;
          }
          .org-title {
            font-size: 1.85rem;
            font-weight: 900;
            color: #ffffff;
            margin: 0 0 0.35rem;
            letter-spacing: -0.02em;
          }
          .org-subtitle {
            color: #c7d2fe;
            font-size: 0.9rem;
            margin: 0;
            max-width: 580px;
            line-height: 1.5;
          }
          .org-action-btns {
            display: flex;
            gap: 0.6rem;
            flex-wrap: wrap;
            align-items: center;
          }
          .org-btn-primary {
            background: #ffffff;
            color: #312e81;
            border: none;
            border-radius: 10px;
            padding: 0.6rem 1.15rem;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
            transition: all 0.15s ease;
          }
          .org-btn-primary:hover {
            transform: translateY(-1px);
            box-shadow: 0 6px 20px rgba(0, 0, 0, 0.22);
            background: #f8fafc;
          }
          .org-btn-ghost {
            background: rgba(255, 255, 255, 0.12);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.25);
            backdrop-filter: blur(8px);
            border-radius: 10px;
            padding: 0.6rem 1.1rem;
            font-weight: 700;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.45rem;
            transition: all 0.15s ease;
          }
          .org-btn-ghost:hover {
            background: rgba(255, 255, 255, 0.22);
            border-color: rgba(255, 255, 255, 0.4);
            transform: translateY(-1px);
          }

          /* ── Target Event Selector Bar ── */
          .org-event-card {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 16px;
            padding: 1.1rem 1.4rem;
            margin-bottom: 1.5rem;
            box-shadow: 0 4px 20px -2px rgba(15, 23, 42, 0.05);
            display: flex;
            justify-content: space-between;
            align-items: center;
            flex-wrap: wrap;
            gap: 1rem;
          }
          .org-event-select-wrap {
            display: flex;
            align-items: center;
            gap: 0.85rem;
            flex: 1;
            min-width: 290px;
          }
          .org-event-label {
            font-weight: 800;
            font-size: 0.925rem;
            color: #0f172a;
            white-space: nowrap;
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }
          #event-select-dropdown {
            background: #f8fafc !important;
            border: 1.5px solid #cbd5e1 !important;
            color: #0f172a !important;
            border-radius: 10px !important;
            font-weight: 700 !important;
            font-size: 0.925rem !important;
            padding: 0.55rem 1rem !important;
            width: 100%;
            max-width: 520px;
            cursor: pointer;
            outline: none;
            transition: border-color 0.15s, box-shadow 0.15s;
          }
          #event-select-dropdown:focus {
            border-color: #6366f1 !important;
            box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.15) !important;
          }
          #event-select-dropdown option {
            background: #ffffff;
            color: #0f172a;
          }
          .org-event-actions {
            display: flex;
            gap: 0.5rem;
            align-items: center;
            flex-wrap: wrap;
          }
          .org-status-pill {
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            padding: 0.35rem 0.8rem;
            border-radius: 999px;
            font-size: 0.775rem;
            font-weight: 800;
            letter-spacing: 0.02em;
          }
          .org-status-pill.open {
            background: #dcfce7;
            color: #15803d;
            border: 1px solid #bbf7d0;
          }
          .org-status-pill.closed {
            background: #ede9fe;
            color: #6d28d9;
            border: 1px solid #ddd6fe;
          }
          .org-status-pill.approved {
            background: #eff6ff;
            color: #1d4ed8;
            border: 1px solid #bfdbfe;
          }
          .org-status-pill.pending {
            background: #fffbeb;
            color: #b45309;
            border: 1px solid #fde68a;
          }
          .org-btn-action {
            background: #f8fafc;
            color: #334155;
            border: 1.5px solid #cbd5e1;
            border-radius: 9px;
            padding: 0.4rem 0.85rem;
            font-size: 0.8rem;
            font-weight: 700;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.35rem;
            transition: all 0.15s ease;
          }
          .org-btn-action:hover {
            background: #f1f5f9;
            border-color: #94a3b8;
            color: #0f172a;
          }
          .org-btn-action.success {
            background: linear-gradient(135deg, #059669, #10b981);
            color: #ffffff;
            border: none;
            box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);
          }
          .org-btn-action.success:hover {
            box-shadow: 0 4px 12px rgba(16, 185, 129, 0.35);
            transform: translateY(-1px);
          }

          /* ── High-Contrast Stat Cards ── */
          .org-stats-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 1rem;
            margin-bottom: 1.5rem;
          }
          .org-metric-card {
            background: #ffffff;
            border: 1.5px solid #e2e8f0;
            border-radius: 16px;
            padding: 1.15rem 1.25rem;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.04);
            position: relative;
            overflow: hidden;
            transition: transform 0.15s ease, box-shadow 0.15s ease;
          }
          .org-metric-card:hover {
            transform: translateY(-2px);
            box-shadow: 0 6px 18px rgba(15, 23, 42, 0.07);
          }
          .org-metric-card::before {
            content: '';
            position: absolute;
            top: 0;
            left: 0;
            bottom: 0;
            width: 4.5px;
            border-radius: 16px 0 0 16px;
          }
          .org-metric-card.amber::before { background: #f59e0b; }
          .org-metric-card.blue::before { background: #3b82f6; }
          .org-metric-card.green::before { background: #10b981; }
          .org-metric-card.red::before { background: #ef4444; }
          .org-metric-card.slate::before { background: #64748b; }

          .org-metric-label {
            font-size: 0.74rem;
            font-weight: 800;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.05em;
            display: flex;
            align-items: center;
            gap: 0.35rem;
          }
          .org-metric-val {
            font-size: 2.1rem;
            font-weight: 900;
            line-height: 1.1;
            margin-top: 0.35rem;
          }
          .org-metric-card.amber .org-metric-val { color: #d97706; }
          .org-metric-card.blue .org-metric-val { color: #2563eb; }
          .org-metric-card.green .org-metric-val { color: #059669; }
          .org-metric-card.red .org-metric-val { color: #dc2626; }
          .org-metric-card.slate .org-metric-val { color: #475569; }

          /* ── Modern Segmented Section Tabs ── */
          .org-nav-tabs {
            display: flex;
            gap: 0.35rem;
            background: #e2e8f0;
            padding: 5px;
            border-radius: 14px;
            margin-bottom: 1.5rem;
            flex-wrap: wrap;
          }
          .org-nav-tab {
            background: transparent;
            color: #475569;
            border: none;
            padding: 0.55rem 1.15rem;
            border-radius: 10px;
            font-size: 0.85rem;
            font-weight: 700;
            cursor: pointer;
            transition: all 0.15s ease;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
          }
          .org-nav-tab:hover {
            color: #0f172a;
            background: rgba(255, 255, 255, 0.5);
          }
          .org-nav-tab.active {
            background: #ffffff;
            color: #4338ca;
            font-weight: 800;
            box-shadow: 0 2px 8px rgba(15, 23, 42, 0.08);
          }
          .org-nav-tab.danger {
            color: #b91c1c;
          }
          .org-nav-tab.danger.active {
            background: #ffffff;
            color: #dc2626;
            box-shadow: 0 2px 8px rgba(220, 38, 38, 0.12);
          }
          .org-tab-badge {
            background: rgba(67, 56, 202, 0.12);
            color: #4338ca;
            font-size: 0.72rem;
            font-weight: 800;
            padding: 2px 7px;
            border-radius: 999px;
          }
          .org-nav-tab.active .org-tab-badge {
            background: #4338ca;
            color: #ffffff;
          }
        </style>

        <!-- ── Top Hero Banner ── -->
        <div class="org-hero">
          <div class="org-hero-top">
            <div>
              <div class="org-badge">🎛️ Event Operations &amp; Attendance Console</div>
              <h1 class="org-title">Organizer Command Hub</h1>
              <p class="org-subtitle">
                Review student applications, take live attendance via QR scan, award certificates, and manage participant rosters.
              </p>
            </div>
            <div class="org-action-btns">
              <button class="org-btn-primary" id="btn-scan-qr">📷 Scan Student QR</button>
              <button class="org-btn-ghost" id="btn-sync-organizer-live" title="Fetch fresh registrations from database">🔄 Sync Live</button>
              <button class="org-btn-ghost" id="btn-export-master">📊 Master CSV</button>
              <button class="org-btn-ghost" id="btn-create-event">➕ Create Event</button>
            </div>
          </div>
        </div>

        <!-- ── Target Event Selector Bar ── -->
        <div class="org-event-card">
          <div class="org-event-select-wrap">
            <span class="org-event-label">🎯 Target Event:</span>
            <select id="event-select-dropdown">
              ${events.length === 0 ? `<option value="">No events found. Click "Create Event" to post one.</option>` : ''}
              ${events.map(e => `
                <option value="${e.id}" ${e.id === selectedEventId ? 'selected' : ''}>
                  ${e.status === 'completed' ? '🏁 [COMPLETED] ' : (e.status === 'approved' ? '🟢 [ACTIVE] ' : '⏳ [PENDING] ')} ${e.title}
                </option>
              `).join('')}
            </select>
          </div>

          ${selectedEvent ? `
            <div class="org-event-actions">
              ${selectedEvent.visibility === 'closed' ? `
                <span class="org-status-pill closed">🔒 CLOSED (${allowedParticipantsList.length})</span>
                <button id="btn-toggle-event-visibility" class="org-btn-action">🌐 Switch to Open</button>
              ` : `
                <span class="org-status-pill open">🌐 OPEN EVENT</span>
                <button id="btn-toggle-event-visibility" class="org-btn-action">🔒 Switch to Closed</button>
              `}

              ${selectedEvent.status === 'completed' ? `
                <span class="org-status-pill closed">🏁 ARCHIVED</span>
                <button id="btn-reopen-event" class="org-btn-action">↺ Reopen</button>
              ` : `
                <span class="org-status-pill ${selectedEvent.status === 'approved' ? 'approved' : 'pending'}">
                  Status: ${selectedEvent.status.toUpperCase()}
                </span>
                <button id="btn-complete-event" class="org-btn-action success">🏁 Mark Completed</button>
              `}
              <button id="btn-export-this-event" class="org-btn-action" title="Download attendance sheet for HOD">📥 Export CSV</button>
            </div>
          ` : ''}
        </div>

        <!-- ── High-Contrast Stat Cards ── -->
        <div class="org-stats-grid">
          <div class="org-metric-card amber">
            <div class="org-metric-label">⏳ Pending Approvals</div>
            <div class="org-metric-val">${pendingRegs.length}</div>
          </div>
          <div class="org-metric-card blue">
            <div class="org-metric-label">✅ Approved Passes</div>
            <div class="org-metric-val">${approvedRegs.length}</div>
          </div>
          <div class="org-metric-card green">
            <div class="org-metric-label">🟢 Marked Present</div>
            <div class="org-metric-val">${presentCount}</div>
          </div>
          <div class="org-metric-card red">
            <div class="org-metric-label">🔴 Marked Absent</div>
            <div class="org-metric-val">${absentCount}</div>
          </div>
          <div class="org-metric-card slate">
            <div class="org-metric-label">❌ Rejected Apps</div>
            <div class="org-metric-val">${rejectedRegs.length}</div>
          </div>
        </div>

        <!-- ── Section Switcher Tabs ── -->
        <div class="org-nav-tabs">
          <button class="org-nav-tab ${activeTab === 'registrations' ? 'active' : ''}" data-tab="registrations">
            📋 Registrations &amp; Attendance <span class="org-tab-badge">${registrations.length}</span>
          </button>
          <button class="org-nav-tab ${activeTab === 'participants' ? 'active' : ''}" data-tab="participants">
            👥 Allowed Participants ${selectedEvent?.visibility === 'closed' ? `🔒` : ''} <span class="org-tab-badge">${allowedParticipantsList.length}</span>
          </button>
          <button class="org-nav-tab ${activeTab === 'volunteers' ? 'active' : ''}" data-tab="volunteers">
            🙋 Volunteer Crew <span class="org-tab-badge">${volunteers.length}</span>
          </button>
          <button class="org-nav-tab ${activeTab === 'grievances' ? 'active' : ''} ${complaints.length > 0 ? 'danger' : ''}" data-tab="grievances">
            🚨 Incident Grievances <span class="org-tab-badge">${complaints.length}</span>
          </button>
          <button class="org-nav-tab ${activeTab === 'history' ? 'active' : ''}" data-tab="history">
            📚 History &amp; Archives <span class="org-tab-badge">${completedEvents.length}</span>
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

        <!-- ========================================== -->
        <!-- TAB: ALLOWED PARTICIPANTS (CLOSED EVENT)  -->
        <!-- ========================================== -->
        ${activeTab === 'participants' ? `
          <div class="card" style="padding: 1.5rem; background: #ffffff;">
            <!-- Header with Status Banner & Switcher -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.5rem; padding-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle);">
              <div>
                <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
                  <h3 style="font-size: 1.25rem; margin: 0; color: #1e293b;">
                    👥 Allowed Participants Roster
                  </h3>
                  ${selectedEvent?.visibility === 'closed' ? `
                    <span style="background: #ede9fe; color: #7c3aed; border: 1.5px solid #c4b5fd; font-weight: 800; font-size: 0.75rem; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.3rem;">
                      🔒 CLOSED EVENT (Invite-Only Roster Active)
                    </span>
                  ` : `
                    <span style="background: #f0fdf4; color: #16a34a; border: 1.5px solid #bbf7d0; font-weight: 800; font-size: 0.75rem; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.3rem;">
                      🌐 OPEN EVENT (All Eligible Students Can Register)
                    </span>
                  `}
                </div>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0; max-width: 720px; line-height: 1.45;">
                  ${selectedEvent?.visibility === 'closed'
                    ? 'This event is strictly <strong>Closed</strong>: only students on this list can view the event and submit registrations. Unlisted students will see an "Invite Only" access block.'
                    : 'This event is currently <strong>Open</strong> to all campus students. You can build and upload the participant roster below, and switch the event to <strong>Closed</strong> mode when ready.'}
                </p>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button id="btn-toggle-vis-in-tab" class="btn btn-secondary btn-sm" style="font-weight: 800; border-color: #cbd5e1; font-size: 0.8rem; padding: 0.45rem 0.85rem;">
                  ${selectedEvent?.visibility === 'closed' ? '🌐 Switch to Open Event' : '🔒 Switch to Closed (Invite-Only)'}
                </button>
              </div>
            </div>

            <!-- Action Toolbar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button id="btn-open-manual-add" class="btn btn-primary btn-sm" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
                  ➕ Add Participant
                </button>
                <button id="btn-open-upload-modal" class="btn btn-sm" style="font-weight: 800; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; display: inline-flex; align-items: center; gap: 0.35rem; cursor: pointer; border-radius: var(--radius-sm); padding: 0.4rem 0.85rem;">
                  📤 Upload Excel / CSV
                </button>
                <button id="btn-download-template-xlsx" class="btn btn-secondary btn-sm" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;" title="Download sample template for participant upload in Excel format">
                  📥 Template (.xlsx)
                </button>
                <button id="btn-download-template-csv" class="btn btn-secondary btn-sm" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem;" title="Download sample template in CSV format">
                  📥 Template (.csv)
                </button>
              </div>

              <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                <button id="btn-export-roster-csv" class="btn btn-secondary btn-sm" style="font-weight: 700;" title="Export list of allowed participants to CSV">
                  📊 Export Roster CSV
                </button>
                ${allowedParticipantsList.length > 0 ? `
                  <button id="btn-clear-roster" class="btn btn-secondary btn-sm" style="color: #dc2626; border-color: #fca5a5; background: #fff5f5; font-weight: 700;" title="Permanently remove all participants from this event">
                    🗑️ Clear List
                  </button>
                ` : ''}
              </div>
            </div>

            <!-- Search Input Filter -->
            <div style="margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <input type="text" id="input-search-participants" class="form-control form-control-sm" placeholder="🔍 Search participant by name, email or PRN..." value="${participantSearchFilter}" style="max-width: 450px; font-size: 0.85rem;" />
              <div style="font-size: 0.825rem; color: var(--text-tertiary); font-weight: 600;">
                Showing <strong>${filteredParticipants.length}</strong> of <strong>${allowedParticipantsList.length}</strong> participants
              </div>
            </div>

            <!-- Participants Table -->
            ${allowedParticipantsList.length === 0 ? `
              <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-secondary); background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                <div style="font-size: 2.75rem; margin-bottom: 0.5rem;">👥</div>
                <div style="font-weight: 800; font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">No Participants on Roster Yet</div>
                <p style="font-size: 0.875rem; max-width: 500px; margin: 0 auto 1.25rem auto;">
                  Upload an Excel (.xlsx/.xls) or CSV sheet with student details, or add participants individually to restrict event access.
                </p>
                <div style="display: flex; gap: 0.5rem; justify-content: center; flex-wrap: wrap;">
                  <button id="btn-open-upload-modal-empty" class="btn btn-primary btn-sm" style="font-weight: 800;">
                    📤 Upload Excel / CSV
                  </button>
                  <button id="btn-open-manual-add-empty" class="btn btn-secondary btn-sm" style="font-weight: 700;">
                    ➕ Add Individually
                  </button>
                </div>
              </div>
            ` : filteredParticipants.length === 0 ? `
              <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary); background: #f8fafc; border-radius: var(--radius-sm);">
                🔍 No participants found matching "<strong>${participantSearchFilter}</strong>".
              </div>
            ` : `
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.875rem; text-align: left;">
                  <thead>
                    <tr style="background: #f8fafc; border-bottom: 1.5px solid var(--border-subtle);">
                      <th style="padding: 0.75rem 0.85rem; width: 45px;">#</th>
                      <th style="padding: 0.75rem 0.85rem;">Student Name</th>
                      <th style="padding: 0.75rem 0.85rem;">College Email</th>
                      <th style="padding: 0.75rem 0.85rem;">PRN / Roll No</th>
                      <th style="padding: 0.75rem 0.85rem;">Added Date</th>
                      <th style="padding: 0.75rem 0.85rem;">Added By</th>
                      <th style="padding: 0.75rem 0.85rem; text-align: right;">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredParticipants.map((p, idx) => `
                      <tr style="border-bottom: 1px solid var(--border-subtle); transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 0.75rem 0.85rem; color: var(--text-tertiary); font-size: 0.8rem;">${idx + 1}</td>
                        <td style="padding: 0.75rem 0.85rem; font-weight: 700; color: #1e293b;">${p.name || '—'}</td>
                        <td style="padding: 0.75rem 0.85rem; font-family: monospace; font-size: 0.825rem; color: #0284c7;">${p.email || p.id}</td>
                        <td style="padding: 0.75rem 0.85rem; font-weight: 600; color: #475569;">${p.prn || '—'}</td>
                        <td style="padding: 0.75rem 0.85rem; font-size: 0.775rem; color: #64748b;">${p.addedAt ? new Date(p.addedAt).toLocaleDateString() : '—'}</td>
                        <td style="padding: 0.75rem 0.85rem; font-size: 0.775rem; color: #64748b;">${p.addedBy || 'Organizer'}</td>
                        <td style="padding: 0.75rem 0.85rem; text-align: right;">
                          <button class="btn btn-secondary btn-sm btn-remove-participant" data-email="${p.email || p.id}" data-name="${p.name || ''}" style="color: #dc2626; border-color: #fca5a5; background: #fff5f5; font-size: 0.75rem; padding: 0.25rem 0.65rem;" title="Remove student from allowed roster">
                            🗑️ Remove
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            `}
          </div>
        ` : ''}

        <!-- Manual Add Participant Modal -->
        <div id="modal-manual-add-participant" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.65); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 1.5rem;">
          <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 480px; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5); overflow: hidden;">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: #1e293b;">➕ Add Participant to Roster</h3>
              <button id="btn-close-manual-add" style="background: none; border: none; font-size: 1.35rem; color: #94a3b8; cursor: pointer;">×</button>
            </div>
            <form id="form-manual-add-participant" style="padding: 1.5rem; display: flex; flex-direction: column; gap: 1rem;">
              <div class="form-group" style="margin: 0;">
                <label style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">Student Full Name *</label>
                <input type="text" id="input-manual-p-name" class="form-control" placeholder="e.g. Aditya Patil" required />
              </div>
              <div class="form-group" style="margin: 0;">
                <label style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">College Email Address *</label>
                <input type="email" id="input-manual-p-email" class="form-control" placeholder="e.g. aditya.cs24@college.edu" required />
              </div>
              <div class="form-group" style="margin: 0;">
                <label style="font-weight: 700; font-size: 0.85rem; margin-bottom: 0.35rem; display: block;">PRN / Roll Number *</label>
                <input type="text" id="input-manual-p-prn" class="form-control" placeholder="e.g. PRN20240101" required />
              </div>
              <div style="display: flex; justify-content: flex-end; gap: 0.75rem; margin-top: 0.5rem;">
                <button type="button" id="btn-cancel-manual-add" class="btn btn-secondary btn-sm" style="font-weight: 700;">Cancel</button>
                <button type="submit" id="btn-submit-manual-add" class="btn btn-primary btn-sm" style="font-weight: 700;">Add to Roster</button>
              </div>
            </form>
          </div>
        </div>

        <!-- Excel / CSV Upload & Validation Preview Modal -->
        <div id="modal-upload-participants" style="display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 1.5rem;">
          <div style="background: #ffffff; border-radius: 16px; width: 100%; max-width: 820px; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.5);">
            <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; background: #f8fafc;">
              <div>
                <h3 style="margin: 0 0 0.2rem 0; font-size: 1.2rem; font-weight: 800; color: #1e293b;">📤 Upload Participant List</h3>
                <p style="margin: 0; font-size: 0.825rem; color: var(--text-secondary);">Upload Excel (.xlsx/.xls) or CSV with columns: <strong>name, email, prn</strong>.</p>
              </div>
              <button id="btn-close-upload-modal" style="background: none; border: none; font-size: 1.35rem; color: #94a3b8; cursor: pointer;">×</button>
            </div>

            <div style="padding: 1.25rem 1.5rem; overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1.25rem;">
              <!-- Drag and Drop Zone -->
              <div id="dropzone-participants" style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 2rem 1.5rem; text-align: center; background: #f8fafc; cursor: pointer; transition: all 0.2s;">
                <input type="file" id="input-participants-file" accept=".xlsx, .xls, .csv" style="display: none;" />
                <div style="font-size: 2.25rem; margin-bottom: 0.5rem;">📂</div>
                <div style="font-weight: 800; font-size: 1rem; color: #1e293b; margin-bottom: 0.25rem;">
                  Click to select file or drag & drop here
                </div>
                <div style="font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.75rem;">
                  Supports Excel (.xlsx, .xls) and CSV (.csv) files.
                </div>
                <div style="display: flex; gap: 0.5rem; justify-content: center;">
                  <button type="button" id="btn-browse-file" class="btn btn-secondary btn-sm" style="font-weight: 700; pointer-events: none;">
                    Browse File
                  </button>
                </div>
              </div>

              <!-- Validation Summary Badges -->
              <div id="upload-validation-summary" style="display: none; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                <div style="flex: 1; min-width: 140px; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 8px; padding: 0.75rem 1rem;">
                  <div style="font-size: 0.75rem; font-weight: 800; color: #16a34a; text-transform: uppercase;">✅ Valid Rows</div>
                  <div id="count-valid-rows" style="font-size: 1.5rem; font-weight: 900; color: #15803d; margin-top: 0.2rem;">0</div>
                </div>
                <div style="flex: 1; min-width: 140px; background: #fef2f2; border: 1.5px solid #fca5a5; border-radius: 8px; padding: 0.75rem 1rem;">
                  <div style="font-size: 0.75rem; font-weight: 800; color: #dc2626; text-transform: uppercase;">⚠️ Invalid Rows</div>
                  <div id="count-invalid-rows" style="font-size: 1.5rem; font-weight: 900; color: #b91c1c; margin-top: 0.2rem;">0</div>
                </div>
                <div style="flex: 1; min-width: 140px; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 8px; padding: 0.75rem 1rem;">
                  <div style="font-size: 0.75rem; font-weight: 800; color: #d97706; text-transform: uppercase;">🔁 Duplicates</div>
                  <div id="count-duplicate-rows" style="font-size: 1.5rem; font-weight: 900; color: #b45309; margin-top: 0.2rem;">0</div>
                </div>
              </div>

              <!-- Preview Table Container -->
              <div id="upload-preview-container" style="display: none; border: 1px solid var(--border-subtle); border-radius: 8px; overflow: hidden;">
                <div style="padding: 0.6rem 0.85rem; background: #f8fafc; border-bottom: 1px solid var(--border-subtle); font-size: 0.8rem; font-weight: 700; color: #475569;">
                  Validation Preview (Only valid rows will be imported)
                </div>
                <div style="max-height: 260px; overflow-y: auto;" id="upload-preview-table-body">
                  <!-- Injected dynamically -->
                </div>
              </div>

              <!-- Progress Bar -->
              <div id="upload-progress-container" style="display: none;">
                <div style="display: flex; justify-content: space-between; font-size: 0.8rem; font-weight: 700; margin-bottom: 0.35rem;">
                  <span id="upload-progress-text">Saving participants to Firestore...</span>
                  <span id="upload-progress-pct">0%</span>
                </div>
                <div style="width: 100%; height: 8px; background: #e2e8f0; border-radius: 4px; overflow: hidden;">
                  <div id="upload-progress-bar" style="width: 0%; height: 100%; background: #10b981; transition: width 0.2s;"></div>
                </div>
              </div>
            </div>

            <div style="padding: 1rem 1.5rem; border-top: 1px solid var(--border-subtle); display: flex; justify-content: flex-end; gap: 0.75rem; background: #f8fafc;">
              <button id="btn-cancel-upload" class="btn btn-secondary btn-sm" style="font-weight: 700;">Cancel</button>
              <button id="btn-confirm-upload" class="btn btn-primary btn-sm" style="font-weight: 800;" disabled>Confirm & Save Participants</button>
            </div>
          </div>
        </div>

      </div>
    `;

    // =========================================================================
    // EVENT LISTENERS & ACTIONS
    // =========================================================================

    // Tab Navigation
    container.querySelectorAll('.cat-tab, .org-tab, .org-nav-tab').forEach(tab => {
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
      allowedParticipantsList = await getAllowedParticipants(selectedEventId);
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

    // -------------------------------------------------------------------------
    // ALLOWED PARTICIPANTS (CLOSED EVENT) EVENT LISTENERS
    // -------------------------------------------------------------------------
    
    // Toggle Event Visibility between Open and Closed
    const toggleEventVisibilityHandler = async () => {
      if (!selectedEvent) return;
      const newVis = selectedEvent.visibility === 'closed' ? 'open' : 'closed';
      const confirmMsg = newVis === 'closed'
        ? `Switch "${selectedEvent.title}" to CLOSED mode?\n\nOnly students on the Allowed Participants roster will be able to view and register for this event.`
        : `Switch "${selectedEvent.title}" to OPEN mode?\n\nAll eligible campus students will be able to browse and register.`;
      
      if (!confirm(confirmMsg)) return;

      const res = await updateEventVisibility(selectedEvent.id, newVis);
      if (res.success) {
        selectedEvent.visibility = newVis;
        render();
        alert(`✅ Event visibility changed to ${newVis.toUpperCase()}!`);
      }
    };
    container.querySelector('#btn-toggle-event-visibility')?.addEventListener('click', toggleEventVisibilityHandler);
    container.querySelector('#btn-toggle-vis-in-tab')?.addEventListener('click', toggleEventVisibilityHandler);

    // Participant Search Filter (with focus preservation)
    const pSearchInput = container.querySelector('#input-search-participants');
    if (pSearchInput) {
      pSearchInput.addEventListener('input', (e) => {
        participantSearchFilter = e.target.value;
        render();
        const refInput = container.querySelector('#input-search-participants');
        if (refInput) {
          refInput.focus();
          refInput.setSelectionRange(refInput.value.length, refInput.value.length);
        }
      });
    }

    // Open Manual Add Modal
    const openManualAdd = () => {
      const modal = container.querySelector('#modal-manual-add-participant');
      if (modal) {
        modal.style.display = 'flex';
        container.querySelector('#input-manual-p-name')?.focus();
      }
    };
    container.querySelector('#btn-open-manual-add')?.addEventListener('click', openManualAdd);
    container.querySelector('#btn-open-manual-add-empty')?.addEventListener('click', openManualAdd);

    // Close Manual Add Modal
    const closeManualAdd = () => {
      const modal = container.querySelector('#modal-manual-add-participant');
      if (modal) modal.style.display = 'none';
      container.querySelector('#form-manual-add-participant')?.reset();
    };
    container.querySelector('#btn-close-manual-add')?.addEventListener('click', closeManualAdd);
    container.querySelector('#btn-cancel-manual-add')?.addEventListener('click', closeManualAdd);

    // Submit Manual Add Form
    container.querySelector('#form-manual-add-participant')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedEventId) {
        alert('Please select an event first.');
        return;
      }

      const name = container.querySelector('#input-manual-p-name')?.value.trim();
      const email = container.querySelector('#input-manual-p-email')?.value.trim();
      const prn = container.querySelector('#input-manual-p-prn')?.value.trim();

      if (!name || !email || !prn) {
        alert('Name, email, and PRN are required.');
        return;
      }

      try {
        const res = await addAllowedParticipant(selectedEventId, { name, email, prn }, user);
        if (res.success) {
          closeManualAdd();
          allowedParticipantsList = await getAllowedParticipants(selectedEventId);
          render();
          alert(`✅ Added ${name} (${email}) to allowed participants!`);
        }
      } catch (err) {
        alert(`Error adding participant: ${err.message}`);
      }
    });

    // Remove Single Participant
    container.querySelectorAll('.btn-remove-participant').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const email = e.currentTarget.getAttribute('data-email');
        const name = e.currentTarget.getAttribute('data-name');
        if (!confirm(`Remove ${name || email} from the allowed participant roster?`)) return;

        try {
          await removeAllowedParticipant(selectedEventId, email);
          allowedParticipantsList = await getAllowedParticipants(selectedEventId);
          render();
        } catch (err) {
          alert(`Error removing participant: ${err.message}`);
        }
      });
    });

    // Clear Roster
    container.querySelector('#btn-clear-roster')?.addEventListener('click', async () => {
      if (!confirm(`Are you sure you want to remove all ${allowedParticipantsList.length} participants from this event roster? This cannot be undone.`)) return;

      try {
        await clearAllowedParticipants(selectedEventId);
        allowedParticipantsList = [];
        render();
        alert('Cleared allowed participants roster.');
      } catch (err) {
        alert(`Error clearing roster: ${err.message}`);
      }
    });

    // Download Sample Templates
    container.querySelector('#btn-download-template-xlsx')?.addEventListener('click', () => {
      downloadSampleTemplate('xlsx');
    });
    container.querySelector('#btn-download-template-csv')?.addEventListener('click', () => {
      downloadSampleTemplate('csv');
    });

    // Export Roster CSV
    container.querySelector('#btn-export-roster-csv')?.addEventListener('click', () => {
      exportParticipantsCsv(allowedParticipantsList, selectedEvent?.title || 'event');
    });

    // Excel / CSV Upload Modal Logic
    let pendingValidBatch = [];
    const uploadModal = container.querySelector('#modal-upload-participants');
    const dropzone = container.querySelector('#dropzone-participants');
    const fileInput = container.querySelector('#input-participants-file');
    const confirmUploadBtn = container.querySelector('#btn-confirm-upload');
    const summaryBox = container.querySelector('#upload-validation-summary');
    const previewContainer = container.querySelector('#upload-preview-container');
    const previewBody = container.querySelector('#upload-preview-table-body');
    const progressContainer = container.querySelector('#upload-progress-container');
    const progressBar = container.querySelector('#upload-progress-bar');
    const progressText = container.querySelector('#upload-progress-text');
    const progressPct = container.querySelector('#upload-progress-pct');

    const openUploadModal = () => {
      if (uploadModal) {
        pendingValidBatch = [];
        if (fileInput) fileInput.value = '';
        if (summaryBox) summaryBox.style.display = 'none';
        if (previewContainer) previewContainer.style.display = 'none';
        if (progressContainer) progressContainer.style.display = 'none';
        if (confirmUploadBtn) {
          confirmUploadBtn.disabled = true;
          confirmUploadBtn.textContent = 'Confirm & Save Participants';
        }
        uploadModal.style.display = 'flex';
      }
    };
    container.querySelector('#btn-open-upload-modal')?.addEventListener('click', openUploadModal);
    container.querySelector('#btn-open-upload-modal-empty')?.addEventListener('click', openUploadModal);

    const closeUploadModal = () => {
      if (uploadModal) uploadModal.style.display = 'none';
      pendingValidBatch = [];
      if (fileInput) fileInput.value = '';
    };
    container.querySelector('#btn-close-upload-modal')?.addEventListener('click', closeUploadModal);
    container.querySelector('#btn-cancel-upload')?.addEventListener('click', closeUploadModal);

    // Dropzone Click & Drag/Drop
    if (dropzone) {
      dropzone.addEventListener('click', () => fileInput?.click());
      dropzone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#0284c7';
        dropzone.style.background = '#f0f9ff';
      });
      dropzone.addEventListener('dragleave', () => {
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '#f8fafc';
      });
      dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropzone.style.borderColor = '#cbd5e1';
        dropzone.style.background = '#f8fafc';
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
          handleParticipantsFile(files[0]);
        }
      });
    }

    if (fileInput) {
      fileInput.addEventListener('change', (e) => {
        if (e.target.files && e.target.files.length > 0) {
          handleParticipantsFile(e.target.files[0]);
        }
      });
    }

    async function handleParticipantsFile(file) {
      if (!file) return;
      try {
        if (dropzone) {
          dropzone.innerHTML = `
            <div style="font-size: 1.75rem; margin-bottom: 0.35rem;">📄</div>
            <div style="font-weight: 800; font-size: 0.95rem; color: #1e293b;">${file.name}</div>
            <div style="font-size: 0.8rem; color: #0284c7; margin-top: 0.25rem;">Parsing spreadsheet with SheetJS...</div>
          `;
        }

        const parsed = await parseParticipantsFile(file, allowedParticipantsList);
        pendingValidBatch = parsed.valid;

        // Update counts
        container.querySelector('#count-valid-rows').textContent = parsed.valid.length;
        container.querySelector('#count-invalid-rows').textContent = parsed.invalid.length;
        container.querySelector('#count-duplicate-rows').textContent = parsed.duplicates.length;
        if (summaryBox) summaryBox.style.display = 'flex';

        // Render preview table
        const allDisplayRows = [
          ...parsed.valid.map(r => ({ ...r, statusType: 'valid' })),
          ...parsed.invalid.map(r => ({ ...r, statusType: 'invalid' })),
          ...parsed.duplicates.map(r => ({ ...r, statusType: 'duplicate' }))
        ].sort((a, b) => a.rowNumber - b.rowNumber);

        if (previewBody) {
          previewBody.innerHTML = `
            <table style="width: 100%; border-collapse: collapse; font-size: 0.825rem; text-align: left;">
              <thead>
                <tr style="background: #f1f5f9; border-bottom: 1.5px solid var(--border-subtle);">
                  <th style="padding: 0.55rem 0.75rem;">Row</th>
                  <th style="padding: 0.55rem 0.75rem;">Name</th>
                  <th style="padding: 0.55rem 0.75rem;">Email</th>
                  <th style="padding: 0.55rem 0.75rem;">PRN</th>
                  <th style="padding: 0.55rem 0.75rem;">Status / Reason</th>
                </tr>
              </thead>
              <tbody>
                ${allDisplayRows.slice(0, 150).map(r => `
                  <tr style="border-bottom: 1px solid var(--border-subtle); background: ${r.statusType === 'valid' ? '#ffffff' : (r.statusType === 'invalid' ? '#fef2f2' : '#fffbeb')};">
                    <td style="padding: 0.55rem 0.75rem; color: var(--text-tertiary);">${r.rowNumber}</td>
                    <td style="padding: 0.55rem 0.75rem; font-weight: 700;">${r.name || '—'}</td>
                    <td style="padding: 0.55rem 0.75rem; font-family: monospace;">${r.email || '—'}</td>
                    <td style="padding: 0.55rem 0.75rem;">${r.prn || '—'}</td>
                    <td style="padding: 0.55rem 0.75rem;">
                      ${r.statusType === 'valid' ? `
                        <span style="color: #16a34a; font-weight: 800;">✓ Ready to Save</span>
                      ` : r.statusType === 'invalid' ? `
                        <span style="color: #dc2626; font-weight: 700; font-size: 0.75rem;">✕ ${r.errors}</span>
                      ` : `
                        <span style="color: #d97706; font-weight: 700; font-size: 0.75rem;">⚠ ${r.reason}</span>
                      `}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            ${allDisplayRows.length > 150 ? `
              <div style="padding: 0.5rem; text-align: center; font-size: 0.75rem; color: var(--text-secondary); background: #f8fafc;">
                Showing first 150 of ${allDisplayRows.length} rows...
              </div>
            ` : ''}
          `;
        }

        if (previewContainer) previewContainer.style.display = 'block';

        if (confirmUploadBtn) {
          confirmUploadBtn.disabled = pendingValidBatch.length === 0;
          confirmUploadBtn.textContent = `Confirm & Save (${pendingValidBatch.length}) Valid Participants`;
        }
      } catch (err) {
        alert(`Failed to parse file: ${err.message}`);
      }
    }

    // Confirm & Save Batch Upload
    confirmUploadBtn?.addEventListener('click', async () => {
      if (!selectedEventId || pendingValidBatch.length === 0) return;

      confirmUploadBtn.disabled = true;
      confirmUploadBtn.textContent = 'Saving...';
      if (progressContainer) progressContainer.style.display = 'block';

      try {
        const res = await batchAddAllowedParticipants(
          selectedEventId,
          pendingValidBatch,
          user,
          (saved, total) => {
            const pct = Math.round((saved / total) * 100);
            if (progressBar) progressBar.style.width = `${pct}%`;
            if (progressPct) progressPct.textContent = `${pct}%`;
            if (progressText) progressText.textContent = `Saved ${saved} of ${total} participants...`;
          }
        );

        if (res.success) {
          allowedParticipantsList = await getAllowedParticipants(selectedEventId);
          closeUploadModal();
          alert(`🎉 Successfully saved ${res.count} participants to the allowed roster!`);

          // If event was open, offer prompt to switch to closed mode
          if (selectedEvent && selectedEvent.visibility !== 'closed') {
            if (confirm(`Do you want to switch "${selectedEvent.title}" to CLOSED (Invite-Only) mode now?`)) {
              await updateEventVisibility(selectedEvent.id, 'closed');
              selectedEvent.visibility = 'closed';
            }
          }
          render();
        }
      } catch (err) {
        alert(`Error saving participants: ${err.message}`);
        confirmUploadBtn.disabled = false;
        confirmUploadBtn.textContent = `Confirm & Save (${pendingValidBatch.length}) Valid Participants`;
      }
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
          const defaultFetched = events.find(e => e.status === 'approved') || events[0];
          selectedEventId = defaultFetched.id;
        }
      }
      if (selectedEventId) {
        const [regs, vols, comps, allowed] = await Promise.all([
          getEventRegistrations(selectedEventId),
          getEventVolunteers(selectedEventId),
          getComplaints(selectedEventId),
          getAllowedParticipants(selectedEventId)
        ]);
        registrations = regs || [];
        volunteers = vols || [];
        complaints = comps || [];
        allowedParticipantsList = allowed || [];
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
          <label style="font-weight: 700; margin-bottom: 0.35rem; display: block;">Event Visibility & Access *</label>
          <div style="display: flex; gap: 1.5rem; align-items: center; background: #f8fafc; border: 1.5px solid var(--border-subtle); padding: 0.85rem 1rem; border-radius: var(--radius-sm); flex-wrap: wrap;">
            <label style="display: flex; align-items: center; gap: 0.45rem; cursor: pointer; font-weight: 700; font-size: 0.875rem; color: #16a34a;">
              <input type="radio" name="ev-visibility" value="open" checked />
              🌐 Open (All eligible students can browse & register)
            </label>
            <label style="display: flex; align-items: center; gap: 0.45rem; cursor: pointer; font-weight: 700; font-size: 0.875rem; color: #7c3aed;">
              <input type="radio" name="ev-visibility" value="closed" />
              🔒 Closed (Restricted to an approved participant list)
            </label>
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
    const visibility = overlay.querySelector('input[name="ev-visibility"]:checked')?.value || 'open';

    const eventPayload = {
      title: overlay.querySelector('#ev-title').value.trim(),
      description: overlay.querySelector('#ev-desc').value.trim(),
      category: overlay.querySelector('#ev-cat').value,
      department: overlay.querySelector('#ev-dept').value,
      visibility,
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
    alert(`🎉 Event submitted! Status: pending_approval (${visibility.toUpperCase()}).`);
    close();
    if (onSuccess) onSuccess();
  });
}
