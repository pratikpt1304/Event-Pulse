import { getApprovedEvents, getCachedEventsSync } from '../services/events';
import { getAnnouncements, getCachedAnnouncementsSync, getFileFromIndexedDB, fetchNoticeAttachmentData } from '../services/announcements';
import { getCurrentUser } from '../services/auth';
import { registerForEvent, getStudentRegistrations } from '../services/registrations';
import { isStudentAllowed } from '../services/participants';
import { createEventCardHtml } from '../components/EventCard';
import { openTeamFinderModal } from '../components/TeamFinderModal';
import { openVolunteerModal } from '../components/VolunteerModal';
import { openDocumentPreviewModal } from '../components/DocumentPreviewModal';


/**
 * Converts plain URLs in text into clickable <a> links (XSS-safe)
 */
function linkifyText(text) {
  if (!text) return '';
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
  return escaped.replace(
    /(https?:\/\/[^\s<>"']+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" style="color: #7c3aed; text-decoration: underline; font-weight: 600; word-break: break-all;">$1</a>'
  );
}

export async function renderEventsView(container, navigateTo) {

  const user = getCurrentUser();

  // Instant Cache-First Data (0ms latency load)
  let events = getCachedEventsSync() || [];
  let announcements = getCachedAnnouncementsSync() || [];
  let registrations = [];

  let searchTerm = '';
  let selectedDept = 'all';
  let selectedCategory = 'all';

  let allowedClosedEventIds = new Set();
  const isStaffOrAdmin = user && ['admin', 'organizer', 'hod', 'dean', 'vc'].includes(user.role);

  async function refreshAllowedClosedEvents(eventsList) {
    if (isStaffOrAdmin || !user || !user.email) return;
    const closedList = eventsList.filter(e => e.visibility === 'closed');
    if (closedList.length === 0) return;

    await Promise.all(
      closedList.map(async (e) => {
        try {
          const allowed = await isStudentAllowed(e.id, user.email);
          if (allowed) {
            allowedClosedEventIds.add(e.id);
          } else {
            allowedClosedEventIds.delete(e.id);
          }
        } catch (err) {
          console.warn('Error checking participant allowance:', err);
        }
      })
    );
  }

  const renderNoticeCard = (n) => {
    const isEmergency = (n.priority || '').includes('Emergency');
    const isFest = (n.priority || '').includes('Fest');
    const isSchedule = (n.priority || '').includes('Schedule');

    const badgeBg = isEmergency ? '#fef2f2' : isFest ? '#fffbeb' : isSchedule ? '#f0f9ff' : '#eff6ff';
    const badgeColor = isEmergency ? '#dc2626' : isFest ? '#b45309' : isSchedule ? '#0284c7' : '#2563eb';
    const badgeBorder = isEmergency ? '#fca5a5' : isFest ? '#fde68a' : isSchedule ? '#bae6fd' : '#bfdbfe';
    const cardBorder = isEmergency ? 'rgba(239, 68, 68, 0.4)' : 'var(--border-subtle)';

    // Truncate message preview to 2 lines
    const previewMsg = (n.message || '').length > 120 ? n.message.slice(0, 120) + '...' : n.message;

    return `
      <div class="notice-card-clickable card" data-notice-id="${n.id}" style="margin-bottom: 1rem; background: #ffffff; border: 1.5px solid ${cardBorder}; padding: 1.25rem; box-shadow: 0 4px 14px rgba(0,0,0,0.04); border-radius: var(--radius-md); cursor: pointer; transition: box-shadow 0.2s, transform 0.15s;" onmouseover="this.style.boxShadow='0 8px 24px rgba(124,58,237,0.13)';this.style.transform='translateY(-2px)'" onmouseout="this.style.boxShadow='0 4px 14px rgba(0,0,0,0.04)';this.style.transform='translateY(0)'">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <span style="font-size: 0.75rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 0.2rem 0.65rem; border-radius: var(--radius-full); border: 1px solid ${badgeBorder};">
              ${n.priority || '📢 Campus Notice'}
            </span>
            <span style="font-size: 0.75rem; color: var(--text-tertiary);">
              ${n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Recent Broadcast'}
            </span>
          </div>
          <span style="font-size: 0.75rem; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: var(--radius-sm); font-weight: 600;">
            Target: <strong>${n.targetDept || 'All Students'}</strong>
          </span>
        </div>

        <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.3rem; line-height: 1.35;">
          ${n.title}
        </h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.5rem; white-space: pre-line;">
          ${linkifyText(previewMsg)}
        </p>

        <div style="font-size: 0.75rem; color: var(--primary); font-weight: 700; display: flex; align-items: center; gap: 0.3rem;">
          ${(n.message || '').length > 120 || n.attachment ? '👆 Tap to read full notice →' : ''}
          ${n.attachment ? '<span style="background:#f3e8ff;color:#7c3aed;padding:0.15rem 0.5rem;border-radius:999px;font-size:0.7rem;margin-left:0.3rem;">📎 Has Attachment</span>' : ''}
        </div>

        <div style="font-size: 0.75rem; color: var(--text-tertiary); display: flex; justify-content: space-between; align-items: center; border-top: 1px dashed var(--border-subtle); padding-top: 0.5rem; margin-top: 0.5rem;">
          <span>Broadcasted by <strong>${n.postedBy || 'Central Administration'}</strong></span>
        </div>
      </div>
    `;
  };

  // Opens a full notice detail modal
  const openNoticeModal = (n) => {
    const isEmergency = (n.priority || '').includes('Emergency');
    const isFest = (n.priority || '').includes('Fest');
    const isSchedule = (n.priority || '').includes('Schedule');
    const badgeBg = isEmergency ? '#fef2f2' : isFest ? '#fffbeb' : isSchedule ? '#f0f9ff' : '#eff6ff';
    const badgeColor = isEmergency ? '#dc2626' : isFest ? '#b45309' : isSchedule ? '#0284c7' : '#2563eb';
    const badgeBorder = isEmergency ? '#fca5a5' : isFest ? '#fde68a' : isSchedule ? '#bae6fd' : '#bfdbfe';

    // Remove any existing notice modal
    document.getElementById('notice-detail-modal')?.remove();

    const modal = document.createElement('div');
    modal.id = 'notice-detail-modal';
    modal.style.cssText = `
      position: fixed; inset: 0; z-index: 9999;
      background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center;
      padding: 1rem; animation: fadeIn 0.2s ease;
    `;

    modal.innerHTML = `
      <div style="background: #ffffff; border-radius: 18px; max-width: 640px; width: 100%; max-height: 85vh; overflow-y: auto; box-shadow: 0 24px 60px rgba(0,0,0,0.22); animation: slideUp 0.25s cubic-bezier(0.16,1,0.3,1);">
        <!-- Header -->
        <div style="padding: 1.25rem 1.5rem 1rem; border-bottom: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; position: sticky; top: 0; background: #fff; border-radius: 18px 18px 0 0; z-index: 1;">
          <div style="flex: 1;">
            <span style="font-size: 0.72rem; font-weight: 800; background: ${badgeBg}; color: ${badgeColor}; padding: 0.2rem 0.65rem; border-radius: 999px; border: 1px solid ${badgeBorder}; display: inline-block; margin-bottom: 0.5rem;">
              ${n.priority || '📢 Campus Notice'}
            </span>
            <h2 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; line-height: 1.35; margin: 0;">${n.title}</h2>
          </div>
          <button id="btn-close-notice-modal" style="background: #f1f5f9; border: none; border-radius: 50%; width: 34px; height: 34px; font-size: 1.1rem; cursor: pointer; flex-shrink: 0; display: flex; align-items: center; justify-content: center; color: #64748b;" title="Close">✕</button>
        </div>

        <!-- Body -->
        <div style="padding: 1.25rem 1.5rem;">
          <div style="display: flex; gap: 1rem; font-size: 0.78rem; color: #64748b; margin-bottom: 1rem; flex-wrap: wrap;">
            <span>🕐 ${n.createdAt ? new Date(n.createdAt).toLocaleString() : 'Recent'}</span>
            <span>🎯 Target: <strong>${n.targetDept || 'All Students'}</strong></span>
            <span>📌 By: <strong>${n.postedBy || 'Central Administration'}</strong></span>
          </div>

          <div style="font-size: 0.95rem; color: #334155; line-height: 1.7; white-space: pre-line; background: #f8fafc; border-radius: 10px; padding: 1rem 1.1rem; border: 1px solid #e2e8f0;">
            ${linkifyText(n.message)}
          </div>

          ${n.link ? `
            <a href="${n.link}" target="_blank" rel="noopener noreferrer" style="display: inline-flex; align-items: center; gap: 0.4rem; margin-top: 1rem; color: #7c3aed; font-weight: 700; font-size: 0.875rem; text-decoration: none; background: #f3e8ff; padding: 0.5rem 1rem; border-radius: 8px; border: 1px solid #d8b4fe;">
              🔗 Open Link →
            </a>
          ` : ''}

          ${n.attachment ? `
            <div style="margin-top: 1rem; padding: 0.85rem 1rem; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px;">
              ${(n.attachment.type && n.attachment.type.startsWith('image/')) ? `
                <img src="${n.attachment.dataUrl}" alt="${n.attachment.name || 'Attachment'}" onerror="this.style.display='none';" style="width:100%;border-radius:8px;margin-bottom:0.75rem;max-height:300px;object-fit:contain;" />
              ` : ''}
              <div style="display:flex;align-items:center;justify-content:space-between;gap:0.5rem;flex-wrap:wrap;">
                <div style="display:flex;align-items:center;gap:0.5rem;">
                  <span style="font-size:1.4rem;">${(n.attachment.type && n.attachment.type.includes('pdf')) ? '📄' : '📎'}</span>
                  <div>
                    <div style="font-size:0.85rem;font-weight:800;color:#0f172a;">${n.attachment.name || 'Notice Attachment'}</div>
                    <div style="font-size:0.7rem;color:#64748b;">${n.attachment.size ? (n.attachment.size/1024).toFixed(1)+' KB' : 'Document'}</div>
                  </div>
                </div>
                <button class="btn-download-notice-file" data-notice-id="${n.id}" data-name="${n.attachment.name || 'Campus_Notice'}" style="background:linear-gradient(135deg,#7c3aed,#4f46e5);color:#fff;border:none;border-radius:8px;padding:0.45rem 1rem;font-size:0.8rem;font-weight:800;cursor:pointer;">
                  👁️ View Document
                </button>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    // Close on backdrop click
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
    modal.querySelector('#btn-close-notice-modal')?.addEventListener('click', () => modal.remove());

    // Attachment preview inside modal
    modal.querySelectorAll('.btn-download-notice-file').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const noticeId = btn.getAttribute('data-notice-id');
        const fileName = btn.getAttribute('data-name');
        const origHtml = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = '⏳ Loading Preview...';

        const noticeObj = announcements.find(x => x.id === noticeId);
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
          } else if (!fileDataUrl && attachmentMeta && attachmentMeta.dataUrl) {
            fileDataUrl = attachmentMeta.dataUrl;
          }

          btn.disabled = false;
          btn.innerHTML = origHtml;

          if (fileDataUrl) {
            openDocumentPreviewModal({
              title: noticeObj ? noticeObj.title : 'Notice Document',
              fileName: fileName || (attachmentMeta ? attachmentMeta.name : 'Notice_Document.pdf'),
              dataUrl: fileDataUrl,
              mimeType: attachmentMeta ? attachmentMeta.type : 'application/pdf'
            });
          } else {
            alert('Notice document is not available for preview.');
          }
        } catch (err) {
          btn.disabled = false;
          btn.innerHTML = origHtml;
          alert('Failed to preview document: ' + err.message);
        }
      });
    });
  };



  // 1. Render Outer Static Shell ONCE
  container.innerHTML = `
    <div>
      ${user && ['hod', 'dean', 'vc'].includes(user.role) ? `
        <div style="background: linear-gradient(135deg, #1e1b4b 0%, #0f172a 60%, #1e293b 100%); border: 1.5px solid #3b82f6; border-radius: 16px; padding: 1.1rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(59, 130, 246, 0.25);">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(59, 130, 246, 0.2); border: 1px solid rgba(59, 130, 246, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
              🏛️
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: #2563eb; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 0.15rem 0.6rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.04em;">
                  ${user.role.toUpperCase()} Academic Oversight
                </span>
                <span style="font-size: 0.8rem; color: #94a3b8; font-weight: 600;">
                  Dept: ${user.department || 'Academic Affairs'}
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #e2e8f0; margin-top: 0.25rem; font-weight: 500;">
                You are currently in student event preview mode. Switch to your Executive Academic Portal to endorse proposals, audit attendance, and export NAAC reports:
              </div>
            </div>
          </div>
          <button id="btn-quick-to-executive" style="background: linear-gradient(135deg, #3b82f6, #2563eb); color: #fff; border: none; padding: 0.65rem 1.3rem; border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 14px rgba(37, 99, 235, 0.4); transition: transform 0.15s; white-space: nowrap;">
            <span>Open Executive Hub</span> <span>→</span>
          </button>
        </div>
      ` : user && user.role === 'organizer' ? `
        <div style="background: linear-gradient(135deg, #2e1065 0%, #0f172a 60%, #1e1b4b 100%); border: 1.5px solid #8b5cf6; border-radius: 16px; padding: 1.1rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(139, 92, 246, 0.25);">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(139, 92, 246, 0.2); border: 1px solid rgba(139, 92, 246, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
              ⚡
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: #7c3aed; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 0.15rem 0.6rem; border-radius: 999px; text-transform: uppercase;">
                  Organizer Workspace
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #e2e8f0; margin-top: 0.25rem;">
                Manage event creation, closed participant rosters, and live QR gate check-ins:
              </div>
            </div>
          </div>
          <button id="btn-quick-to-organizer" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed); color: #fff; border: none; padding: 0.65rem 1.3rem; border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 14px rgba(124, 58, 237, 0.4); transition: transform 0.15s; white-space: nowrap;">
            <span>Open Organizer Hub</span> <span>→</span>
          </button>
        </div>
      ` : user && user.role === 'admin' ? `
        <div style="background: linear-gradient(135deg, #450a0a 0%, #0f172a 60%, #1e1b4b 100%); border: 1.5px solid #ef4444; border-radius: 16px; padding: 1.1rem 1.4rem; margin-bottom: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem; color: #ffffff; box-shadow: 0 10px 25px -5px rgba(239, 68, 68, 0.25);">
          <div style="display: flex; align-items: center; gap: 0.85rem;">
            <div style="width: 44px; height: 44px; border-radius: 12px; background: rgba(239, 68, 68, 0.2); border: 1px solid rgba(239, 68, 68, 0.4); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; flex-shrink: 0;">
              🛡️
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                <span style="background: #dc2626; color: #fff; font-size: 0.72rem; font-weight: 800; padding: 0.15rem 0.6rem; border-radius: 999px; text-transform: uppercase;">
                  Central Administrator
                </span>
              </div>
              <div style="font-size: 0.85rem; color: #e2e8f0; margin-top: 0.25rem;">
                Access user roles, staff invites, event approvals, and institutional audit trails:
              </div>
            </div>
          </div>
          <button id="btn-quick-to-admin" style="background: linear-gradient(135deg, #ef4444, #dc2626); color: #fff; border: none; padding: 0.65rem 1.3rem; border-radius: 10px; font-weight: 700; font-size: 0.875rem; cursor: pointer; display: flex; align-items: center; gap: 0.45rem; box-shadow: 0 4px 14px rgba(220, 38, 38, 0.4); transition: transform 0.15s; white-space: nowrap;">
            <span>Open Admin Console</span> <span>→</span>
          </button>
        </div>
      ` : ''}

      <!-- Hero Banner Header -->
      <div class="hero-banner">
        <h1 style="margin-bottom: 0.5rem; font-size: 2.25rem;">Event<span style="opacity: 0.95;">Pulse</span></h1>
        <p style="max-width: 620px; font-size: 1rem; line-height: 1.6; opacity: 0.95;">
          Discover upcoming hackathons, tech symposiums, sports tournaments, and campus notices. Register to receive your official digital pass.
        </p>
      </div>

      <!-- Event Category Tabs -->
      <div style="display: flex; gap: 0.6rem; flex-wrap: wrap; margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-subtle); padding-bottom: 1rem;" id="category-tabs-container">
        <button class="cat-tab ${selectedCategory === 'all' ? 'active' : ''}" data-cat="all">🌟 All Events</button>
        <button class="cat-tab ${selectedCategory === 'technical' ? 'active' : ''}" data-cat="technical">💻 Technical</button>
        <button class="cat-tab ${selectedCategory === 'sports' ? 'active' : ''}" data-cat="sports">🏆 Sports</button>
        <button class="cat-tab ${selectedCategory === 'social' ? 'active' : ''}" data-cat="social">🎉 Social & Cultural</button>
        <button class="cat-tab ${selectedCategory === 'notice' ? 'active' : ''}" data-cat="notice">📢 Campus Notices (${announcements.length})</button>
      </div>

      <!-- Search & Filter Controls -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.75rem;">
        <div style="font-size: 1.15rem; font-weight: 700; color: var(--text-primary);" id="events-count-label">
          Upcoming Events (0)
        </div>

        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; flex: 1; max-width: 580px; justify-content: flex-end;">
          <input type="text" id="search-input" class="form-control" placeholder="🔍 Search events or notices..." value="" style="flex: 1; min-width: 220px;" autocomplete="off" />
          
          <select id="dept-filter" class="form-control" style="width: auto;">
            <option value="all">All Departments</option>
            <option value="Computer Science & Engineering">Computer Science & Engineering</option>
            <option value="Information Technology">Information Tech</option>
            <option value="AIML">AIML</option>
            <option value="AIDS">AIDS</option>
            <option value="Cyber Security">Cyber Security</option>
            <option value="IMtech">IMtech</option>
            <option value="Robotics & Automation">Robotics & Automation</option>
          </select>
        </div>
      </div>

      <!-- Dynamic Events Grid Container -->
      <div id="events-container" class="events-grid"></div>
    </div>
  `;

  const eventsContainer = container.querySelector('#events-container');
  const countLabel = container.querySelector('#events-count-label');
  const searchInput = container.querySelector('#search-input');
  const deptFilter = container.querySelector('#dept-filter');

  // 2. Targeted Grid Update
  const updateGrid = () => {
    // If 'Campus Notice' tab is selected, render all announcements
    if (selectedCategory === 'notice') {
      const q = searchTerm.toLowerCase().trim();
      const filteredNotices = announcements.filter(n => {
        const matchesSearch = !q ||
          (n.title || '').toLowerCase().includes(q) ||
          (n.message || '').toLowerCase().includes(q) ||
          (n.postedBy || '').toLowerCase().includes(q);

        const matchesDept = selectedDept === 'all' ||
          (n.targetDept || '').toLowerCase().includes(selectedDept.toLowerCase()) ||
          (n.targetDept || '').toLowerCase().includes('all');

        return matchesSearch && matchesDept;
      });

      if (countLabel) {
        countLabel.textContent = `Campus Notices & Broadcasts (${filteredNotices.length})`;
      }

      if (!eventsContainer) return;

      if (filteredNotices.length === 0) {
        eventsContainer.innerHTML = `
          <div class="card" style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">📢</div>
            <h3>No Campus Notices Found</h3>
            <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">No active broadcasts match your search or department filter.</p>
          </div>
        `;
        return;
      }

      eventsContainer.innerHTML = `
        <div style="grid-column: 1/-1;">
          ${filteredNotices.map(renderNoticeCard).join('')}
        </div>
      `;
      return;
    }

    // Standard Events Filtering
    const filteredEvents = events.filter(e => {
      // Closed event security: hide from non-staff students unless they are in allowed roster
      if (e.visibility === 'closed' && !isStaffOrAdmin) {
        if (!user || !user.email || !allowedClosedEventIds.has(e.id)) {
          return false;
        }
      }

      const q = searchTerm.toLowerCase().trim();
      const matchesSearch = !q || 
                            (e.title || '').toLowerCase().includes(q) || 
                            (e.description || '').toLowerCase().includes(q);
      const matchesDept = selectedDept === 'all' || e.department === selectedDept;
      
      const eventCat = (e.category || 'technical').toLowerCase();
      const matchesCategory = selectedCategory === 'all' || eventCat === selectedCategory;

      return matchesSearch && matchesDept && matchesCategory;
    });

    if (countLabel) {
      const noticeCountInAll = selectedCategory === 'all' ? announcements.filter(n => {
        const q = searchTerm.toLowerCase().trim();
        const matchesDept = selectedDept === 'all' ||
          (n.targetDept || '').toLowerCase().includes(selectedDept.toLowerCase()) ||
          (n.targetDept || '').toLowerCase().includes('all');
        const matchesSearch = !q || (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q);
        return matchesDept && matchesSearch;
      }).length : 0;
      countLabel.textContent = selectedCategory === 'all'
        ? `All Content (${filteredEvents.length} Events${noticeCountInAll > 0 ? ` + ${noticeCountInAll} Notice${noticeCountInAll > 1 ? 's' : ''}` : ''})`
        : `Upcoming Events (${filteredEvents.length})`;
    }

    if (!eventsContainer) return;

    // Build notices section for 'All' tab
    let noticesSection = '';
    if (selectedCategory === 'all' && announcements.length > 0) {
      const q = searchTerm.toLowerCase().trim();
      const filteredNotices = announcements.filter(n => {
        const matchesDept = selectedDept === 'all' ||
          (n.targetDept || '').toLowerCase().includes(selectedDept.toLowerCase()) ||
          (n.targetDept || '').toLowerCase().includes('all');
        const matchesSearch = !q || (n.title || '').toLowerCase().includes(q) || (n.message || '').toLowerCase().includes(q);
        return matchesDept && matchesSearch;
      });
      if (filteredNotices.length > 0) {
        noticesSection = `
          <div style="grid-column: 1/-1; margin-bottom: 0.5rem;">
            <div style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: #dc2626; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
              <span>📢</span> Campus Notices & Broadcasts
            </div>
            ${filteredNotices.map(renderNoticeCard).join('')}
          </div>
          ${filteredEvents.length > 0 ? `<div style="grid-column: 1/-1; margin: 0.5rem 0;"><div style="font-size: 0.8rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; color: var(--text-tertiary); margin-bottom: 0.75rem;">🎉 Upcoming Events</div></div>` : ''}
        `;
      }
    }

    if (filteredEvents.length === 0 && !noticesSection) {
      eventsContainer.innerHTML = `
        <div class="card" style="grid-column: 1/-1; text-align: center; padding: 4rem 1rem;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">📅</div>
          <h3>No Events Found</h3>
          <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">No events match your criteria. Try adjusting your search or category filter!</p>
        </div>
      `;
      return;
    }

    const eventsHtml = filteredEvents.map(e => {
      const reg = registrations.find(r => r.eventId === e.id);
      const regStatus = reg ? reg.status : null;
      
      let isEligible = true;
      if (user && user.role === 'student') {
        if (e.eligibleDepartments && e.eligibleDepartments.length > 0 && !e.eligibleDepartments.includes('All Departments')) {
          if (!e.eligibleDepartments.includes(user.department)) isEligible = false;
        }
        if (e.eligibleYears && e.eligibleYears.length > 0) {
          if (!e.eligibleYears.includes(user.year)) isEligible = false;
        }
      }

      const isAllowed = e.visibility !== 'closed' || isStaffOrAdmin || (user && allowedClosedEventIds.has(e.id));
      return createEventCardHtml(e, regStatus, isEligible, isAllowed);
    }).join('');

    eventsContainer.innerHTML = noticesSection + eventsHtml;

    // Notice card click → open full notice modal
    eventsContainer.querySelectorAll('.notice-card-clickable').forEach(card => {
      card.addEventListener('click', (e) => {
        // Don't open modal if clicking a link inside the card
        if (e.target.tagName === 'A' || e.target.closest('a')) return;
        const noticeId = card.getAttribute('data-notice-id');
        const noticeObj = announcements.find(n => n.id === noticeId);
        if (noticeObj) openNoticeModal(noticeObj);
      });
    });

    // Attach notice file preview listener (Opens in-app document viewer)
    eventsContainer.querySelectorAll('.btn-download-notice-file').forEach(btn => {

      btn.addEventListener('click', async (e) => {
        e.preventDefault();
        const b = e.currentTarget;
        const noticeId = b.getAttribute('data-notice-id');
        const fileName = b.getAttribute('data-name');
        const origHtml = b.innerHTML;

        b.disabled = true;
        b.innerHTML = '⏳ Loading Preview...';

        const noticeObj = announcements.find(n => n.id === noticeId);
        const attachmentMeta = noticeObj ? noticeObj.attachment : null;

        try {
          let fileDataUrl = await fetchNoticeAttachmentData(noticeId, attachmentMeta);

          // Fallback if IndexedDB reference
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

    // Attach find team button listeners
    eventsContainer.querySelectorAll('.btn-find-team').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = events.find(ev => ev.id === eventId);
        openTeamFinderModal(targetEvent);
      });
    });

    // Attach volunteer button listeners
    eventsContainer.querySelectorAll('.btn-apply-volunteer').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = events.find(ev => ev.id === eventId);
        openVolunteerModal(targetEvent);
      });
    });

    // Attach reviews button listeners
    eventsContainer.querySelectorAll('.btn-event-reviews').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const eventId = e.currentTarget.getAttribute('data-event-id');
        const targetEvent = events.find(ev => ev.id === eventId);
        openReviewModal(targetEvent, () => {
          renderEventsView(container, navigateTo);
        });
      });
    });

    // Attach registration button listeners
    eventsContainer.querySelectorAll('.btn-register').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!user) {
          navigateTo('login');
          return;
        }

        const eventId = e.target.getAttribute('data-event-id');
        const targetEvent = events.find(ev => ev.id === eventId);
        
        btn.disabled = true;
        btn.textContent = 'Registering...';

        try {
          const res = await registerForEvent(targetEvent, user);
          if (res && res.success) {
            alert(`🎉 Registration Submitted Successfully!\nStatus is PENDING approval by ${targetEvent.organizerName || 'organizer'}.`);
          } else {
            alert(`Notice: ${res?.message || 'Unable to register.'}`);
          }
          registrations = await getStudentRegistrations(user.uid);
          updateGrid();
        } catch (err) {
          console.error('Registration failed:', err);
          alert('Registration failed due to a network or server error. Please try again.');
          btn.disabled = false;
          btn.textContent = 'Register Now';
        }
      });
    });
  };

  // 3. Category Tabs Handler
  container.querySelectorAll('.cat-tab').forEach(tab => {
    tab.addEventListener('click', (e) => {
      selectedCategory = e.currentTarget.getAttribute('data-cat');
      container.querySelectorAll('.cat-tab').forEach(t => t.classList.remove('active'));
      e.currentTarget.classList.add('active');
      updateGrid();
    });
  });

  // 4. Search & Dept Event Handlers
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      searchTerm = e.target.value;
      updateGrid();
    });
  }

  if (deptFilter) {
    deptFilter.addEventListener('change', (e) => {
      selectedDept = e.target.value;
      updateGrid();
    });
  }

  // Quick-switch staff banner listeners
  container.querySelector('#btn-quick-to-executive')?.addEventListener('click', () => {
    navigateTo('executive');
  });
  container.querySelector('#btn-quick-to-organizer')?.addEventListener('click', () => {
    navigateTo('organizer');
  });
  container.querySelector('#btn-quick-to-admin')?.addEventListener('click', () => {
    navigateTo('admin');
  });

  // Initial Grid Render & Closed Events Resolution
  refreshAllowedClosedEvents(events).then(() => updateGrid()).catch(() => {});
  updateGrid();

  // Background Async Refresh (Syncs live database seamlessly)
  Promise.all([
    getApprovedEvents(),
    getAnnouncements(),
    user ? getStudentRegistrations(user.uid) : Promise.resolve([])
  ]).then(async ([freshEvents, freshNotices, freshRegs]) => {
    if (freshEvents) {
      events = freshEvents;
      await refreshAllowedClosedEvents(events);
    }
    if (freshNotices) announcements = freshNotices;
    if (freshRegs) registrations = freshRegs;

    // Update notice count on tab
    const noticeTab = container.querySelector('[data-cat="notice"]');
    if (noticeTab) {
      noticeTab.textContent = `📢 Campus Notices (${announcements.length})`;
    }

    updateGrid();
  }).catch(() => {});
}
