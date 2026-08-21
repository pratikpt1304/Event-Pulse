import { getEventReviews, submitReview, getEventRatingStats, deleteReview } from '../services/reviews';
import { getCurrentUser, isUserAdmin } from '../services/auth';

export async function openReviewModal(event, onReviewAdded = null) {
  const user = getCurrentUser();
  const existing = document.getElementById('review-modal');
  if (existing) existing.remove();

  let reviews = await getEventReviews(event.id);
  let selectedRating = 5;

  const modal = document.createElement('div');
  modal.id = 'review-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  const renderModal = () => {
    const stats = getEventRatingStats(event.id);

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 540px; padding: 1.75rem; max-height: 88vh; display: flex; flex-direction: column; overflow: hidden;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <div style="font-size: 1.25rem; font-weight: 800; color: var(--text-primary); display: flex; align-items: center; gap: 0.45rem;">
              ⭐ Reviews & Feedback
            </div>
            <div style="font-size: 0.85rem; color: var(--text-secondary); margin-top: 0.2rem;">
              Ratings and experiences for <strong style="color: var(--primary);">${event.title}</strong>
            </div>
          </div>
          <button id="btn-close-review-modal" style="background: none; border: none; font-size: 1.25rem; cursor: pointer; color: var(--text-tertiary);">✕</button>
        </div>

        <!-- Rating Summary Bar -->
        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.75rem 1rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 1.6rem; font-weight: 900; color: #f59e0b;">★ ${stats.avgRating}</span>
            <span style="font-size: 0.85rem; color: var(--text-secondary);">out of 5.0</span>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-tertiary); font-weight: 600;">
            ${reviews.length} student review(s)
          </div>
        </div>

        <div style="overflow-y: auto; flex: 1; padding-right: 0.25rem; display: flex; flex-direction: column; gap: 1.25rem;">
          <!-- Write Review Section -->
          ${user ? `
            <form id="form-write-review" style="background: rgba(124, 58, 237, 0.04); border: 1px dashed rgba(124, 58, 237, 0.3); border-radius: var(--radius-sm); padding: 1rem;">
              <div style="font-size: 0.875rem; font-weight: 700; color: var(--primary); margin-bottom: 0.65rem;">
                ✍️ Leave Your Rating & Experience
              </div>

              <!-- Interactive Star Picker -->
              <div style="display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.75rem;" id="star-picker-container">
                ${[1, 2, 3, 4, 5].map(star => `
                  <button type="button" class="star-btn" data-star="${star}" style="background: none; border: none; font-size: 1.5rem; cursor: pointer; color: ${star <= selectedRating ? '#f59e0b' : '#cbd5e1'}; padding: 0 2px; transition: transform 0.1s;">
                    ★
                  </button>
                `).join('')}
                <span id="star-rating-label" style="font-size: 0.8rem; font-weight: 700; color: #f59e0b; margin-left: 0.5rem;">
                  ${getStarLabel(selectedRating)}
                </span>
              </div>

              <div class="form-group" style="margin-bottom: 0.75rem;">
                <textarea id="rev-text" class="form-control" rows="2" placeholder="Share your experience, organization feedback, or project judging highlights..." required style="font-size: 0.825rem;"></textarea>
              </div>

              <div id="rev-form-error" class="alert alert-danger" style="display: none; font-size: 0.8rem; padding: 0.4rem;"></div>

              <button type="submit" id="btn-submit-rev" class="btn btn-primary btn-sm" style="font-weight: 700;">
                ⭐ Post Review
              </button>
            </form>
          ` : `
            <div style="background: #f8fafc; border: 1px solid var(--border-subtle); padding: 0.85rem; border-radius: var(--radius-sm); text-align: center; font-size: 0.85rem;">
              <span>🔑 <a href="#login" id="btn-review-login" style="color: var(--primary); font-weight: 700; text-decoration: none;">Sign in</a> to share your review and rate this event.</span>
            </div>
          `}

          <!-- Reviews List -->
          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
              Student Reviews (${reviews.length})
            </div>

            ${reviews.length === 0 ? `
              <div style="text-align: center; padding: 2rem 1rem; color: var(--text-tertiary); font-size: 0.85rem;">
                <div style="font-size: 2rem; margin-bottom: 0.35rem;">💬</div>
                No reviews yet. Be the first student to review this event!
              </div>
            ` : reviews.map(r => {
              const canDelete = user && (user.uid === r.userId || (user.email && r.studentEmail && user.email.toLowerCase() === r.studentEmail.toLowerCase()) || isUserAdmin(user));
              return `
              <div style="background: #ffffff; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.85rem; display: flex; flex-direction: column; gap: 0.35rem; position: relative;">
                <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                  <div style="font-size: 0.85rem; font-weight: 700; color: var(--text-primary);">
                    ${r.studentName} <span style="font-size: 0.75rem; font-weight: 400; color: var(--text-tertiary);">(${r.department || 'General'})</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <div style="color: #f59e0b; font-size: 0.9rem; font-weight: 800;">
                      ${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}
                    </div>
                    ${canDelete ? `
                      <button class="btn-delete-review" data-review-id="${r.id}" style="background: #fef2f2; border: 1px solid #fca5a5; color: #dc2626; font-size: 0.7rem; font-weight: 700; padding: 0.15rem 0.45rem; border-radius: var(--radius-full); cursor: pointer; display: inline-flex; align-items: center; gap: 0.2rem;" title="Delete your review">
                        🗑️ Delete
                      </button>
                    ` : ''}
                  </div>
                </div>
                <p style="font-size: 0.825rem; color: var(--text-secondary); line-height: 1.45; margin: 0;">
                  "${r.reviewText}"
                </p>
                <div style="font-size: 0.7rem; color: var(--text-tertiary); margin-top: 0.2rem;">
                  📅 ${new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
            `;
            }).join('')}
          </div>
        </div>
      </div>
    `;

    // Close Handler
    const close = () => modal.remove();
    modal.querySelector('#btn-close-review-modal')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    modal.querySelector('#btn-review-login')?.addEventListener('click', () => {
      close();
      window.location.hash = 'login';
    });

    // Delete Review Handler
    modal.querySelectorAll('.btn-delete-review').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const reviewId = e.currentTarget.getAttribute('data-review-id');
        if (confirm('Are you sure you want to delete this review?')) {
          btn.disabled = true;
          btn.textContent = 'Deleting...';
          await deleteReview(reviewId, event.id);
          reviews = await getEventReviews(event.id);
          renderModal();
          if (onReviewAdded) onReviewAdded();
        }
      });
    });

    // Star Picker Interaction
    modal.querySelectorAll('.star-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        selectedRating = Number(e.currentTarget.getAttribute('data-star'));
        modal.querySelectorAll('.star-btn').forEach(b => {
          const s = Number(b.getAttribute('data-star'));
          b.style.color = s <= selectedRating ? '#f59e0b' : '#cbd5e1';
        });
        const label = modal.querySelector('#star-rating-label');
        if (label) label.textContent = getStarLabel(selectedRating);
      });
    });

    // Form Submit Handler
    modal.querySelector('#form-write-review')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const submitBtn = modal.querySelector('#btn-submit-rev');
      const errEl = modal.querySelector('#rev-form-error');
      const reviewText = modal.querySelector('#rev-text').value;

      submitBtn.disabled = true;
      submitBtn.textContent = 'Posting...';

      const res = await submitReview({
        eventId: event.id,
        eventTitle: event.title,
        rating: selectedRating,
        reviewText,
        user
      });

      if (res.success) {
        reviews = await getEventReviews(event.id);
        renderModal();
        if (onReviewAdded) onReviewAdded();
      } else {
        submitBtn.disabled = false;
        submitBtn.textContent = '⭐ Post Review';
        if (errEl) {
          errEl.style.display = 'block';
          errEl.textContent = res.error || 'Failed to post review.';
        }
      }
    });
  };

  renderModal();
  document.body.appendChild(modal);
}

function getStarLabel(rating) {
  switch (rating) {
    case 5: return '⭐⭐⭐⭐⭐ Outstanding!';
    case 4: return '⭐⭐⭐⭐ Very Good';
    case 3: return '⭐⭐⭐ Good';
    case 2: return '⭐⭐ Fair';
    case 1: return '⭐ Poor';
    default: return '⭐⭐⭐⭐⭐ Outstanding!';
  }
}
