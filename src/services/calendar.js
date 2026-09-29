/**
 * EventPulse — 1-Click Calendar Sync Service
 * Generates Google Calendar URLs and downloadable .ics files for Apple Calendar / Outlook
 */

/**
 * Parses event date and time strings into JavaScript Date objects
 * e.g., date: "2026-08-25", time: "09:30 AM - 05:00 PM"
 */
export function parseEventDateTime(event) {
  try {
    const dateStr = event.date || new Date().toISOString().slice(0, 10);
    let startTimeStr = '09:00 AM';
    let endTimeStr = '05:00 PM';

    if (event.time) {
      const parts = event.time.split('-');
      if (parts[0]) startTimeStr = parts[0].trim();
      if (parts[1]) endTimeStr = parts[1].trim();
      else endTimeStr = startTimeStr;
    }

    const parseTime = (baseDate, timeStr) => {
      const match = timeStr.match(/(\d{1,2}):?(\d{2})?\s*(AM|PM)?/i);
      if (!match) return new Date(baseDate);

      let hours = parseInt(match[1], 10);
      const minutes = match[2] ? parseInt(match[2], 10) : 0;
      const meridiem = match[3] ? match[3].toUpperCase() : null;

      if (meridiem === 'PM' && hours < 12) hours += 12;
      if (meridiem === 'AM' && hours === 12) hours = 0;

      const d = new Date(baseDate);
      d.setHours(hours, minutes, 0, 0);
      return d;
    };

    const baseDate = new Date(dateStr);
    if (isNaN(baseDate.getTime())) {
      const now = new Date();
      return { start: now, end: new Date(now.getTime() + 2 * 60 * 60 * 1000) };
    }

    const start = parseTime(baseDate, startTimeStr);
    let end = parseTime(baseDate, endTimeStr);

    if (end <= start) {
      end = new Date(start.getTime() + 3 * 60 * 60 * 1000); // 3 hour default duration
    }

    return { start, end };
  } catch (err) {
    console.warn('Date parsing warning:', err);
    const now = new Date();
    return { start: now, end: new Date(now.getTime() + 2 * 60 * 60 * 1000) };
  }
}

/**
 * Format date to ISO format required by Google / iCalendar: YYYYMMDDTHHmmssZ
 */
function formatToUtcString(date) {
  return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
}

/**
 * Generates Google Calendar Web Link (1-Click Add)
 */
export function getGoogleCalendarUrl(event) {
  const { start, end } = parseEventDateTime(event);
  const startUtc = formatToUtcString(start);
  const endUtc = formatToUtcString(end);

  const title = encodeURIComponent(event.title || 'EventPulse Campus Event');
  const details = encodeURIComponent(
    `${event.description || ''}\n\n📍 Venue: ${event.venue || 'Campus Auditorium'}\n🎓 Department: ${event.department || 'University'}\n⚡ Powered by EventPulse Platform`
  );
  const location = encodeURIComponent(event.venue || 'Sanjivani University Campus');

  return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startUtc}/${endUtc}&details=${details}&location=${location}&sf=true&output=xml`;
}

/**
 * Generates and downloads an iCalendar (.ics) file for Apple Calendar, Outlook, and Mobile devices
 */
export function downloadIcsCalendarFile(event) {
  const { start, end } = parseEventDateTime(event);
  const startUtc = formatToUtcString(start);
  const endUtc = formatToUtcString(end);
  const nowUtc = formatToUtcString(new Date());

  const uid = `eventpulse-${event.id || Date.now()}@eventpulse-su-34a42.web.app`;
  const title = (event.title || 'Campus Event').replace(/[\r\n]/g, ' ');
  const venue = (event.venue || 'Campus Auditorium').replace(/[\r\n]/g, ' ');
  const description = (event.description || '').replace(/\n/g, '\\n').replace(/,/g, '\\,');

  const icsContent = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//EventPulse//Campus Event Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${nowUtc}`,
    `DTSTART:${startUtc}`,
    `DTEND:${endUtc}`,
    `SUMMARY:${title}`,
    `DESCRIPTION:${description}\\n\\nOrganized by: ${event.department || 'EventPulse'}\\nVenue: ${venue}`,
    `LOCATION:${venue}`,
    'STATUS:CONFIRMED',
    'BEGIN:VALARM',
    'TRIGGER:-PT1H',
    'ACTION:DISPLAY',
    'DESCRIPTION:Reminder: Upcoming Event in 1 hour on EventPulse',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR'
  ].join('\r\n');

  const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
  const link = document.createElement('a');
  link.href = window.URL.createObjectURL(blob);
  const safeName = (event.title || 'event').replace(/[^a-zA-Z0-9_-]/g, '_');
  link.setAttribute('download', `${safeName}.ics`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.URL.revokeObjectURL(link.href);
}

/**
 * Helper to show a floating calendar picker menu
 */
export function openCalendarSyncPicker(event, buttonElement) {
  const existing = document.getElementById('ep-calendar-picker-popover');
  if (existing) {
    existing.remove();
    return;
  }

  const rect = buttonElement.getBoundingClientRect();
  const popover = document.createElement('div');
  popover.id = 'ep-calendar-picker-popover';
  popover.style.cssText = `
    position: fixed;
    top: ${rect.bottom + 6}px;
    left: ${Math.min(rect.left, window.innerWidth - 220)}px;
    z-index: 100000;
    background: #ffffff;
    border: 1px solid var(--border-strong, #cbd5e1);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
    border-radius: 12px;
    padding: 0.5rem;
    display: flex;
    flex-direction: column;
    gap: 0.35rem;
    min-width: 200px;
    animation: fadeIn 0.15s ease;
  `;

  popover.innerHTML = `
    <div style="font-size: 0.725rem; font-weight: 800; color: #64748b; padding: 0.25rem 0.5rem; text-transform: uppercase; letter-spacing: 0.05em;">
      📅 Sync to Calendar
    </div>
    <a href="${getGoogleCalendarUrl(event)}" target="_blank" rel="noopener noreferrer" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.65rem; border-radius: 8px; color: #1e293b; font-size: 0.825rem; font-weight: 700; text-decoration: none; transition: background 0.15s;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
      <span style="font-size: 1.1rem;">🌐</span> Google Calendar
    </a>
    <button id="btn-sync-apple-ics" style="display: flex; align-items: center; gap: 0.6rem; padding: 0.5rem 0.65rem; border-radius: 8px; color: #1e293b; font-size: 0.825rem; font-weight: 700; border: none; background: transparent; cursor: pointer; text-align: left; transition: background 0.15s; width: 100%;" onmouseover="this.style.background='#f1f5f9'" onmouseout="this.style.background='transparent'">
      <span style="font-size: 1.1rem;">🍏</span> Apple / Outlook (.ics)
    </button>
  `;

  document.body.appendChild(popover);

  popover.querySelector('#btn-sync-apple-ics')?.addEventListener('click', () => {
    downloadIcsCalendarFile(event);
    popover.remove();
  });

  const closeOnClickOutside = (e) => {
    if (!popover.contains(e.target) && e.target !== buttonElement) {
      popover.remove();
      document.removeEventListener('click', closeOnClickOutside);
    }
  };
  setTimeout(() => document.addEventListener('click', closeOnClickOutside), 10);
}
