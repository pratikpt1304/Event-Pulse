import { getCampusIdeas, getCachedIdeasSync, toggleUpvoteIdea, addCommentToIdea, deleteIdea } from '../services/ideas';
import { getCurrentUser, isUserAdmin } from '../services/auth';
import { openIdeaModal } from '../components/IdeaModal';

export async function renderIdeaHubView(container, navigateTo) {
  const user = getCurrentUser();
  let ideas = getCachedIdeasSync();
  let currentFilter = 'all'; // 'all' | 'new_event' | 'improvement' | 'gaming' | 'tech' | 'music'
  let activeCommentIdeaId = null;

  const render = () => {
    // Sort by upvotes descending
    let filtered = [...ideas].sort((a, b) => (b.upvotes || 0) - (a.upvotes || 0));

    if (currentFilter === 'new_event') {
      filtered = filtered.filter(i => i.type === 'new_event');
    } else if (currentFilter === 'improvement') {
      filtered = filtered.filter(i => i.type === 'improvement');
    } else if (currentFilter === 'gaming') {
      filtered = filtered.filter(i => (i.category || '').toLowerCase().includes('game') || (i.category || '').toLowerCase().includes('esport'));
    } else if (currentFilter === 'tech') {
      filtered = filtered.filter(i => (i.category || '').toLowerCase().includes('tech') || (i.category || '').toLowerCase().includes('hackathon'));
    } else if (currentFilter === 'music') {
      filtered = filtered.filter(i => (i.category || '').toLowerCase().includes('music') || (i.category || '').toLowerCase().includes('concert') || (i.category || '').toLowerCase().includes('mic'));
    }

    container.innerHTML = `
      <div style="max-width: 1000px; margin: 0 auto;">
        <!-- Hero Header -->
        <div style="background: linear-gradient(135deg, #1e1b4b, #4338ca, #7c3aed); border-radius: var(--radius-lg); padding: 2.25rem 2rem; color: #ffffff; margin-bottom: 2rem; position: relative; overflow: hidden; box-shadow: 0 16px 40px -10px rgba(124, 58, 237, 0.4);">
          <div style="position: absolute; top: -30px; right: -30px; width: 140px; height: 140px; background: rgba(6, 182, 212, 0.25); border-radius: 50%; filter: blur(35px);"></div>

          <div style="position: relative; z-index: 1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
            <div style="max-width: 600px;">
              <div style="display: inline-flex; align-items: center; gap: 0.4rem; background: rgba(255, 255, 255, 0.15); border: 1px solid rgba(255, 255, 255, 0.25); padding: 0.2rem 0.65rem; border-radius: var(--radius-full); font-size: 0.75rem; font-weight: 700; margin-bottom: 0.75rem; letter-spacing: 0.04em;">
                🔥 STUDENT VOICE & EVENT WISHLIST
              </div>
              <h1 style="font-size: 2.1rem; font-weight: 900; line-height: 1.15; margin-bottom: 0.6rem; color: #ffffff;">
                What event should happen next? 💡
              </h1>
              <p style="font-size: 0.95rem; color: #cbd5e1; line-height: 1.5; margin: 0;">
                Suggest concerts, gaming tournaments, hackathons & open mics. Upvote your favorite ideas — most requested events will be officially organized!
              </p>
            </div>

            <button id="btn-open-post-idea" class="btn" style="background: linear-gradient(135deg, #06b6d4, #10b981); color: #ffffff; font-weight: 800; padding: 0.85rem 1.5rem; border-radius: var(--radius-full); font-size: 0.95rem; box-shadow: 0 6px 20px rgba(6, 182, 212, 0.45); border: none; cursor: pointer; display: inline-flex; align-items: center; gap: 0.5rem;">
              ✨ Post Your Idea
            </button>
          </div>
        </div>

        <!-- Filter Tab Buttons -->
        <div style="display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.5rem; margin-bottom: 1.5rem; white-space: nowrap;">
          <button class="cat-tab ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">🔥 All Trending (${ideas.length})</button>
          <button class="cat-tab ${currentFilter === 'new_event' ? 'active' : ''}" data-filter="new_event">🎤 New Event Wishes</button>
          <button class="cat-tab ${currentFilter === 'improvement' ? 'active' : ''}" data-filter="improvement">✨ Event Improvements</button>
          <button class="cat-tab ${currentFilter === 'gaming' ? 'active' : ''}" data-filter="gaming">🎮 Gaming & Esports</button>
          <button class="cat-tab ${currentFilter === 'tech' ? 'active' : ''}" data-filter="tech">💻 Tech & Hackathons</button>
          <button class="cat-tab ${currentFilter === 'music' ? 'active' : ''}" data-filter="music">🎙️ Music & Cultural</button>
        </div>

        <!-- Ideas Feed Grid -->
        <div style="display: flex; flex-direction: column; gap: 1.25rem;">
          ${filtered.length === 0 ? `
            <div class="card" style="text-align: center; padding: 3.5rem 1rem;">
              <div style="font-size: 2.8rem; margin-bottom: 0.5rem;">💡</div>
              <h3>No ideas in this category yet</h3>
              <p style="color: var(--text-secondary); font-size: 0.9rem; margin-top: 0.25rem;">Be the first to suggest an event or improvement!</p>
              <button class="btn btn-primary btn-sm" id="btn-zero-post-idea" style="margin-top: 1rem;">✨ Post Your Idea</button>
            </div>
          ` : filtered.map((idea, index) => {
            const hasUpvoted = user && (idea.upvotedBy || []).includes(user.uid);
            const isTrending = index === 0 || (idea.upvotes || 0) >= 30;

            return `
              <div class="card" style="padding: 1.5rem; display: flex; gap: 1.25rem; align-items: flex-start; background: #ffffff; border: 1px solid var(--border-subtle); position: relative; overflow: hidden; transition: transform 0.15s, box-shadow 0.15s;">
                ${isTrending ? `
                  <div style="position: absolute; top: 0; right: 0; background: linear-gradient(135deg, #f59e0b, #ef4444); color: #ffffff; font-size: 0.65rem; font-weight: 800; padding: 0.2rem 0.75rem; border-bottom-left-radius: 10px; text-transform: uppercase; letter-spacing: 0.05em; display: flex; align-items: center; gap: 0.25rem;">
                    🔥 Trending Wish
                  </div>
                ` : ''}

                <!-- Upvote Pill -->
                <button class="btn-upvote-idea ${hasUpvoted ? 'upvoted' : ''}" data-idea-id="${idea.id}" style="display: flex; flex-direction: column; align-items: center; justify-content: center; min-width: 58px; padding: 0.6rem 0.4rem; background: ${hasUpvoted ? 'linear-gradient(135deg, #7c3aed, #6d28d9)' : '#f1f5f9'}; color: ${hasUpvoted ? '#ffffff' : '#334155'}; border: 1px solid ${hasUpvoted ? '#7c3aed' : '#cbd5e1'}; border-radius: 12px; cursor: pointer; transition: all 0.2s;">
                  <span style="font-size: 1.15rem; line-height: 1; transform: translateY(-1px);">▲</span>
                  <span style="font-size: 1rem; font-weight: 800; margin-top: 0.2rem;">${idea.upvotes || 0}</span>
                  <span style="font-size: 0.6rem; font-weight: 600; text-transform: uppercase; opacity: 0.85;">${hasUpvoted ? 'VOTED' : 'VOTE'}</span>
                </button>

                <!-- Idea Content -->
                <div style="flex: 1; min-width: 0;">
                  <div style="display: flex; gap: 0.45rem; align-items: center; margin-bottom: 0.45rem; flex-wrap: wrap;">
                    <span style="font-size: 0.725rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                      ${idea.type === 'improvement' ? '✨ Improvement' : '🎤 New Event'}
                    </span>
                    <span style="font-size: 0.725rem; font-weight: 700; color: var(--mint); background: var(--mint-light); padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                      ${idea.category}
                    </span>
                    <span style="font-size: 0.725rem; font-weight: 700; color: #475569; background: #f1f5f9; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">
                      ${idea.status === 'approved' ? '✅ Approved for Schedule' : (idea.status === 'under_review' ? '👀 Under Council Review' : '🔥 Community Voting')}
                    </span>
                  </div>

                  <h3 style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); margin-bottom: 0.45rem; line-height: 1.3;">
                    ${idea.title}
                  </h3>

                  <p style="font-size: 0.875rem; color: var(--text-secondary); line-height: 1.5; margin-bottom: 0.85rem;">
                    ${idea.description}
                  </p>

                  <!-- Suggested Venue & Guests Pills -->
                  <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; margin-bottom: 0.85rem; font-size: 0.775rem; color: var(--text-secondary);">
                    ${idea.suggestedVenue ? `<div>📍 <strong>Venue:</strong> ${idea.suggestedVenue}</div>` : ''}
                    ${idea.suggestedGuest ? `<div>⭐ <strong>Theme/Guest:</strong> ${idea.suggestedGuest}</div>` : ''}
                  </div>

                  <!-- Author & Discussion Footer -->
                  <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="font-size: 0.775rem; color: var(--text-tertiary);">
                      Suggested by <strong>${idea.authorName}</strong> (${idea.department} • ${idea.year})
                    </div>

                    <div style="display: flex; align-items: center; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm btn-toggle-comments" data-idea-id="${idea.id}" style="font-size: 0.75rem; padding: 0.25rem 0.65rem; border-radius: var(--radius-full);">
                        💬 Suggestions (${(idea.comments || []).length})
                      </button>

                      ${user && (idea.userId === user.uid || isUserAdmin(user)) ? `
                        <button class="btn btn-secondary btn-sm btn-delete-own-idea" data-idea-id="${idea.id}" style="font-size: 0.725rem; font-weight: 700; padding: 0.2rem 0.55rem; color: #dc2626; border-color: #fca5a5; background: #fff5f5; border-radius: var(--radius-full); cursor: pointer;" title="Delete your suggestion">
                          🗑️ Delete
                        </button>
                      ` : ''}
                    </div>
                  </div>

                  <!-- Comments & Discussion Box -->
                  ${activeCommentIdeaId === idea.id ? `
                    <div style="margin-top: 1rem; padding-top: 1rem; border-top: 1px dashed var(--border-subtle); display: flex; flex-direction: column; gap: 0.75rem;">
                      <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
                        💬 Discussion & Suggestions
                      </div>

                      <div style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto;">
                        ${(!idea.comments || idea.comments.length === 0) ? `
                          <div style="font-size: 0.8rem; color: var(--text-tertiary); font-style: italic;">
                            No comments yet. Add the first suggestion or feedback!
                          </div>
                        ` : idea.comments.map(c => `
                          <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.6rem 0.75rem; font-size: 0.8rem;">
                            <div style="display: flex; justify-content: space-between; font-weight: 700; color: var(--text-primary); margin-bottom: 0.2rem;">
                              <span>${c.authorName} <span style="font-size: 0.7rem; font-weight: 400; color: var(--text-tertiary);">(${c.department || 'Student'})</span></span>
                              <span style="font-size: 0.7rem; color: var(--text-tertiary); font-weight: 400;">${c.time}</span>
                            </div>
                            <div style="color: var(--text-secondary); line-height: 1.4;">${c.text}</div>
                          </div>
                        `).join('')}
                      </div>

                      <!-- Add Comment Form -->
                      <form class="form-add-comment" data-idea-id="${idea.id}" style="display: flex; gap: 0.4rem; margin-top: 0.25rem;">
                        <input type="text" class="form-control form-control-sm comment-input" placeholder="Add your suggestion (e.g. recommend DJ, timings)..." required style="font-size: 0.8rem;" />
                        <button type="submit" class="btn btn-primary btn-sm" style="font-size: 0.75rem; font-weight: 700; white-space: nowrap;">
                          Send 💬
                        </button>
                      </form>
                    </div>
                  ` : ''}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;

    // Category Filter Buttons
    container.querySelectorAll('.cat-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        currentFilter = e.currentTarget.getAttribute('data-filter');
        render();
      });
    });

    // Open Post Idea Modal
    const openModalHandler = () => {
      openIdeaModal(async () => {
        ideas = await getCampusIdeas();
        render();
      });
    };
    container.querySelector('#btn-open-post-idea')?.addEventListener('click', openModalHandler);
    container.querySelector('#btn-zero-post-idea')?.addEventListener('click', openModalHandler);

    // Upvote Button Listeners
    container.querySelectorAll('.btn-upvote-idea').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!user) {
          navigateTo('login');
          return;
        }
        const ideaId = e.currentTarget.getAttribute('data-idea-id');
        await toggleUpvoteIdea(ideaId, user);
        ideas = getCachedIdeasSync();
        render();
      });
    });

    // Toggle Comments Listeners
    container.querySelectorAll('.btn-toggle-comments').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const ideaId = e.currentTarget.getAttribute('data-idea-id');
        activeCommentIdeaId = activeCommentIdeaId === ideaId ? null : ideaId;
        render();
      });
    });

    // Add Comment Listeners
    container.querySelectorAll('.form-add-comment').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!user) {
          navigateTo('login');
          return;
        }
        const ideaId = e.currentTarget.getAttribute('data-idea-id');
        const input = e.currentTarget.querySelector('.comment-input');
        const text = input.value;

        await addCommentToIdea(ideaId, text, user);
        ideas = getCachedIdeasSync();
        render();
      });
    });

    // Delete Own Idea Listener
    container.querySelectorAll('.btn-delete-own-idea').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const ideaId = e.currentTarget.getAttribute('data-idea-id');
        if (confirm('Are you sure you want to remove your suggestion from the campus wishlist?')) {
          await deleteIdea(ideaId);
          ideas = await getCampusIdeas();
          render();
        }
      });
    });
  };

  // Instant zero-delay render
  render();

  // Async sync from Firestore
  getCampusIdeas().then(freshIdeas => {
    if (freshIdeas) {
      ideas = freshIdeas;
      render();
    }
  }).catch(() => {});
}
