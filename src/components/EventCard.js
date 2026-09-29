import { getEventRatingStats } from '../services/reviews';

export function createEventCardHtml(event, registrationStatus = null, isEligible = true, isAllowed = true) {
  const isPastDeadline = new Date(event.registrationDeadline) < new Date();
  const ratingStats = getEventRatingStats(event.id);
  const isClosed = event.visibility === 'closed';
  
  let actionButton = '';
  if (registrationStatus) {
    actionButton = `<span class="badge badge-${registrationStatus}">Status: ${registrationStatus}</span>`;
  } else if (isClosed && !isAllowed) {
    actionButton = `<button class="btn btn-secondary btn-sm" disabled style="opacity: 0.75; cursor: not-allowed;" title="Registration is restricted to invited participants">🔒 Invite Only</button>`;
  } else if (isPastDeadline) {
    actionButton = `<button class="btn btn-secondary btn-sm" disabled>Deadline Passed</button>`;
  } else {
    actionButton = `<button class="btn btn-primary btn-sm btn-register" data-event-id="${event.id}">Register Now</button>`;
  }

  const deptClass = event.department.includes('Computer') ? 'dept-cs' : (event.department.includes('Info') ? 'dept-it' : 'dept-robo');

  return `
    <div class="card card-hover" style="display: flex; flex-direction: column; justify-content: space-between; background: #ffffff;">
      <div>
        <div class="event-card-header ${deptClass}"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            ${isClosed ? `
              <span style="font-size: 0.725rem; font-weight: 800; color: #7c3aed; background: #ede9fe; border: 1px solid #ddd6fe; padding: 0.25rem 0.65rem; border-radius: var(--radius-full); display: inline-flex; align-items: center; gap: 0.25rem;" title="Closed event: Visible to listed participants only">
                🔒 Closed Roster
              </span>
            ` : ''}
            <span style="font-size: 0.725rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.25rem 0.65rem; border-radius: var(--radius-full);">
              ${event.department}
            </span>
            <span style="font-size: 0.725rem; font-weight: 700; color: var(--mint); background: var(--mint-light); padding: 0.25rem 0.65rem; border-radius: var(--radius-full); text-transform: capitalize;">
              ${event.category === 'technical' ? '💻 Tech' : (event.category === 'sports' ? '🏆 Sports' : (event.category === 'social' ? '🎉 Social' : (event.category === 'notice' ? '📢 Notice' : '✨ Event')))}
            </span>
            <button type="button" class="btn-event-reviews" data-event-id="${event.id}" style="background: rgba(245, 158, 11, 0.12); color: #d97706; border: 1px solid rgba(245, 158, 11, 0.3); font-size: 0.725rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: var(--radius-full); cursor: pointer; display: inline-flex; align-items: center; gap: 0.2rem;" title="View & submit student reviews">
              ★ ${ratingStats.avgRating} <span style="font-weight: 500; font-size: 0.675rem; color: #b45309;">(${ratingStats.totalReviews})</span>
            </button>
          </div>
          <span style="font-size: 0.75rem; color: var(--text-tertiary); font-weight: 500;">
            Ends ${event.registrationDeadline}
          </span>
        </div>

        <h3 style="margin-bottom: 0.5rem; font-size: 1.2rem; color: var(--text-primary);">${event.title}</h3>
        <p style="font-size: 0.875rem; color: var(--text-secondary); margin-bottom: 1.25rem; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;">
          ${event.description}
        </p>

        <div style="background: #f8fafc; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); padding: 0.85rem; margin-bottom: 1.25rem; font-size: 0.825rem; color: var(--text-secondary); display: flex; flex-direction: column; gap: 0.4rem;">
          <div>📅 <strong>Date:</strong> ${event.date} (${event.time})</div>
          <div>📍 <strong>Venue:</strong> ${event.venue}</div>
          <div>🎓 <strong>Eligible:</strong> ${(event.eligibleYears || []).join(', ')}</div>
          ${event.externalLink ? `
            <div style="margin-top: 0.35rem; padding-top: 0.35rem; border-top: 1px dashed var(--border-subtle);">
              🔗 <strong>External Link:</strong> 
              <a href="${event.externalLink}" target="_blank" rel="noopener noreferrer" style="color: var(--primary); font-weight: 700; text-decoration: underline; word-break: break-all;">
                ${event.externalLink.length > 35 ? event.externalLink.slice(0, 35) + '...' : event.externalLink} ↗
              </a>
            </div>
          ` : ''}
        </div>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-subtle); padding-top: 1rem; flex-wrap: wrap; gap: 0.5rem;">
        <!-- Find Teammates & Volunteer & Reviews Buttons -->
        <div style="display: flex; gap: 0.35rem; flex-wrap: wrap; align-items: center;">
          <button class="btn btn-secondary btn-sm btn-find-team" data-event-id="${event.id}" style="font-size: 0.75rem; padding: 0.35rem 0.55rem; gap: 0.25rem;" title="Find or form a squad for this event">
            🤝 Squad
          </button>
          <button class="btn btn-secondary btn-sm btn-apply-volunteer" data-event-id="${event.id}" style="font-size: 0.75rem; padding: 0.35rem 0.55rem; gap: 0.25rem; background: rgba(16, 185, 129, 0.08); color: var(--mint); border-color: rgba(16, 185, 129, 0.3);" title="Join the event organizing volunteer team">
            🙋 Volunteer
          </button>
          <button class="btn btn-secondary btn-sm btn-event-reviews" data-event-id="${event.id}" style="font-size: 0.75rem; padding: 0.35rem 0.55rem; gap: 0.25rem;" title="View reviews & ratings">
            ⭐ Reviews
          </button>
          ${event.externalLink ? `
            <a href="${event.externalLink}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: linear-gradient(135deg, #0284c7, #0369a1); color: #ffffff; font-size: 0.75rem; font-weight: 700; padding: 0.35rem 0.65rem; border-radius: var(--radius-sm); text-decoration: none; display: inline-flex; align-items: center; gap: 0.25rem;" title="Open Official Link / Rulebook">
              🔗 Open Link ↗
            </a>
          ` : ''}
        </div>

        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <div style="font-size: 0.75rem; color: var(--text-tertiary);">
            ${event.maxParticipants} spots
          </div>
          ${actionButton}
        </div>
      </div>
    </div>
  `;
}
