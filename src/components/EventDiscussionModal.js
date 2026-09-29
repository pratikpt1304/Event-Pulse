/**
 * EventPulse — Event Discussion & Live Q&A Modal Component
 * Displays live questions, answers, verified organizer responses, upvotes, and asking interface.
 */

import { getEventDiscussions, getCachedDiscussionsSync, askEventQuestion, answerEventQuestion, toggleUpvoteQuestion } from '../services/discussions';
import { getCurrentUser, isUserAdmin } from '../services/auth';

export async function openEventDiscussionModal(event) {
  const user = getCurrentUser();
  const existing = document.getElementById('modal-event-discussion-root');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'modal-event-discussion-root';
  modal.className = 'modal-overlay';
  modal.style.cssText = 'position: fixed; inset: 0; z-index: 100000; background: rgba(0, 0, 0, 0.7); backdrop-filter: blur(5px); display: flex; align-items: center; justify-content: center; padding: 1rem;';

  let discussions = getCachedDiscussionsSync(event.id) || [];
  let activeFilter = 'all'; // 'all' | 'answered' | 'unanswered'
  let replyingToQuestionId = null;

  const renderModalContent = () => {
    const filteredQuestions = discussions.filter(q => {
      const hasAnswers = Array.isArray(q.answers) && q.answers.length > 0;
      if (activeFilter === 'answered') return hasAnswers || q.isResolved;
      if (activeFilter === 'unanswered') return !hasAnswers && !q.isResolved;
      return true;
    });

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 680px; width: 94%; height: 88vh; max-height: 88vh; display: flex; flex-direction: column; padding: 0; overflow: hidden; border-radius: 20px; background: #ffffff; box-shadow: 0 25px 60px rgba(0,0,0,0.25);">
        
        <!-- Header Bar -->
        <div style="padding: 1.25rem 1.5rem; background: linear-gradient(135deg, #1e1b4b, #312e81); color: #ffffff; display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; border-bottom: 1px solid rgba(255,255,255,0.1); flex-shrink: 0;">
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <span style="font-size: 0.725rem; font-weight: 800; background: rgba(139, 92, 246, 0.3); color: #ddd6fe; padding: 0.2rem 0.6rem; border-radius: 999px; border: 1px solid rgba(139, 92, 246, 0.4);">
                💬 Live Event Q&A
              </span>
              <span style="font-size: 0.75rem; color: #cbd5e1;">📍 ${event.venue || 'Campus Auditorium'}</span>
            </div>
            <h2 style="font-size: 1.2rem; font-weight: 900; color: #ffffff; margin: 0; line-height: 1.3;">
              ${event.title}
            </h2>
          </div>
          <button id="btn-close-discussion-modal" style="background: rgba(255,255,255,0.15); border: none; color: #ffffff; width: 32px; height: 32px; border-radius: 50%; cursor: pointer; font-size: 1rem; display: flex; align-items: center; justify-content: center;">
            ✕
          </button>
        </div>

        <!-- Ask Question Input Bar -->
        <div style="padding: 1rem 1.5rem; background: #f8fafc; border-bottom: 1px solid #e2e8f0; flex-shrink: 0;">
          ${user ? `
            <form id="form-ask-question" style="display: flex; gap: 0.6rem;">
              <input type="text" id="input-question-text" class="form-control" placeholder="Ask a question (e.g. reporting time, dress code, rule clarifications)..." style="flex: 1; font-size: 0.875rem;" required autocomplete="off" />
              <button type="submit" id="btn-submit-question" class="btn btn-primary" style="padding: 0.5rem 1.1rem; font-weight: 800; font-size: 0.85rem; white-space: nowrap; background: #7c3aed;">
                Ask
              </button>
            </form>
          ` : `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.85rem; color: #64748b;">
              <span>Have a question about this event? Log in to ask the organizers!</span>
              <button id="btn-login-to-ask" class="btn btn-sm btn-primary" style="padding: 0.35rem 0.8rem; font-size: 0.775rem;">Log In</button>
            </div>
          `}
        </div>

        <!-- Filter Sub-Tabs -->
        <div style="padding: 0.65rem 1.5rem; display: flex; justify-content: space-between; align-items: center; background: #ffffff; border-bottom: 1px solid #f1f5f9; flex-shrink: 0;">
          <div style="display: flex; gap: 0.4rem;">
            <button class="filter-tab-pill ${activeFilter === 'all' ? 'active' : ''}" data-filter="all" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid ${activeFilter === 'all' ? '#7c3aed' : '#e2e8f0'}; background: ${activeFilter === 'all' ? '#f3e8ff' : '#ffffff'}; color: ${activeFilter === 'all' ? '#7c3aed' : '#64748b'}; cursor: pointer;">
              All (${discussions.length})
            </button>
            <button class="filter-tab-pill ${activeFilter === 'answered' ? 'active' : ''}" data-filter="answered" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid ${activeFilter === 'answered' ? '#10b981' : '#e2e8f0'}; background: ${activeFilter === 'answered' ? '#ecfdf5' : '#ffffff'}; color: ${activeFilter === 'answered' ? '#059669' : '#64748b'}; cursor: pointer;">
              ✅ Answered
            </button>
            <button class="filter-tab-pill ${activeFilter === 'unanswered' ? 'active' : ''}" data-filter="unanswered" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.65rem; border-radius: 999px; border: 1px solid ${activeFilter === 'unanswered' ? '#f59e0b' : '#e2e8f0'}; background: ${activeFilter === 'unanswered' ? '#fffbeb' : '#ffffff'}; color: ${activeFilter === 'unanswered' ? '#d97706' : '#64748b'}; cursor: pointer;">
              ⏳ Open Queries
            </button>
          </div>
          <span style="font-size: 0.75rem; color: #94a3b8;">${filteredQuestions.length} queries</span>
        </div>

        <!-- Questions & Answers Scrollable List -->
        <div style="flex: 1; overflow-y: auto; padding: 1.25rem 1.5rem; display: flex; flex-direction: column; gap: 1rem; background: #f8fafc;">
          ${filteredQuestions.length === 0 ? `
            <div style="text-align: center; padding: 3rem 1rem; color: #94a3b8;">
              <div style="font-size: 2.2rem; margin-bottom: 0.5rem;">💬</div>
              <div style="font-weight: 700; color: #475569;">No questions in this section</div>
              <div style="font-size: 0.8rem; margin-top: 0.25rem;">Got any doubts about rules or schedule? Ask above!</div>
            </div>
          ` : filteredQuestions.map(q => {
            const hasUpvoted = user && Array.isArray(q.upvotes) && q.upvotes.includes(user.uid);
            const answers = Array.isArray(q.answers) ? q.answers : [];

            return `
              <div class="card" style="padding: 1.1rem; background: #ffffff; border-radius: 14px; border: 1px solid #e2e8f0; box-shadow: 0 2px 10px rgba(0,0,0,0.03);">
                
                <!-- Question Top Row -->
                <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.75rem; margin-bottom: 0.6rem;">
                  <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
                    <div style="width: 28px; height: 28px; border-radius: 50%; background: #e0e7ff; color: #4338ca; font-weight: 800; font-size: 0.725rem; display: flex; align-items: center; justify-content: center;">
                      ${(q.authorName || 'ST').slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <div style="font-size: 0.825rem; font-weight: 800; color: #1e293b; line-height: 1.2;">
                        ${q.authorName || 'Student'}
                        ${q.authorRole === 'admin' ? '<span style="color:#ef4444;font-size:0.65rem;margin-left:0.3rem;">[ADMIN]</span>' : ''}
                      </div>
                      <div style="font-size: 0.7rem; color: #94a3b8;">
                        ${q.authorDept || 'Campus'} • ${q.createdAt ? new Date(q.createdAt).toLocaleDateString() : 'Recent'}
                      </div>
                    </div>
                  </div>

                  <!-- Upvote Button -->
                  <button class="btn-upvote-q" data-question-id="${q.id}" style="background: ${hasUpvoted ? '#f5f3ff' : '#f8fafc'}; color: ${hasUpvoted ? '#7c3aed' : '#64748b'}; border: 1px solid ${hasUpvoted ? '#c4b5fd' : '#e2e8f0'}; padding: 0.25rem 0.6rem; border-radius: 999px; font-size: 0.75rem; font-weight: 800; cursor: pointer; display: flex; align-items: center; gap: 0.3rem;">
                    <span>▲</span>
                    <span>${(q.upvotes || []).length}</span>
                  </button>
                </div>

                <!-- Question Text -->
                <div style="font-size: 0.95rem; font-weight: 700; color: #0f172a; line-height: 1.45; margin-bottom: 0.85rem;">
                  Q: ${q.question}
                </div>

                <!-- Answers List -->
                ${answers.length > 0 ? `
                  <div style="display: flex; flex-direction: column; gap: 0.6rem; margin-bottom: 0.75rem;">
                    ${answers.map(ans => `
                      <div style="padding: 0.75rem 0.9rem; border-radius: 10px; background: ${ans.isOfficial ? '#faf5ff' : '#f8fafc'}; border: 1px solid ${ans.isOfficial ? '#e9d5ff' : '#e2e8f0'}; border-left: 3.5px solid ${ans.isOfficial ? '#7c3aed' : '#cbd5e1'};">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem; flex-wrap: wrap; gap: 0.4rem;">
                          <div style="display: flex; align-items: center; gap: 0.4rem;">
                            <span style="font-size: 0.8rem; font-weight: 800; color: ${ans.isOfficial ? '#581c87' : '#1e293b'};">
                              ${ans.authorName}
                            </span>
                            ${ans.isOfficial ? `
                              <span style="font-size: 0.65rem; font-weight: 800; background: linear-gradient(135deg, #7c3aed, #4f46e5); color: #ffffff; padding: 0.15rem 0.45rem; border-radius: 4px;">
                                ⚡ ORGANIZER VERIFIED
                              </span>
                            ` : ''}
                          </div>
                          <span style="font-size: 0.675rem; color: #94a3b8;">${ans.createdAt ? new Date(ans.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}</span>
                        </div>
                        <div style="font-size: 0.85rem; color: #334155; line-height: 1.5;">
                          ${ans.text}
                        </div>
                      </div>
                    `).join('')}
                  </div>
                ` : ''}

                <!-- Reply Toggle / Form -->
                <div style="border-top: 1px dashed #f1f5f9; padding-top: 0.6rem; display: flex; justify-content: space-between; align-items: center;">
                  <button class="btn-toggle-reply" data-question-id="${q.id}" style="background: none; border: none; color: #7c3aed; font-size: 0.775rem; font-weight: 700; cursor: pointer; padding: 0; display: flex; align-items: center; gap: 0.25rem;">
                    💬 ${replyingToQuestionId === q.id ? 'Cancel Reply' : (answers.length > 0 ? 'Add Another Answer' : 'Answer this question')}
                  </button>
                  <span style="font-size: 0.7rem; color: #94a3b8;">${answers.length} reply${answers.length === 1 ? '' : 'ies'}</span>
                </div>

                <!-- Inline Reply Box -->
                ${replyingToQuestionId === q.id ? `
                  <div style="margin-top: 0.75rem; padding: 0.75rem; background: #f8fafc; border-radius: 10px; border: 1px solid #e2e8f0;">
                    ${user ? `
                      <form class="form-submit-answer" data-question-id="${q.id}" style="display: flex; flex-direction: column; gap: 0.5rem;">
                        <textarea class="form-control input-answer-text" rows="2" placeholder="Write clear answer or official clarification..." style="font-size: 0.85rem;" required></textarea>
                        <div style="display: flex; justify-content: flex-end; gap: 0.5rem;">
                          <button type="button" class="btn btn-sm btn-secondary btn-cancel-reply" style="padding: 0.3rem 0.75rem; font-size: 0.75rem;">Cancel</button>
                          <button type="submit" class="btn btn-sm btn-primary" style="padding: 0.3rem 0.85rem; font-size: 0.75rem; font-weight: 700; background: #7c3aed;">Post Answer</button>
                        </div>
                      </form>
                    ` : `
                      <div style="font-size: 0.8rem; color: #64748b; text-align: center;">Please log in to reply.</div>
                    `}
                  </div>
                ` : ''}

              </div>
            `;
          }).join('')}
        </div>

      </div>
    `;

    attachListeners();
  };

  const attachListeners = () => {
    // Close button & backdrop
    modal.querySelector('#btn-close-discussion-modal')?.addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });

    // Filter sub-tabs
    modal.querySelectorAll('.filter-tab-pill').forEach(btn => {
      btn.addEventListener('click', (e) => {
        activeFilter = e.currentTarget.getAttribute('data-filter');
        renderModalContent();
      });
    });

    // Ask Question Form
    const askForm = modal.querySelector('#form-ask-question');
    if (askForm) {
      askForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const input = modal.querySelector('#input-question-text');
        const text = input.value.trim();
        if (!text) return;

        const submitBtn = modal.querySelector('#btn-submit-question');
        submitBtn.disabled = true;
        submitBtn.textContent = '...';

        try {
          const newQ = await askEventQuestion({
            eventId: event.id,
            eventTitle: event.title,
            questionText: text,
            user
          });
          discussions = [newQ, ...discussions];
          input.value = '';
          renderModalContent();
        } catch (err) {
          alert('Error posting question: ' + err.message);
          submitBtn.disabled = false;
          submitBtn.textContent = 'Ask';
        }
      });
    }

    // Upvote Buttons
    modal.querySelectorAll('.btn-upvote-q').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        if (!user) {
          alert('Please log in to upvote questions.');
          return;
        }
        const qId = btn.getAttribute('data-question-id');
        const updated = await toggleUpvoteQuestion(event.id, qId, user.uid);
        if (updated) {
          const idx = discussions.findIndex(q => q.id === qId);
          if (idx !== -1) discussions[idx] = updated;
          renderModalContent();
        }
      });
    });

    // Toggle Reply
    modal.querySelectorAll('.btn-toggle-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        const qId = btn.getAttribute('data-question-id');
        replyingToQuestionId = replyingToQuestionId === qId ? null : qId;
        renderModalContent();
      });
    });

    modal.querySelectorAll('.btn-cancel-reply').forEach(btn => {
      btn.addEventListener('click', () => {
        replyingToQuestionId = null;
        renderModalContent();
      });
    });

    // Submit Answer Form
    modal.querySelectorAll('.form-submit-answer').forEach(form => {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const qId = form.getAttribute('data-question-id');
        const text = form.querySelector('.input-answer-text').value.trim();
        if (!text) return;

        const isUserOrg = user.role === 'admin' || user.role === 'organizer' || isUserAdmin(user);

        try {
          const updatedQ = await answerEventQuestion({
            eventId: event.id,
            questionId: qId,
            answerText: text,
            user,
            isOfficial: isUserOrg
          });

          const idx = discussions.findIndex(q => q.id === qId);
          if (idx !== -1) discussions[idx] = updatedQ;
          replyingToQuestionId = null;
          renderModalContent();
        } catch (err) {
          alert('Error posting answer: ' + err.message);
        }
      });
    });
  };

  document.body.appendChild(modal);
  renderModalContent();

  // Background Live Fetch
  getEventDiscussions(event.id).then(fresh => {
    discussions = fresh;
    renderModalContent();
  });
}
