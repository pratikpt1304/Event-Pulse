import { submitIdea } from '../services/ideas';
import { getCurrentUser } from '../services/auth';

// Global toggle function called directly from HTML onclick
window._ideaToggleType = function(type) {
  const isNew = type === 'new_event';

  // Sections
  const secNew = document.getElementById('idea-sec-new');
  const secImp = document.getElementById('idea-sec-imp');
  if (secNew) secNew.style.display = isNew ? 'block' : 'none';
  if (secImp) secImp.style.display = isNew ? 'none' : 'block';

  // Hints
  const hNew = document.getElementById('idea-hint-new');
  const hImp = document.getElementById('idea-hint-imp');
  if (hNew) hNew.style.display = isNew ? 'block' : 'none';
  if (hImp) hImp.style.display = isNew ? 'none' : 'block';

  // Tab styles
  const tabNew = document.getElementById('idea-tab-new');
  const tabImp = document.getElementById('idea-tab-imp');
  if (tabNew) {
    tabNew.style.background = isNew ? 'linear-gradient(135deg,#4338ca,#7c3aed)' : '#f8fafc';
    tabNew.style.color = isNew ? '#fff' : '#64748b';
    tabNew.style.borderColor = isNew ? '#7c3aed' : '#e2e8f0';
  }
  if (tabImp) {
    tabImp.style.background = isNew ? '#f8fafc' : 'linear-gradient(135deg,#0ea5e9,#0369a1)';
    tabImp.style.color = isNew ? '#64748b' : '#fff';
    tabImp.style.borderColor = isNew ? '#e2e8f0' : '#0369a1';
  }
};

