import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

async function generatePDF() {
  const pdfDoc = await PDFDocument.create();
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const colors = {
    primary: rgb(0.12, 0.11, 0.29),      // #1e1b4b Navy
    indigo: rgb(0.31, 0.27, 0.79),       // #4f46e5 Indigo
    accentBlue: rgb(0.14, 0.38, 0.92),   // #2563eb Blue
    emerald: rgb(0.06, 0.73, 0.51),      // #10b981 Mint/Emerald
    amber: rgb(0.96, 0.62, 0.04),        // #f59e0b Amber
    purple: rgb(0.55, 0.36, 0.96),       // #8b5cf6 Purple
    darkText: rgb(0.06, 0.09, 0.16),     // #0f172a Deep Slate
    mutedText: rgb(0.28, 0.33, 0.41),    // #475569 Slate Muted
    lightBg: rgb(0.97, 0.98, 0.99),      // #f8fafc Light Gray
    border: rgb(0.80, 0.84, 0.88),       // #cbd5e1 Light Border
    white: rgb(1, 1, 1)
  };

  // ================= PAGE 1 =================
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Top Header Banner
  page1.drawRectangle({
    x: 28,
    y: height - 130,
    width: width - 56,
    height: 102,
    color: colors.primary,
    borderWidth: 0
  });

  // Top Pill
  page1.drawRectangle({
    x: 42,
    y: height - 52,
    width: 220,
    height: 18,
    color: rgb(0.25, 0.22, 0.55),
    borderColor: rgb(0.40, 0.38, 0.75),
    borderWidth: 1
  });
  page1.drawText('EVENTPULSE EXECUTIVE BLUEPRINT', {
    x: 48,
    y: height - 47,
    size: 8.5,
    font: fontHelveticaBold,
    color: colors.white
  });

  // Main Header Title
  page1.drawText('Corporate Hackathon & Multi-University Model', {
    x: 42,
    y: height - 78,
    size: 17,
    font: fontHelveticaBold,
    color: colors.white
  });

  // Subtitle
  page1.drawText('Operational Lifecycle, Cross-Campus Federation, Academic OD & Talent Acquisition', {
    x: 42,
    y: height - 96,
    size: 9.5,
    font: fontHelvetica,
    color: rgb(0.78, 0.82, 0.99)
  });

  // Meta bar inside banner
  page1.drawLine({
    start: { x: 42, y: height - 108 },
    end: { x: width - 42, y: height - 108 },
    thickness: 0.8,
    color: rgb(0.35, 0.33, 0.65)
  });
  page1.drawText('Document: Technical Strategic Roadmap   |   Coverage: 3-4 Universities + Corporates   |   Status: Production Architecture', {
    x: 42,
    y: height - 120,
    size: 7.5,
    font: fontHelvetica,
    color: rgb(0.85, 0.88, 0.99)
  });

  // Section 1: Introduction
  let curY = height - 155;
  page1.drawText('1. 6-Stage Inter-University Operational Flowchart', {
    x: 28,
    y: curY,
    size: 13,
    font: fontHelveticaBold,
    color: colors.primary
  });
  page1.drawLine({
    start: { x: 28, y: curY - 5 },
    end: { x: width - 28, y: curY - 5 },
    thickness: 1.5,
    color: colors.indigo
  });

  curY -= 20;
  page1.drawText('This flowchart illustrates how EventPulse seamlessly coordinates corporate hackathons across independent campuses:', {
    x: 28,
    y: curY,
    size: 8.5,
    font: fontHelvetica,
    color: colors.mutedText
  });

  curY -= 15;

  // 6 Stages Grid (2 columns x 3 rows)
  const stages = [
    {
      num: 'STAGE 1',
      title: 'Corporate Onboarding & Launch',
      color: colors.accentBlue,
      items: [
        'Corporate partner registers & sets problem statements',
        'Deposits cash prize pool (e.g. Rs 1,00,000) into escrow',
        'Targets: "All Connected Universities" with 1-click',
        'EventPulse Master Super Admin reviews and authorizes'
      ]
    },
    {
      num: 'STAGE 2',
      title: 'Multi-Campus Broadcast Engine',
      color: colors.purple,
      items: [
        'Router broadcasts event to all 4 partner colleges',
        'Campus A: Sanjivani Univ (5,000+ students)',
        'Campus B: Pune Univ / COEP (8,000+ students)',
        'Campus C: Autonomous Engg College (4,000+ students)'
      ]
    },
    {
      num: 'STAGE 3',
      title: 'Cross-Campus Teaming & Passes',
      color: colors.amber,
      items: [
        'Student A (Sanjivani) creates team "CodeTitans"',
        'Generates team join invite code: #TITAN-92',
        'Student B (COEP) enters code to join the team',
        'Verified PRNs checked -> Cryptographic QR Pass issued'
      ]
    },
    {
      num: 'STAGE 4',
      title: 'Live Check-in & Auto-OD Clearance',
      color: colors.emerald,
      items: [
        'Organizer scans student QR at hackathon entrance',
        'Real-time attendance recorded: PRESENT [Verified]',
        'Auto-OD Trigger: HOD receives instant clearance push',
        'HOD 1-click approves -> College attendance 100% safe!'
      ]
    },
    {
      num: 'STAGE 5',
      title: 'Project Submission & Evaluation',
      color: colors.accentBlue,
      items: [
        'Teams submit GitHub repositories, architecture & demos',
        'Corporate jury evaluates via standardized rubric scoring',
        'Dynamic live multi-campus leaderboard updates real-time',
        'Top 10 finalist teams present at Grand Finale'
      ]
    },
    {
      num: 'STAGE 6',
      title: 'PPOs, Hiring & Co-Branded Certs',
      color: colors.indigo,
      items: [
        'Automated prize money distribution to winning teams',
        'Recruiter Talent Dossier: Direct interview invites & PPOs',
        'Tamper-proof certificates with Company + Univ logos',
        'Instant verification via public /verify/:id link'
      ]
    }
  ];

  const colWidth = (width - 56 - 12) / 2; // ~263 pt
  const boxHeight = 110;

  for (let i = 0; i < stages.length; i++) {
    const row = Math.floor(i / 2);
    const col = i % 2;
    const boxX = 28 + col * (colWidth + 12);
    const boxY = curY - (row + 1) * (boxHeight + 10);

    const s = stages[i];

    // Card background
    page1.drawRectangle({
      x: boxX,
      y: boxY,
      width: colWidth,
      height: boxHeight,
      color: colors.lightBg,
      borderColor: s.color,
      borderWidth: 1.2
    });

    // Badge
    page1.drawRectangle({
      x: boxX + 10,
      y: boxY + boxHeight - 20,
      width: 55,
      height: 14,
      color: s.color
    });
    page1.drawText(s.num, {
      x: boxX + 14,
      y: boxY + boxHeight - 16,
      size: 7,
      font: fontHelveticaBold,
      color: colors.white
    });

    // Title
    page1.drawText(s.title, {
      x: boxX + 72,
      y: boxY + boxHeight - 17,
      size: 8.5,
      font: fontHelveticaBold,
      color: colors.darkText
    });

    // Items
    let itemY = boxY + boxHeight - 34;
    for (const item of s.items) {
      page1.drawText('• ' + item, {
        x: boxX + 12,
        y: itemY,
        size: 7,
        font: fontHelvetica,
        color: colors.mutedText,
        maxWidth: colWidth - 24
      });
      itemY -= 17;
    }
  }

  // Highlight Banner: Killer Feature
  const highlightY = curY - 3 * (boxHeight + 10) - 45;
  page1.drawRectangle({
    x: 28,
    y: highlightY,
    width: width - 56,
    height: 52,
    color: rgb(0.98, 0.95, 1.0),
    borderColor: colors.purple,
    borderWidth: 1.5
  });

  page1.drawText('THE KILLER DIFFERENTIATOR: AUTOMATED ACADEMIC ON-DUTY (OD) CLEARANCE', {
    x: 40,
    y: highlightY + 36,
    size: 8.5,
    font: fontHelveticaBold,
    color: rgb(0.45, 0.15, 0.75)
  });

  page1.drawText(
    'Platforms like Unstop suffer from 60%+ ghost attendance because students cannot get leave from college. EventPulse connects live venue QR check-ins directly to HOD dashboards. The moment a student enters the hackathon, their HOD receives a verified OD request with 1-click clearance. Students and colleges will strictly prefer EventPulse for this protection.',
    {
      x: 40,
      y: highlightY + 22,
      size: 7.2,
      font: fontHelvetica,
      color: rgb(0.35, 0.15, 0.55),
      maxWidth: width - 80,
      lineHeight: 10
    }
  );

  // Footer Page 1
  page1.drawText('EventPulse Multi-University Corporate Framework  |  Confidential Architecture  |  Page 1 of 2', {
    x: 130,
    y: 20,
    size: 7.5,
    font: fontHelvetica,
    color: colors.mutedText
  });

  // ================= PAGE 2 =================
  const page2 = pdfDoc.addPage([595.28, 841.89]);

  // Page 2 Header Bar
  page2.drawRectangle({
    x: 28,
    y: height - 55,
    width: width - 56,
    height: 28,
    color: colors.primary
  });
  page2.drawText('EVENTPULSE  •  BUSINESS MODEL, DATA PRIVACY & RECRUITER STRATEGY', {
    x: 40,
    y: height - 43,
    size: 9,
    font: fontHelveticaBold,
    color: colors.white
  });

  let p2Y = height - 85;

  // Section 2: Monetization
  page2.drawText('2. Business & Monetization Blueprint', {
    x: 28,
    y: p2Y,
    size: 13,
    font: fontHelveticaBold,
    color: colors.primary
  });
  page2.drawLine({
    start: { x: 28, y: p2Y - 5 },
    end: { x: width - 28, y: p2Y - 5 },
    thickness: 1.5,
    color: colors.indigo
  });

  p2Y -= 22;

  // Pricing Table
  const tableTop = p2Y;
  const col1X = 28, col2X = 175, col3X = 425;
  const tWidth = width - 56;

  // Table Header
  page2.drawRectangle({
    x: 28,
    y: tableTop - 18,
    width: tWidth,
    height: 20,
    color: rgb(0.92, 0.95, 0.98)
  });
  page2.drawText('Revenue Stream', { x: col1X + 8, y: tableTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('Deliverables to Corporate Sponsor', { x: col2X + 8, y: tableTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('Commercial Pricing Fee', { x: col3X + 8, y: tableTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });

  const pricingRows = [
    {
      name: 'Sponsored Hackathon Listing',
      desc: 'Branding across 4 universities, problem statement broadcast, participant management dashboard, digital certificates.',
      price: 'Rs 25,000 - Rs 75,000 / event'
    },
    {
      name: 'Full Enterprise Challenge',
      desc: 'Dedicated multi-campus promotion, mentor slots, custom judging criteria, physical lab venue coordination at partner colleges.',
      price: 'Rs 1,00,000 - Rs 2,50,000 / challenge'
    },
    {
      name: 'Talent Hiring Access Pass',
      desc: 'Direct access to verified candidate dossiers (top 10% performers), GitHub profiles, PRNs, and 1-click interview invitations.',
      price: 'Rs 5,000 - Rs 10,000 / hire / intern'
    },
    {
      name: 'Web3 & Open Source Grants',
      desc: 'Sponsored developer tracks funded by global foundations (Polygon, Solana, Ethereum India, GitHub Campus).',
      price: '$1,000 - $3,000 (Rs 80k - Rs 2.5L)'
    }
  ];

  let rowY = tableTop - 20;
  for (let r = 0; r < pricingRows.length; r++) {
    const row = pricingRows[r];
    const rHeight = 36;
    page2.drawRectangle({
      x: 28,
      y: rowY - rHeight,
      width: tWidth,
      height: rHeight,
      color: r % 2 === 0 ? colors.white : colors.lightBg,
      borderColor: colors.border,
      borderWidth: 0.5
    });

    page2.drawText(row.name, { x: col1X + 8, y: rowY - 14, size: 7.5, font: fontHelveticaBold, color: colors.indigo, maxWidth: 135 });
    page2.drawText(row.desc, { x: col2X + 8, y: rowY - 13, size: 7, font: fontHelvetica, color: colors.mutedText, maxWidth: 235, lineHeight: 9 });
    page2.drawText(row.price, { x: col3X + 8, y: rowY - 15, size: 7.5, font: fontHelveticaBold, color: colors.emerald });

    rowY -= rHeight;
  }

  // Section 3: Data Isolation Matrix
  p2Y = rowY - 30;
  page2.drawText('3. Multi-Tenant Data Isolation & Privacy Matrix', {
    x: 28,
    y: p2Y,
    size: 13,
    font: fontHelveticaBold,
    color: colors.primary
  });
  page2.drawLine({
    start: { x: 28, y: p2Y - 5 },
    end: { x: width - 28, y: p2Y - 5 },
    thickness: 1.5,
    color: colors.indigo
  });

  p2Y -= 22;

  // Matrix Table Header
  const mTop = p2Y;
  page2.drawRectangle({
    x: 28,
    y: mTop - 18,
    width: tWidth,
    height: 20,
    color: rgb(0.92, 0.95, 0.98)
  });
  page2.drawText('Data Entity', { x: 36, y: mTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('Corporate Sponsor', { x: 170, y: mTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('College Students', { x: 285, y: mTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('College HOD / Dean', { x: 400, y: mTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });
  page2.drawText('Super Admin', { x: 495, y: mTop - 12, size: 8, font: fontHelveticaBold, color: colors.darkText });

  const matrixRows = [
    { entity: 'Inter-Campus Hackathons', c: 'Full Access', s: 'Browse & Register', h: 'View Participants', a: 'Full Control' },
    { entity: 'Internal College Fests', c: 'BLOCKED [X]', s: 'Own College Only', h: 'Own Dept Only', a: 'Full Control' },
    { entity: 'Student Grievance Dossiers', c: 'BLOCKED [X]', s: 'Own Tickets', h: 'Own Dept Only', a: 'Full Control' },
    { entity: 'Academic OD Attendance', c: 'BLOCKED [X]', s: 'View OD Status', h: '1-Click Approve', a: 'Audit Logs' }
  ];

  let mRowY = mTop - 20;
  for (let m = 0; m < matrixRows.length; m++) {
    const mr = matrixRows[m];
    const mHeight = 22;
    page2.drawRectangle({
      x: 28,
      y: mRowY - mHeight,
      width: tWidth,
      height: mHeight,
      color: m % 2 === 0 ? colors.white : colors.lightBg,
      borderColor: colors.border,
      borderWidth: 0.5
    });

    page2.drawText(mr.entity, { x: 36, y: mRowY - 14, size: 7.5, font: fontHelveticaBold, color: colors.darkText });
    page2.drawText(mr.c, { x: 170, y: mRowY - 14, size: 7.5, font: fontHelvetica, color: mr.c.includes('BLOCKED') ? rgb(0.85, 0.1, 0.1) : colors.emerald });
    page2.drawText(mr.s, { x: 285, y: mRowY - 14, size: 7.5, font: fontHelvetica, color: colors.mutedText });
    page2.drawText(mr.h, { x: 400, y: mRowY - 14, size: 7.5, font: fontHelvetica, color: colors.mutedText });
    page2.drawText(mr.a, { x: 495, y: mRowY - 14, size: 7.5, font: fontHelveticaBold, color: colors.indigo });

    mRowY -= mHeight;
  }

  // Section 4: Pitch Script
  p2Y = mRowY - 26;
  page2.drawText('4. Corporate Pitch Script (For HR & Placement Leads)', {
    x: 28,
    y: p2Y,
    size: 13,
    font: fontHelveticaBold,
    color: colors.primary
  });
  page2.drawLine({
    start: { x: 28, y: p2Y - 5 },
    end: { x: width - 28, y: p2Y - 5 },
    thickness: 1.5,
    color: colors.indigo
  });

  p2Y -= 20;

  page2.drawRectangle({
    x: 28,
    y: p2Y - 90,
    width: width - 56,
    height: 90,
    color: rgb(0.95, 0.96, 0.99),
    borderColor: colors.indigo,
    borderWidth: 1
  });

  page2.drawText('Subject: Direct Access to 15,000+ Pre-Verified Engineering Students Across 4 Universities', {
    x: 40,
    y: p2Y - 16,
    size: 8,
    font: fontHelveticaBold,
    color: colors.indigo
  });

  const pitchText = 
    '"Hi [Recruiter / Campus Lead], I am the founder of EventPulse, the official campus event and academic clearance platform operating across 4 major universities with 15,000+ verified engineering students. Traditional hiring hackathons suffer from 60%+ ghost registrations and unverified resumes. With EventPulse, your challenge is broadcast directly to students\' official academic feeds with guaranteed physical turnout via our HOD-backed On-Duty (OD) attendance engine. We would love to host a sponsored track for [Company Name] next month. Would you be open for a brief 10-minute briefing this Thursday?"';

  page2.drawText(pitchText, {
    x: 40,
    y: p2Y - 32,
    size: 7.3,
    font: fontHelveticaOblique,
    color: colors.darkText,
    maxWidth: width - 80,
    lineHeight: 11
  });

  // Footer Page 2
  page2.drawText('EventPulse Multi-University Corporate Framework  |  Confidential Architecture  |  Page 2 of 2', {
    x: 130,
    y: 20,
    size: 7.5,
    font: fontHelvetica,
    color: colors.mutedText
  });

  const pdfBytes = await pdfDoc.save();
  const outputPath = path.resolve('C:\\Users\\thora\\Downloads\\EventPulse_Corporate_Partnership_Flowchart.pdf');
  fs.writeFileSync(outputPath, pdfBytes);
  console.log(`✅ PDF successfully generated at: ${outputPath} (${(pdfBytes.length / 1024).toFixed(1)} KB)`);
}

generatePDF().catch(err => {
  console.error('❌ Failed to generate PDF:', err);
  process.exit(1);
});
