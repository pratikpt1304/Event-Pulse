import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getAllEvents, getCompletedEvents, getPendingEvents, getApprovedEvents, updateEventStatus, createEvent, reopenEvent, deleteEvent, getCachedEventsSync } from '../services/events';
import { getEventRegistrations, getStudentRegistrations } from '../services/registrations';
import { getAnnouncements, createAnnouncement, deleteAnnouncement, getCachedAnnouncementsSync, uploadNoticeAttachment, fetchNoticeAttachmentData, getFileFromIndexedDB } from '../services/announcements';
import { getAllUsers, updateUserRole, updateUserProfileData, toggleUserBan, getCachedUsersSync, deleteDirectoryUser } from '../services/users';
import { getAllComplaints, updateComplaintStatus, deleteComplaint, getCachedComplaintsSync } from '../services/complaints';
import { getCampusIdeas, getCachedIdeasSync, deleteIdea } from '../services/ideas';
import { generateEventDescriptionAI } from '../services/ai';
import { openCompletedEventModal } from '../components/CompletedEventModal';
import { openDocumentPreviewModal } from '../components/DocumentPreviewModal';

/**
 * Converts plain URLs in text into clickable <a> links (XSS-safe)
 */
function linkifyText(text) {
  if (!text) return '';
  const escaped = String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #7c3aed; text-decoration: underline; font-weight: 600; word-break: break-all;">$1</a>'
  );
}