export function openIdeaModal(onSuccess = null) {
  const user = getCurrentUser();
  const existing = document.getElementById('idea-modal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'idea-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  modal.innerHTML = `
    <div class="modal-container" style="max-width: 540px; padding: 1.75rem; max-height: 90vh; overflow-y: auto;">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
        <div>
          <div style="font-size: 1.2rem; font-weight: 800; color: var(--text-primary);">
            💡 Post Campus Event Wish / Idea
          </div>
          <div style="font-size: 0.83rem; color: var(--text-secondary); margin-top: 0.2rem;">
            Suggest a brand-new event <em>or</em> improve an existing one!
          </div>
        </div>
        <button id="btn-close-idea-modal" style="background:none;border:none;font-size:1.3rem;cursor:pointer;color:var(--text-tertiary);padding:0;">✕</button>
      </div>

      ${!user ? `
        <div style="padding: 2.5rem 1rem; text-align: center; background: #f8fafc; border-radius: var(--radius-md);">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🔑</div>
          <h3 style="font-size: 1.1rem; margin-bottom: 0.25rem;">Sign In Required</h3>
          <p style="color: var(--text-secondary); font-size: 0.85rem; margin-bottom: 1rem;">Please sign in to submit your event idea.</p>
          <button id="btn-idea-signin" class="btn btn-primary btn-sm">Sign In</button>
        </div>
      ` : `
        <form id="form-submit-idea">
          <div style="display:flex;flex-direction:column;gap:1rem;">

            <!-- TYPE SELECTOR -->
            <div>
              <label class="form-label" style="font-size:0.8rem;font-weight:700;">What type of suggestion is this? *</label>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">

                <label id="idea-tab-new"
                  onclick="window._ideaToggleType('new_event')"
                  style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;font-weight:700;
                         background:linear-gradient(135deg,#4338ca,#7c3aed);color:#fff;
                         border:2px solid #7c3aed;padding:0.7rem 0.75rem;
                         border-radius:var(--radius-sm);cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="idea-type" value="new_event" checked style="accent-color:#fff;" />
                  🎤 Suggest New Event
                </label>

                <label id="idea-tab-imp"
                  onclick="window._ideaToggleType('improvement')"
                  style="display:flex;align-items:center;gap:0.5rem;font-size:0.82rem;font-weight:700;
                         background:#f8fafc;color:#64748b;
                         border:2px solid #e2e8f0;padding:0.7rem 0.75rem;
                         border-radius:var(--radius-sm);cursor:pointer;transition:all 0.2s;">
                  <input type="radio" name="idea-type" value="improvement" style="accent-color:#0ea5e9;" />
                  ✨ Improve Existing Event
                </label>

              </div>

              <!-- Hint banners -->
              <div id="idea-hint-new" style="margin-top:0.5rem;font-size:0.775rem;color:#6d28d9;background:#ede9fe;padding:0.4rem 0.75rem;border-radius:var(--radius-sm);border-left:3px solid #7c3aed;">
                🎤 <strong>New Event:</strong> Propose a brand-new event — concert, hackathon, esports, open mic, etc.
              </div>
              <div id="idea-hint-imp" style="display:none;margin-top:0.5rem;font-size:0.775rem;color:#0369a1;background:#e0f2fe;padding:0.4rem 0.75rem;border-radius:var(--radius-sm);border-left:3px solid #0ea5e9;">
                ✨ <strong>Improve Existing Event:</strong> Suggest changes to venue, timing, activities, prizes, food, safety, theme, etc.
              </div>
            </div>

            <!-- ========== NEW EVENT SECTION ========== -->
            <div id="idea-sec-new">
              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">Event Idea / Wish Title *</label>
                <input type="text" id="idea-title" class="form-control"
                  placeholder="e.g. 24h AI Hackathon, Standup Night, Esports LAN..." />
              </div>

              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">Category *</label>
                <select id="idea-cat" class="form-control">
                  <option value="🎤 Concert & Music">🎤 Concert & Live Music</option>
                  <option value="🎮 Gaming & Esports">🎮 Gaming & Esports Tournament</option>
                  <option value="💻 Tech & Workshop">💻 Hackathon & Tech Workshop</option>
                  <option value="🎙️ Open Mic & Standup">🎙️ Open Mic & Standup Comedy</option>
                  <option value="🏆 Sports & Fitness">🏆 Sports Championship</option>
                  <option value="🎨 Art & Cultural">🎨 Art, Drama & Cultural Fest</option>
                  <option value="✨ General Campus Wish">✨ General Campus Wish</option>
                </select>
              </div>

              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">Why will students love this event? *</label>
                <textarea id="idea-desc" class="form-control" rows="3"
                  placeholder="Format, activities, why it should happen on campus..."></textarea>
              </div>

              <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
                <div>
                  <label class="form-label" style="font-size:0.8rem;font-weight:700;">Suggested Venue</label>
                  <input type="text" id="idea-venue" class="form-control" placeholder="e.g. Amphitheater, Ground" />
                </div>
                <div>
                  <label class="form-label" style="font-size:0.8rem;font-weight:700;">Guest / Theme</label>
                  <input type="text" id="idea-guest" class="form-control" placeholder="e.g. Local DJ, College Band" />
                </div>
              </div>
            </div>

            <!-- ========== IMPROVEMENT SECTION ========== -->
            <div id="idea-sec-imp" style="display:none;">
              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">Which event needs improvement? *</label>
                <input type="text" id="imp-event-name" class="form-control"
                  placeholder="e.g. Annual Hackathon, Fresher's Party, Sports Day..." />
              </div>

              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">What area needs fixing? *</label>
                <select id="imp-aspect" class="form-control">
                  <option value="🏟️ Venue / Location">🏟️ Venue / Location — too small, bad acoustics, far away</option>
                  <option value="⏰ Timing / Schedule">⏰ Timing / Schedule — clashes, too short, late start</option>
                  <option value="🎯 Activities / Format">🎯 Activities / Format — boring rounds, no engagement</option>
                  <option value="🎁 Prizes / Rewards">🎁 Prizes / Rewards — too low, unfair, no certificates</option>
                  <option value="🎤 Guest / Performer">🎤 Guest / Performer — better speakers, artists, judges</option>
                  <option value="📢 Promotion / Awareness">📢 Promotion / Awareness — poor communication, last-minute info</option>
                  <option value="🍕 Food & Hospitality">🍕 Food & Hospitality — stalls, refreshments, seating</option>
                  <option value="🛡️ Crowd / Safety">🛡️ Crowd / Safety Management — overcrowding, security</option>
                  <option value="✨ Theme / Decor">✨ Theme / Decor — outdated, no visual appeal</option>
                  <option value="📋 Other Improvement">📋 Other Improvement</option>
                </select>
              </div>

              <div style="margin-bottom:0.85rem;">
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">Your Specific Suggestion *</label>
                <textarea id="imp-desc" class="form-control" rows="3"
                  placeholder="What exactly should change and why it will make the event better..."></textarea>
              </div>

              <div>
                <label class="form-label" style="font-size:0.8rem;font-weight:700;">How urgent is this?</label>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.3rem;">
                  <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;cursor:pointer;background:#f0fdf4;padding:0.35rem 0.65rem;border-radius:var(--radius-full);border:1px solid #86efac;">
                    <input type="radio" name="imp-priority" value="nice_to_have" checked /> 👍 Nice to Have
                  </label>
                  <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;cursor:pointer;background:#fefce8;padding:0.35rem 0.65rem;border-radius:var(--radius-full);border:1px solid #fde047;">
                    <input type="radio" name="imp-priority" value="important" /> ⚠️ Important
                  </label>
                  <label style="display:flex;align-items:center;gap:0.35rem;font-size:0.8rem;cursor:pointer;background:#fef2f2;padding:0.35rem 0.65rem;border-radius:var(--radius-full);border:1px solid #fca5a5;">
                    <input type="radio" name="imp-priority" value="critical" /> 🔥 Must Fix
                  </label>
                </div>
              </div>
            </div>

            <div id="idea-form-error" style="display:none;background:#fef2f2;color:#dc2626;font-size:0.8rem;padding:0.5rem 0.75rem;border-radius:var(--radius-sm);border:1px solid #fca5a5;"></div>

            <button type="submit" id="btn-submit-idea-btn" class="btn btn-primary"
              style="margin-top:0.25rem;width:100%;justify-content:center;font-weight:700;">
              🚀 Publish to Campus Wishlist
            </button>
          </div>
        </form>
      `}
    </div>
  `;

  document.body.appendChild(modal);

  const close = () => {
    modal.remove();
    delete window._ideaToggleType;
  };
  modal.querySelector('#btn-close-idea-modal')?.addEventListener('click', close);
  modal.addEventListener('click', (e) => { if (e.target === modal) close(); });
  modal.querySelector('#btn-idea-signin')?.addEventListener('click', () => {
    close();
    window.location.hash = 'login';
  });

  modal.querySelector('#form-submit-idea')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = modal.querySelector('#btn-submit-idea-btn');
    const errEl = modal.querySelector('#idea-form-error');
    if (errEl) errEl.style.display = 'none';

    const type = modal.querySelector('input[name="idea-type"]:checked').value;
    const isNew = type === 'new_event';

    let title, category, description, suggestedVenue, suggestedGuest;

    if (isNew) {
      title = (modal.querySelector('#idea-title').value || '').trim();
      category = modal.querySelector('#idea-cat').value;
      description = (modal.querySelector('#idea-desc').value || '').trim();
      suggestedVenue = (modal.querySelector('#idea-venue').value || '').trim();
      suggestedGuest = (modal.querySelector('#idea-guest').value || '').trim();

      if (!title) { errEl.style.display = 'block'; errEl.textContent = 'Please enter an event title.'; return; }
      if (!description) { errEl.style.display = 'block'; errEl.textContent = 'Please describe your event idea.'; return; }
    } else {
      const eventName = (modal.querySelector('#imp-event-name').value || '').trim();
      const aspect = modal.querySelector('#imp-aspect').value;
      const impDesc = (modal.querySelector('#imp-desc').value || '').trim();
      const priority = modal.querySelector('input[name="imp-priority"]:checked')?.value || 'nice_to_have';

      if (!eventName) { errEl.style.display = 'block'; errEl.textContent = 'Please enter the name of the event to improve.'; return; }
      if (!impDesc) { errEl.style.display = 'block'; errEl.textContent = 'Please describe your improvement suggestion.'; return; }

      title = `${aspect} → ${eventName}`;
      category = '✨ Event Improvement';
      description = impDesc;
      suggestedVenue = `Priority: ${priority === 'critical' ? '🔥 Must Fix' : priority === 'important' ? '⚠️ Important' : '👍 Nice to Have'}`;
      suggestedGuest = aspect;
    }

    btn.disabled = true;
    btn.textContent = 'Publishing...';

    const res = await submitIdea({ title, type, category, description, suggestedVenue, suggestedGuest, user });

    if (res.success) {
      alert(`🎉 ${isNew ? 'Event Wish' : 'Improvement Suggestion'} Published!\nOther students can now upvote it. Most-requested ideas go to the event council!`);
      close();
      if (onSuccess) onSuccess();
    } else {
      btn.disabled = false;
      btn.textContent = '🚀 Publish to Campus Wishlist';
      errEl.style.display = 'block';
      errEl.textContent = res.error || 'Failed to submit. Try again.';
    }
  });
}
