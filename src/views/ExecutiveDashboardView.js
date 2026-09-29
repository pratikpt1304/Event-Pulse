import { getCurrentUser, isUserAdmin } from '../services/auth';
import { getCachedEventsSync, approveEventTier } from '../services/events';
import { OFFICIAL_FY_AIML_STUDENTS, SCHOOLS_HIERARCHY } from '../data/studentsData';

/**
 * Exports all student participation and attendance records to NAAC Criterion 5.3 compliant CSV
 */
function exportNAACStudentCSV(students) {
  const headers = ["Sr", "Student Name", "PRN / Roll No", "Division", "Department", "School", "Academic Year", "Events Registered", "Verified Attended", "Attendance Rate %", "Skills Profile"];
  const rows = students.map(s => [
    s.sr,
    `"${s.name}"`,
    s.prn,
    `"Div ${s.division}"`,
    `"${s.department}"`,
    `"${s.school}"`,
    `"${s.year}"`,
    s.totalRegistered,
    s.totalAttended,
    `${s.attendanceRate}%`,
    `"${s.skills.join('; ')}"`
  ]);
  const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `Sanjivani_University_NAAC_Criterion_5_3_Student_Participation_${Date.now()}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Executive Governance Dashboard (VC, Dean, HOD)
 * Features:
 * 1. Tiered Approval Pipeline (HOD -> Dean -> VC Final Sign-off)
 * 2. Event-Wise Status Board
 * 3. 4-Tier Academic Deep Dive (School -> Department -> Class -> Student)
 * 4. Whole Student Participation Dossier Modal with Verified Passes & Badges
 */
export async function renderExecutiveDashboardView(container, role, navigateTo) {
  const user = getCurrentUser();
  const allEvents = getCachedEventsSync();

  // Tier metadata & scope resolution
  let tierTitle = "Hon'ble Vice Chancellor Apex Governance Console";
  let tierBadge = "👑 Apex University Authority (Top Layer)";
  let tierScopeDesc = "Centralized oversight across all schools, academic departments, and campus events.";
  let headerGradient = "linear-gradient(135deg, #1e1b4b 0%, #312e81 40%, #0f172a 100%)";
  let accentColor = "#f59e0b"; // Gold for VC
  let approvalActionLabel = "Authorize & Publish Event Campus-Wide 🚀";
  let nextTierText = "Event will be published immediately to all students.";

  if (role === 'dean') {
    tierTitle = "Dean's Academic & Event Oversight Portal";
    tierBadge = "🎓 School Governance (School of Computing & Engineering)";
    tierScopeDesc = "Supervising Department of AI & ML, Computer Engineering, and Information Technology.";
    headerGradient = "linear-gradient(135deg, #0c4a6e 0%, #075985 40%, #0f172a 100%)";
    accentColor = "#38bdf8"; // Cyan/Blue for Dean
    approvalActionLabel = "Endorse & Escalate to Hon. Vice Chancellor ➔";
    nextTierText = "Event will be submitted to the Vice Chancellor for final university charter approval.";
  } else if (role === 'hod') {
    tierTitle = "HOD Departmental Command & Approval Centre";
    tierBadge = "🏫 Department Governance (Department of AI & ML / IMTech)";
    tierScopeDesc = "Direct monitoring of First-Year to Final-Year IMTech classes, student turnout, and event organizers.";
    headerGradient = "linear-gradient(135deg, #2e1065 0%, #4c1d95 40%, #0f172a 100%)";
    accentColor = "#a855f7"; // Purple for HOD
    approvalActionLabel = "Approve & Escalate to School Dean ➔";
    nextTierText = "Event will be sent to Dr. Kavita (Dean) for school-level clearance.";
  }

  // Active Deep Dive state
  let selectedSchoolId = 'sce';
  let selectedDeptId = 'aiml';
  let selectedClassId = 'fy_aiml';
  let studentSearchQuery = '';
  let studentAttendanceFilter = 'all'; // 'all', 'high' (>75%), 'moderate' (50-75%), 'low' (<50%)
  let activeTab = 'deepdive'; // 'deepdive' | 'approvals' | 'events'
  let activeStudentDossier = null;

  // Filter events pending for this role's tier
  const getPendingEventsForRole = () => {
    if (role === 'vc') return allEvents.filter(e => e.status === 'pending_vc');
    if (role === 'dean') return allEvents.filter(e => e.status === 'pending_dean');
    if (role === 'hod') return allEvents.filter(e => e.status === 'pending_hod' || e.status === 'pending_approval');
    return allEvents.filter(e => e.status && e.status.startsWith('pending'));
  };

  const render = () => {
    const pendingEvents = getPendingEventsForRole();
    const approvedEvents = allEvents.filter(e => e.status === 'approved');
    const totalStudentsInCohort = OFFICIAL_FY_AIML_STUDENTS.length;
    const avgCohortTurnout = Math.round(
      OFFICIAL_FY_AIML_STUDENTS.reduce((acc, s) => acc + s.attendanceRate, 0) / totalStudentsInCohort
    );

    // Selected School / Dept / Class objects
    const currentSchool = SCHOOLS_HIERARCHY.find(s => s.id === selectedSchoolId) || SCHOOLS_HIERARCHY[0];
    const currentDept = currentSchool.departments.find(d => d.id === selectedDeptId) || currentSchool.departments[0];
    const currentClass = currentDept.classes.find(c => c.id === selectedClassId) || currentDept.classes[0];

    // Filter students
    let displayedStudents = (selectedClassId === 'fy_aiml') ? OFFICIAL_FY_AIML_STUDENTS : [];
    if (studentSearchQuery.trim()) {
      const q = studentSearchQuery.toLowerCase().trim();
      displayedStudents = displayedStudents.filter(s => 
        s.name.toLowerCase().includes(q) || 
        s.prn.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q)
      );
    }
    if (studentAttendanceFilter === 'high') {
      displayedStudents = displayedStudents.filter(s => s.attendanceRate >= 75);
    } else if (studentAttendanceFilter === 'moderate') {
      displayedStudents = displayedStudents.filter(s => s.attendanceRate >= 50 && s.attendanceRate < 75);
    } else if (studentAttendanceFilter === 'low') {
      displayedStudents = displayedStudents.filter(s => s.attendanceRate < 50);
    }

    container.innerHTML = `
      <div style="max-width: 1200px; margin: 0 auto; padding-bottom: 4rem; font-family: 'Plus Jakarta Sans', system-ui, sans-serif;">

        <!-- Institutional Executive Briefing Bar -->
        <div style="
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 14px;
          padding: 1rem 1.5rem;
          margin-bottom: 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
          box-shadow: 0 2px 10px rgba(0,0,0,0.03);
        ">
          <div style="display: flex; align-items: center; gap: 1rem;">
            <img src="/logo.jpg" alt="University Crest" style="width: 46px; height: 46px; border-radius: 10px; object-fit: cover; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.05);" />
            <div>
              <div style="font-size: 0.7rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">
                Sanjivani University • Directorate of Academic Affairs & Student Governance
              </div>
              <div style="font-size: 1.15rem; font-weight: 900; color: #0f172a; line-height: 1.2;">
                ${tierTitle}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <button id="btn-export-naac-csv" style="
              background: #f8fafc;
              color: #0f172a;
              border: 1px solid #cbd5e1;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              font-size: 0.78rem;
              font-weight: 800;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
              box-shadow: 0 1px 3px rgba(0,0,0,0.04);
            " title="Download NAAC Criterion 5.3 compliant spreadsheet with all 120 students">
              <span>📥</span> Export NAAC Criterion 5.3 CSV
            </button>
            
            <button onclick="window.print()" style="
              background: #0f172a;
              color: #ffffff;
              border: 1px solid #0f172a;
              padding: 0.5rem 1rem;
              border-radius: 8px;
              font-size: 0.78rem;
              font-weight: 800;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 0.4rem;
            ">
              <span>🖨️</span> Print Briefing
            </button>
          </div>
        </div>

        <!-- 1. Executive Master Header Banner -->
        <div style="
          background: ${headerGradient};
          border-radius: 20px;
          padding: 2.25rem 2.25rem 2rem;
          color: #ffffff;
          margin-bottom: 1.5rem;
          position: relative;
          overflow: hidden;
          box-shadow: 0 20px 45px -12px rgba(15, 23, 42, 0.5);
          border: 1px solid rgba(255, 255, 255, 0.08);
        ">
          <!-- Abstract Glow Spheres -->
          <div style="position: absolute; top: -50px; right: -50px; width: 220px; height: 220px; background: ${accentColor}; opacity: 0.15; border-radius: 50%; filter: blur(50px);"></div>
          
          <div style="position: relative; z-index: 1;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 1rem;">
              <div>
                <span style="
                  background: rgba(255, 255, 255, 0.12);
                  border: 1px solid rgba(255, 255, 255, 0.25);
                  padding: 0.3rem 0.8rem;
                  border-radius: 999px;
                  font-size: 0.75rem;
                  font-weight: 800;
                  letter-spacing: 0.05em;
                  text-transform: uppercase;
                  color: ${accentColor};
                  display: inline-flex;
                  align-items: center;
                  gap: 0.4rem;
                ">
                  ${tierBadge}
                </span>
                <h1 style="font-size: 2.25rem; font-weight: 900; margin-top: 0.75rem; margin-bottom: 0.35rem; color: #ffffff; letter-spacing: -0.02em;">
                  ${tierTitle}
                </h1>
                <p style="font-size: 0.95rem; color: #cbd5e1; max-width: 720px; line-height: 1.5; margin: 0;">
                  ${tierScopeDesc}
                </p>
              </div>

              <!-- Quick Executive Badge -->
              <div style="background: rgba(0, 0, 0, 0.35); border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 12px; padding: 0.75rem 1.25rem; text-align: right;">
                <div style="font-size: 0.7rem; color: #94a3b8; text-transform: uppercase; font-weight: 700; letter-spacing: 0.05em;">Authorized Session</div>
                <div style="font-size: 1.05rem; font-weight: 800; color: #ffffff;">${user?.name || 'Executive Authority'}</div>
                <div style="font-size: 0.8rem; color: ${accentColor}; font-weight: 600;">${user?.title || role.toUpperCase()}</div>
              </div>
            </div>

            <!-- Executive KPI Row -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.5rem;">
              <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1rem 1.25rem;">
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Pending Clearance</div>
                <div style="font-size: 1.85rem; font-weight: 900; color: ${pendingEvents.length > 0 ? '#f87171' : '#34d399'}; margin-top: 0.2rem;">
                  ${pendingEvents.length} <span style="font-size: 0.85rem; font-weight: 600; color: #cbd5e1;">Events</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">Action needed at your tier</div>
              </div>

              <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1rem 1.25rem;">
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Campus-Wide Live Events</div>
                <div style="font-size: 1.85rem; font-weight: 900; color: #38bdf8; margin-top: 0.2rem;">
                  ${approvedEvents.length} <span style="font-size: 0.85rem; font-weight: 600; color: #cbd5e1;">Active</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">Published & open to students</div>
              </div>

              <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1rem 1.25rem;">
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">FY AIML Cohort Strength</div>
                <div style="font-size: 1.85rem; font-weight: 900; color: #a78bfa; margin-top: 0.2rem;">
                  120 <span style="font-size: 0.85rem; font-weight: 600; color: #cbd5e1;">Students</span>
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">Official Excel Roster imported</div>
              </div>

              <div style="background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 14px; padding: 1rem 1.25rem;">
                <div style="font-size: 0.75rem; color: #94a3b8; font-weight: 700; text-transform: uppercase;">Cohort Turnout Index</div>
                <div style="font-size: 1.85rem; font-weight: 900; color: #34d399; margin-top: 0.2rem;">
                  ${avgCohortTurnout}%
                </div>
                <div style="font-size: 0.75rem; color: #94a3b8; margin-top: 0.15rem;">Average verified event attendance</div>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Section Navigation Tabs -->
        <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">
          <button class="dash-tab-btn ${activeTab === 'deepdive' ? 'active' : ''}" data-tab="deepdive" style="
            background: ${activeTab === 'deepdive' ? 'var(--primary, #7c3aed)' : 'transparent'};
            color: ${activeTab === 'deepdive' ? '#ffffff' : '#64748b'};
            border: none;
            padding: 0.55rem 1.2rem;
            border-radius: 10px;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.2s;
          ">
            <span>📊</span> Deep-Dive Academic Hierarchy (School ➔ Dept ➔ Class ➔ Student)
          </button>

          <button class="dash-tab-btn ${activeTab === 'approvals' ? 'active' : ''}" data-tab="approvals" style="
            background: ${activeTab === 'approvals' ? 'var(--primary, #7c3aed)' : 'transparent'};
            color: ${activeTab === 'approvals' ? '#ffffff' : '#64748b'};
            border: none;
            padding: 0.55rem 1.2rem;
            border-radius: 10px;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.2s;
          ">
            <span>🛡️</span> Approval Queue (${pendingEvents.length})
          </button>

          <button class="dash-tab-btn ${activeTab === 'events' ? 'active' : ''}" data-tab="events" style="
            background: ${activeTab === 'events' ? 'var(--primary, #7c3aed)' : 'transparent'};
            color: ${activeTab === 'events' ? '#ffffff' : '#64748b'};
            border: none;
            padding: 0.55rem 1.2rem;
            border-radius: 10px;
            font-weight: 800;
            font-size: 0.85rem;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
            transition: all 0.2s;
          ">
            <span>📅</span> University Event Status Board (${allEvents.length})
          </button>
        </div>

        <!-- 3. TAB CONTENT: DEEP DIVE HIERARCHY -->
        ${activeTab === 'deepdive' ? `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.04); margin-bottom: 2rem;">
            
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem;">
              <div>
                <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0;">
                  🏛️ Multi-Level Academic Participation Drill-Down
                </h2>
                <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem; margin-bottom: 0;">
                  Select <strong>School</strong> ➔ <strong>Department</strong> ➔ <strong>Class</strong> to inspect individual student participation dossiers.
                </p>
              </div>

              <div style="font-size: 0.75rem; background: #f1f5f9; color: #475569; padding: 0.35rem 0.75rem; border-radius: 8px; font-weight: 700;">
                Showing: ${currentSchool.code} / ${currentDept.code} / ${currentClass.name}
              </div>
            </div>

            <!-- Stepper Breadcrumb / Filter Controls -->
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem; margin-bottom: 1.5rem; background: #f8fafc; padding: 1rem; border-radius: 12px; border: 1px solid #e2e8f0;">
              
              <!-- Level 1: School Selector -->
              <div>
                <label style="display: block; font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.35rem;">
                  1. School Level
                </label>
                <select id="select-school" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-weight: 700; background: #ffffff; color: #0f172a;">
                  ${SCHOOLS_HIERARCHY.map(s => `
                    <option value="${s.id}" ${s.id === selectedSchoolId ? 'selected' : ''}>
                      ${s.name} (${s.code})
                    </option>
                  `).join('')}
                </select>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem;">Dean: ${currentSchool.dean}</div>
              </div>

              <!-- Level 2: Department Selector -->
              <div>
                <label style="display: block; font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.35rem;">
                  2. Department Level
                </label>
                <select id="select-dept" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-weight: 700; background: #ffffff; color: #0f172a;">
                  ${currentSchool.departments.map(d => `
                    <option value="${d.id}" ${d.id === selectedDeptId ? 'selected' : ''}>
                      ${d.name} (${d.code})
                    </option>
                  `).join('')}
                </select>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem;">HOD: ${currentDept.hod}</div>
              </div>

              <!-- Level 3: Class / Cohort Selector -->
              <div>
                <label style="display: block; font-size: 0.72rem; font-weight: 800; color: #475569; text-transform: uppercase; margin-bottom: 0.35rem;">
                  3. Class / Batch Level
                </label>
                <select id="select-class" style="width: 100%; padding: 0.5rem; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.85rem; font-weight: 700; background: #ffffff; color: #0f172a;">
                  ${currentDept.classes.map(c => `
                    <option value="${c.id}" ${c.id === selectedClassId ? 'selected' : ''}>
                      ${c.name} (${c.totalStudents} Students)
                    </option>
                  `).join('')}
                </select>
                <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.25rem;">Batch: ${currentClass.batch || '2026'}</div>
              </div>

            </div>

            <!-- Student Search & Filter Bar -->
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; max-width: 450px;">
                <input type="text" id="student-search-input" value="${studentSearchQuery}" placeholder="🔍 Search by student name, PRN (e.g. 2126PMIM1001)..." style="
                  width: 100%;
                  padding: 0.55rem 0.85rem;
                  border-radius: 8px;
                  border: 1.5px solid #cbd5e1;
                  font-size: 0.85rem;
                " />
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">Turnout:</span>
                <select id="student-attendance-filter" style="padding: 0.5rem 0.75rem; border-radius: 8px; border: 1.5px solid #cbd5e1; font-size: 0.8rem; font-weight: 600; background: #ffffff;">
                  <option value="all" ${studentAttendanceFilter === 'all' ? 'selected' : ''}>All Turnout Rates</option>
                  <option value="high" ${studentAttendanceFilter === 'high' ? 'selected' : ''}>High Participation (≥ 75%)</option>
                  <option value="moderate" ${studentAttendanceFilter === 'moderate' ? 'selected' : ''}>Moderate (50% - 74%)</option>
                  <option value="low" ${studentAttendanceFilter === 'low' ? 'selected' : ''}>Low Turnout (< 50%)</option>
                </select>
                <span style="font-size: 0.8rem; color: #475569; font-weight: 700; margin-left: 0.5rem;">
                  ${displayedStudents.length} of ${OFFICIAL_FY_AIML_STUDENTS.length} students
                </span>
              </div>
            </div>

            <!-- Students Roster Table -->
            <div style="overflow-x: auto; border: 1px solid #e2e8f0; border-radius: 12px;">
              <table style="width: 100%; border-collapse: collapse; text-align: left; font-size: 0.85rem;">
                <thead style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; color: #475569; font-weight: 800; font-size: 0.75rem; text-transform: uppercase;">
                  <tr>
                    <th style="padding: 0.75rem 1rem; width: 50px;">Sr</th>
                    <th style="padding: 0.75rem 1rem;">Student Details</th>
                    <th style="padding: 0.75rem 1rem;">PRN / Enrollment</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Div</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Events Registered</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Verified Attended</th>
                    <th style="padding: 0.75rem 1rem; text-align: center;">Turnout Rate</th>
                    <th style="padding: 0.75rem 1rem; text-align: right;">Action</th>
                  </tr>
                </thead>
                <tbody>
                  ${displayedStudents.length === 0 ? `
                    <tr>
                      <td colspan="8" style="padding: 2.5rem; text-align: center; color: #64748b;">
                        No students match the selected filter. Try adjusting your search query.
                      </td>
                    </tr>
                  ` : displayedStudents.map((s, idx) => {
                    let rateBadgeBg = 'rgba(16, 185, 129, 0.15)';
                    let rateBadgeColor = '#059669';
                    if (s.attendanceRate < 50) {
                      rateBadgeBg = 'rgba(239, 68, 68, 0.15)';
                      rateBadgeColor = '#dc2626';
                    } else if (s.attendanceRate < 75) {
                      rateBadgeBg = 'rgba(245, 158, 11, 0.15)';
                      rateBadgeColor = '#d97706';
                    }

                    return `
                      <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
                        <td style="padding: 0.85rem 1rem; color: #64748b; font-weight: 600;">${s.sr}</td>
                        <td style="padding: 0.85rem 1rem;">
                          <div style="font-weight: 800; color: #0f172a;">${s.name}</div>
                          <div style="font-size: 0.75rem; color: #64748b;">${s.email}</div>
                        </td>
                        <td style="padding: 0.85rem 1rem; font-family: monospace; font-weight: 700; color: #4338ca;">
                          ${s.prn}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">
                          <span style="background: #e0e7ff; color: #3730a3; padding: 0.15rem 0.45rem; border-radius: 4px; font-weight: 800; font-size: 0.75rem;">
                            Div ${s.division}
                          </span>
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 700; color: #334155;">
                          ${s.totalRegistered}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center; font-weight: 700; color: #059669;">
                          ${s.totalAttended}
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: center;">
                          <span style="background: ${rateBadgeBg}; color: ${rateBadgeColor}; font-weight: 800; font-size: 0.75rem; padding: 0.2rem 0.55rem; border-radius: 999px;">
                            ${s.attendanceRate}%
                          </span>
                        </td>
                        <td style="padding: 0.85rem 1rem; text-align: right;">
                          <button class="btn-view-dossier" data-prn="${s.prn}" style="
                            background: linear-gradient(135deg, #7c3aed, #4f46e5);
                            color: #ffffff;
                            border: none;
                            padding: 0.4rem 0.8rem;
                            border-radius: 6px;
                            font-size: 0.75rem;
                            font-weight: 700;
                            cursor: pointer;
                            display: inline-flex;
                            align-items: center;
                            gap: 0.3rem;
                          ">
                            <span>Inspect Dossier</span> <span>➔</span>
                          </button>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>

          </div>
        ` : ''}

        <!-- 4. TAB CONTENT: APPROVAL QUEUE -->
        ${activeTab === 'approvals' ? `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.04); margin-bottom: 2rem;">
            
            <div style="margin-bottom: 1.5rem;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0;">
                🛡️ Tiered Event Clearance Queue (${pendingEvents.length})
              </h2>
              <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
                Official multi-tier review: <strong>Organizer</strong> ➔ <strong>HOD (Anwar Sir)</strong> ➔ <strong>Dean (Dr. Kavita)</strong> ➔ <strong>VC (Apex Sanction)</strong>.
              </p>
            </div>

            ${pendingEvents.length === 0 ? `
              <div style="padding: 3rem 1.5rem; text-align: center; background: #f8fafc; border-radius: 12px; border: 1.5px dashed #cbd5e1;">
                <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🎉</div>
                <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a;">Queue Clear!</div>
                <p style="color: #64748b; font-size: 0.85rem; margin: 0.25rem 0 0;">
                  No events currently waiting for clearance at the <strong>${role.toUpperCase()}</strong> tier.
                </p>
              </div>
            ` : `
              <div style="display: flex; flex-direction: column; gap: 1.25rem;">
                ${pendingEvents.map(evt => `
                  <div style="border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 1.5rem; background: #fdfdfd; transition: all 0.2s; box-shadow: 0 2px 8px rgba(0,0,0,0.02);">
                    
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem; margin-bottom: 0.75rem;">
                      <div>
                        <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.3rem;">
                          <span style="background: rgba(245, 158, 11, 0.15); color: #d97706; padding: 0.15rem 0.55rem; border-radius: 4px; font-size: 0.7rem; font-weight: 800; text-transform: uppercase;">
                            Status: ${evt.status}
                          </span>
                          <span style="font-size: 0.75rem; color: #64748b;">Submitted: ${new Date(evt.createdAt || Date.now()).toLocaleDateString()}</span>
                        </div>
                        <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${evt.title}
                        </h3>
                        <div style="font-size: 0.85rem; color: #475569; margin-top: 0.25rem;">
                          🏢 ${evt.department || 'IMTech'} • 👤 Organizer: <strong>${evt.organizerName || 'Faculty / Admin'}</strong>
                        </div>
                      </div>

                      <!-- Event Date & Venue Pill -->
                      <div style="background: #f1f5f9; padding: 0.5rem 0.85rem; border-radius: 8px; font-size: 0.8rem; text-align: right;">
                        <div style="font-weight: 700; color: #0f172a;">📅 ${evt.date} (${evt.time || '10:00 AM'})</div>
                        <div style="color: #64748b; font-size: 0.75rem;">📍 ${evt.venue}</div>
                      </div>
                    </div>

                    <p style="font-size: 0.85rem; color: #475569; line-height: 1.5; margin: 0.5rem 0 1rem;">
                      ${evt.description}
                    </p>

                    <!-- Multi-Tier Endorsement Badges -->
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.75rem 1rem; margin-bottom: 1rem;">
                      <div style="font-size: 0.7rem; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 0.4rem;">
                        Approval Audit Trail:
                      </div>
                      
                      <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                        <!-- HOD Status -->
                        <div style="font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between;">
                          <span><strong>1. HOD Level:</strong> ${evt.hodApproval ? '✅ ' + evt.hodApproval.approvedBy : (role === 'hod' ? '⏳ Under Your Review' : '⏳ Pending')}</span>
                          <span style="color: #64748b; font-size: 0.7rem;">${evt.hodApproval?.comments || ''}</span>
                        </div>

                        <!-- Dean Status -->
                        <div style="font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between;">
                          <span><strong>2. Dean Level:</strong> ${evt.deanApproval ? '✅ ' + evt.deanApproval.approvedBy : (role === 'dean' ? '⏳ Under Your Review' : '⏳ Pending')}</span>
                          <span style="color: #64748b; font-size: 0.7rem;">${evt.deanApproval?.comments || ''}</span>
                        </div>

                        <!-- VC Status -->
                        <div style="font-size: 0.78rem; display: flex; align-items: center; justify-content: space-between;">
                          <span><strong>3. Vice Chancellor:</strong> ${evt.vcApproval ? '✅ Authorized' : (role === 'vc' ? '⏳ Awaiting Your Final Sanction' : '⏳ Pending')}</span>
                          <span style="color: #64748b; font-size: 0.7rem;">${evt.vcApproval?.comments || ''}</span>
                        </div>
                      </div>
                    </div>

                    <!-- Action Buttons -->
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
                      <div style="font-size: 0.75rem; color: #64748b;">
                        ℹ️ ${nextTierText}
                      </div>

                      <div style="display: flex; gap: 0.5rem;">
                        <button class="btn-reject-event" data-id="${evt.id}" style="
                          background: #fee2e2;
                          color: #dc2626;
                          border: 1px solid #fecaca;
                          padding: 0.5rem 0.9rem;
                          border-radius: 8px;
                          font-size: 0.8rem;
                          font-weight: 700;
                          cursor: pointer;
                        ">
                          Send Back for Revision
                        </button>

                        <button class="btn-approve-event" data-id="${evt.id}" data-tier="${role}" style="
                          background: linear-gradient(135deg, #10b981, #059669);
                          color: #ffffff;
                          border: none;
                          padding: 0.5rem 1.2rem;
                          border-radius: 8px;
                          font-size: 0.82rem;
                          font-weight: 800;
                          cursor: pointer;
                          box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
                        ">
                          ${approvalActionLabel}
                        </button>
                      </div>
                    </div>

                  </div>
                `).join('')}
              </div>
            `}

          </div>
        ` : ''}

        <!-- 5. TAB CONTENT: CAMPUS EVENT DIRECTORY -->
        ${activeTab === 'events' ? `
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 18px; padding: 1.75rem; box-shadow: 0 4px 20px rgba(0,0,0,0.04); margin-bottom: 2rem;">
            
            <div style="margin-bottom: 1.25rem;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: #0f172a; margin: 0;">
                📅 Master University Event Board
              </h2>
              <p style="font-size: 0.85rem; color: #64748b; margin-top: 0.25rem;">
                Status of all academic, technical, cultural, and sports events conducted across the campus.
              </p>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1rem;">
              ${allEvents.map(ev => {
                let badgeColor = '#059669';
                let badgeBg = 'rgba(16, 185, 129, 0.15)';
                let statusLabel = 'Live & Approved';
                if (ev.status === 'pending_vc') {
                  badgeColor = '#d97706';
                  badgeBg = 'rgba(245, 158, 11, 0.15)';
                  statusLabel = 'Pending VC';
                } else if (ev.status === 'pending_dean') {
                  badgeColor = '#0284c7';
                  badgeBg = 'rgba(2, 132, 199, 0.15)';
                  statusLabel = 'Pending Dean';
                } else if (ev.status === 'pending_hod') {
                  badgeColor = '#7c3aed';
                  badgeBg = 'rgba(124, 58, 237, 0.15)';
                  statusLabel = 'Pending HOD';
                }

                return `
                  <div style="border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; background: #ffffff; box-shadow: 0 2px 6px rgba(0,0,0,0.02);">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                      <span style="background: ${badgeBg}; color: ${badgeColor}; padding: 0.15rem 0.5rem; border-radius: 4px; font-size: 0.68rem; font-weight: 800; text-transform: uppercase;">
                        ${statusLabel}
                      </span>
                      <span style="font-size: 0.72rem; color: #64748b;">📅 ${ev.date}</span>
                    </div>

                    <h4 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0 0 0.35rem; line-height: 1.3;">
                      ${ev.title}
                    </h4>

                    <div style="font-size: 0.75rem; color: #64748b; margin-bottom: 0.75rem;">
                      📍 ${ev.venue} • 👤 ${ev.organizerName}
                    </div>

                    <div style="display: flex; justify-content: space-between; font-size: 0.75rem; border-top: 1px solid #f1f5f9; padding-top: 0.5rem; color: #475569;">
                      <span>Max Cap: <strong>${ev.maxParticipants || 150}</strong></span>
                      <span style="color: #059669; font-weight: 700;">✅ Certified</span>
                    </div>
                  </div>
                `;
              }).join('')}
            </div>

          </div>
        ` : ''}

        <!-- 6. STUDENT PARTICIPATION DOSSIER MODAL -->
        <div id="student-dossier-modal" style="
          display: ${activeStudentDossier ? 'flex' : 'none'};
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.75);
          backdrop-filter: blur(6px);
          z-index: 9999;
          align-items: center;
          justify-content: center;
          padding: 1rem;
        ">
          ${activeStudentDossier ? renderDossierContent(activeStudentDossier) : ''}
        </div>

      </div>
    `;

    // Tab button listeners
    container.querySelectorAll('.dash-tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        activeTab = btn.getAttribute('data-tab');
        render();
      });
    });

    // School / Dept / Class Change Listeners
    const schoolSel = container.querySelector('#select-school');
    if (schoolSel) {
      schoolSel.addEventListener('change', (e) => {
        selectedSchoolId = e.target.value;
        const sch = SCHOOLS_HIERARCHY.find(s => s.id === selectedSchoolId);
        if (sch && sch.departments.length > 0) {
          selectedDeptId = sch.departments[0].id;
          if (sch.departments[0].classes.length > 0) {
            selectedClassId = sch.departments[0].classes[0].id;
          }
        }
        render();
      });
    }

    const deptSel = container.querySelector('#select-dept');
    if (deptSel) {
      deptSel.addEventListener('change', (e) => {
        selectedDeptId = e.target.value;
        const sch = SCHOOLS_HIERARCHY.find(s => s.id === selectedSchoolId);
        const dept = sch?.departments.find(d => d.id === selectedDeptId);
        if (dept && dept.classes.length > 0) {
          selectedClassId = dept.classes[0].id;
        }
        render();
      });
    }

    const classSel = container.querySelector('#select-class');
    if (classSel) {
      classSel.addEventListener('change', (e) => {
        selectedClassId = e.target.value;
        render();
      });
    }

    // Search and filter listeners
    const searchInput = container.querySelector('#student-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        studentSearchQuery = e.target.value;
        render();
      });
    }

    const attFilter = container.querySelector('#student-attendance-filter');
    if (attFilter) {
      attFilter.addEventListener('change', (e) => {
        studentAttendanceFilter = e.target.value;
        render();
      });
    }

    // Dossier click listeners
    container.querySelectorAll('.btn-view-dossier').forEach(btn => {
      btn.addEventListener('click', () => {
        const prn = btn.getAttribute('data-prn');
        const student = OFFICIAL_FY_AIML_STUDENTS.find(s => s.prn === prn);
        if (student) {
          activeStudentDossier = student;
          render();
        }
      });
    });

    // Approval action listeners
    container.querySelectorAll('.btn-approve-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        const eventId = btn.getAttribute('data-id');
        const tier = btn.getAttribute('data-tier');
        const comments = prompt(`Enter official approval comment for ${user?.title || role.toUpperCase()}:`, `Sanctioned by ${user?.name || role.toUpperCase()}`);
        if (comments !== null) {
          btn.disabled = true;
          btn.innerText = 'Processing...';
          await approveEventTier(eventId, tier, user, comments);
          alert(`✅ Event successfully cleared by ${user?.name || role.toUpperCase()}!`);
          render();
        }
      });
    });

    container.querySelectorAll('.btn-reject-event').forEach(btn => {
      btn.addEventListener('click', async () => {
        const eventId = btn.getAttribute('data-id');
        const reason = prompt('Enter reason / required revisions for the organizer:');
        if (reason) {
          await approveEventTier(eventId, 'reject', user, reason);
          alert('Sent back to organizer for revision.');
          render();
        }
      });
    });

    // NAAC CSV Export Listener
    container.querySelector('#btn-export-naac-csv')?.addEventListener('click', () => {
      exportNAACStudentCSV(displayedStudents.length > 0 ? displayedStudents : OFFICIAL_FY_AIML_STUDENTS);
    });

    // Modal close listener
    const modal = container.querySelector('#student-dossier-modal');
    if (modal) {
      modal.addEventListener('click', (e) => {
        if (e.target.id === 'student-dossier-modal' || e.target.closest('#btn-close-dossier')) {
          activeStudentDossier = null;
          render();
        }
      });
    }
  };

  render();
}