export async function renderAdminView(container, navigateTo) {
  const user = getCurrentUser();
  const isAdmin = isUserAdmin(user);
  if (!isAdmin) {
    navigateTo('login');
    return;
  }

  // Safe Instant In-Memory Cache Init (Never hangs or shows blank white screen)
  const cachedAllEvents = getCachedEventsSync() || [];
  let pendingEvents = cachedAllEvents.filter(e => e.status === 'pending_approval' || e.status === 'pending');
  let approvedEvents = cachedAllEvents.filter(e => e.status === 'approved');
  let completedEvents = cachedAllEvents.filter(e => e.status === 'completed');
  let announcements = getCachedAnnouncementsSync() || [];
  let usersList = getCachedUsersSync() || [];
  let complaints = getCachedComplaintsSync() || [];
  let ideas = getCachedIdeasSync() || [];

  const hash = (window.location.hash || '').toLowerCase();
  let activeTab = 'queue'; // 'queue' | 'notices' | 'create_event' | 'users' | 'grievances' | 'wishlist' | 'archives'
  if (hash.includes('grievance') || hash.includes('support') || hash.includes('helpdesk') || hash.includes('ticket')) {
    activeTab = 'grievances';
  } else if (hash.includes('wishlist') || hash.includes('idea')) {
    activeTab = 'wishlist';
  } else if (hash.includes('user') || hash.includes('directory')) {
    activeTab = 'users';
  } else if (hash.includes('notice') || hash.includes('announcement')) {
    activeTab = 'notices';
  } else if (hash.includes('archive')) {
    activeTab = 'archives';
  }
  let userSearchQuery = '';
  let userDeptFilter = 'all';
  let userYearFilter = 'all';
  let userRoleFilter = 'all';
  let userSortBy = 'prn_asc';

  let noticeSearchQuery = '';
  let noticePriorityFilter = 'all';
  let noticeDeptFilter = 'all';

  let complaintSearchQuery = '';
  let complaintStatusFilter = 'all'; // 'all' | 'pending' | 'resolved'
  let complaintCategoryFilter = 'all';

  let wishlistTypeFilter = 'all'; // 'all' | 'new_event' | 'improvement'
  let wishlistSearchQuery = '';

  const render = () => {
    const adminCount = usersList.filter(u => u.role === 'admin' || isUserAdmin(u)).length;
    const orgCount = usersList.filter(u => u.role === 'organizer' && !isUserAdmin(u)).length;
    const studentCount = usersList.filter(u => !isUserAdmin(u) && u.role !== 'organizer').length;

    container.innerHTML = `
      <div style="max-width: 1100px; margin: 0 auto; padding-bottom: 3rem;">
        
        <!-- Admin Command Center Header -->
        <div style="background: linear-gradient(135deg, #0f172a, #1e293b, #334155); border-radius: var(--radius-lg); padding: 2.25rem 2rem; color: #ffffff; margin-bottom: 1.75rem; position: relative; overflow: hidden; box-shadow: 0 16px 40px -10px rgba(15, 23, 42, 0.45);">
          <div style="position: absolute; top: -30px; right: -30px; width: 150px; height: 150px; background: rgba(59, 130, 246, 0.2); border-radius: 50%; filter: blur(40px);"></div>
          
          <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
            <div>
              <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.2); padding: 0.2rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; letter-spacing: 0.05em; text-transform: uppercase;">
                🛡️ University Administration & Governance
              </div>
              <h1 style="font-size: 2.1rem; font-weight: 900; margin-top: 0.5rem; margin-bottom: 0.4rem; color: #ffffff; line-height: 1.2;">
                Admin Command Center
              </h1>
              <p style="font-size: 0.95rem; color: #94a3b8; line-height: 1.5; margin: 0;">
                Logged in as <strong>${user?.name || 'Administrator'}</strong> (${user?.department || 'Central Administration'} • Administrator)
              </p>
            </div>

            <div style="display: flex; gap: 0.6rem; align-items: center; flex-wrap: wrap;">
              <button class="btn btn-secondary btn-sm" id="btn-admin-sync-all" style="font-weight: 800; background: rgba(255,255,255,0.15); color: #ffffff; border: 1px solid rgba(255,255,255,0.25); display: inline-flex; align-items: center; gap: 0.35rem;">
                🔄 Live Sync
              </button>
              <button class="btn btn-primary" id="btn-quick-create-event" style="font-weight: 800; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4);">
                ➕ Direct Publish Event
              </button>
            </div>
          </div>
        </div>

        <!-- Quick Summary Stat Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 0.85rem; margin-bottom: 1.75rem;">
          <div class="card" style="padding: 1rem; border-left: 4px solid #f59e0b; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Pending Queue</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #f59e0b; margin-top: 0.2rem;">${pendingEvents.length}</div>
          </div>
          <div class="card" style="padding: 1rem; border-left: 4px solid #10b981; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Active Events</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">${approvedEvents.length}</div>
          </div>
          <div class="card" style="padding: 1rem; border-left: 4px solid #334155; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Archived History</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #334155; margin-top: 0.2rem;">${completedEvents.length}</div>
          </div>
          <div class="card" style="padding: 1rem; border-left: 4px solid #3b82f6; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Campus Accounts</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #3b82f6; margin-top: 0.15rem; line-height: 1;">${usersList.length}</div>
            <div style="font-size: 0.7rem; font-weight: 700; color: var(--text-secondary); margin-top: 0.35rem; display: flex; gap: 0.35rem; flex-wrap: wrap;">
              <span style="color: #2563eb;">🎓 ${studentCount}</span> &bull;
              <span style="color: #dc2626;">👑 ${adminCount}</span> &bull;
              <span style="color: #7c3aed;">⚡ ${orgCount}</span>
            </div>
          </div>
          <div class="card" style="padding: 1rem; border-left: 4px solid #ef4444; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Grievances</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #ef4444; margin-top: 0.2rem;">${complaints.filter(c => c.status !== 'resolved').length}</div>
          </div>
          <div class="card" style="padding: 1rem; border-left: 4px solid #8b5cf6; background: #ffffff;">
            <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase;">Wishlist Ideas</div>
            <div style="font-size: 1.55rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">${ideas.length}</div>
          </div>
        </div>

        <!-- Admin Navigation Tab Pills -->
        <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); white-space: nowrap;">
          <button class="cat-tab ${activeTab === 'queue' ? 'active' : ''}" data-tab="queue">⏳ Event Queue (${pendingEvents.length})</button>
          <button class="cat-tab ${activeTab === 'archives' ? 'active' : ''}" data-tab="archives">📚 Event Archives (${completedEvents.length})</button>
          <button class="cat-tab ${activeTab === 'notices' ? 'active' : ''}" data-tab="notices">📢 Campus Notices (${announcements.length})</button>
          <button class="cat-tab ${activeTab === 'create_event' ? 'active' : ''}" data-tab="create_event">➕ Direct Publish Event</button>
          <button class="cat-tab ${activeTab === 'users' ? 'active' : ''}" data-tab="users">👥 Student Directory (${usersList.length})</button>
          <button class="cat-tab ${activeTab === 'grievances' ? 'active' : ''}" data-tab="grievances">🚨 Grievance Center (${complaints.length})</button>
          <button class="cat-tab ${activeTab === 'wishlist' ? 'active' : ''}" data-tab="wishlist">💡 Wishlist Approvals (${ideas.length})</button>
        </div>

        <!-- ========================================== -->
        <!-- TAB 1: PENDING APPROVAL & ACTIVE EVENTS   -->
        <!-- ========================================== -->
        ${activeTab === 'queue' ? `
          <div>
            <!-- Pending Events -->
            <div class="card" style="margin-bottom: 2rem; border-color: rgba(245, 158, 11, 0.4); background: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                <h3 style="font-size: 1.2rem; color: #b45309; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
                  ⏳ Pending Events Requiring Administrative Review (${pendingEvents.length})
                </h3>
                <button id="btn-export-queue-csv" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; cursor: pointer; border-radius: var(--radius-sm); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">
                  📥 Export All Events CSV
                </button>
              </div>

              ${pendingEvents.length === 0 ? `
                <div style="text-align: center; padding: 2.5rem 1rem; color: var(--text-secondary);">
                  <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">✅</div>
                  <div style="font-weight: 700;">Queue is completely clear!</div>
                  <div style="font-size: 0.85rem; margin-top: 0.2rem;">All organizer-submitted events have been reviewed.</div>
                </div>
              ` : pendingEvents.map(e => `
                <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; padding: 1.25rem;">
                  <div style="flex: 1; min-width: 260px;">
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
                      <span class="badge badge-pending">Pending Review</span>
                      <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${e.category || 'General'}</span>
                      <span style="font-size: 0.75rem; color: var(--text-tertiary);">Dept: <strong>${e.department}</strong></span>
                    </div>
                    <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">${e.title}</h3>
                    <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.35rem 0; line-height: 1.4;">${e.description}</p>
                    <div style="font-size: 0.8rem; color: var(--text-tertiary); margin-top: 0.5rem;">
                      👤 Organizer: <strong>${e.organizerName || 'Faculty / Coordinator'}</strong> | 📍 Venue: <strong>${e.venue}</strong> | 📅 <strong>${e.date} (${e.time})</strong>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <button class="btn btn-primary btn-sm btn-admin-approve" data-event-id="${e.id}" style="font-weight: 700;">
                      ✓ Approve Event
                    </button>
                    <button class="btn btn-danger btn-sm btn-admin-reject" data-event-id="${e.id}" style="font-weight: 700;">
                      ✕ Reject
                    </button>
                    <button class="btn btn-sm btn-admin-delete-event" data-event-id="${e.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); cursor: pointer;" title="Permanently delete event">
                      🗑️ Delete
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Approved Events Master Table -->
            <div class="card" style="background: #ffffff;">
              <h3 style="font-size: 1.2rem; margin-bottom: 1rem; color: var(--text-primary);">
                Active Approved Campus Events (${approvedEvents.length})
              </h3>
              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-secondary); height: 42px;">
                      <th>Title</th>
                      <th>Category</th>
                      <th>Department</th>
                      <th>Date & Time</th>
                      <th>Venue</th>
                      <th>Status</th>
                      <th style="text-align: right;">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${approvedEvents.map(e => `
                      <tr style="border-bottom: 1px solid var(--border-subtle); height: 48px;">
                        <td style="font-weight: 700; color: var(--text-primary);">${e.title}</td>
                        <td><span style="font-size: 0.75rem; background: #ede9fe; color: #6d28d9; padding: 0.2rem 0.5rem; border-radius: var(--radius-full); font-weight: 600;">${e.category}</span></td>
                        <td>${e.department}</td>
                        <td>${e.date} (${e.time})</td>
                        <td>${e.venue}</td>
                        <td><span class="badge badge-approved">Approved</span></td>
                        <td style="text-align: right;">
                          <button class="btn btn-sm btn-admin-delete-event" data-event-id="${e.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.725rem; font-weight: 700; padding: 0.2rem 0.55rem; border-radius: var(--radius-sm); cursor: pointer;" title="Permanently delete event">
                            🗑️ Delete
                          </button>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- TAB 2: CAMPUS NOTICES & BROADCASTS        -->
        <!-- ========================================== -->
        ${activeTab === 'notices' ? (() => {
          const emergencyCount = announcements.filter(n => (n.priority || '').includes('Emergency')).length;
          const festCount = announcements.filter(n => (n.priority || '').includes('Fest')).length;
          const scheduleCount = announcements.filter(n => (n.priority || '').includes('Schedule')).length;
          const campusCount = announcements.filter(n => (n.priority || '').includes('Notice') || (!n.priority?.includes('Emergency') && !n.priority?.includes('Fest') && !n.priority?.includes('Schedule'))).length;

          const filteredAnnouncements = announcements.filter(n => {
            const q = noticeSearchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
              (n.title || '').toLowerCase().includes(q) ||
              (n.message || '').toLowerCase().includes(q) ||
              (n.postedBy || '').toLowerCase().includes(q);

            const prio = (n.priority || '').toLowerCase();
            const matchesPriority = noticePriorityFilter === 'all' ||
              (noticePriorityFilter === 'emergency' && prio.includes('emergency')) ||
              (noticePriorityFilter === 'fest' && prio.includes('fest')) ||
              (noticePriorityFilter === 'schedule' && prio.includes('schedule')) ||
              (noticePriorityFilter === 'notice' && prio.includes('notice'));

            const dept = (n.targetDept || '').toLowerCase();
            const matchesDept = noticeDeptFilter === 'all' ||
              dept.includes(noticeDeptFilter.toLowerCase()) ||
              dept.includes('all');

            return matchesSearch && matchesPriority && matchesDept;
          });

          return `
            <div class="card" style="background: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <h3 style="font-size: 1.25rem; margin-bottom: 0.2rem; font-weight: 800; color: var(--text-primary);">
                    Official Campus Announcements
                  </h3>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                    Showing <strong>${filteredAnnouncements.length}</strong> of <strong>${announcements.length}</strong> broadcast notices.
                  </p>

                  <!-- Live Interactive Priority Breakdown Badges -->
                  <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.65rem;">
                    <button class="btn-quick-notice-badge ${noticePriorityFilter === 'all' ? 'active' : ''}" data-prio="all" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${noticePriorityFilter === 'all' ? '#0f172a' : '#cbd5e1'}; background: ${noticePriorityFilter === 'all' ? '#0f172a' : '#ffffff'}; color: ${noticePriorityFilter === 'all' ? '#ffffff' : 'var(--text-secondary)'}; transition: all 0.15s;">
                      📢 All (${announcements.length})
                    </button>
                    <button class="btn-quick-notice-badge ${noticePriorityFilter === 'emergency' ? 'active' : ''}" data-prio="emergency" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${noticePriorityFilter === 'emergency' ? '#dc2626' : '#fecaca'}; background: ${noticePriorityFilter === 'emergency' ? '#dc2626' : '#fef2f2'}; color: ${noticePriorityFilter === 'emergency' ? '#ffffff' : '#b91c1c'}; transition: all 0.15s;">
                      🚨 Emergency Alerts (${emergencyCount})
                    </button>
                    <button class="btn-quick-notice-badge ${noticePriorityFilter === 'fest' ? 'active' : ''}" data-prio="fest" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${noticePriorityFilter === 'fest' ? '#d97706' : '#fde68a'}; background: ${noticePriorityFilter === 'fest' ? '#d97706' : '#fffbeb'}; color: ${noticePriorityFilter === 'fest' ? '#ffffff' : '#b45309'}; transition: all 0.15s;">
                      🏆 Fest Alerts (${festCount})
                    </button>
                    <button class="btn-quick-notice-badge ${noticePriorityFilter === 'schedule' ? 'active' : ''}" data-prio="schedule" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${noticePriorityFilter === 'schedule' ? '#0284c7' : '#bae6fd'}; background: ${noticePriorityFilter === 'schedule' ? '#0284c7' : '#f0f9ff'}; color: ${noticePriorityFilter === 'schedule' ? '#ffffff' : '#0369a1'}; transition: all 0.15s;">
                      ⚠️ Schedule Changes (${scheduleCount})
                    </button>
                    <button class="btn-quick-notice-badge ${noticePriorityFilter === 'notice' ? 'active' : ''}" data-prio="notice" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${noticePriorityFilter === 'notice' ? '#7c3aed' : '#e9d5ff'}; background: ${noticePriorityFilter === 'notice' ? '#7c3aed' : '#faf5ff'}; color: ${noticePriorityFilter === 'notice' ? '#ffffff' : '#6d28d9'}; transition: all 0.15s;">
                      📢 Campus Notices (${campusCount})
                    </button>
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <!-- Export Notices Dropdown Hub -->
                  <div style="position: relative;" id="export-notices-dropdown-wrapper">
                    <button id="btn-toggle-export-notices" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; cursor: pointer; border-radius: var(--radius-sm); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">
                      📥 Export CSV ▾
                    </button>
                    <div id="menu-export-notices" style="display: none; position: absolute; left: 0; top: calc(100% + 6px); background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 12px 30px -5px rgba(15,23,42,0.25); z-index: 1000; min-width: 270px; padding: 0.4rem 0;">
                      <div style="padding: 0.4rem 0.85rem; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                        Select Notice Export Scope
                      </div>
                      <button class="btn-do-export-notice-csv" data-export-type="filtered" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        🎯 Current Filtered Notices (${filteredAnnouncements.length})
                      </button>
                      <div style="height: 1px; background: #e2e8f0; margin: 0.25rem 0;"></div>
                      <button class="btn-do-export-notice-csv" data-export-type="all" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        📢 Master All Notices (${announcements.length})
                      </button>
                      <button class="btn-do-export-notice-csv" data-export-type="emergency" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #dc2626; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        🚨 Emergency Alerts Only (${emergencyCount})
                      </button>
                      <button class="btn-do-export-notice-csv" data-export-type="fest" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #d97706; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        🏆 Fest Alerts Only (${festCount})
                      </button>
                      <button class="btn-do-export-notice-csv" data-export-type="schedule" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0284c7; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        ⚠️ Schedule Changes Only (${scheduleCount})
                      </button>
                      <button class="btn-do-export-notice-csv" data-export-type="notice" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #7c3aed; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        📢 Campus Notices Only (${campusCount})
                      </button>
                    </div>
                  </div>
                  <button id="btn-trigger-notice-modal" class="btn btn-primary btn-sm" style="font-weight: 700;">
                    ➕ Create Announcement
                  </button>
                </div>
              </div>

              <!-- Filter & Search Toolbar for Notices -->
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1.25rem;">
                <input type="text" id="input-search-notices" class="form-control form-control-sm" placeholder="🔍 Search notices by title, message..." value="${noticeSearchQuery}" style="width: 220px;" />

                <select id="select-filter-notice-prio" class="form-control form-control-sm" style="width: 165px; font-size: 0.8rem; cursor: pointer;">
                  <option value="all" ${noticePriorityFilter === 'all' ? 'selected' : ''}>🏷️ All Notice Badges</option>
                  <option value="emergency" ${noticePriorityFilter === 'emergency' ? 'selected' : ''}>🚨 Emergency Alert</option>
                  <option value="fest" ${noticePriorityFilter === 'fest' ? 'selected' : ''}>🏆 Fest Alert</option>
                  <option value="schedule" ${noticePriorityFilter === 'schedule' ? 'selected' : ''}>⚠️ Schedule Change</option>
                  <option value="notice" ${noticePriorityFilter === 'notice' ? 'selected' : ''}>📢 Campus Notice</option>
                </select>

                <select id="select-filter-notice-dept" class="form-control form-control-sm" style="width: 155px; font-size: 0.8rem; cursor: pointer;">
                  <option value="all" ${noticeDeptFilter === 'all' ? 'selected' : ''}>🏢 All Target Depts</option>
                  <option value="Computer Science" ${noticeDeptFilter === 'Computer Science' ? 'selected' : ''}>CSE / Computer</option>
                  <option value="Information Technology" ${noticeDeptFilter === 'Information Technology' ? 'selected' : ''}>Information Tech</option>
                  <option value="AIML" ${noticeDeptFilter === 'AIML' ? 'selected' : ''}>AIML</option>
                  <option value="AIDS" ${noticeDeptFilter === 'AIDS' ? 'selected' : ''}>AIDS</option>
                  <option value="IMtech" ${noticeDeptFilter === 'IMtech' ? 'selected' : ''}>IMtech</option>
                  <option value="Robotics" ${noticeDeptFilter === 'Robotics' ? 'selected' : ''}>Robotics</option>
                  <option value="Mechanical" ${noticeDeptFilter === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                  <option value="Civil" ${noticeDeptFilter === 'Civil' ? 'selected' : ''}>Civil</option>
                </select>
              </div>

              ${filteredAnnouncements.length === 0 ? `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                  <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">📢</div>
                  <div style="font-weight: 700;">No matching campus notices found</div>
                  <div style="font-size: 0.85rem; margin-top: 0.2rem;">Try changing your search term or filter badges.</div>
                </div>
              ` : filteredAnnouncements.map(n => `
                <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; padding: 1.25rem;">
                  <div style="flex: 1; min-width: 250px;">
                    <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem;">
                      <span style="font-size: 0.75rem; font-weight: 800; background: ${n.priority.includes('Emergency') ? '#fef2f2' : n.priority.includes('Fest') ? '#fffbeb' : n.priority.includes('Schedule') ? '#f0f9ff' : '#eff6ff'}; color: ${n.priority.includes('Emergency') ? '#dc2626' : n.priority.includes('Fest') ? '#b45309' : n.priority.includes('Schedule') ? '#0369a1' : '#2563eb'}; padding: 0.2rem 0.6rem; border-radius: var(--radius-full); border: 1px solid ${n.priority.includes('Emergency') ? '#fca5a5' : n.priority.includes('Fest') ? '#fde68a' : n.priority.includes('Schedule') ? '#bae6fd' : '#bfdbfe'};">
                        ${n.priority}
                      </span>
                      <span style="font-size: 0.75rem; color: var(--text-tertiary);">${new Date(n.createdAt).toLocaleString()}</span>
                    </div>
                    <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">${n.title}</h3>
                    <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.4rem; white-space: pre-line;">${linkifyText(n.message)}</p>
                    
                    ${n.attachment ? `
                      <div style="margin: 0.5rem 0 0.6rem 0; padding: 0.5rem 0.75rem; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.6rem;">
                        <span style="font-size: 1.1rem;">${(n.attachment.type && n.attachment.type.includes('pdf')) ? '📄' : '📎'}</span>
                        <span style="font-size: 0.8rem; font-weight: 700; color: #0f172a;">${n.attachment.name || 'Notice Attachment'}</span>
                        <button class="btn-admin-preview-notice" data-notice-id="${n.id}" data-name="${n.attachment.name || 'Notice_Attachment'}" style="font-size: 0.75rem; font-weight: 800; color: #7c3aed; background: #f3e8ff; border: 1px solid #d8b4fe; padding: 0.25rem 0.65rem; border-radius: 6px; cursor: pointer;">
                          👁️ Preview Document
                        </button>
                      </div>
                    ` : ''}

                    <div style="font-size: 0.775rem; color: var(--text-tertiary);">
                      Target: <strong>${n.targetDept}</strong> | Broadcasted by <strong>${n.postedBy}</strong>
                    </div>
                  </div>
                  <div>
                    <button class="btn btn-danger btn-sm btn-delete-notice" data-notice-id="${n.id}" style="font-size: 0.75rem; padding: 0.3rem 0.65rem;">
                      🗑️ Remove
                    </button>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        })() : ''}

        <!-- ========================================== -->
        <!-- TAB 3: DIRECT EVENT PUBLISHER (ADMIN)     -->
        <!-- ========================================== -->
        ${activeTab === 'create_event' ? `
          <div class="card" style="background: #ffffff; max-width: 760px; margin: 0 auto;">
            <div style="margin-bottom: 1.5rem;">
              <span style="font-size: 0.75rem; font-weight: 800; color: #16a34a; background: #dcfce7; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">⚡ Direct Fast-Track Publishing</span>
              <h2 style="font-size: 1.5rem; margin-top: 0.4rem; color: var(--text-primary);">Publish University Event Directly</h2>
              <p style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Events created by administrators bypass the pending review queue and go live across campus immediately.
              </p>
            </div>

            <form id="form-admin-create-event">
              <div style="display: flex; flex-direction: column; gap: 1rem;">
                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Event Title *</label>
                  <input type="text" id="admin-event-title" class="form-control" placeholder="e.g. Sanjivani TechFest 2026: National Hackathon" required />
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Category *</label>
                    <select id="admin-event-cat" class="form-control" required>
                      <option value="technical">💻 Technical / Hackathon</option>
                      <option value="cultural">🎨 Cultural / Fest</option>
                      <option value="sports">🏆 Sports Championship</option>
                      <option value="workshop">🔬 Workshop & Seminar</option>
                    </select>
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Host Department *</label>
                    <input type="text" id="admin-event-dept" class="form-control" value="University Central / All Departments" required />
                  </div>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Date *</label>
                    <input type="date" id="admin-event-date" class="form-control" required />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Time *</label>
                    <input type="text" id="admin-event-time" class="form-control" placeholder="e.g. 09:30 AM - 05:00 PM" required />
                  </div>
                </div>

                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Venue *</label>
                  <input type="text" id="admin-event-venue" class="form-control" placeholder="e.g. Main University Auditorium & Amphitheater" required />
                </div>

                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">External Link / Rulebook PDF / Unstop URL (Optional)</label>
                  <input type="url" id="admin-event-link" class="form-control" placeholder="e.g. https://unstop.com/... or Google Form / Drive Rulebook" />
                </div>

                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700; margin: 0;">Description & Rules *</label>
                    <button type="button" id="btn-admin-ai-draft" class="btn btn-sm" style="background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border: none; border-radius: var(--radius-full);">
                      ⚡ Auto-Draft with NEX AI
                    </button>
                  </div>
                  <textarea id="admin-event-desc" class="form-control" rows="4" placeholder="Enter comprehensive overview, schedule, rules, and prizes..." required></textarea>
                </div>

                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Max Participants Capacity</label>
                    <input type="number" id="admin-event-capacity" class="form-control" value="250" />
                  </div>
                  <div>
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Registration Fee</label>
                    <input type="text" id="admin-event-fee" class="form-control" value="₹0 (Free for SU Students)" />
                  </div>
                </div>

                <button type="submit" id="btn-submit-admin-event" class="btn btn-primary" style="margin-top: 0.5rem; justify-content: center; font-weight: 800; padding: 0.8rem;">
                  🚀 Publish Directly (Live on Portal)
                </button>
              </div>
            </form>
          </div>
        ` : ''}

        <!-- ========================================== -->
        <!-- TAB 4: STUDENT & ROLE DIRECTORY           -->
        <!-- ========================================== -->
        ${activeTab === 'users' ? (() => {
          const filteredUsers = usersList.filter(u => {
            const q = userSearchQuery.toLowerCase().trim();
            const matchesSearch = !q || 
              (u.name || '').toLowerCase().includes(q) || 
              (u.prn || '').toLowerCase().includes(q) || 
              (u.department || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q);

            const userDept = (u.department || '').toLowerCase();
            const matchesDept = userDeptFilter === 'all' || 
              (userDeptFilter === 'not_set' && (!u.department || u.department === 'Not Set')) ||
              userDept.includes(userDeptFilter.toLowerCase());

            const userYear = (u.year || '').toLowerCase();
            const matchesYear = userYearFilter === 'all' || 
              (userYearFilter === 'not_set' && (!u.year || u.year === 'Not Set')) ||
              userYear.includes(userYearFilter.toLowerCase());

            const userIsAdmin = u.role === 'admin' || isUserAdmin(u);
            const userIsOrg = u.role === 'organizer';
            const matchesRole = userRoleFilter === 'all' ||
              (userRoleFilter === 'admin' && userIsAdmin) ||
              (userRoleFilter === 'organizer' && userIsOrg && !userIsAdmin) ||
              (userRoleFilter === 'student' && !userIsAdmin && !userIsOrg);

            return matchesSearch && matchesDept && matchesYear && matchesRole;
          }).sort((a, b) => {
            const extractPrnLastDigits = (prn) => {
              if (!prn) return null;
              // Fix common typo: letter 'O' mistakenly used instead of digit '0'
              const str = String(prn).trim().replace(/O/g, '0').replace(/o/g, '0');
              const match = str.match(/(\d{1,6})$/);
              if (match) {
                const trailing = match[1].slice(-4);
                const num = parseInt(trailing, 10);
                if (!isNaN(num)) return num;
              }
              const digitsOnly = str.replace(/\D/g, '');
              if (digitsOnly.length >= 4) {
                const num = parseInt(digitsOnly.slice(-4), 10);
                if (!isNaN(num)) return num;
              } else if (digitsOnly.length > 0) {
                const num = parseInt(digitsOnly, 10);
                if (!isNaN(num)) return num;
              }
              return null;
            };

            if (userSortBy === 'prn_asc') {
              const aNum = extractPrnLastDigits(a.prn);
              const bNum = extractPrnLastDigits(b.prn);
              // null PRN → send to BOTTOM
              if (aNum === null && bNum === null) return (a.name || '').localeCompare(b.name || '');
              if (aNum === null) return 1;   // a goes to bottom
              if (bNum === null) return -1;  // b goes to bottom
              if (aNum !== bNum) return aNum - bNum;
              return (a.name || '').localeCompare(b.name || '');
            } else if (userSortBy === 'prn_desc') {
              const aNum = extractPrnLastDigits(a.prn);
              const bNum = extractPrnLastDigits(b.prn);
              // null PRN → send to BOTTOM
              if (aNum === null && bNum === null) return (b.name || '').localeCompare(a.name || '');
              if (aNum === null) return 1;   // a goes to bottom
              if (bNum === null) return -1;  // b goes to bottom
              if (aNum !== bNum) return bNum - aNum;
              return (b.name || '').localeCompare(a.name || '');
            } else if (userSortBy === 'name_asc') {
              return (a.name || '').localeCompare(b.name || '');
            } else if (userSortBy === 'name_desc') {
              return (b.name || '').localeCompare(a.name || '');
            } else if (userSortBy === 'dept_asc') {
              return (a.department || 'ZZZ').localeCompare(b.department || 'ZZZ');
            } else if (userSortBy === 'year_asc') {
              return (a.year || 'ZZZ').localeCompare(b.year || 'ZZZ');
            }
            return 0;
          });

          return `
            <div class="card" style="background: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <h3 style="font-size: 1.25rem; margin-bottom: 0.2rem; font-weight: 800; color: var(--text-primary);">
                    University Student & Faculty Directory
                  </h3>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                    Showing <strong>${filteredUsers.length}</strong> of <strong>${usersList.length}</strong> registered accounts.
                  </p>

                  <!-- Live Interactive Role Breakdown Count Badges -->
                  <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.65rem;">
                    <button class="btn-quick-role-badge ${userRoleFilter === 'all' ? 'active' : ''}" data-role="all" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${userRoleFilter === 'all' ? '#0f172a' : '#cbd5e1'}; background: ${userRoleFilter === 'all' ? '#0f172a' : '#ffffff'}; color: ${userRoleFilter === 'all' ? '#ffffff' : 'var(--text-secondary)'}; transition: all 0.15s;">
                      👥 All Accounts (${usersList.length})
                    </button>
                    <button class="btn-quick-role-badge ${userRoleFilter === 'student' ? 'active' : ''}" data-role="student" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${userRoleFilter === 'student' ? '#2563eb' : '#bfdbfe'}; background: ${userRoleFilter === 'student' ? '#2563eb' : '#eff6ff'}; color: ${userRoleFilter === 'student' ? '#ffffff' : '#1d4ed8'}; transition: all 0.15s;">
                      🎓 Students (${studentCount})
                    </button>
                    <button class="btn-quick-role-badge ${userRoleFilter === 'admin' ? 'active' : ''}" data-role="admin" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${userRoleFilter === 'admin' ? '#dc2626' : '#fecaca'}; background: ${userRoleFilter === 'admin' ? '#dc2626' : '#fef2f2'}; color: ${userRoleFilter === 'admin' ? '#ffffff' : '#b91c1c'}; transition: all 0.15s;">
                      👑 Admins (${adminCount})
                    </button>
                    <button class="btn-quick-role-badge ${userRoleFilter === 'organizer' ? 'active' : ''}" data-role="organizer" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${userRoleFilter === 'organizer' ? '#7c3aed' : '#e9d5ff'}; background: ${userRoleFilter === 'organizer' ? '#7c3aed' : '#faf5ff'}; color: ${userRoleFilter === 'organizer' ? '#ffffff' : '#6d28d9'}; transition: all 0.15s;">
                      ⚡ Organizers (${orgCount})
                    </button>
                  </div>
                </div>

                <!-- Filter & Sort Controls Toolbar -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
                  <!-- Search Bar -->
                  <input type="text" id="input-search-users" class="form-control form-control-sm" placeholder="🔍 Search name, PRN, email..." value="${userSearchQuery}" style="width: 175px;" />

                  <!-- Role / Admin Filter -->
                  <select id="select-filter-role" class="form-control form-control-sm" style="width: 135px; font-size: 0.8rem; cursor: pointer;">
                    <option value="all" ${userRoleFilter === 'all' ? 'selected' : ''}>👥 All Roles</option>
                    <option value="admin" ${userRoleFilter === 'admin' ? 'selected' : ''}>👑 Admins Only</option>
                    <option value="organizer" ${userRoleFilter === 'organizer' ? 'selected' : ''}>⚡ Organizers</option>
                    <option value="student" ${userRoleFilter === 'student' ? 'selected' : ''}>🎓 Students</option>
                  </select>

                  <!-- Department Filter -->
                  <select id="select-filter-dept" class="form-control form-control-sm" style="width: 150px; font-size: 0.8rem; cursor: pointer;">
                    <option value="all" ${userDeptFilter === 'all' ? 'selected' : ''}>🏢 All Depts</option>
                    <option value="Computer Science" ${userDeptFilter === 'Computer Science' ? 'selected' : ''}>CSE / Computer</option>
                    <option value="Information Technology" ${userDeptFilter === 'Information Technology' ? 'selected' : ''}>Information Tech</option>
                    <option value="AIML" ${userDeptFilter === 'AIML' ? 'selected' : ''}>AIML</option>
                    <option value="AIDS" ${userDeptFilter === 'AIDS' ? 'selected' : ''}>AIDS</option>
                    <option value="IMtech" ${userDeptFilter === 'IMtech' ? 'selected' : ''}>IMtech</option>
                    <option value="Robotics" ${userDeptFilter === 'Robotics' ? 'selected' : ''}>Robotics</option>
                    <option value="Mechanical" ${userDeptFilter === 'Mechanical' ? 'selected' : ''}>Mechanical</option>
                    <option value="Civil" ${userDeptFilter === 'Civil' ? 'selected' : ''}>Civil</option>
                    <option value="not_set" ${userDeptFilter === 'not_set' ? 'selected' : ''}>⚠️ Dept Not Set</option>
                  </select>

                  <!-- Year Filter -->
                  <select id="select-filter-year" class="form-control form-control-sm" style="width: 115px; font-size: 0.8rem; cursor: pointer;">
                    <option value="all" ${userYearFilter === 'all' ? 'selected' : ''}>🎓 All Years</option>
                    <option value="1st Year" ${userYearFilter === '1st Year' ? 'selected' : ''}>1st Year</option>
                    <option value="2nd Year" ${userYearFilter === '2nd Year' ? 'selected' : ''}>2nd Year</option>
                    <option value="3rd Year" ${userYearFilter === '3rd Year' ? 'selected' : ''}>3rd Year</option>
                    <option value="4th Year" ${userYearFilter === '4th Year' ? 'selected' : ''}>4th Year</option>
                    <option value="not_set" ${userYearFilter === 'not_set' ? 'selected' : ''}>⚠️ Year Not Set</option>
                  </select>

                  <!-- Sort Selector (PRN last 4 digits default at top) -->
                  <select id="select-sort-users" class="form-control form-control-sm" style="width: 160px; font-size: 0.8rem; cursor: pointer;">
                    <option value="prn_asc" ${userSortBy === 'prn_asc' ? 'selected' : ''}>🔢 PRN Last 4 (Asc: 1001 ➔ 1099)</option>
                    <option value="prn_desc" ${userSortBy === 'prn_desc' ? 'selected' : ''}>🔢 PRN Last 4 (Desc: 1099 ➔ 1001)</option>
                    <option value="name_asc" ${userSortBy === 'name_asc' ? 'selected' : ''}>🔤 Name (A - Z)</option>
                    <option value="name_desc" ${userSortBy === 'name_desc' ? 'selected' : ''}>🔤 Name (Z - A)</option>
                    <option value="dept_asc" ${userSortBy === 'dept_asc' ? 'selected' : ''}>🏛️ Department</option>
                    <option value="year_asc" ${userSortBy === 'year_asc' ? 'selected' : ''}>📅 Year</option>
                  </select>

                  <!-- Export CSV Dropdown Hub -->
                  <div style="position: relative;" id="export-users-dropdown-wrapper">
                    <button id="btn-toggle-export-users" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; cursor: pointer; border-radius: var(--radius-sm); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">
                      📥 Export CSV ▾
                    </button>
                    <div id="menu-export-users" style="display: none; position: absolute; right: 0; top: calc(100% + 6px); background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 12px 30px -5px rgba(15,23,42,0.25); z-index: 1000; min-width: 260px; padding: 0.4rem 0;">
                      <div style="padding: 0.4rem 0.85rem; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                        Select Export Scope
                      </div>
                      <button class="btn-do-export-csv" data-export-type="filtered" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        🎯 Current Filtered View (${filteredUsers.length})
                      </button>
                      <div style="height: 1px; background: #e2e8f0; margin: 0.25rem 0;"></div>
                      <button class="btn-do-export-csv" data-export-type="all" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        👥 All Accounts Master (${usersList.length})
                      </button>
                      <button class="btn-do-export-csv" data-export-type="students" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #2563eb; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        🎓 Students Only (${studentCount})
                      </button>
                      <button class="btn-do-export-csv" data-export-type="admins" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #dc2626; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        👑 Admins & Staff Only (${adminCount})
                      </button>
                      <button class="btn-do-export-csv" data-export-type="organizers" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #7c3aed; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                        ⚡ Organizers Only (${orgCount})
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div style="overflow-x: auto;">
                <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                  <thead>
                    <tr style="border-bottom: 2px solid var(--border-subtle); color: var(--text-secondary); height: 42px;">
                      <th>Name</th>
                      <th>PRN</th>
                      <th>Department & Year</th>
                      <th>Email</th>
                      <th>Current Role</th>
                      <th>Role Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${filteredUsers.length === 0 ? `
                      <tr>
                        <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--text-tertiary);">
                          <div style="font-size: 1.5rem; margin-bottom: 0.35rem;">🔍</div>
                          No students match the selected Department, Year, or Search filters.
                        </td>
                      </tr>
                    ` : filteredUsers.map(u => `
                      <tr style="border-bottom: 1px solid var(--border-subtle); height: 52px; background: ${u.status === 'banned' ? 'rgba(239, 68, 68, 0.04)' : 'transparent'};">
                        <td>
                          <div style="display: flex; align-items: center; gap: 0.45rem;">
                            <span style="font-weight: 700; color: var(--text-primary);">${u.name || 'Student'}</span>
                            ${u.status === 'banned' ? `<span style="font-size: 0.65rem; font-weight: 800; background: #fee2e2; color: #dc2626; padding: 0.15rem 0.45rem; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.2);">🚫 BANNED</span>` : ''}
                          </div>
                        </td>
                        <td>
                          ${u.prn ? `<code>${u.prn}</code>` : `<span style="color: #94a3b8; font-size: 0.775rem; font-style: italic;">Not Set</span>`}
                        </td>
                        <td>
                          ${u.department ? `${u.department} ${u.year ? `(${u.year})` : ''}` : `<span style="color: #94a3b8; font-size: 0.775rem; font-style: italic;">Not Set</span>`}
                        </td>
                        <td style="color: var(--text-tertiary); font-size: 0.8rem;">${u.email}</td>
                        <td>
                          <span style="font-size: 0.725rem; font-weight: 800; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); background: ${u.role === 'admin' ? '#fef2f2' : u.role === 'organizer' ? '#ede9fe' : '#f1f5f9'}; color: ${u.role === 'admin' ? '#dc2626' : u.role === 'organizer' ? '#7c3aed' : '#475569'};">
                            ${u.role || 'student'}
                          </span>
                        </td>
                        <td>
                          <div style="display: flex; gap: 0.4rem; align-items: center;">
                            <button class="btn btn-primary btn-sm btn-view-user-activity" data-uid="${u.uid}" data-email="${u.email}" style="font-size: 0.75rem; padding: 0.25rem 0.75rem; font-weight: 700; background: linear-gradient(135deg, #4f46e5, #7c3aed); border: none; color: #fff; border-radius: 6px; box-shadow: 0 2px 6px rgba(124, 58, 237, 0.25); cursor: pointer;">
                              👁️ View Activity
                            </button>
                            <button class="btn-remove-user" data-uid="${u.uid}" data-email="${u.email}" data-name="${u.name || 'this user'}" style="font-size: 0.75rem; padding: 0.25rem 0.65rem; font-weight: 700; background: #fee2e2; border: 1px solid #fca5a5; color: #dc2626; border-radius: 6px; cursor: pointer;" title="Remove from Directory">
                              🗑️
                            </button>
                          </div>
                        </td>
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
            </div>
          `;
        })() : ''}

        <!-- ========================================== -->
        <!-- ========================================== -->
        <!-- TAB 5: GRIEVANCE RESOLUTION CENTER        -->
        <!-- ========================================== -->
        ${activeTab === 'grievances' ? (() => {
          const unresolvedCount = complaints.filter(c => (c.status || '').toLowerCase() !== 'resolved').length;
          const resolvedCount = complaints.filter(c => (c.status || '').toLowerCase() === 'resolved').length;

          const filteredComplaints = complaints.filter(c => {
            const q = complaintSearchQuery.toLowerCase().trim();
            const matchesSearch = !q ||
              (c.ticketId || '').toLowerCase().includes(q) ||
              (c.eventTitle || '').toLowerCase().includes(q) ||
              (c.description || '').toLowerCase().includes(q) ||
              (c.category || '').toLowerCase().includes(q) ||
              (c.authorName || '').toLowerCase().includes(q);

            const status = (c.status || 'pending').toLowerCase();
            const matchesStatus = complaintStatusFilter === 'all' ||
              (complaintStatusFilter === 'pending' && status !== 'resolved') ||
              (complaintStatusFilter === 'resolved' && status === 'resolved');

            const cat = (c.category || '').toLowerCase();
            const matchesCategory = complaintCategoryFilter === 'all' ||
              (complaintCategoryFilter === 'helpdesk' && (cat.includes('helpdesk') || cat.includes('support') || cat.includes('query'))) ||
              (complaintCategoryFilter === 'misbehavior' && (cat.includes('misbehavior') || cat.includes('harassment') || cat.includes('conduct') || cat.includes('discipline'))) ||
              (complaintCategoryFilter === 'judging' && (cat.includes('judging') || cat.includes('cheating') || cat.includes('scoring') || cat.includes('dispute') || cat.includes('unfair'))) ||
              (complaintCategoryFilter === 'pass' && (cat.includes('pass') || cat.includes('registration') || cat.includes('qr') || cat.includes('fraud') || cat.includes('scanning'))) ||
              (complaintCategoryFilter === 'logistics' && (cat.includes('logistics') || cat.includes('refreshment') || cat.includes('facility') || cat.includes('venue'))) ||
              (complaintCategoryFilter === 'safety' && (cat.includes('safety') || cat.includes('security') || cat.includes('hazard'))) ||
              (complaintCategoryFilter === 'other' && (cat.includes('other') || (!cat.includes('helpdesk') && !cat.includes('support') && !cat.includes('misbehavior') && !cat.includes('judging') && !cat.includes('pass') && !cat.includes('logistics') && !cat.includes('safety'))));

            return matchesSearch && matchesStatus && matchesCategory;
          });

          return `
            <div class="card" style="background: #ffffff;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
                <div>
                  <h3 style="font-size: 1.25rem; margin-bottom: 0.2rem; color: #dc2626; font-weight: 800;">
                    🚨 Disciplinary & Grievance Resolution Desk
                  </h3>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">
                    Showing <strong>${filteredComplaints.length}</strong> of <strong>${complaints.length}</strong> incident reports & student support queries.
                  </p>

                  <!-- Live Interactive Status Breakdown Badges -->
                  <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; margin-top: 0.65rem;">
                    <button class="btn-quick-complaint-badge ${complaintStatusFilter === 'all' ? 'active' : ''}" data-status="all" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${complaintStatusFilter === 'all' ? '#0f172a' : '#cbd5e1'}; background: ${complaintStatusFilter === 'all' ? '#0f172a' : '#ffffff'}; color: ${complaintStatusFilter === 'all' ? '#ffffff' : 'var(--text-secondary)'}; transition: all 0.15s;">
                      🚨 All Reports (${complaints.length})
                    </button>
                    <button class="btn-quick-complaint-badge ${complaintStatusFilter === 'pending' ? 'active' : ''}" data-status="pending" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${complaintStatusFilter === 'pending' ? '#eab308' : '#fef08a'}; background: ${complaintStatusFilter === 'pending' ? '#eab308' : '#fefce8'}; color: ${complaintStatusFilter === 'pending' ? '#ffffff' : '#854d0e'}; transition: all 0.15s;">
                      ⏳ Unresolved / Not Solved (${unresolvedCount})
                    </button>
                    <button class="btn-quick-complaint-badge ${complaintStatusFilter === 'resolved' ? 'active' : ''}" data-status="resolved" style="padding: 0.25rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 800; cursor: pointer; border: 1.5px solid ${complaintStatusFilter === 'resolved' ? '#16a34a' : '#bbf7d0'}; background: ${complaintStatusFilter === 'resolved' ? '#16a34a' : '#f0fdf4'}; color: ${complaintStatusFilter === 'resolved' ? '#ffffff' : '#166534'}; transition: all 0.15s;">
                      ✅ Solved / Resolved (${resolvedCount})
                    </button>
                  </div>
                </div>

                <!-- Export & Sync Grievances Hub -->
                <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
                  <button id="btn-sync-live-grievances" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #ffffff; border: 1.5px solid #cbd5e1; color: #1e293b; cursor: pointer; border-radius: var(--radius-sm);">
                    🔄 Sync Live Data
                  </button>
                  <div style="position: relative;" id="export-grievances-dropdown-wrapper">
                    <button id="btn-toggle-export-grievances" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; cursor: pointer; border-radius: var(--radius-sm); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">
                      📥 Export CSV ▾
                    </button>
                  <div id="menu-export-grievances" style="display: none; position: absolute; right: 0; top: calc(100% + 6px); background: #ffffff; border: 1px solid #cbd5e1; border-radius: 8px; box-shadow: 0 12px 30px -5px rgba(15,23,42,0.25); z-index: 1000; min-width: 275px; padding: 0.4rem 0;">
                    <div style="padding: 0.4rem 0.85rem; font-size: 0.7rem; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 0.05em;">
                      Select Grievance Export Scope
                    </div>
                    <button class="btn-do-export-grievance-csv" data-export-type="filtered" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                      🎯 Current Filtered View (${filteredComplaints.length})
                    </button>
                    <div style="height: 1px; background: #e2e8f0; margin: 0.25rem 0;"></div>
                    <button class="btn-do-export-grievance-csv" data-export-type="all" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #0f172a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                      🚨 Master All Grievances (${complaints.length})
                    </button>
                    <button class="btn-do-export-grievance-csv" data-export-type="unresolved" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #d97706; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                      ⏳ Unresolved / Not Solved Only (${unresolvedCount})
                    </button>
                    <button class="btn-do-export-grievance-csv" data-export-type="resolved" style="width: 100%; text-align: left; background: none; border: none; padding: 0.55rem 0.85rem; font-size: 0.82rem; font-weight: 700; color: #16a34a; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: background 0.15s;">
                      ✅ Solved / Resolved Only (${resolvedCount})
                    </button>
                  </div>
                </div>
              </div>

              <!-- Grievance Filter & Search Toolbar -->
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center; margin-bottom: 1.25rem;">
                <input type="text" id="input-search-complaints" class="form-control form-control-sm" placeholder="🔍 Search ticket ID, description, student..." value="${complaintSearchQuery}" style="width: 230px;" />

                <select id="select-filter-complaint-status" class="form-control form-control-sm" style="width: 165px; font-size: 0.8rem; cursor: pointer;">
                  <option value="all" ${complaintStatusFilter === 'all' ? 'selected' : ''}>📌 All Resolution Status</option>
                  <option value="pending" ${complaintStatusFilter === 'pending' ? 'selected' : ''}>⏳ Unresolved / Not Solved</option>
                  <option value="resolved" ${complaintStatusFilter === 'resolved' ? 'selected' : ''}>✅ Solved / Resolved</option>
                </select>

                <select id="select-filter-complaint-cat" class="form-control form-control-sm" style="width: 260px; font-size: 0.8rem; cursor: pointer;">
                  <option value="all" ${complaintCategoryFilter === 'all' ? 'selected' : ''}>🏷️ All Categories & Queries</option>
                  <option value="helpdesk" ${complaintCategoryFilter === 'helpdesk' ? 'selected' : ''}>💬 Helpdesk & Student Support Queries</option>
                  <option value="misbehavior" ${complaintCategoryFilter === 'misbehavior' ? 'selected' : ''}>🚫 Misbehavior / Harassment / Unfair Conduct</option>
                  <option value="judging" ${complaintCategoryFilter === 'judging' ? 'selected' : ''}>⚖️ Unfair Judging / Scoring Dispute</option>
                  <option value="pass" ${complaintCategoryFilter === 'pass' ? 'selected' : ''}>🎫 Pass / Registration / QR Scanning Issue</option>
                  <option value="logistics" ${complaintCategoryFilter === 'logistics' ? 'selected' : ''}>📦 Logistics / Refreshment / Venue Facility</option>
                  <option value="safety" ${complaintCategoryFilter === 'safety' ? 'selected' : ''}>⚠️ Safety & Security Hazard</option>
                  <option value="other" ${complaintCategoryFilter === 'other' ? 'selected' : ''}>❓ Other Grievance</option>
                </select>
              </div>

              ${filteredComplaints.length === 0 ? `
                <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                  <div style="font-size: 2.2rem; margin-bottom: 0.35rem;">🛡️</div>
                  <div style="font-weight: 700;">No matching grievance reports found</div>
                  <div style="font-size: 0.85rem; margin-top: 0.2rem;">Try adjusting your status filter or search query.</div>
                </div>
              ` : filteredComplaints.map(c => `
                <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); padding: 1.25rem;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div style="display: flex; gap: 0.45rem; align-items: center; flex-wrap: wrap;">
                      <span style="font-family: monospace; font-size: 0.75rem; font-weight: 800; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm);">${c.ticketId || c.id}</span>
                      <span style="font-size: 0.75rem; font-weight: 800; background: #fef2f2; color: #dc2626; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">${c.category}</span>
                      ${c.isAnonymous ? `<span style="font-size: 0.75rem; font-weight: 700; background: #334155; color: #ffffff; padding: 0.2rem 0.5rem; border-radius: var(--radius-full);">🔒 Anonymous Report</span>` : ''}
                    </div>
                    <div>
                      <span style="font-size: 0.75rem; font-weight: 800; text-transform: uppercase; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); background: ${c.status === 'resolved' ? '#dcfce7' : '#fef9c3'}; color: ${c.status === 'resolved' ? '#16a34a' : '#ca8a04'};">
                        ${c.status === 'resolved' ? '✅ SOLVED' : '⏳ PENDING'}
                      </span>
                    </div>
                  </div>

                  <div style="font-size: 0.95rem; font-weight: 700; color: var(--text-primary); margin-bottom: 0.35rem;">
                    Event: ${c.eventTitle || 'Campus General Incident'}
                  </div>

                  <div style="background: #ffffff; border: 1px solid var(--border-subtle); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: var(--text-secondary); line-height: 1.45; margin-bottom: 0.75rem;">
                    ${c.description}
                  </div>

                  <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.775rem; color: var(--text-tertiary); background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
                    <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0.4rem;">
                      <span>Reported by: <strong style="color: var(--text-primary);">${c.isAnonymous ? '🔒 Confidential Student' : (c.reporterName || c.authorName || 'Student')}</strong></span>
                      ${!c.isAnonymous && (c.reporterEmail || c.authorEmail) ? `<span style="color: #475569; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 4px;">📧 ${c.reporterEmail || c.authorEmail}</span>` : ''}
                      ${!c.isAnonymous && c.reporterPrn && c.reporterPrn !== 'Hidden' && c.reporterPrn !== 'N/A' ? `<span style="color: #475569; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 4px;">🎓 PRN: ${c.reporterPrn}</span>` : ''}
                      ${!c.isAnonymous && c.reporterDept && c.reporterDept !== 'Hidden' && c.reporterDept !== 'N/A' ? `<span style="color: #475569; background: #ffffff; border: 1px solid #e2e8f0; padding: 0.1rem 0.4rem; border-radius: 4px;">🏛️ ${c.reporterDept}</span>` : ''}
                      ${c.contactPhone ? `<span style="background: #ecfdf5; color: #047857; font-weight: 700; padding: 0.15rem 0.5rem; border-radius: 4px; border: 1px solid #a7f3d0;">📞 ${c.contactPhone}</span>` : ''}
                      <span style="color: #94a3b8; margin-left: 0.2rem;">🕒 ${new Date(c.createdAt).toLocaleString()}</span>
                    </div>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      ${c.status !== 'resolved' ? `
                        <button class="btn btn-primary btn-sm btn-resolve-complaint" data-id="${c.id}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; background: #16a34a; border-color: #16a34a;">
                          ✓ Mark Solved
                        </button>
                      ` : `
                        <button class="btn btn-secondary btn-sm btn-reopen-complaint" data-id="${c.id}" style="font-size: 0.75rem; padding: 0.25rem 0.6rem; color: #ca8a04; border-color: #ca8a04;">
                          🔄 Reopen
                        </button>
                      `}
                      <button class="btn btn-secondary btn-sm btn-delete-complaint" data-id="${c.id}" style="font-size: 0.75rem; padding: 0.25rem 0.55rem; color: #dc2626; border-color: #fca5a5; background: #fef2f2;" title="Delete & Dismiss this Report">
                        🗑️ Delete
                      </button>
                    </div>
                  </div>
                </div>
              `).join('')}
            </div>
          `;
        })() : ''}

        <!-- ========================================== -->
        <!-- TAB 6: WISHLIST APPROVALS                 -->
        <!-- ========================================== -->
        ${activeTab === 'wishlist' ? (() => {
          const newCount = ideas.filter(i => i.type !== 'improvement').length;
          const impCount = ideas.filter(i => i.type === 'improvement').length;

          let filteredIdeas = ideas.filter(i => {
            if (wishlistTypeFilter === 'new_event') {
              if (i.type === 'improvement') return false;
            } else if (wishlistTypeFilter === 'improvement') {
              if (i.type !== 'improvement') return false;
            }

            if (wishlistSearchQuery) {
              const q = wishlistSearchQuery.toLowerCase();
              const match = (i.title || '').toLowerCase().includes(q) ||
                            (i.description || '').toLowerCase().includes(q) ||
                            (i.authorName || '').toLowerCase().includes(q) ||
                            (i.department || '').toLowerCase().includes(q) ||
                            (i.category || '').toLowerCase().includes(q) ||
                            (i.suggestedVenue || '').toLowerCase().includes(q) ||
                            (i.suggestedGuest || '').toLowerCase().includes(q);
              if (!match) return false;
            }
            return true;
          });

          return `
            <div class="card" style="background: #ffffff; padding: 1.5rem;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 style="font-size: 1.25rem; margin: 0; color: #7c3aed;">💡 Student Wishes & Improvement Proposals</h3>
                    <span style="background: #ede9fe; color: #7c3aed; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                      ${ideas.length} Total
                    </span>
                  </div>
                  <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0.25rem 0 0;">
                    Review student-voted new event suggestions and event improvements, then convert popular ideas into official events.
                  </p>
                </div>

                <!-- Direct Separate Export Buttons -->
                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <button id="btn-export-wishlist-new" class="btn btn-sm" style="background: #ede9fe; color: #6d28d9; border: 1.5px solid #c4b5fd; font-weight: 800; font-size: 0.775rem; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(109, 40, 217, 0.15);">
                    🎤 Export Suggestions (${newCount})
                  </button>
                  <button id="btn-export-wishlist-imp" class="btn btn-sm" style="background: #e0f2fe; color: #0369a1; border: 1.5px solid #7dd3fc; font-weight: 800; font-size: 0.775rem; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(3, 105, 161, 0.15);">
                    ✨ Export Improvements (${impCount})
                  </button>
                  <button id="btn-export-wishlist-all" class="btn btn-secondary btn-sm" style="background: #0f172a; color: #ffffff; border: 1.5px solid #0f172a; font-weight: 800; font-size: 0.775rem; padding: 0.4rem 0.8rem; border-radius: var(--radius-sm); cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; box-shadow: 0 2px 6px rgba(15, 23, 42, 0.2);">
                    🌟 Export All (${ideas.length})
                  </button>
                </div>
              </div>

              <!-- Segmented Two-Part Tabs & Search Bar -->
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; margin-bottom: 1.25rem; display: flex; flex-direction: column; gap: 0.75rem;">
                
                <!-- Filter Tabs -->
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button class="btn-quick-wishlist-badge" data-type="all" style="padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 800; border: 1.5px solid ${wishlistTypeFilter === 'all' ? '#0f172a' : '#cbd5e1'}; background: ${wishlistTypeFilter === 'all' ? '#0f172a' : '#ffffff'}; color: ${wishlistTypeFilter === 'all' ? '#ffffff' : '#475569'}; cursor: pointer; transition: all 0.15s;">
                    🌟 All Submissions (${ideas.length})
                  </button>
                  
                  <button class="btn-quick-wishlist-badge" data-type="new_event" style="padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 800; border: 1.5px solid ${wishlistTypeFilter === 'new_event' ? '#7c3aed' : '#cbd5e1'}; background: ${wishlistTypeFilter === 'new_event' ? '#7c3aed' : '#ffffff'}; color: ${wishlistTypeFilter === 'new_event' ? '#ffffff' : '#7c3aed'}; cursor: pointer; transition: all 0.15s;">
                    🎤 New Event Suggestions (${newCount})
                  </button>

                  <button class="btn-quick-wishlist-badge" data-type="improvement" style="padding: 0.4rem 0.85rem; border-radius: var(--radius-full); font-size: 0.8rem; font-weight: 800; border: 1.5px solid ${wishlistTypeFilter === 'improvement' ? '#0284c7' : '#cbd5e1'}; background: ${wishlistTypeFilter === 'improvement' ? '#0284c7' : '#ffffff'}; color: ${wishlistTypeFilter === 'improvement' ? '#ffffff' : '#0284c7'}; cursor: pointer; transition: all 0.15s;">
                    ✨ Campus & Event Improvements (${impCount})
                  </button>
                </div>

                <!-- Search Input -->
                <div>
                  <input type="text" id="input-search-wishlist" class="form-control form-control-sm" placeholder="🔍 Search ideas by title, author name, department, category, venue, artist..." value="${wishlistSearchQuery}" style="font-size: 0.825rem;" />
                </div>
              </div>

              ${filteredIdeas.length === 0 ? `
                <div style="text-align: center; padding: 3.5rem 1rem; color: var(--text-secondary); background: #f8fafc; border-radius: var(--radius-md); border: 1px dashed var(--border-subtle);">
                  <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">💡</div>
                  <div style="font-weight: 800; font-size: 1.1rem; color: var(--text-primary); margin-bottom: 0.25rem;">No Submissions Found</div>
                  <div style="font-size: 0.85rem;">No wishlist ideas matching the selected type or search query.</div>
                </div>
              ` : filteredIdeas.map(idea => {
                const isImp = idea.type === 'improvement';
                return `
                  <div class="card" style="margin-bottom: 1rem; background: #ffffff; border: 1px solid var(--border-subtle); border-left: 4.5px solid ${isImp ? '#0284c7' : '#7c3aed'}; display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    <div style="flex: 1; min-width: 260px;">
                      <div style="display: flex; gap: 0.45rem; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: #ffffff; background: ${isImp ? '#0284c7' : '#7c3aed'}; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">
                          ${isImp ? '✨ Event Improvement' : '🎤 New Event Wish'}
                        </span>
                        <span style="font-size: 0.75rem; font-weight: 800; color: #7c3aed; background: #ede9fe; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                          ▲ ${idea.upvotes || 0} Upvotes
                        </span>
                        <span style="font-size: 0.75rem; font-weight: 700; color: #475569; background: #f1f5f9; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                          ${idea.category}
                        </span>
                        <span style="font-size: 0.75rem; color: #94a3b8; margin-left: auto;">
                          🕒 ${new Date(idea.createdAt).toLocaleDateString()}
                        </span>
                      </div>

                      <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.4rem;">
                        ${idea.title}
                      </h3>

                      <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 0.85rem; border-radius: var(--radius-sm); font-size: 0.85rem; color: #334155; line-height: 1.5; margin-bottom: 0.6rem;">
                        "${idea.description}"
                      </div>

                      <div style="display: flex; flex-wrap: wrap; gap: 0.6rem; font-size: 0.775rem; color: #64748b;">
                        <span>👤 Suggested by: <strong>${idea.authorName || 'Student'}</strong> (${idea.department || 'N/A'}${idea.year ? `, Year ${idea.year}` : ''})</span>
                        ${idea.suggestedVenue ? `<span>📍 Venue: <strong>${idea.suggestedVenue}</strong></span>` : ''}
                        ${idea.suggestedGuest ? `<span>🌟 Artist/Guest: <strong>${idea.suggestedGuest}</strong></span>` : ''}
                      </div>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 0.45rem; align-items: flex-end;">
                      <button class="btn btn-primary btn-sm btn-convert-wish" data-title="${encodeURIComponent(idea.title)}" data-desc="${encodeURIComponent(idea.description)}" data-cat="${encodeURIComponent(idea.category)}" style="font-size: 0.775rem; font-weight: 800; padding: 0.4rem 0.85rem; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: var(--radius-sm);">
                        🚀 Convert to Event
                      </button>
                      <button class="btn btn-secondary btn-sm btn-delete-wishlist-idea" data-id="${idea.id}" style="font-size: 0.75rem; font-weight: 700; color: #dc2626; border-color: #fca5a5; background: #fff5f5; padding: 0.25rem 0.65rem;" title="Delete this idea from wishlist">
                        🗑️ Dismiss / Delete
                      </button>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>
          `;
        })() : ''}

        <!-- ========================================== -->
        <!-- TAB 7: HISTORICAL EVENT ARCHIVES & AUDIT  -->
        <!-- ========================================== -->
        ${activeTab === 'archives' ? `
          <div class="card" style="background: #ffffff; padding: 1.5rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 style="font-size: 1.25rem; margin-bottom: 0.2rem; color: #1e293b;">📚 University Event History & Completed Archives (${completedEvents.length})</h3>
                <p style="font-size: 0.85rem; color: var(--text-secondary); margin: 0;">Access historical event records, attendee rosters, and accreditation reports for HODs and Deans.</p>
              </div>
              <button id="btn-export-archives-csv" class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; font-size: 0.8rem; padding: 0.4rem 0.85rem; background: #0f172a; border: 1.5px solid #0f172a; color: #ffffff; cursor: pointer; border-radius: var(--radius-sm); box-shadow: 0 2px 8px rgba(15, 23, 42, 0.25);">
                📥 Export Archives CSV
              </button>
            </div>

            ${completedEvents.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.5rem; margin-bottom: 0.35rem;">🏁</div>
                <div style="font-weight: 700; font-size: 1.1rem;">No Completed Events in Archive Yet</div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">When organizers or admins conclude an event and mark it completed, all its records and attendance logs are preserved here.</div>
              </div>
            ` : completedEvents.map(ce => `
              <div class="card" style="margin-bottom: 1rem; background: #f8fafc; border: 1px solid var(--border-subtle); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; padding: 1.25rem;">
                <div style="flex: 1; min-width: 260px;">
                  <div style="display: flex; gap: 0.5rem; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap;">
                    <span style="font-size: 0.75rem; font-weight: 800; background: #e2e8f0; color: #334155; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">
                      🏁 COMPLETED ARCHIVE
                    </span>
                    <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary);">${ce.department}</span>
                    <span style="font-size: 0.75rem; color: var(--text-tertiary);">Organizer: <strong>${ce.organizerName || 'Coordinator'}</strong></span>
                  </div>
                  <h3 style="font-size: 1.15rem; color: var(--text-primary); margin-bottom: 0.35rem;">${ce.title}</h3>
                  <div style="font-size: 0.8rem; color: var(--text-tertiary);">
                    📅 Held on: <strong>${ce.date} (${ce.time})</strong> | 📍 Venue: <strong>${ce.venue}</strong>
                  </div>
                </div>

                <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                  <button class="btn btn-primary btn-sm btn-admin-inspect-archive" data-event-id="${ce.id}" style="font-weight: 700;">
                    🔍 Inspect Attendees & Attendance
                  </button>
                  <button class="btn btn-secondary btn-sm btn-admin-export-archive" data-event-id="${ce.id}" style="font-weight: 700;">
                    📥 Export CSV
                  </button>
                  <button class="btn btn-secondary btn-sm btn-admin-reopen" data-event-id="${ce.id}" style="font-size: 0.75rem;">
                    ↺ Reopen
                  </button>
                  <button class="btn btn-sm btn-admin-delete-event" data-event-id="${ce.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-sm); cursor: pointer;" title="Permanently delete event">
                    🗑️ Delete
                  </button>
                </div>
              </div>
            `).join('')}
          </div>
        ` : ''}

      </div>
    `;

    // =========================================================================
    // EVENT LISTENERS
    // =========================================================================

    // Tab Navigation
    container.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        activeTab = e.currentTarget.getAttribute('data-tab');
        render();
      });
    });

    // Pending Event Actions
    container.querySelectorAll('.btn-admin-approve').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-event-id');
        btn.disabled = true;
        btn.textContent = 'Approving...';
        await updateEventStatus(id, 'approved', user);
        pendingEvents = await getPendingEvents();
        approvedEvents = await getApprovedEvents();
        render();
      });
    });

    container.querySelectorAll('.btn-admin-reject').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-event-id');
        btn.disabled = true;
        await updateEventStatus(id, 'rejected', user);
        pendingEvents = await getPendingEvents();
        render();
      });
    });

    // Admin Delete Event (Pending, Approved, or Completed Archive)
    container.querySelectorAll('.btn-admin-delete-event').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-event-id');
        const target = [...pendingEvents, ...approvedEvents, ...completedEvents].find(ev => ev.id === id);
        const title = target ? target.title : 'this event';
        if (confirm(`Are you sure you want to permanently delete event "${title}"?\n\nThis will remove it completely from the database and student portal.`)) {
          btn.disabled = true;
          btn.textContent = 'Deleting...';
          await deleteEvent(id);
          pendingEvents = await getPendingEvents();
          approvedEvents = await getApprovedEvents();
          completedEvents = await getCompletedEvents();
          render();
        }
      });
    });

    // Delete Announcement
    container.querySelectorAll('.btn-delete-notice').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-notice-id');
        if (confirm('Are you sure you want to remove this campus notice?')) {
          await deleteAnnouncement(id, user);
          announcements = await getAnnouncements();
          render();
        }
      });
    });

    // Preview Notice Document In-App
    container.querySelectorAll('.btn-admin-preview-notice').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const b = e.currentTarget;
        const noticeId = b.getAttribute('data-notice-id');
        const fileName = b.getAttribute('data-name');
        const origHtml = b.innerHTML;

        b.disabled = true;
        b.innerHTML = '⏳ Loading...';

        const noticeObj = announcements.find(n => n.id === noticeId);
        const attachmentMeta = noticeObj ? noticeObj.attachment : null;

        try {
          let fileDataUrl = await fetchNoticeAttachmentData(noticeId, attachmentMeta);

          if (!fileDataUrl && attachmentMeta && attachmentMeta.dataUrl && attachmentMeta.dataUrl.startsWith('idb:')) {
            const file = await getFileFromIndexedDB(attachmentMeta.dataUrl);
            if (file) {
              fileDataUrl = await new Promise((res) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.readAsDataURL(file);
              });
            }
          }

          if (fileDataUrl) {
            openDocumentPreviewModal({
              title: noticeObj ? noticeObj.title : 'Notice Announcement',
              fileName: fileName || (attachmentMeta ? attachmentMeta.name : 'Student_Council_Notice.pdf'),
              dataUrl: fileDataUrl,
              mimeType: attachmentMeta ? attachmentMeta.type : 'application/pdf'
            });
          } else {
            alert('Attachment file not available.');
          }
        } catch (err) {
          alert('Failed to preview document: ' + err.message);
        } finally {
          b.disabled = false;
          b.innerHTML = origHtml;
        }
      });
    });

    // Campus Notices Search & Filters
    const noticeSearch = container.querySelector('#input-search-notices');
    if (noticeSearch) {
      noticeSearch.addEventListener('input', (e) => {
        noticeSearchQuery = e.target.value;
        render();
        const refreshed = container.querySelector('#input-search-notices');
        if (refreshed) {
          refreshed.focus();
          refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
        }
      });
    }

    container.querySelectorAll('.btn-quick-notice-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        noticePriorityFilter = e.currentTarget.getAttribute('data-prio');
        render();
      });
    });

    container.querySelector('#select-filter-notice-prio')?.addEventListener('change', (e) => {
      noticePriorityFilter = e.target.value;
      render();
    });

    container.querySelector('#select-filter-notice-dept')?.addEventListener('change', (e) => {
      noticeDeptFilter = e.target.value;
      render();
    });

    // Student Directory Search, Filter & Sort
    const searchInput = container.querySelector('#input-search-users');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        userSearchQuery = e.target.value;
        render();
        const refreshedInput = container.querySelector('#input-search-users');
        if (refreshedInput) {
          refreshedInput.focus();
          refreshedInput.setSelectionRange(refreshedInput.value.length, refreshedInput.value.length);
        }
      });
    }

    container.querySelectorAll('.btn-quick-role-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        userRoleFilter = e.currentTarget.getAttribute('data-role');
        render();
      });
    });

    container.querySelector('#select-filter-role')?.addEventListener('change', (e) => {
      userRoleFilter = e.target.value;
      render();
    });

    container.querySelector('#select-filter-dept')?.addEventListener('change', (e) => {
      userDeptFilter = e.target.value;
      render();
    });

    container.querySelector('#select-filter-year')?.addEventListener('change', (e) => {
      userYearFilter = e.target.value;
      render();
    });

    container.querySelector('#select-sort-users')?.addEventListener('change', (e) => {
      userSortBy = e.target.value;
      render();
    });

    // Helper: Export Users to CSV
    const exportUsersToCSV = (userArray, filenamePrefix = 'EventPulse_Directory') => {
      if (!userArray || userArray.length === 0) {
        alert('No user accounts available to export for the selected filter.');
        return;
      }

      const headers = ['Full Name', 'PRN Number', 'Department', 'Academic Year', 'Email Address', 'System Role', 'Account Status', 'Registered Date'];
      const rows = userArray.map(u => {
        const role = isUserAdmin(u) ? 'ADMIN' : (u.role === 'organizer' ? 'ORGANIZER' : 'STUDENT');
        return [
          `"${(u.name || '').replace(/"/g, '""')}"`,
          `"${(u.prn || '').replace(/"/g, '""')}"`,
          `"${(u.department || 'Not Set').replace(/"/g, '""')}"`,
          `"${(u.year || 'Not Set').replace(/"/g, '""')}"`,
          `"${(u.email || '').replace(/"/g, '""')}"`,
          `"${role}"`,
          `"${(u.status || 'active').toUpperCase()}"`,
          `"${u.createdAt ? new Date(u.createdAt).toLocaleDateString() : 'N/A'}"`
        ].join(',');
      });

      const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // Export Student Directory CSV Hub (Multi-Scope)
    const toggleExportBtn = container.querySelector('#btn-toggle-export-users');
    const exportMenu = container.querySelector('#menu-export-users');
    if (toggleExportBtn && exportMenu) {
      toggleExportBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = exportMenu.style.display === 'none' || !exportMenu.style.display;
        exportMenu.style.display = isHidden ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!container.querySelector('#export-users-dropdown-wrapper')?.contains(e.target)) {
          exportMenu.style.display = 'none';
        }
      });
    }

    container.querySelectorAll('.btn-do-export-csv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const type = e.currentTarget.getAttribute('data-export-type');
        let targetList = [];
        let prefix = 'EventPulse_Directory';

        if (type === 'filtered') {
          const q = userSearchQuery.toLowerCase().trim();
          targetList = usersList.filter(u => {
            const matchesSearch = !q ||
              (u.name || '').toLowerCase().includes(q) ||
              (u.email || '').toLowerCase().includes(q) ||
              (u.prn || '').toLowerCase().includes(q) ||
              (u.department || '').toLowerCase().includes(q);

            const role = (u.role || 'student').toLowerCase();
            const matchesRole = userRoleFilter === 'all' || 
              (userRoleFilter === 'student' && role === 'student' && !isUserAdmin(u)) ||
              (userRoleFilter === 'admin' && isUserAdmin(u)) ||
              (userRoleFilter === 'organizer' && role === 'organizer');

            const dept = (u.department || '').toLowerCase();
            const matchesDept = userDeptFilter === 'all' || dept.includes(userDeptFilter.toLowerCase());

            const yr = (u.year || '').toLowerCase();
            const matchesYear = userYearFilter === 'all' || yr.includes(userYearFilter.toLowerCase());

            return matchesSearch && matchesRole && matchesDept && matchesYear;
          });
          prefix = `EventPulse_Filtered_Directory_${targetList.length}_Students`;
        } else if (type === 'all') {
          targetList = usersList;
          prefix = 'EventPulse_Master_All_Accounts';
        } else if (type === 'students') {
          targetList = usersList.filter(u => !isUserAdmin(u) && u.role !== 'organizer');
          prefix = 'EventPulse_Students_Only';
        } else if (type === 'admins') {
          targetList = usersList.filter(u => isUserAdmin(u));
          prefix = 'EventPulse_Administrators_Staff';
        } else if (type === 'organizers') {
          targetList = usersList.filter(u => u.role === 'organizer' && !isUserAdmin(u));
          prefix = 'EventPulse_Event_Organizers';
        }

        exportUsersToCSV(targetList, prefix);
        if (exportMenu) exportMenu.style.display = 'none';
      });
    });

    // Helper: Generic CSV Downloader for All Tabs
    const downloadGenericCSV = (headers, rows, filenamePrefix) => {
      if (!rows || rows.length === 0) {
        alert('No data records available in this section to export.');
        return;
      }
      const csvContent = '\uFEFF' + [
        headers.join(','),
        ...rows.map(r => r.map(c => `"${String(c || '').replace(/"/g, '""')}"`).join(','))
      ].join('\r\n');
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      link.setAttribute('href', url);
      link.setAttribute('download', `${filenamePrefix}_${dateStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    };

    // 1. Export Queue & Active Events CSV
    container.querySelector('#btn-export-queue-csv')?.addEventListener('click', () => {
      const allEventsList = [...pendingEvents, ...approvedEvents];
      const headers = ['Event ID', 'Event Title', 'Category', 'Department', 'Date', 'Time', 'Venue', 'Organizer', 'Status', 'Capacity', 'Registration Fee'];
      const rows = allEventsList.map(e => [
        e.id,
        e.title,
        e.category,
        e.department,
        e.date,
        e.time,
        e.venue,
        e.organizerName || 'Faculty / Coordinator',
        (e.status || 'Active').toUpperCase(),
        e.capacity || 250,
        e.registrationFee || 'Free'
      ]);
      downloadGenericCSV(headers, rows, 'EventPulse_Events_Queue_Active');
    });

    // 2. Export Campus Notices CSV Hub (Multi-Scope)
    const noticeExportToggle = container.querySelector('#btn-toggle-export-notices');
    const noticeExportMenu = container.querySelector('#menu-export-notices');
    if (noticeExportToggle && noticeExportMenu) {
      noticeExportToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = noticeExportMenu.style.display === 'none' || !noticeExportMenu.style.display;
        noticeExportMenu.style.display = isHidden ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!container.querySelector('#export-notices-dropdown-wrapper')?.contains(e.target)) {
          noticeExportMenu.style.display = 'none';
        }
      });
    }

    container.querySelectorAll('.btn-do-export-notice-csv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-export-type');
        let targetList = [];
        let prefix = 'EventPulse_Notices';

        if (type === 'filtered') {
          const q = noticeSearchQuery.toLowerCase().trim();
          targetList = announcements.filter(n => {
            const matchesSearch = !q ||
              (n.title || '').toLowerCase().includes(q) ||
              (n.message || '').toLowerCase().includes(q) ||
              (n.postedBy || '').toLowerCase().includes(q);

            const prio = (n.priority || '').toLowerCase();
            const matchesPriority = noticePriorityFilter === 'all' ||
              (noticePriorityFilter === 'emergency' && prio.includes('emergency')) ||
              (noticePriorityFilter === 'fest' && prio.includes('fest')) ||
              (noticePriorityFilter === 'schedule' && prio.includes('schedule')) ||
              (noticePriorityFilter === 'notice' && prio.includes('notice'));

            const dept = (n.targetDept || '').toLowerCase();
            const matchesDept = noticeDeptFilter === 'all' ||
              dept.includes(noticeDeptFilter.toLowerCase()) ||
              dept.includes('all');

            return matchesSearch && matchesPriority && matchesDept;
          });
          prefix = `EventPulse_Filtered_${noticePriorityFilter}_Notices`;
        } else if (type === 'all') {
          targetList = announcements;
          prefix = 'EventPulse_Master_All_Campus_Notices';
        } else if (type === 'emergency') {
          targetList = announcements.filter(n => (n.priority || '').includes('Emergency'));
          prefix = 'EventPulse_Emergency_Alerts_Only';
        } else if (type === 'fest') {
          targetList = announcements.filter(n => (n.priority || '').includes('Fest'));
          prefix = 'EventPulse_Fest_Alerts_Only';
        } else if (type === 'schedule') {
          targetList = announcements.filter(n => (n.priority || '').includes('Schedule'));
          prefix = 'EventPulse_Schedule_Changes_Only';
        } else if (type === 'notice') {
          targetList = announcements.filter(n => (n.priority || '').includes('Notice') || (!n.priority?.includes('Emergency') && !n.priority?.includes('Fest') && !n.priority?.includes('Schedule')));
          prefix = 'EventPulse_Standard_Campus_Notices';
        }

        const headers = ['Notice ID', 'Title', 'Message', 'Urgency Priority', 'Target Department', 'Posted By', 'Created Date'];
        const rows = targetList.map(n => [
          n.id,
          n.title,
          n.message,
          n.priority,
          n.targetDept,
          n.postedBy,
          n.createdAt ? new Date(n.createdAt).toLocaleString() : 'N/A'
        ]);

        downloadGenericCSV(headers, rows, prefix);
        if (noticeExportMenu) noticeExportMenu.style.display = 'none';
      });
    });

    // 3. Export Grievance Reports CSV Hub (Multi-Scope)
    const grievanceExportToggle = container.querySelector('#btn-toggle-export-grievances');
    const grievanceExportMenu = container.querySelector('#menu-export-grievances');
    if (grievanceExportToggle && grievanceExportMenu) {
      grievanceExportToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        const isHidden = grievanceExportMenu.style.display === 'none' || !grievanceExportMenu.style.display;
        grievanceExportMenu.style.display = isHidden ? 'block' : 'none';
      });
      document.addEventListener('click', (e) => {
        if (!container.querySelector('#export-grievances-dropdown-wrapper')?.contains(e.target)) {
          grievanceExportMenu.style.display = 'none';
        }
      });
    }

    container.querySelectorAll('.btn-do-export-grievance-csv').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const type = e.currentTarget.getAttribute('data-export-type');
        let targetList = [];
        let prefix = 'EventPulse_Grievances';

        if (type === 'filtered') {
          const q = complaintSearchQuery.toLowerCase().trim();
          targetList = complaints.filter(c => {
            const matchesSearch = !q ||
              (c.ticketId || '').toLowerCase().includes(q) ||
              (c.eventTitle || '').toLowerCase().includes(q) ||
              (c.description || '').toLowerCase().includes(q) ||
              (c.category || '').toLowerCase().includes(q) ||
              (c.authorName || '').toLowerCase().includes(q);

            const status = (c.status || 'pending').toLowerCase();
            const matchesStatus = complaintStatusFilter === 'all' ||
              (complaintStatusFilter === 'pending' && status !== 'resolved') ||
              (complaintStatusFilter === 'resolved' && status === 'resolved');

            const cat = (c.category || '').toLowerCase();
            const matchesCategory = complaintCategoryFilter === 'all' || cat.includes(complaintCategoryFilter.toLowerCase());

            return matchesSearch && matchesStatus && matchesCategory;
          });
          prefix = `EventPulse_Filtered_${complaintStatusFilter}_Grievances`;
        } else if (type === 'all') {
          targetList = complaints;
          prefix = 'EventPulse_Master_All_Grievances';
        } else if (type === 'unresolved') {
          targetList = complaints.filter(c => (c.status || '').toLowerCase() !== 'resolved');
          prefix = 'EventPulse_Unresolved_Pending_Grievances';
        } else if (type === 'resolved') {
          targetList = complaints.filter(c => (c.status || '').toLowerCase() === 'resolved');
          prefix = 'EventPulse_Resolved_Solved_Grievances';
        }

        const headers = ['Ticket ID', 'Event / Topic', 'Category', 'Status', 'Is Anonymous', 'Reporter Name', 'PRN', 'Department', 'Student Email', 'Contact Phone', 'Report Date', 'Description'];
        const rows = targetList.map(c => [
          c.ticketId || c.id,
          c.eventTitle || 'Campus General',
          c.category,
          (c.status || 'Pending').toUpperCase(),
          c.isAnonymous ? 'YES' : 'NO',
          c.isAnonymous ? 'Confidential Student' : (c.reporterName || c.authorName || 'Student'),
          c.isAnonymous ? 'Hidden' : (c.reporterPrn || 'N/A'),
          c.isAnonymous ? 'Hidden' : (c.reporterDept || 'N/A'),
          c.isAnonymous ? 'Hidden' : (c.reporterEmail || c.authorEmail || 'N/A'),
          c.contactPhone || 'Not Provided',
          c.createdAt ? new Date(c.createdAt).toLocaleString() : 'N/A',
          c.description
        ]);

        downloadGenericCSV(headers, rows, prefix);
        if (grievanceExportMenu) grievanceExportMenu.style.display = 'none';
      });
    });

    // 4. Export Student Wishlist CSV
    container.querySelector('#btn-export-wishlist-csv')?.addEventListener('click', () => {
      const headers = ['Idea ID', 'Idea Title', 'Category', 'Upvotes Count', 'Suggested Venue', 'Author Name', 'Department', 'Description', 'Submitted Date'];
      const rows = ideas.map(idea => [
        idea.id,
        idea.title,
        idea.category,
        idea.upvotes || 0,
        idea.suggestedVenue || 'Amphitheater',
        idea.authorName || 'Student',
        idea.department || 'All',
        idea.description,
        idea.createdAt ? new Date(idea.createdAt).toLocaleString() : 'N/A'
      ]);
      downloadGenericCSV(headers, rows, 'EventPulse_Student_Wishlist');
    });

    // 5. Export Archives CSV
    container.querySelector('#btn-export-archives-csv')?.addEventListener('click', () => {
      const headers = ['Event ID', 'Event Title', 'Department', 'Category', 'Event Date', 'Venue', 'Organizer', 'Status'];
      const rows = completedEvents.map(ce => [
        ce.id,
        ce.title,
        ce.department,
        ce.category,
        ce.date,
        ce.venue,
        ce.organizerName || 'Coordinator',
        'COMPLETED'
      ]);
      downloadGenericCSV(headers, rows, 'EventPulse_Completed_Archives_Master');
    });

    // View Student Activity Dossier & Governance Modal
    // Remove User from Directory
    container.querySelectorAll('.btn-remove-user').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.currentTarget.getAttribute('data-uid');
        const email = e.currentTarget.getAttribute('data-email');
        const name = e.currentTarget.getAttribute('data-name');
        if (!confirm(`⚠️ Are you sure you want to permanently remove "${name}" (${email}) from the Student Directory?\n\nThis will delete their profile from the platform.`)) return;

        btn.disabled = true;
        btn.textContent = '⏳';
        try {
          await deleteDirectoryUser(uid, email);
          // Remove from in-memory list
          usersList = usersList.filter(u => u.uid !== uid && (u.email || '').toLowerCase() !== (email || '').toLowerCase());
          render();
        } catch (err) {
          console.error('Failed to remove user:', err);
          alert('Failed to remove user. Please try again.');
          btn.disabled = false;
          btn.textContent = '🗑️';
        }
      });
    });

    container.querySelectorAll('.btn-view-user-activity').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const uid = e.currentTarget.getAttribute('data-uid');
        const email = e.currentTarget.getAttribute('data-email');
        let targetStudent = usersList.find(u => u.uid === uid || u.email === email);
        if (!targetStudent) return;

        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.zIndex = '9999';

        modal.innerHTML = `
          <div class="modal-container" style="max-width: 680px; width: 92%; max-height: 88vh; display: flex; flex-direction: column; padding: 1.75rem; overflow: hidden;">
            <!-- Modal Header -->
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;">
              <div style="display: flex; gap: 1rem; align-items: center;">
                <div style="width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #a855f7); color: #fff; font-size: 1.35rem; font-weight: 800; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(124, 58, 237, 0.3);">
                  ${(targetStudent.name || 'S')[0].toUpperCase()}
                </div>
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <h3 style="font-size: 1.3rem; font-weight: 800; color: var(--text-primary); margin: 0;">
                      ${targetStudent.name || 'Student Profile'}
                    </h3>
                    <span id="activity-modal-status-badge" style="font-size: 0.675rem; font-weight: 800; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); background: ${targetStudent.status === 'banned' ? '#fee2e2' : '#ecfdf5'}; color: ${targetStudent.status === 'banned' ? '#dc2626' : '#059669'}; border: 1px solid ${targetStudent.status === 'banned' ? '#fca5a5' : '#a7f3d0'};">
                      ${targetStudent.status === 'banned' ? '🚫 BANNED' : '● ACTIVE'}
                    </span>
                    <span id="activity-modal-role-badge" style="font-size: 0.675rem; font-weight: 800; text-transform: uppercase; padding: 0.15rem 0.5rem; border-radius: var(--radius-full); background: ${targetStudent.role === 'admin' ? '#fef2f2' : targetStudent.role === 'organizer' ? '#ede9fe' : '#f1f5f9'}; color: ${targetStudent.role === 'admin' ? '#dc2626' : targetStudent.role === 'organizer' ? '#7c3aed' : '#475569'};">
                      ${targetStudent.role || 'student'}
                    </span>
                  </div>
                  <div style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.2rem;">
                    <strong>Email:</strong> ${targetStudent.email} &nbsp;|&nbsp; <strong>PRN:</strong> ${targetStudent.prn ? targetStudent.prn : 'Not Set'} &nbsp;|&nbsp; <strong>Dept:</strong> ${targetStudent.department || 'General'}
                  </div>
                </div>
              </div>
              <button id="btn-close-activity-modal" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-tertiary);">✕</button>
            </div>

            <!-- Action Control Bar -->
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.75rem 1rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.25rem;">
              <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
                📊 Official Student Activity Dossier
              </div>
              <button id="btn-modal-export-csv" class="btn btn-secondary btn-sm" style="font-size: 0.75rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                📥 Export Dossier (CSV)
              </button>
            </div>

            <!-- Scrollable Content Body -->
            <div style="overflow-y: auto; flex: 1; display: flex; flex-direction: column; gap: 1rem; padding-right: 0.3rem;">
              <!-- Loading Indicator -->
              <div id="activity-loading-spinner" style="text-align: center; padding: 2rem; color: var(--text-tertiary); font-size: 0.875rem;">
                ⏳ Loading registered events and campus activity...
              </div>

              <!-- Activity Details Mount -->
              <div id="activity-content-mount" style="display: none; flex-direction: column; gap: 1.25rem;">
              </div>
            </div>
          </div>
        `;

        document.body.appendChild(modal);
        const close = () => modal.remove();
        modal.querySelector('#btn-close-activity-modal')?.addEventListener('click', close);
        modal.addEventListener('click', (ev) => { if (ev.target === modal) close(); });

        // Fetch user activity asynchronously
        let studentRegs = [];
        try {
          studentRegs = await getStudentRegistrations(targetStudent.uid || targetStudent.email);
        } catch (err) {}

        const studentComplaints = complaints.filter(c => (c.submittedBy || '').toLowerCase() === (targetStudent.email || '').toLowerCase() || c.userId === targetStudent.uid);
        const studentIdeas = ideas.filter(i => (i.submittedBy || '').toLowerCase() === (targetStudent.email || '').toLowerCase() || i.authorId === targetStudent.uid);

        // Hide Spinner and Render Content
        const spinner = modal.querySelector('#activity-loading-spinner');
        const mount = modal.querySelector('#activity-content-mount');
        if (spinner) spinner.style.display = 'none';
        if (mount) {
          mount.style.display = 'flex';

          const attendedCount = studentRegs.filter(r => r.attended || r.attendanceStatus === 'attended').length;
          const regCount = studentRegs.length;
          const attendanceRate = regCount > 0 ? Math.round((attendedCount / regCount) * 100) : 0;

          mount.innerHTML = `
            <!-- Analytics Stat Pills -->
            <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem;">
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: #4f46e5;">${regCount}</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase;">Events Registered</div>
              </div>
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: #059669;">${attendedCount}</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase;">Events Attended</div>
              </div>
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem; text-align: center;">
                <div style="font-size: 1.4rem; font-weight: 800; color: #7c3aed;">${attendanceRate}%</div>
                <div style="font-size: 0.75rem; font-weight: 600; color: var(--text-tertiary); text-transform: uppercase;">Attendance Rate</div>
              </div>
            </div>

            <!-- Event Registrations Timeline -->
            <div>
              <h4 style="font-size: 0.95rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.6rem; display: flex; align-items: center; justify-content: space-between;">
                <span>🎟️ Registered Campus Events (${regCount})</span>
              </h4>

              ${studentRegs.length === 0 ? `
                <div style="text-align: center; padding: 1.5rem; background: #f8fafc; border: 1px dashed var(--border-strong); border-radius: var(--radius-md); color: var(--text-tertiary); font-size: 0.85rem;">
                  No event registrations found for this student yet.
                </div>
              ` : `
                <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 220px; overflow-y: auto;">
                  ${studentRegs.map(r => `
                    <div style="padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); background: #ffffff; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                      <div>
                        <div style="font-weight: 700; font-size: 0.875rem; color: var(--text-primary);">${r.eventTitle || 'Campus Event'}</div>
                        <div style="font-size: 0.75rem; color: var(--text-tertiary); margin-top: 0.15rem;">
                          Pass ID: <code>${r.id || r.ticketId || 'EP-PASS'}</code> &nbsp;•&nbsp; ${r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : 'Recent'}
                        </div>
                      </div>
                      <div>
                        ${r.attended || r.attendanceStatus === 'attended' ? `
                          <span style="font-size: 0.725rem; font-weight: 800; background: #ecfdf5; color: #059669; padding: 0.2rem 0.5rem; border-radius: 4px; border: 1px solid #a7f3d0;">
                            ✅ Attended
                          </span>
                        ` : `
                          <span style="font-size: 0.725rem; font-weight: 700; background: #f1f5f9; color: #475569; padding: 0.2rem 0.5rem; border-radius: 4px;">
                            ⏳ Registered
                          </span>
                        `}
                      </div>
                    </div>
                  `).join('')}
                </div>
              `}
            </div>

            <!-- Campus Contributions (Ideas & Grievances) -->
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
              <!-- Submitted Ideas -->
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
                <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
                  💡 Wishlist Ideas (${studentIdeas.length})
                </div>
                ${studentIdeas.length === 0 ? `
                  <div style="font-size: 0.775rem; color: var(--text-tertiary);">No wishlist ideas submitted.</div>
                ` : studentIdeas.slice(0, 3).map(i => `
                  <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem;">
                    • ${i.title} <span style="color: var(--text-tertiary); font-size: 0.7rem;">(${i.upvotes || 0} 👍)</span>
                  </div>
                `).join('')}
              </div>

              <!-- Grievances -->
              <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 0.85rem;">
                <div style="font-size: 0.85rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.5rem;">
                  📢 Grievances (${studentComplaints.length})
                </div>
                ${studentComplaints.length === 0 ? `
                  <div style="font-size: 0.775rem; color: var(--text-tertiary);">No grievances filed.</div>
                ` : studentComplaints.slice(0, 3).map(c => `
                  <div style="font-size: 0.8rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 0.3rem;">
                    • ${c.category || 'General'}: <span style="font-size: 0.725rem; color: ${c.status === 'resolved' ? '#059669' : '#f59e0b'}; font-weight: 700;">${c.status}</span>
                  </div>
                `).join('')}
              </div>
            </div>
          `;
        }

        // Action: Export Student Dossier CSV
        modal.querySelector('#btn-modal-export-csv')?.addEventListener('click', () => {
          const rows = [
            ['EventPulse Student Activity Dossier'],
            ['Generated At', new Date().toLocaleString()],
            [''],
            ['STUDENT PROFILE INFORMATION'],
            ['Student Name', targetStudent.name || 'N/A'],
            ['PRN / Roll No', targetStudent.prn || 'Not Set'],
            ['Email Address', targetStudent.email || 'N/A'],
            ['Department', targetStudent.department || 'N/A'],
            ['Year / Division', `${targetStudent.year || 'N/A'} - ${targetStudent.division || 'A'}`],
            ['Current Role', targetStudent.role || 'student'],
            [''],
            ['EVENT REGISTRATION & ATTENDANCE HISTORY'],
            ['Event Title', 'Category', 'Registration Date', 'Ticket ID', 'Attendance Status']
          ];

          if (studentRegs.length > 0) {
            studentRegs.forEach(r => {
              rows.push([
                r.eventTitle || 'Campus Event',
                r.category || 'General',
                r.registeredAt ? new Date(r.registeredAt).toLocaleDateString() : 'N/A',
                r.id || r.ticketId || 'EP-PASS',
                r.attended || r.attendanceStatus === 'attended' ? 'Attended' : 'Registered / Absent'
              ]);
            });
          } else {
            rows.push(['No event registrations found', '', '', '', '']);
          }

          const csvContent = 'data:text/csv;charset=utf-8,' + rows.map(e => e.map(val => `"${String(val).replace(/"/g, '""')}"`).join(',')).join('\n');
          const encodedUri = encodeURI(csvContent);
          const link = document.createElement('a');
          link.setAttribute('href', encodedUri);
          link.setAttribute('download', `Student_Dossier_${(targetStudent.name || 'student').replace(/\s+/g, '_')}_${targetStudent.prn || 'Record'}.csv`);
          document.body.appendChild(link);
          link.click();
          link.remove();
        });
      });
    });

    // Resolve complaint
    container.querySelectorAll('.btn-resolve-complaint').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await updateComplaintStatus(id, 'resolved', 'Resolved by University Administration', user);
        complaints = await getAllComplaints();
        render();
      });
    });

    // Reopen complaint
    container.querySelectorAll('.btn-reopen-complaint').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        await updateComplaintStatus(id, 'pending', 'Reopened for further investigation', user);
        complaints = await getAllComplaints();
        render();
      });
    });

    // Delete / Dismiss complaint
    container.querySelectorAll('.btn-delete-complaint').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.getAttribute('data-id');
        if (confirm(`Are you sure you want to permanently delete and dismiss grievance report ${id}?`)) {
          await deleteComplaint(id, user);
          complaints = await getAllComplaints();
          render();
        }
      });
    });

    // Grievance Search & Filters
    const complaintSearch = container.querySelector('#input-search-complaints');
    if (complaintSearch) {
      complaintSearch.addEventListener('input', (e) => {
        complaintSearchQuery = e.target.value;
        render();
        const refreshed = container.querySelector('#input-search-complaints');
        if (refreshed) {
          refreshed.focus();
          refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
        }
      });
    }

    container.querySelectorAll('.btn-quick-complaint-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        complaintStatusFilter = e.currentTarget.getAttribute('data-status');
        render();
      });
    });

    container.querySelector('#select-filter-complaint-status')?.addEventListener('change', (e) => {
      complaintStatusFilter = e.target.value;
      render();
    });

    container.querySelector('#select-filter-complaint-cat')?.addEventListener('change', (e) => {
      complaintCategoryFilter = e.target.value;
      render();
    });

    // Sync Live Grievances Button
    container.querySelector('#btn-sync-live-grievances')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Syncing...';
      complaints = await getAllComplaints();
      render();
    });

    // Admin Header Live Sync All Data
    container.querySelector('#btn-admin-sync-all')?.addEventListener('click', async (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = 'Syncing...';
      const [pe, ae, an, us, cp, id] = await Promise.all([
        getPendingEvents(),
        getApprovedEvents(),
        getAnnouncements(),
        getAllUsers(),
        getAllComplaints(),
        getCampusIdeas()
      ]);
      if (pe) pendingEvents = pe;
      if (ae) approvedEvents = ae;
      if (an) announcements = an;
      if (us) usersList = us;
      if (cp) complaints = cp;
      if (id) ideas = id;
      render();
    });

    // =========================================================================
    // WISHLIST TAB HANDLERS
    // =========================================================================
    
    // Wishlist Segmented Filter Badges
    container.querySelectorAll('.btn-quick-wishlist-badge').forEach(badge => {
      badge.addEventListener('click', (e) => {
        wishlistTypeFilter = e.currentTarget.getAttribute('data-type');
        render();
      });
    });

    // Wishlist Search Input
    const wishlistSearch = container.querySelector('#input-search-wishlist');
    if (wishlistSearch) {
      wishlistSearch.addEventListener('input', (e) => {
        wishlistSearchQuery = e.target.value;
        render();
        const refreshed = container.querySelector('#input-search-wishlist');
        if (refreshed) {
          refreshed.focus();
          refreshed.setSelectionRange(refreshed.value.length, refreshed.value.length);
        }
      });
    }

    // Wishlist Export Dropdown Toggle
    const btnToggleExportWishlist = container.querySelector('#btn-toggle-export-wishlist');
    const menuExportWishlist = container.querySelector('#menu-export-wishlist');
    if (btnToggleExportWishlist && menuExportWishlist) {
      btnToggleExportWishlist.addEventListener('click', (e) => {
        e.stopPropagation();
        menuExportWishlist.style.display = menuExportWishlist.style.display === 'block' ? 'none' : 'block';
      });
      document.addEventListener('click', () => {
        if (menuExportWishlist) menuExportWishlist.style.display = 'none';
      });
    }

    // Wishlist CSV Exporter Function
    const exportWishlistCSV = (typeFilter = 'all') => {
      let exportList = [...ideas];
      if (typeFilter === 'new_event') {
        exportList = exportList.filter(i => i.type !== 'improvement');
      } else if (typeFilter === 'improvement') {
        exportList = exportList.filter(i => i.type === 'improvement');
      }

      if (exportList.length === 0) {
        alert('No ideas found to export in this category.');
        return;
      }

      const headers = ['ID', 'Type', 'Title', 'Category', 'Description', 'Author Name', 'Department', 'Year', 'Suggested Venue', 'Suggested Guest/Artist', 'Upvotes', 'Created At'];
      const rows = exportList.map(i => [
        i.id,
        i.type === 'improvement' ? 'Campus/Event Improvement' : 'New Event Suggestion',
        `"${(i.title || '').replace(/"/g, '""')}"`,
        `"${(i.category || '').replace(/"/g, '""')}"`,
        `"${(i.description || '').replace(/"/g, '""')}"`,
        `"${(i.authorName || '').replace(/"/g, '""')}"`,
        `"${(i.department || '').replace(/"/g, '""')}"`,
        `"${(i.year || '').replace(/"/g, '""')}"`,
        `"${(i.suggestedVenue || '').replace(/"/g, '""')}"`,
        `"${(i.suggestedGuest || '').replace(/"/g, '""')}"`,
        i.upvotes || 0,
        i.createdAt || ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const typeLabel = typeFilter === 'new_event' ? 'New_Event_Suggestions' : (typeFilter === 'improvement' ? 'Campus_Improvements' : 'All_Student_Wishes');
      link.setAttribute('download', `EventPulse_${typeLabel}_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    };

    container.querySelector('#btn-export-wishlist-all')?.addEventListener('click', () => exportWishlistCSV('all'));
    container.querySelector('#btn-export-wishlist-new')?.addEventListener('click', () => exportWishlistCSV('new_event'));
    container.querySelector('#btn-export-wishlist-imp')?.addEventListener('click', () => exportWishlistCSV('improvement'));

    // Wishlist convert to event
    container.querySelectorAll('.btn-convert-wish').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const title = decodeURIComponent(e.target.getAttribute('data-title'));
        const desc = decodeURIComponent(e.target.getAttribute('data-desc'));
        activeTab = 'create_event';
        render();
        setTimeout(() => {
          const tInput = container.querySelector('#admin-event-title');
          const dInput = container.querySelector('#admin-event-desc');
          if (tInput) tInput.value = title;
          if (dInput) dInput.value = desc;
        }, 100);
      });
    });

    // Wishlist Delete / Dismiss Idea
    container.querySelectorAll('.btn-delete-wishlist-idea').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.currentTarget.getAttribute('data-id');
        if (confirm(`Are you sure you want to permanently delete and dismiss this wishlist submission?`)) {
          await deleteIdea(id);
          ideas = await getCampusIdeas();
          render();
        }
      });
    });

    // AI Auto-Draft for Admin Event
    container.querySelector('#btn-admin-ai-draft')?.addEventListener('click', async () => {
      const title = container.querySelector('#admin-event-title').value;
      const cat = container.querySelector('#admin-event-cat').value;
      const dept = container.querySelector('#admin-event-dept').value;
      const descArea = container.querySelector('#admin-event-desc');

      if (!title) {
        alert('Please enter an Event Title first to generate rules & overview.');
        return;
      }

      descArea.value = '⚡ NEX AI is drafting event structure...';
      const aiText = await generateEventDescriptionAI(title, cat, dept);
      descArea.value = aiText;
    });

    // Admin Direct Event Submit
    container.querySelector('#form-admin-create-event')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = container.querySelector('#btn-submit-admin-event');
      btn.disabled = true;
      btn.textContent = 'Publishing Event...';

      try {
        const title = container.querySelector('#admin-event-title').value;
        const category = container.querySelector('#admin-event-cat').value;
        const department = container.querySelector('#admin-event-dept').value;
        const date = container.querySelector('#admin-event-date').value;
        const time = container.querySelector('#admin-event-time').value;
        const venue = container.querySelector('#admin-event-venue').value;
        const externalLink = (container.querySelector('#admin-event-link')?.value || '').trim();
        const description = container.querySelector('#admin-event-desc').value;
        const capacity = parseInt(container.querySelector('#admin-event-capacity').value) || 250;

        const res = await createEvent({
          title,
          category,
          department,
          date,
          time,
          venue,
          externalLink,
          description,
          capacity,
          status: 'approved', // Direct publish
          organizerId: user.uid,
          organizerName: (user.name || user.displayName || 'Admin') + ' (Admin)'
        }, user);

        if (res && res.success) {
          alert('🎉 Event Published Directly! It is now live on the student portal.');
          approvedEvents = await getApprovedEvents();
          activeTab = 'queue';
          render();
        } else {
          alert('Failed to publish: ' + (res?.error || 'Unknown error'));
        }
      } catch (err) {
        console.error('Publish error:', err);
        alert('Error publishing event: ' + err.message);
      } finally {
        if (btn) {
          btn.disabled = false;
          btn.textContent = '🚀 Publish Directly to Student Portal';
        }
      }
    });

    // Inspect Historical Archive Modal
    container.querySelectorAll('.btn-admin-inspect-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = completedEvents.find(ev => ev.id === evId);
        if (!targetEvent) return;

        btn.disabled = true;
        btn.textContent = 'Loading...';
        const regs = await getEventRegistrations(evId);
        btn.disabled = false;
        btn.textContent = '🔍 Inspect Dossier';

        openCompletedEventModal(targetEvent, regs);
      });
    });

    // Single Archive Event Export CSV
    container.querySelectorAll('.btn-admin-export-archive').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = completedEvents.find(ev => ev.id === evId);
        if (!targetEvent) return;

        const regs = await getEventRegistrations(evId);
        let csv = `Event Title,${targetEvent.title}\n`;
        csv += `Department,${targetEvent.department}\n`;
        csv += `Date,${targetEvent.date} (${targetEvent.time})\n`;
        csv += `Venue,${targetEvent.venue}\n`;
        csv += `Status,Completed Archive\n\n`;

        csv += `Student Name,PRN,Department,Year,Registration Status,Attendance,Certificate ID,Registered At\n`;
        regs.forEach(r => {
          csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'N/A'}","${r.year || '1st Year'}","${r.status}","${r.attendance || (r.status === 'attended' ? 'present' : 'pending')}","${r.certificateId || 'N/A'}","${r.registeredAt}"\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${targetEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Completed_Event_Report.csv`;
        a.click();
        URL.revokeObjectURL(url);
      });
    });

    // Admin Reopen Event
    container.querySelectorAll('.btn-admin-reopen').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const evId = e.currentTarget.getAttribute('data-event-id');
        if (confirm('Reopen this event back to Active Approved events?')) {
          await reopenEvent(evId, user);
          const all = await getAllEvents();
          approvedEvents = all.filter(ev => ev.status === 'approved');
          completedEvents = all.filter(ev => ev.status === 'completed');
          render();
        }
      });
    });

    // Export Master CSV Report
    container.querySelector('#btn-admin-export-csv')?.addEventListener('click', () => {
      let csv = 'Type,ID/Title,Category/Department,Date/Timestamp,Status\n';
      approvedEvents.forEach(e => {
        csv += `Event,"${e.title}","${e.department}","${e.date}","${e.status}"\n`;
      });
      completedEvents.forEach(e => {
        csv += `Archived Event,"${e.title}","${e.department}","${e.date}","${e.status}"\n`;
      });
      usersList.forEach(u => {
        csv += `User,"${u.name}","${u.department || 'N/A'}","${u.prn || 'N/A'}","${u.role || 'student'}"\n`;
      });
      complaints.forEach(c => {
        csv += `Grievance,"${c.ticketId || c.id}","${c.category}","${c.createdAt}","${c.status}"\n`;
      });

      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `EventPulse_Master_Report_${new Date().toISOString().slice(0,10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    });

    // Open Announcement Broadcast Modal
    const openBroadcastModal = () => {
      const existing = document.getElementById('admin-broadcast-modal');
      if (existing) existing.remove();

      const modal = document.createElement('div');
      modal.id = 'admin-broadcast-modal';
      modal.className = 'modal-overlay';
      modal.style.zIndex = '9999';

      modal.innerHTML = `
        <div class="modal-container" style="max-width: 500px; padding: 1.75rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
            <div>
              <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">
                📢 Post Campus Notice
              </div>
              <div style="font-size: 0.83rem; color: var(--text-secondary); margin-top: 0.2rem;">
                Broadcast an official announcement to all students.
              </div>
            </div>
            <button id="btn-close-notice-modal" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-tertiary);">✕</button>
          </div>

          <form id="form-broadcast-notice">
            <div style="display: flex; flex-direction: column; gap: 0.95rem;">
              <div>
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Notice Title *</label>
                <input type="text" id="notice-title" class="form-control" placeholder="e.g. Hackathon Registration Deadline Extended!" required />
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Priority Badge *</label>
                  <select id="notice-priority" class="form-control" required>
                    <option value="📢 Campus Notice">📢 Campus Notice</option>
                    <option value="🚨 Emergency Alert">🚨 Emergency Alert</option>
                    <option value="🏆 Fest Alert">🏆 Fest Alert</option>
                    <option value="⚠️ Schedule Change">⚠️ Schedule Change</option>
                  </select>
                </div>
                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Target Department</label>
                  <input type="text" id="notice-dept" class="form-control" value="All Departments" />
                </div>
              </div>

              <div>
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Notice Message *</label>
                <textarea id="notice-msg" class="form-control" rows="3" placeholder="Enter the official details of the circular or announcement..." required></textarea>
              </div>

              <div>
                <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">📎 Attach Official Document / Photo (Optional)</label>
                <input type="file" id="notice-file" class="form-control" accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" style="padding: 0.4rem; font-size: 0.85rem;" />
                <div style="font-size: 0.725rem; color: var(--text-tertiary); margin-top: 0.25rem;">
                  Attach PDF notice circular, official flyer image, or document.
                </div>
              </div>

              <button type="submit" id="btn-submit-notice" class="btn btn-primary" style="margin-top: 0.5rem; justify-content: center; font-weight: 800;">
                📢 Broadcast to All Students
              </button>
            </div>
          </form>
        </div>
      `;

      document.body.appendChild(modal);

      const close = () => modal.remove();
      modal.querySelector('#btn-close-notice-modal')?.addEventListener('click', close);
      modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

      modal.querySelector('#form-broadcast-notice')?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = modal.querySelector('#btn-submit-notice');
        submitBtn.disabled = true;
        submitBtn.textContent = '⚡ Broadcasting...';

        try {
          const noticeId = 'notice_' + Date.now();
          const title = modal.querySelector('#notice-title').value;
          const priority = modal.querySelector('#notice-priority').value;
          const targetDept = modal.querySelector('#notice-dept').value;
          const message = modal.querySelector('#notice-msg').value;

          // Process File Attachment if selected
          let attachment = null;
          const fileInput = modal.querySelector('#notice-file');
          if (fileInput && fileInput.files && fileInput.files[0]) {
            const file = fileInput.files[0];
            try {
              attachment = await uploadNoticeAttachment(file, noticeId);
            } catch (err) {
              console.warn('Attachment upload notice warning:', err);
            }
          }

          const res = await createAnnouncement({ id: noticeId, title, priority, targetDept, message, attachment, user });

          if (res.success) {
            alert('📢 Campus Notice broadcasted successfully!');
            close();
            announcements = await getAnnouncements();
            render();
          } else {
            alert('Failed to post: ' + (res.error || 'Unknown error'));
          }
        } catch (err) {
          alert('Notice submission error: ' + err.message);
        } finally {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '📢 Broadcast to All Students';
          }
        }
      });
    };

    container.querySelector('#btn-admin-broadcast-modal')?.addEventListener('click', openBroadcastModal);
    container.querySelector('#btn-trigger-notice-modal')?.addEventListener('click', openBroadcastModal);
  };

  // 1. Instant Synchronous First Render (0ms Blank Free)
  render();

  // 2. Background Asynchronous Refresh
  Promise.allSettled([
    getPendingEvents(),
    getApprovedEvents(),
    getAnnouncements(),
    getAllUsers(),
    getAllComplaints(),
    getCampusIdeas()
  ]).then(([pe, ae, an, us, cp, id]) => {
    if (pe.status === 'fulfilled' && pe.value) pendingEvents = pe.value;
    if (ae.status === 'fulfilled' && ae.value) approvedEvents = ae.value;
    if (an.status === 'fulfilled' && an.value) announcements = an.value;
    if (us.status === 'fulfilled' && us.value) usersList = us.value;
    if (cp.status === 'fulfilled' && cp.value) complaints = cp.value;
    if (id.status === 'fulfilled' && id.value) ideas = id.value;
    render();
  }).catch(() => {});
}
