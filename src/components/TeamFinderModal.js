import { getEventTeams, createTeamPost, deleteTeamPost } from '../services/teams';
import { getCurrentUser, isUserAdmin } from '../services/auth';
import { generateSquadPitchAI } from '../services/ai';

export async function openTeamFinderModal(event = null, onUpdate = null) {
  const user = getCurrentUser();
  const existingModal = document.getElementById('team-finder-modal');
  if (existingModal) existingModal.remove();

  const modal = document.createElement('div');
  modal.id = 'team-finder-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  let currentTab = 'browse'; // 'browse' | 'create'
  let teams = await getEventTeams(event ? event.id : null);

  const renderContent = () => {
    modal.innerHTML = `
      <div class="modal-container" style="max-width: 620px; padding: 1.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 1.35rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.5rem;">
              🤝 Teammate & Squad Finder
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
              ${event ? `Finding teammates for: <strong style="color: var(--primary);">${event.title}</strong>` : 'Find students with complementary skills for hackathons & contests'}
            </div>
          </div>
          <button id="btn-close-team-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-tertiary);">✕</button>
        </div>

        <!-- Mode Toggle Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; background: #f1f5f9; padding: 0.25rem; border-radius: var(--radius-full);">
          <button id="tab-browse-teams" style="flex: 1; padding: 0.5rem; border: none; border-radius: var(--radius-full); font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${currentTab === 'browse' ? '#ffffff' : 'transparent'}; color: ${currentTab === 'browse' ? 'var(--primary)' : 'var(--text-secondary)'}; box-shadow: ${currentTab === 'browse' ? 'var(--shadow-card)' : 'none'};">
            🔍 Open Squads (${teams.length})
          </button>
          <button id="tab-create-team" style="flex: 1; padding: 0.5rem; border: none; border-radius: var(--radius-full); font-size: 0.85rem; font-weight: 700; cursor: pointer; transition: all 0.2s; background: ${currentTab === 'create' ? 'linear-gradient(135deg, var(--primary), #8b5cf6)' : 'transparent'}; color: ${currentTab === 'create' ? '#ffffff' : 'var(--text-secondary)'}; box-shadow: ${currentTab === 'create' ? 'var(--primary-glow)' : 'none'};">
            ➕ Post Squad Requirement
          </button>
        </div>

        ${currentTab === 'browse' ? `
          <!-- BROWSE SQUADS LIST -->
          <div style="max-height: 400px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.85rem;" id="teams-list">
            ${teams.length === 0 ? `
              <div style="text-align: center; padding: 3rem 1rem; color: var(--text-secondary);">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">👥</div>
                <div style="font-weight: 700; font-size: 1rem; color: var(--text-primary);">No open squads posted yet</div>
                <div style="font-size: 0.85rem; margin-top: 0.25rem;">Be the first team leader to post requirements and recruit teammates!</div>
                <button id="btn-switch-create" class="btn btn-primary btn-sm" style="margin-top: 1rem;">
                  ➕ Post Your Squad
                </button>
              </div>
            ` : teams.map(t => {
              const isLeader = user && (user.uid === t.leaderId || (user.email && t.leaderEmail && user.email.toLowerCase() === t.leaderEmail.toLowerCase()));
              const canDelete = isLeader || (user && isUserAdmin(user));
              return `
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-md); padding: 1rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                  <div>
                    <div style="font-size: 1.05rem; font-weight: 800; color: var(--text-primary);">
                      ⚡ ${t.teamName}
                    </div>
                    <div style="font-size: 0.775rem; color: var(--text-secondary); margin-top: 0.15rem;">
                      Leader: <strong>${t.leaderName}</strong> (${t.leaderDept} • ${t.leaderYear})
                    </div>
                  </div>
                  ${canDelete ? `
                    <button class="btn-delete-team" data-team-id="${t.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.725rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-full); cursor: pointer; display: inline-flex; align-items: center; gap: 0.25rem; box-shadow: 0 1px 3px rgba(220, 38, 38, 0.15);" title="Delete squad post">
                      🗑️ Delete Post
                    </button>
                  ` : ''}
                </div>

                <!-- Seeking Roles Tags -->
                <div style="margin-top: 0.65rem;">
                  <div style="font-size: 0.725rem; font-weight: 700; color: var(--text-tertiary); text-transform: uppercase; margin-bottom: 0.3rem;">Seeking Roles:</div>
                  <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                    ${(t.requiredRoles || []).map(r => `
                      <span style="background: rgba(124, 58, 237, 0.1); color: var(--primary); font-size: 0.75rem; font-weight: 700; padding: 0.2rem 0.6rem; border-radius: var(--radius-full); border: 1px solid rgba(124, 58, 237, 0.2);">
                        🎯 ${r}
                      </span>
                    `).join('')}
                  </div>
                </div>

                ${t.description ? `
                  <p style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.4; margin-top: 0.65rem; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 6px;">
                    "${t.description}"
                  </p>
                ` : ''}

                <!-- Contact & Connect Buttons -->
                <div style="display: flex; gap: 0.45rem; margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid var(--border-subtle); flex-wrap: wrap; align-items: center;">
                  ${t.contactPhone ? `
                    <a href="https://wa.me/${t.contactPhone.replace(/[^0-9]/g, '')}?text=${encodeURIComponent('Hi ' + t.leaderName + ', I saw your squad "' + t.teamName + '" on EventPulse and would love to join!')}" target="_blank" class="btn btn-sm" style="background: #22c55e; color: #ffffff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; font-size: 0.775rem; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); box-shadow: 0 2px 6px rgba(34, 197, 94, 0.25);">
                      💬 WhatsApp
                    </a>
                  ` : ''}
                  ${t.contactInstagram ? `
                    <a href="https://instagram.com/${t.contactInstagram.replace('@', '')}" target="_blank" class="btn btn-sm" style="background: linear-gradient(45deg, #f09433 0%, #e6683c 25%, #dc2743 50%, #cc2366 75%, #bc1888 100%); color: #ffffff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; font-size: 0.775rem; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); border: none; box-shadow: 0 2px 6px rgba(220, 39, 67, 0.25);">
                      📸 @${t.contactInstagram.replace('@', '')}
                    </a>
                  ` : ''}
                  ${t.contactLinkedin ? (() => {
                    const clean = t.contactLinkedin.trim();
                    const link = clean.startsWith('http') ? clean : (clean.startsWith('in/') || clean.startsWith('linkedin.com') ? `https://${clean.replace(/^https?:\/\//, '')}` : `https://linkedin.com/in/${clean.replace(/^@/, '')}`);
                    return `
                      <a href="${link}" target="_blank" class="btn btn-sm" style="background: #0a66c2; color: #ffffff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; font-size: 0.775rem; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm); border: none; box-shadow: 0 2px 6px rgba(10, 102, 194, 0.25);">
                        💼 LinkedIn
                      </a>
                    `;
                  })() : ''}
                  <a href="mailto:${t.contactEmail || t.leaderEmail}?subject=${encodeURIComponent('EventPulse Teammate Request: ' + t.teamName)}" class="btn btn-secondary btn-sm" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.775rem; font-weight: 700; padding: 0.35rem 0.75rem; border-radius: var(--radius-sm);">
                    ✉️ ${t.contactEmail ? 'Email' : 'Email Leader'}
                  </a>
                </div>
              </div>
            `;
            }).join('')}
          </div>
        ` : `
          <!-- CREATE SQUAD FORM -->
          <form id="form-create-team">
            ${!user ? `
              <div style="padding: 1.5rem; text-align: center; background: #f8fafc; border-radius: var(--radius-md);">
                <p style="margin-bottom: 0.75rem; font-weight: 600;">Please sign in with your student account to post a squad request.</p>
                <button type="button" id="btn-login-to-post" class="btn btn-primary btn-sm">Sign In</button>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Squad / Team Name *</label>
                  <input type="text" id="team-name" class="form-control" placeholder="e.g. ByteBusters / CyberKnights" required />
                </div>

                <div>
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700;">Required Roles (comma separated) *</label>
                  <input type="text" id="team-roles" class="form-control" placeholder="e.g. UI/UX Designer, Python Backend, AI/ML" required />
                </div>

                <!-- Multiple Contact Channels -->
                <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.85rem;">
                  <label class="form-label" style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0.4rem; color: var(--text-primary); display: flex; align-items: center; gap: 0.35rem;">
                    📞 Squad Contact & Social Handles <span style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 500;">(Provide at least 1)</span>
                  </label>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; margin-bottom: 0.5rem;">
                    <div>
                      <input type="tel" id="team-phone" class="form-control form-control-sm" placeholder="💬 WhatsApp (e.g. 919876543210)" value="${user.phone || ''}" />
                    </div>
                    <div>
                      <input type="text" id="team-insta" class="form-control form-control-sm" placeholder="📸 Instagram (e.g. @your_id)" />
                    </div>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                    <div>
                      <input type="text" id="team-linkedin" class="form-control form-control-sm" placeholder="💼 LinkedIn (e.g. in/username)" />
                    </div>
                    <div>
                      <input type="email" id="team-email" class="form-control form-control-sm" placeholder="✉️ Contact Email ID" value="${user.email || ''}" />
                    </div>
                  </div>
                </div>

                <div>
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                    <label class="form-label" style="font-size: 0.8rem; font-weight: 700; margin-bottom: 0;">Project Idea / Teammate Requirements</label>
                    <button type="button" id="btn-ai-polish-pitch" style="background: linear-gradient(135deg, rgba(124, 58, 237, 0.12), rgba(6, 182, 212, 0.15)); color: var(--primary); border: 1px solid var(--primary); border-radius: var(--radius-full); padding: 0.15rem 0.55rem; font-size: 0.725rem; font-weight: 700; cursor: pointer;">
                      ⚡ Polish with NEX
                    </button>
                  </div>
                  <textarea id="team-desc" class="form-control" rows="3" placeholder="Briefly describe what your team is building or what skills you need..."></textarea>
                </div>

                <div id="team-form-error" class="alert alert-danger" style="display: none; font-size: 0.8rem; padding: 0.5rem;"></div>

                <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem; width: 100%; justify-content: center; font-weight: 800;">
                  🚀 Publish Squad Post
                </button>
              </div>
            `}
          </form>
        `}
      </div>
    `;

    // Modal Close
    modal.querySelector('#btn-close-team-modal')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => {
      if (e.target === modal) modal.remove();
    });

    // Tab Switchers
    modal.querySelector('#tab-browse-teams')?.addEventListener('click', () => {
      currentTab = 'browse';
      renderContent();
    });
    modal.querySelector('#tab-create-team')?.addEventListener('click', () => {
      currentTab = 'create';
      renderContent();
    });
    modal.querySelector('#btn-switch-create')?.addEventListener('click', () => {
      currentTab = 'create';
      renderContent();
    });

    // AI Pitch Generator
    modal.querySelector('#btn-ai-polish-pitch')?.addEventListener('click', async () => {
      const teamName = modal.querySelector('#team-name')?.value.trim() || 'Innovators';
      const roles = modal.querySelector('#team-roles')?.value.trim();
      const descBox = modal.querySelector('#team-desc');
      const currentDesc = descBox?.value.trim();

      if (descBox) {
        descBox.value = '✨ Generating high-impact squad recruitment pitch with PulseAI...';
        const pitch = await generateSquadPitchAI(teamName, currentDesc, roles);
        descBox.value = pitch;
      }
    });

    // Form Submit
    modal.querySelector('#form-create-team')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const errorEl = modal.querySelector('#team-form-error');
      if (errorEl) errorEl.style.display = 'none';

      const teamName = modal.querySelector('#team-name').value;
      const requiredRoles = modal.querySelector('#team-roles').value;
      const contactPhone = modal.querySelector('#team-phone')?.value;
      const contactInstagram = modal.querySelector('#team-insta')?.value;
      const contactLinkedin = modal.querySelector('#team-linkedin')?.value;
      const contactEmail = modal.querySelector('#team-email')?.value;
      const description = modal.querySelector('#team-desc')?.value;

      const res = await createTeamPost({
        eventId: event ? event.id : 'campus_hackathon',
        eventTitle: event ? event.title : 'Campus Hackathon / Contest',
        teamName,
        leaderId: user.uid,
        leaderName: user.name,
        leaderEmail: user.email,
        leaderDept: user.department,
        leaderYear: user.year,
        requiredRoles,
        contactPhone,
        contactInstagram,
        contactLinkedin,
        contactEmail,
        description
      });

      if (res.success) {
        teams = await getEventTeams(event ? event.id : null);
        currentTab = 'browse';
        renderContent();
        if (onUpdate) onUpdate();
      } else {
        if (errorEl) {
          errorEl.style.display = 'block';
          errorEl.textContent = res.error || 'Failed to publish post.';
        }
      }
    });

    // Delete Post Handler
    modal.querySelectorAll('.btn-delete-team').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const teamId = e.currentTarget.getAttribute('data-team-id');
        if (confirm('Are you sure you want to delete your squad post?')) {
          await deleteTeamPost(teamId);
          teams = await getEventTeams(event ? event.id : null);
          renderContent();
          if (onUpdate) onUpdate();
        }
      });
    });
  };

  renderContent();
  document.body.appendChild(modal);
}