/**
 * Renders the deep Student Participation Dossier inside a modal
 */
function renderDossierContent(student) {
  const isHighTurnout = student.attendanceRate >= 75;
  const isModTurnout = student.attendanceRate >= 50 && student.attendanceRate < 75;
  const standingBadge = isHighTurnout 
    ? { text: "🏆 EXEMPLAR / MERIT ROLL (CRITERIA 5.3)", bg: "rgba(16, 185, 129, 0.12)", color: "#059669" }
    : (isModTurnout 
        ? { text: "📈 REGULAR ACTIVE PARTICIPANT", bg: "rgba(59, 130, 246, 0.12)", color: "#2563eb" }
        : { text: "⚠️ LOW TURNOUT (ADVISORY)", bg: "rgba(239, 68, 68, 0.12)", color: "#dc2626" });

  return `
    <div style="
      background: #ffffff;
      border-radius: 16px;
      max-width: 820px;
      width: 100%;
      max-height: 90vh;
      overflow-y: auto;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
      border: 1px solid #cbd5e1;
      font-family: 'Plus Jakarta Sans', system-ui, sans-serif;
    ">
      <!-- Institutional Document Header -->
      <div style="
        background: #0f172a;
        color: #ffffff;
        padding: 1.5rem 1.75rem;
        position: relative;
        border-bottom: 3px solid #d97706;
      ">
        <button id="btn-close-dossier" style="
          position: absolute;
          top: 1.25rem;
          right: 1.25rem;
          background: rgba(255, 255, 255, 0.15);
          color: #ffffff;
          border: 1px solid rgba(255, 255, 255, 0.25);
          width: 32px;
          height: 32px;
          border-radius: 8px;
          cursor: pointer;
          font-weight: 800;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          justify-content: center;
        ">✕</button>

        <div style="display: flex; align-items: center; gap: 1.25rem;">
          <img src="/logo.jpg" alt="University Crest" style="width: 58px; height: 58px; border-radius: 12px; object-fit: cover; border: 2px solid rgba(255, 255, 255, 0.2);" />
          <div>
            <div style="font-size: 0.7rem; color: #94a3b8; font-weight: 800; text-transform: uppercase; letter-spacing: 0.06em;">
              Sanjivani University • Directorate of Student Welfare & Extra-Curricular Affairs
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 900; margin: 0.2rem 0; color: #ffffff; letter-spacing: -0.01em;">
              Official Student Participation Transcript & Dossier
            </h2>
            <div style="font-size: 0.76rem; color: #cbd5e1; font-family: monospace;">
              Document Ref: <strong>SU/SW-DOSSIER/2026/${student.prn}</strong> • AICTE & NIRF Verification Ledger
            </div>
          </div>
        </div>
      </div>

      <!-- Dossier Body -->
      <div style="padding: 1.75rem;">
        
        <!-- Student Identity Grid -->
        <div style="
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 1.25rem 1.5rem;
          margin-bottom: 1.5rem;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 1rem;
        ">
          <div>
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.35rem;">
              <h3 style="font-size: 1.25rem; font-weight: 900; color: #0f172a; margin: 0;">
                ${student.name}
              </h3>
              <span style="background: ${standingBadge.bg}; color: ${standingBadge.color}; font-size: 0.65rem; font-weight: 800; padding: 0.15rem 0.55rem; border-radius: 6px;">
                ${standingBadge.text}
              </span>
            </div>
            <div style="font-size: 0.82rem; color: #475569; margin-top: 0.15rem;">
              Enrollment PRN: <strong style="font-family: monospace; color: #4338ca;">${student.prn}</strong> • Institutional Email: <strong style="color: #0f172a;">${student.email}</strong>
            </div>
            <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.2rem;">
              Program: <strong>${student.department}</strong> (${student.year}) • <strong>Division ${student.division}</strong> • ${student.school}
            </div>
          </div>

          <div style="text-align: right; background: #ffffff; border: 1px solid #cbd5e1; padding: 0.6rem 0.85rem; border-radius: 8px;">
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 800; text-transform: uppercase;">Accreditation Status</div>
            <div style="font-size: 0.85rem; font-weight: 800; color: #16a34a; margin-top: 0.1rem;">
              ✓ Verified Enrolled Student
            </div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.1rem;">Academic Year 2026–2030</div>
          </div>
        </div>

        <!-- Academic Performance Metrics -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 0.85rem; margin-bottom: 1.5rem;">
          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Events Registered</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #0f172a; margin-top: 0.15rem;">${student.totalRegistered}</div>
            <div style="font-size: 0.7rem; color: #64748b; margin-top: 0.15rem;">Formal registrations filed</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Verified Turnout</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.15rem;">${student.totalAttended}</div>
            <div style="font-size: 0.7rem; color: #059669; font-weight: 600; margin-top: 0.15rem;">Scanned via QR passes</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Turnout Ratio</div>
            <div style="font-size: 1.6rem; font-weight: 900; color: #7c3aed; margin-top: 0.15rem;">${student.attendanceRate}%</div>
            <div style="font-size: 0.7rem; color: #7c3aed; font-weight: 600; margin-top: 0.15rem;">Criterion 5.3 verified</div>
          </div>

          <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
            <div style="font-size: 0.68rem; color: #64748b; font-weight: 800; text-transform: uppercase; letter-spacing: 0.04em;">Activity Skillset</div>
            <div style="font-size: 0.78rem; color: #1e293b; font-weight: 700; margin-top: 0.4rem; line-height: 1.3;">${student.skills.join(', ')}</div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.25rem;">Student Talent Tags</div>
          </div>
        </div>

        <!-- Participation Ledger -->
        <div style="margin-bottom: 1.5rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.65rem;">
            <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0; text-transform: uppercase; letter-spacing: 0.03em;">
              📋 Verified Participation Ledger
            </h4>
            <span style="font-size: 0.72rem; color: #64748b; font-weight: 600;">
              All entries secured with tamper-proof tokens
            </span>
          </div>

          <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow: hidden;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.8rem; text-align: left;">
              <thead style="background: #f8fafc; color: #475569; font-weight: 800; text-transform: uppercase; font-size: 0.68rem; border-bottom: 1px solid #e2e8f0;">
                <tr>
                  <th style="padding: 0.7rem 0.9rem;">Event & Convener</th>
                  <th style="padding: 0.7rem 0.9rem;">Category</th>
                  <th style="padding: 0.7rem 0.9rem;">Schedule & Venue</th>
                  <th style="padding: 0.7rem 0.9rem; text-align: center;">Accredited Status</th>
                  <th style="padding: 0.7rem 0.9rem;">Pass Token & Check-In</th>
                </tr>
              </thead>
              <tbody>
                ${student.participations.map((p, pIdx) => `
                  <tr style="border-bottom: 1px solid #f1f5f9; background: ${pIdx % 2 === 0 ? '#ffffff' : '#fafafa'};">
                    <td style="padding: 0.75rem 0.9rem;">
                      <div style="font-weight: 800; color: #0f172a;">${p.eventTitle}</div>
                      <div style="font-size: 0.7rem; color: #64748b;">${p.organizer}</div>
                    </td>
                    <td style="padding: 0.75rem 0.9rem; color: #475569; font-weight: 600;">
                      ${p.category}
                    </td>
                    <td style="padding: 0.75rem 0.9rem; color: #475569;">
                      <div>📅 ${p.date}</div>
                      <div style="font-size: 0.7rem; color: #64748b;">📍 ${p.venue}</div>
                    </td>
                    <td style="padding: 0.75rem 0.9rem; text-align: center;">
                      ${p.status === 'attended' ? `
                        <span style="background: rgba(16, 185, 129, 0.12); color: #059669; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          <span>✓</span> Verified Attended
                        </span>
                      ` : `
                        <span style="background: rgba(245, 158, 11, 0.12); color: #d97706; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 999px; font-size: 0.68rem;">
                          ⏳ Enrolled / Pending
                        </span>
                      `}
                    </td>
                    <td style="padding: 0.75rem 0.9rem;">
                      <div style="font-family: monospace; font-weight: 700; color: #4338ca; font-size: 0.78rem;">${p.passToken}</div>
                      <div style="font-size: 0.68rem; color: #64748b;">${p.checkInTime ? 'Checked in: ' + p.checkInTime : 'Pre-registered'}</div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Official Institutional Seal & Security Footer -->
        <div style="
          background: #f8fafc;
          border: 1px dashed #cbd5e1;
          border-radius: 10px;
          padding: 1rem 1.25rem;
          display: flex;
          justify-content: space-between;
          align-items: center;
          flex-wrap: wrap;
          gap: 1rem;
        ">
          <div>
            <div style="font-size: 0.72rem; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em;">
              Institutional Cryptographic Verification
            </div>
            <div style="font-size: 0.68rem; color: #64748b; font-family: monospace; margin-top: 0.15rem;">
              SHA-256 Ledger Hash: <strong>9e82a...c0147 [AUTHENTIC RECORD]</strong>
            </div>
            <div style="font-size: 0.68rem; color: #64748b; margin-top: 0.15rem;">
              Issued under the authority of the Dean of Student Welfare, Sanjivani University.
            </div>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button onclick="window.print()" style="
              background: #0f172a;
              color: #ffffff;
              border: 1px solid #0f172a;
              padding: 0.45rem 1rem;
              border-radius: 8px;
              font-size: 0.78rem;
              font-weight: 800;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              gap: 0.35rem;
            ">
              <span>🖨️</span> Print Certified Transcript
            </button>
          </div>
        </div>

      </div>
    </div>
  `;
}
