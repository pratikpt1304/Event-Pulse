export function openCompletedEventModal(targetEvent, regs) {
  const existing = document.getElementById('completed-event-inspect-modal');
  if (existing) existing.remove();

  const presentCount = regs.filter(r => r.attendance === 'present' || r.status === 'attended').length;
  const absentCount = regs.filter(r => r.attendance === 'absent').length;

  let currentFilter = 'all'; // 'all' | 'present' | 'absent'

  const modal = document.createElement('div');
  modal.id = 'completed-event-inspect-modal';
  modal.className = 'modal-overlay';
  modal.style.zIndex = '9999';

  const downloadCSV = (type) => {
    let listToExport = regs;
    let filename = `${targetEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Master_Report.csv`;
    let headerTitle = `Event: ${targetEvent.title} (Complete Master Report)`;

    if (type === 'present') {
      listToExport = regs.filter(r => r.attendance === 'present' || r.status === 'attended');
      filename = `${targetEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Attended_Present_List.csv`;
      headerTitle = `Event: ${targetEvent.title} (Attended / Present Students)`;
    } else if (type === 'absent') {
      listToExport = regs.filter(r => r.attendance === 'absent');
      filename = `${targetEvent.title.replace(/[^a-zA-Z0-9]/g, '_')}_Absent_Students_List.csv`;
      headerTitle = `Event: ${targetEvent.title} (Absent Students)`;
    }

    let csv = `${headerTitle}\n`;
    csv += `Department: ${targetEvent.department} | Date: ${targetEvent.date} (${targetEvent.time}) | Venue: ${targetEvent.venue}\n\n`;
    csv += `Student Name,PRN,Department,Year,Attendance Status,Certificate ID,Registered Date\n`;

    listToExport.forEach(r => {
      const isPresent = r.attendance === 'present' || r.status === 'attended';
      const isAbsent = r.attendance === 'absent';
      const statusText = isPresent ? 'Present' : (isAbsent ? 'Absent' : 'Pending');
      csv += `"${r.studentName}","${r.prn || 'N/A'}","${r.department || 'General'}","${r.year || '1st Year'}","${statusText}","${r.certificateId || 'N/A'}","${r.registeredAt || 'N/A'}"\n`;
    });

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  const render = () => {
    const filteredRegs = regs.filter(r => {
      if (currentFilter === 'present') return r.attendance === 'present' || r.status === 'attended';
      if (currentFilter === 'absent') return r.attendance === 'absent';
      return true;
    });

    modal.innerHTML = `
      <div class="modal-container" style="max-width: 840px; padding: 1.75rem; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden;">
        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.25rem;">
          <div>
            <div style="display: flex; gap: 0.4rem; align-items: center; margin-bottom: 0.25rem;">
              <span style="font-size: 0.75rem; font-weight: 800; background: #334155; color: #ffffff; padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">🏁 COMPLETED EVENT</span>
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary); background: var(--primary-light); padding: 0.2rem 0.6rem; border-radius: var(--radius-full);">${targetEvent.department}</span>
            </div>
            <h2 style="font-size: 1.4rem; color: var(--text-primary); margin: 0; font-weight: 800;">${targetEvent.title}</h2>
            <div style="font-size: 0.825rem; color: var(--text-secondary); margin-top: 0.25rem;">
              📅 ${targetEvent.date} (${targetEvent.time}) @ ${targetEvent.venue} | Organizer: <strong>${targetEvent.organizerName || 'Coordinator'}</strong>
            </div>
          </div>
          <button id="btn-close-inspect-modal" style="background:none;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-tertiary);">✕</button>
        </div>

        <!-- Summary Metric Cards (Clickable to Filter) -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 0.75rem; margin-bottom: 1.25rem;">
          <div id="stat-filter-all" style="background: ${currentFilter === 'all' ? '#f1f5f9' : '#ffffff'}; padding: 0.75rem 1rem; border-radius: var(--radius-sm); text-align: center; border: 2px solid ${currentFilter === 'all' ? '#64748b' : 'var(--border-subtle)'}; cursor: pointer; transition: all 0.15s;" title="Click to show all registrations">
            <div style="font-size: 0.725rem; font-weight: 800; color: var(--text-tertiary); text-transform: uppercase;">TOTAL REGISTRATIONS</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: var(--text-primary); margin-top: 0.1rem;">${regs.length}</div>
          </div>
          <div id="stat-filter-present" style="background: ${currentFilter === 'present' ? '#dcfce7' : '#ffffff'}; padding: 0.75rem 1rem; border-radius: var(--radius-sm); text-align: center; border: 2px solid ${currentFilter === 'present' ? '#16a34a' : '#bbf7d0'}; cursor: pointer; transition: all 0.15s;" title="Click to filter attended students">
            <div style="font-size: 0.725rem; font-weight: 800; color: #16a34a; text-transform: uppercase;">ATTENDED (PRESENT)</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #16a34a; margin-top: 0.1rem;">${presentCount}</div>
          </div>
          <div id="stat-filter-absent" style="background: ${currentFilter === 'absent' ? '#fee2e2' : '#ffffff'}; padding: 0.75rem 1rem; border-radius: var(--radius-sm); text-align: center; border: 2px solid ${currentFilter === 'absent' ? '#dc2626' : '#fecaca'}; cursor: pointer; transition: all 0.15s;" title="Click to filter absent students">
            <div style="font-size: 0.725rem; font-weight: 800; color: #dc2626; text-transform: uppercase;">ABSENT</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #dc2626; margin-top: 0.1rem;">${absentCount}</div>
          </div>
        </div>

        <!-- Filter & CSV Export Action Bar -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle);">
          <!-- Filter Tabs -->
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            <span style="font-size: 0.775rem; font-weight: 700; color: var(--text-secondary); margin-right: 0.25rem;">Filter:</span>
            <button class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" id="btn-modal-filter-all" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-full);">
              All (${regs.length})
            </button>
            <button class="btn btn-sm ${currentFilter === 'present' ? 'btn-primary' : 'btn-secondary'}" id="btn-modal-filter-present" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-full); background: ${currentFilter === 'present' ? '#16a34a' : ''}; color: ${currentFilter === 'present' ? '#ffffff' : '#16a34a'}; border-color: #bbf7d0;">
              🟢 Present (${presentCount})
            </button>
            <button class="btn btn-sm ${currentFilter === 'absent' ? 'btn-primary' : 'btn-secondary'}" id="btn-modal-filter-absent" style="font-size: 0.75rem; font-weight: 700; padding: 0.25rem 0.6rem; border-radius: var(--radius-full); background: ${currentFilter === 'absent' ? '#dc2626' : ''}; color: ${currentFilter === 'absent' ? '#ffffff' : '#dc2626'}; border-color: #fecaca;">
              🔴 Absent (${absentCount})
            </button>
          </div>

          <!-- Dedicated CSV Export Buttons -->
          <div style="display: flex; gap: 0.4rem; align-items: center; flex-wrap: wrap;">
            <button id="btn-export-attended-csv" class="btn btn-sm" style="background: #16a34a; color: #ffffff; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border: none; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 0.25rem;" title="Export only students who attended the event">
              📥 Export Attended (${presentCount})
            </button>
            <button id="btn-export-absent-csv" class="btn btn-sm" style="background: #dc2626; color: #ffffff; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border: none; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 0.25rem;" title="Export only students marked absent">
              📥 Export Absent (${absentCount})
            </button>
            <button id="btn-export-complete-csv" class="btn btn-secondary btn-sm" style="font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: var(--radius-sm); display: inline-flex; align-items: center; gap: 0.25rem;" title="Export full master report">
              📊 Master CSV (${regs.length})
            </button>
          </div>
        </div>

        <!-- Attendees Table -->
        <div style="flex: 1; overflow-y: auto; border: 1px solid var(--border-subtle); border-radius: var(--radius-sm); margin-bottom: 1rem; background: #ffffff;">
          <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.825rem;">
            <thead style="position: sticky; top: 0; background: #f1f5f9; z-index: 2;">
              <tr style="height: 38px; color: var(--text-secondary); border-bottom: 2px solid var(--border-subtle);">
                <th style="padding-left: 0.85rem;">Student Name</th>
                <th>PRN</th>
                <th>Dept & Year</th>
                <th>Attendance Status</th>
                <th>Certificate ID</th>
              </tr>
            </thead>
            <tbody>
              ${filteredRegs.length === 0 ? `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--text-tertiary);">
                    No students match the "${currentFilter.toUpperCase()}" filter.
                  </td>
                </tr>
              ` : filteredRegs.map(r => `
                <tr style="border-bottom: 1px solid var(--border-subtle); height: 44px;">
                  <td style="padding-left: 0.85rem; font-weight: 700; color: var(--text-primary);">${r.studentName}</td>
                  <td><code>${r.prn || 'N/A'}</code></td>
                  <td>${r.department || 'General'} (${r.year || '1st Year'})</td>
                  <td>
                    ${r.attendance === 'present' || r.status === 'attended' ? `
                      <span style="font-size: 0.725rem; font-weight: 800; background: #dcfce7; color: #166534; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">🟢 Present</span>
                    ` : (r.attendance === 'absent' ? `
                      <span style="font-size: 0.725rem; font-weight: 800; background: #fee2e2; color: #991b1b; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">🔴 Absent</span>
                    ` : `
                      <span style="font-size: 0.725rem; font-weight: 700; background: #f1f5f9; color: #64748b; padding: 0.2rem 0.55rem; border-radius: var(--radius-full);">⚪ Not Marked</span>
                    `)}
                  </td>
                  <td>
                    ${r.certificateId ? `<code style="color: #059669; font-size: 0.725rem; font-weight: 700; background: #ecfdf5; padding: 0.15rem 0.45rem; border-radius: 4px;">${r.certificateId}</code>` : '<span style="color: var(--text-tertiary); font-size: 0.75rem;">—</span>'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 0.775rem; color: var(--text-tertiary);">Showing <strong>${filteredRegs.length}</strong> of <strong>${regs.length}</strong> attendee records</span>
          <button class="btn btn-secondary btn-sm" id="btn-close-inspect-modal-bottom" style="font-weight: 700; padding: 0.35rem 1rem;">Close</button>
        </div>
      </div>
    `;

    // Modal Close Listeners
    const close = () => modal.remove();
    modal.querySelector('#btn-close-inspect-modal')?.addEventListener('click', close);
    modal.querySelector('#btn-close-inspect-modal-bottom')?.addEventListener('click', close);
    modal.addEventListener('click', (e) => { if (e.target === modal) close(); });

    // Filter Button Listeners
    modal.querySelector('#stat-filter-all')?.addEventListener('click', () => { currentFilter = 'all'; render(); });
    modal.querySelector('#stat-filter-present')?.addEventListener('click', () => { currentFilter = 'present'; render(); });
    modal.querySelector('#stat-filter-absent')?.addEventListener('click', () => { currentFilter = 'absent'; render(); });

    modal.querySelector('#btn-modal-filter-all')?.addEventListener('click', () => { currentFilter = 'all'; render(); });
    modal.querySelector('#btn-modal-filter-present')?.addEventListener('click', () => { currentFilter = 'present'; render(); });
    modal.querySelector('#btn-modal-filter-absent')?.addEventListener('click', () => { currentFilter = 'absent'; render(); });

    // Export Button Listeners
    modal.querySelector('#btn-export-attended-csv')?.addEventListener('click', () => downloadCSV('present'));
    modal.querySelector('#btn-export-absent-csv')?.addEventListener('click', () => downloadCSV('absent'));
    modal.querySelector('#btn-export-complete-csv')?.addEventListener('click', () => downloadCSV('all'));
  };

  render();
  document.body.appendChild(modal);
}
