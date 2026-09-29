/**
 * EventPulse — Campus Moments Wall View
 * Interactive photo gallery with live likes, filters, uploader tags, and full-screen lightbox.
 */

import { getMoments, getCachedMomentsSync, uploadMoment, toggleLikeMoment, deleteMoment } from '../services/moments';
import { getApprovedEvents, getCachedEventsSync } from '../services/events';
import { getCurrentUser, isUserAdmin } from '../services/auth';

export async function renderMomentsWallView(container, navigateTo) {
  const user = getCurrentUser();
  let moments = getCachedMomentsSync() || [];
  let events = getCachedEventsSync() || [];
  let activeEventFilter = 'all';

  const render = () => {
    const filteredMoments = activeEventFilter === 'all'
      ? moments
      : moments.filter(m => m.eventId === activeEventFilter || (m.eventTitle || '').toLowerCase().includes(activeEventFilter.toLowerCase()));

    container.innerHTML = `
      <div style="padding-bottom: 3rem;">
        <!-- Hero Header -->
        <div class="hero-banner" style="background: linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #ec4899 100%); margin-bottom: 2rem;">
          <button class="btn-back-events" style="background: rgba(255,255,255,0.22); border: 1px solid rgba(255,255,255,0.45); color: #ffffff; padding: 0.35rem 0.85rem; border-radius: 999px; font-weight: 800; font-size: 0.825rem; display: inline-flex; align-items: center; gap: 0.4rem; cursor: pointer; margin-bottom: 0.85rem; backdrop-filter: blur(8px); transition: all 0.2s;">
            <span>←</span> Back to Campus Events & Notices
          </button>
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
            <div>
              <span style="background: rgba(255,255,255,0.2); color: #ffffff; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.75rem; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.05em; display: inline-block; margin-bottom: 0.5rem; backdrop-filter: blur(4px);">
                ✨ Live Campus Memory Wall
              </span>
              <h1 style="margin-bottom: 0.4rem; font-size: 2.25rem; color: #ffffff; font-weight: 900; letter-spacing: -0.02em;">
                Campus <span style="color: #fbcfe8;">Moments</span> Wall
              </h1>
              <p style="max-width: 600px; font-size: 0.95rem; line-height: 1.6; opacity: 0.95; color: #ffffff;">
                Celebrate unforgettable hackathon sprints, cultural night sparks, and sports triumphs captured by Sanjivani University students.
              </p>
            </div>

            <div>
              ${user ? `
                <button id="btn-open-upload-moment" class="btn" style="background: #ffffff; color: #7c3aed; font-weight: 800; font-size: 0.9rem; padding: 0.7rem 1.4rem; border-radius: 12px; box-shadow: 0 10px 25px rgba(0,0,0,0.2); border: none; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: transform 0.2s;">
                  📸 Share a Moment
                </button>
              ` : `
                <button id="btn-login-to-post-moment" class="btn" style="background: #ffffff; color: #7c3aed; font-weight: 800; padding: 0.7rem 1.4rem; border-radius: 12px;">
                  🔐 Log in to Share Photo
                </button>
              `}
            </div>
          </div>
        </div>

        <!-- Filter Bar & Stats -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.75rem;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <button class="cat-tab ${activeEventFilter === 'all' ? 'active' : ''}" data-moment-filter="all">
              🌟 All Campus Moments (${moments.length})
            </button>
            <button class="cat-tab ${activeEventFilter === 'hackathon' ? 'active' : ''}" data-moment-filter="hackathon">
              💻 Hackathons & Tech
            </button>
            <button class="cat-tab ${activeEventFilter === 'cultural' ? 'active' : ''}" data-moment-filter="cultural">
              🎭 Cultural & Fests
            </button>
            <button class="cat-tab ${activeEventFilter === 'sports' ? 'active' : ''}" data-moment-filter="sports">
              🏆 Sports Arena
            </button>
          </div>

          <div style="font-size: 0.85rem; color: var(--text-tertiary); font-weight: 600;">
            Showing ${filteredMoments.length} shared memories
          </div>
        </div>

        <!-- Moments Grid -->
        ${filteredMoments.length === 0 ? `
          <div class="card" style="text-align: center; padding: 4rem 1.5rem; background: #ffffff;">
            <div style="font-size: 3rem; margin-bottom: 0.75rem;">📸</div>
            <h3 style="font-size: 1.25rem; color: #1e293b; margin-bottom: 0.35rem;">No moments shared in this category yet</h3>
            <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 1.25rem;">Be the first student to upload a photo and capture the campus vibe!</p>
            ${user ? `<button id="btn-empty-upload-moment" class="btn btn-primary">📸 Upload First Moment</button>` : ''}
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 1.5rem;">
            ${filteredMoments.map(m => {
              const hasLiked = user && Array.isArray(m.likedBy) && m.likedBy.includes(user.uid);
              const canDelete = user && (user.role === 'admin' || user.role === 'organizer' || isUserAdmin(user) || m.uploaderUid === user.uid);

              return `
                <div class="card" style="padding: 0; overflow: hidden; background: #ffffff; border-radius: 16px; border: 1px solid var(--border-subtle); display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 20px rgba(0,0,0,0.05); transition: transform 0.2s, box-shadow 0.2s;" onmouseover="this.style.transform='translateY(-4px)';this.style.boxShadow='0 12px 30px rgba(0,0,0,0.1)'" onmouseout="this.style.transform='none';this.style.boxShadow='0 4px 20px rgba(0,0,0,0.05)'">
                  
                  <!-- Photo Container with Lightbox Trigger -->
                  <div class="moment-photo-box" data-photo-url="${m.photoUrl}" data-caption="${encodeURIComponent(m.caption || '')}" data-title="${encodeURIComponent(m.eventTitle || '')}" style="position: relative; width: 100%; height: 230px; background: #0f172a; cursor: pointer; overflow: hidden;">
                    <img src="${m.photoUrl}" alt="${m.eventTitle || 'Campus Moment'}" style="width: 100%; height: 100%; object-fit: cover; transition: transform 0.4s ease;" onmouseover="this.style.transform='scale(1.05)'" onmouseout="this.style.transform='scale(1)'" />
                    
                    <!-- Event Tag Badge -->
                    <span style="position: absolute; bottom: 10px; left: 10px; background: rgba(15, 23, 42, 0.85); backdrop-filter: blur(6px); color: #ffffff; font-size: 0.725rem; font-weight: 800; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid rgba(255,255,255,0.2);">
                      📍 ${m.eventTitle || 'Campus Life'}
                    </span>

                    <!-- Expand Hint -->
                    <span style="position: absolute; top: 10px; right: 10px; width: 30px; height: 30px; border-radius: 50%; background: rgba(0,0,0,0.6); color: #ffffff; display: flex; align-items: center; justify-content: center; font-size: 0.85rem; backdrop-filter: blur(4px);">
                      🔍
                    </span>
                  </div>

                  <!-- Details Body -->
                  <div style="padding: 1.1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between;">
                    <div>
                      <!-- Uploader Header -->
                      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
                        <div style="display: flex; align-items: center; gap: 0.5rem;">
                          <div style="width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #7c3aed, #a855f7); color: #ffffff; font-weight: 800; font-size: 0.75rem; display: flex; align-items: center; justify-content: center;">
                            ${(m.uploaderName || 'EP').slice(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <div style="font-size: 0.85rem; font-weight: 800; color: #1e293b; line-height: 1.2;">
                              ${m.uploaderName || 'Student'}
                            </div>
                            <div style="font-size: 0.7rem; color: #64748b;">
                              ${m.uploaderDept || 'IMtech'} • ${m.createdAt ? new Date(m.createdAt).toLocaleDateString() : 'Recent'}
                            </div>
                          </div>
                        </div>

                        ${m.uploaderRole === 'admin' ? `
                          <span style="font-size: 0.65rem; font-weight: 800; background: #fee2e2; color: #ef4444; padding: 0.15rem 0.45rem; border-radius: 4px;">ADMIN</span>
                        ` : (m.uploaderRole === 'organizer' ? `
                          <span style="font-size: 0.65rem; font-weight: 800; background: #e0e7ff; color: #4f46e5; padding: 0.15rem 0.45rem; border-radius: 4px;">ORGANIZER</span>
                        ` : '')}
                      </div>

                      <!-- Caption -->
                      <p style="font-size: 0.875rem; color: #334155; line-height: 1.5; margin: 0 0 0.85rem 0; word-break: break-word;">
                        ${m.caption || 'Captured during campus event.'}
                      </p>
                    </div>

                    <!-- Footer: Like & Action Buttons -->
                    <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #f1f5f9; padding-top: 0.75rem; margin-top: 0.5rem;">
                      <button class="btn-like-moment" data-moment-id="${m.id}" style="background: ${hasLiked ? '#fef2f2' : '#f8fafc'}; color: ${hasLiked ? '#ef4444' : '#64748b'}; border: 1px solid ${hasLiked ? '#fca5a5' : '#e2e8f0'}; border-radius: 999px; padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.15s;">
                        <span>${hasLiked ? '❤️' : '🤍'}</span>
                        <span>${m.likesCount || 0}</span>
                      </button>

                      ${canDelete ? `
                        <button class="btn-delete-moment" data-moment-id="${m.id}" style="background: none; border: none; color: #94a3b8; font-size: 0.85rem; cursor: pointer; padding: 0.25rem 0.5rem;" title="Delete this moment">
                          🗑️
                        </button>
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>
    `;

    attachListeners();
  };

  const attachListeners = () => {
    // Back to events navigation
    container.querySelectorAll('.btn-back-events').forEach(btn => {
      btn.addEventListener('click', () => {
        navigateTo('events');
      });
    });

    // Filter click
    container.querySelectorAll('[data-moment-filter]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeEventFilter = e.currentTarget.getAttribute('data-moment-filter');
        render();
      });
    });

    // Upload Trigger
    const openUploadBtn = container.querySelector('#btn-open-upload-moment') || container.querySelector('#btn-empty-upload-moment');
    if (openUploadBtn) {
      openUploadBtn.addEventListener('click', () => openUploadMomentModal());
    }

    const loginBtn = container.querySelector('#btn-login-to-post-moment');
    if (loginBtn) {
      loginBtn.addEventListener('click', () => navigateTo('login'));
    }

    // Like buttons
    container.querySelectorAll('.btn-like-moment').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!user) {
          alert('Please log in to like campus moments!');
          return;
        }
        const momentId = e.currentTarget.getAttribute('data-moment-id');
        const updated = await toggleLikeMoment(momentId, user.uid);
        if (updated) {
          const idx = moments.findIndex(m => m.id === momentId);
          if (idx !== -1) moments[idx] = updated;
          render();
        }
      });
    });

    // Delete buttons
    container.querySelectorAll('.btn-delete-moment').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Are you sure you want to delete this moment?')) return;
        const momentId = e.currentTarget.getAttribute('data-moment-id');
        await deleteMoment(momentId, user);
        moments = moments.filter(m => m.id !== momentId);
        render();
      });
    });

    // Lightbox triggers
    container.querySelectorAll('.moment-photo-box').forEach(box => {
      box.addEventListener('click', (e) => {
        const photoUrl = box.getAttribute('data-photo-url');
        const caption = decodeURIComponent(box.getAttribute('data-caption') || '');
        const title = decodeURIComponent(box.getAttribute('data-title') || '');
        openPhotoLightbox(photoUrl, caption, title);
      });
    });
  };

  // Full-screen Lightbox Modal
  const openPhotoLightbox = (photoUrl, caption, title) => {
    const existing = document.getElementById('ep-photo-lightbox');
    if (existing) existing.remove();

    const lightbox = document.createElement('div');
    lightbox.id = 'ep-photo-lightbox';
    lightbox.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(0, 0, 0, 0.9); backdrop-filter: blur(8px);
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 1.5rem; animation: fadeIn 0.2s ease;
    `;

    lightbox.innerHTML = `
      <div style="position: relative; max-width: 950px; width: 100%; max-height: 90vh; display: flex; flex-direction: column; align-items: center;">
        <button id="btn-close-lightbox" style="position: absolute; top: -45px; right: 0; background: rgba(255,255,255,0.2); border: none; color: #ffffff; font-size: 1.3rem; width: 38px; height: 38px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center;">
          ✕
        </button>
        <img src="${photoUrl}" alt="${title}" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 12px; box-shadow: 0 20px 50px rgba(0,0,0,0.8);" />
        
        <div style="margin-top: 1rem; color: #ffffff; text-align: center; max-width: 700px;">
          <div style="font-size: 1rem; font-weight: 800; color: #fbcfe8; margin-bottom: 0.25rem;">📍 ${title}</div>
          <div style="font-size: 0.9rem; color: #e2e8f0; line-height: 1.5;">${caption}</div>
        </div>
      </div>
    `;

    document.body.appendChild(lightbox);
    lightbox.addEventListener('click', (e) => { if (e.target === lightbox) lightbox.remove(); });
    lightbox.querySelector('#btn-close-lightbox').addEventListener('click', () => lightbox.remove());
  };

  // Upload Moment Modal
  const openUploadMomentModal = () => {
    const existing = document.getElementById('modal-upload-moment');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'modal-upload-moment';
    modal.className = 'modal-overlay';
    modal.style.zIndex = '10000';

    let selectedFileDataUrl = null;

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 520px; width: 92%; padding: 1.5rem; background: #ffffff; border-radius: 18px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.25rem;">
          <h2 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0;">📸 Share a Campus Moment</h2>
          <button id="btn-close-upload-modal" style="background: #f1f5f9; border: none; border-radius: 50%; width: 32px; height: 32px; font-size: 1rem; cursor: pointer;">✕</button>
        </div>

        <form id="form-upload-moment" style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Event Selector -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Associated Event / Category *</label>
            <select id="moment-event-select" class="form-control" required>
              <option value="general">🌟 General Campus Life</option>
              ${events.map(ev => `<option value="${ev.id}">${ev.title} (${ev.date})</option>`).join('')}
            </select>
          </div>

          <!-- Photo File Picker -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Select Photo * (JPG, PNG, WebP)</label>
            <input type="file" id="moment-file-input" class="form-control" accept="image/*" required />
          </div>

          <!-- Image Live Preview -->
          <div id="moment-preview-box" style="display: none; width: 100%; height: 180px; border-radius: 10px; overflow: hidden; background: #0f172a; text-align: center;">
            <img id="moment-preview-img" src="" alt="Preview" style="width: 100%; height: 100%; object-fit: cover;" />
          </div>

          <!-- Caption -->
          <div>
            <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Caption / Experience *</label>
            <textarea id="moment-caption" class="form-control" rows="3" placeholder="Tell the story behind this moment (e.g. Won 1st prize at Hackathon, stage performance, team celebration)..." required></textarea>
          </div>

          <button type="submit" id="btn-submit-moment" class="btn btn-primary btn-block" style="font-weight: 800; padding: 0.8rem; margin-top: 0.5rem; justify-content: center; background: linear-gradient(135deg, #7c3aed, #4f46e5);">
            🚀 Post to Moments Wall
          </button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => modal.remove();
    modal.querySelector('#btn-close-upload-modal').addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // File selection reader with client compression
    const fileInput = modal.querySelector('#moment-file-input');
    const previewBox = modal.querySelector('#moment-preview-box');
    const previewImg = modal.querySelector('#moment-preview-img');

    fileInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (ev) => {
        const img = new Image();
        img.onload = () => {
          // Resize/compress to max 1200px width for fast loading
          const canvas = document.createElement('canvas');
          const maxDim = 1200;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = (h * maxDim) / w;
              w = maxDim;
            } else {
              w = (w * maxDim) / h;
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          selectedFileDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          previewImg.src = selectedFileDataUrl;
          previewBox.style.display = 'block';
        };
        img.src = ev.target.result;
      };
      reader.readAsDataURL(file);
    });

    // Form Submit
    modal.querySelector('#form-upload-moment').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!selectedFileDataUrl) {
        alert('Please select a photo to upload.');
        return;
      }

      const submitBtn = modal.querySelector('#btn-submit-moment');
      submitBtn.disabled = true;
      submitBtn.textContent = '⏳ Uploading & Syncing...';

      const eventSelect = modal.querySelector('#moment-event-select');
      const eventId = eventSelect.value;
      const eventTitle = eventSelect.options[eventSelect.selectedIndex].text;
      const caption = modal.querySelector('#moment-caption').value.trim();

      try {
        const newMoment = await uploadMoment({
          eventId,
          eventTitle,
          photoDataUrl: selectedFileDataUrl,
          caption,
          user
        });

        moments = [newMoment, ...moments];
        close();
        render();
      } catch (err) {
        alert('Upload error: ' + err.message);
        submitBtn.disabled = false;
        submitBtn.textContent = '🚀 Post to Moments Wall';
      }
    });
  };

  // Initial Instant Render
  render();

  // Background Live Sync
  getMoments().then(fetched => {
    moments = fetched;
    render();
  });
}
