/**
 * EventPulse Certificate Generator
 * Renders an HTML certificate matching the Sanjivani University design
 * and opens a print dialog for PDF saving.
 */

export async function buildCertificatePDF({ studentName, prn, eventTitle, eventDate, verificationId }) {
  const verifyUrl = `${window.location.origin}/#verify/${verificationId}`;

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <title>Certificate - ${studentName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com"/>
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin/>
  <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700;900&family=EB+Garamond:ital,wght@0,400;0,600;1,400;1,600&family=Playfair+Display:ital,wght@0,700;1,400&display=swap" rel="stylesheet"/>
  <style>
    @page {
      size: A4 landscape;
      margin: 0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      width: 297mm;
      height: 210mm;
      background: #ffffff;
      font-family: 'EB Garamond', Georgia, serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      overflow: hidden;
    }

    .cert-wrap {
      position: relative;
      width: 297mm;
      height: 210mm;
      background: #f9f8f6;
      overflow: hidden;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
    }

    /* ── Corner Blocks ── */
    .corner {
      position: absolute;
      width: 42mm;
      height: 42mm;
      background: #0d1e3e;
      z-index: 2;
    }
    .corner-tl { top: 0; left: 0; clip-path: polygon(0 0, 100% 0, 0 100%); }
    .corner-tr { top: 0; right: 0; clip-path: polygon(100% 0, 100% 100%, 0 0); }
    .corner-bl { bottom: 0; left: 0; clip-path: polygon(0 0, 100% 100%, 0 100%); }
    .corner-br { bottom: 0; right: 0; clip-path: polygon(100% 0, 100% 100%, 0 100%); }

    /* Gold accent lines on corners */
    .corner-tl::after, .corner-tr::after, .corner-bl::after, .corner-br::after {
      content: '';
      position: absolute;
      background: #c9a84c;
    }
    .corner-tl::after { width: 3px; height: 55mm; top: 0; left: 16mm; transform-origin: top; transform: rotate(-45deg) translateX(0); display: none; }

    /* Side accent bars */
    .accent-left {
      position: absolute;
      left: 0; top: 38mm; bottom: 38mm;
      width: 7mm;
      background: linear-gradient(180deg, #0d1e3e 0%, #1a3a70 50%, #0d1e3e 100%);
      z-index: 1;
    }
    .accent-right {
      position: absolute;
      right: 0; top: 38mm; bottom: 38mm;
      width: 7mm;
      background: linear-gradient(180deg, #0d1e3e 0%, #1a3a70 50%, #0d1e3e 100%);
      z-index: 1;
    }

    /* Gold accent line on side bars */
    .accent-left::after, .accent-right::after {
      content: '';
      position: absolute;
      top: 0; bottom: 0;
      width: 2px;
      background: #c9a84c;
    }
    .accent-left::after { right: 0; }
    .accent-right::after { left: 0; }

    /* ── Outer Gold Border ── */
    .outer-border {
      position: absolute;
      inset: 10mm;
      border: 2px solid #c9a84c;
      z-index: 1;
      pointer-events: none;
    }

    /* ── Content Area ── */
    .content {
      position: relative;
      z-index: 3;
      text-align: center;
      width: 230mm;
      padding: 0 6mm;
    }

    /* ── Logo + University Row ── */
    .university-row {
      position: absolute;
      top: 12mm;
      left: 14mm;
      display: flex;
      align-items: center;
      gap: 3mm;
      z-index: 4;
    }

    .uni-logo {
      width: 18mm;
      height: 18mm;
      border-radius: 50%;
      border: 1.5px solid #c9a84c;
      background: #ffffff;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      padding: 1.5mm;
    }

    .uni-logo svg {
      width: 100%;
      height: 100%;
    }

    .uni-name {
      text-align: left;
      line-height: 1.15;
    }
    .uni-name .name1 {
      font-family: 'Cinzel', serif;
      font-size: 5.5pt;
      font-weight: 700;
      color: #0d1e3e;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .uni-name .name2 {
      font-family: 'Cinzel', serif;
      font-size: 4pt;
      color: #0d1e3e;
      letter-spacing: 1.5px;
      text-transform: uppercase;
    }
    .uni-name .name3 {
      font-family: 'EB Garamond', serif;
      font-size: 4pt;
      color: #555;
      letter-spacing: 1px;
    }

    /* ── EP Tag (top center) ── */
    .ep-tag {
      font-family: 'Cinzel', serif;
      font-size: 5.5pt;
      letter-spacing: 4px;
      color: #c9a84c;
      text-transform: uppercase;
      margin-bottom: 1.5mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3mm;
    }
    .ep-tag::before, .ep-tag::after {
      content: '';
      display: inline-block;
      width: 18mm;
      height: 1px;
      background: linear-gradient(90deg, transparent, #c9a84c, transparent);
    }

    /* ── Ornament ── */
    .ornament {
      font-size: 12pt;
      color: #c9a84c;
      margin: 0.5mm 0 1mm 0;
      letter-spacing: 3px;
    }

    /* ── CERTIFICATE heading ── */
    .cert-title {
      font-family: 'Cinzel', serif;
      font-size: 30pt;
      font-weight: 900;
      color: #0d1e3e;
      letter-spacing: 5px;
      line-height: 1;
      margin: 0;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 4mm;
    }
    .cert-title::before, .cert-title::after {
      content: '';
      display: block;
      width: 4mm;
      height: 28pt;
      border: 2px solid #0d1e3e;
      border-right: none;
    }
    .cert-title::after {
      border-right: 2px solid #0d1e3e;
      border-left: none;
    }

    .cert-of {
      font-family: 'Cinzel', serif;
      font-size: 10pt;
      color: #c9a84c;
      letter-spacing: 5px;
      margin: 0.5mm 0;
    }

    .cert-type {
      font-family: 'Cinzel', serif;
      font-size: 18pt;
      font-weight: 700;
      color: #c9a84c;
      letter-spacing: 6px;
      margin-bottom: 2mm;
    }

    /* ── Presented to ── */
    .presented-to {
      font-family: 'EB Garamond', serif;
      font-style: italic;
      font-size: 10pt;
      color: #333;
      margin-bottom: 1mm;
    }

    /* ── Name Line ── */
    .name-line {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 3mm;
      margin: 1mm 0;
    }
    .name-line::before, .name-line::after {
      content: '';
      flex: 1;
      max-width: 30mm;
      height: 1px;
      background: #c9a84c;
    }
    .student-name {
      font-family: 'Cinzel', serif;
      font-size: 17pt;
      font-weight: 700;
      color: #0d1e3e;
      letter-spacing: 2px;
    }

    /* ── PRN ── */
    .prn-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      margin: 0.5mm 0 2mm 0;
    }
    .prn-label {
      font-family: 'Cinzel', serif;
      font-size: 7.5pt;
      color: #0d1e3e;
      font-weight: 700;
      letter-spacing: 1px;
    }
    .prn-value {
      font-family: 'EB Garamond', serif;
      font-size: 9pt;
      color: #333;
      border-bottom: 1px solid #c9a84c;
      min-width: 35mm;
      text-align: center;
      padding-bottom: 0.5mm;
    }

    /* ── Mid divider ── */
    .mid-divider {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      margin: 1mm 0;
      color: #c9a84c;
      font-size: 7pt;
    }
    .mid-divider::before, .mid-divider::after {
      content: '';
      display: inline-block;
      width: 25mm;
      height: 1px;
      background: #c9a84c;
    }

    /* ── Body text ── */
    .body-text {
      font-family: 'EB Garamond', serif;
      font-size: 9.5pt;
      color: #333;
      margin-bottom: 0.5mm;
    }

    .event-name {
      font-family: 'Playfair Display', serif;
      font-style: italic;
      font-size: 12pt;
      font-weight: 700;
      color: #0d1e3e;
    }

    /* ── Held on ── */
    .held-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      margin-top: 1mm;
    }
    .held-label {
      font-family: 'EB Garamond', serif;
      font-style: italic;
      font-size: 9pt;
      color: #333;
    }
    .held-value {
      font-family: 'EB Garamond', serif;
      font-size: 9pt;
      color: #0d1e3e;
      border-bottom: 1px solid #c9a84c;
      min-width: 40mm;
      text-align: center;
      padding-bottom: 0.5mm;
    }

    /* ── Decorative bottom flourish ── */
    .flourish {
      margin-top: 3mm;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 2mm;
      color: #c9a84c;
      font-size: 9pt;
      letter-spacing: 3px;
    }
    .flourish span { font-size: 6pt; }

    /* ── Footer ── */
    .cert-footer {
      position: absolute;
      bottom: 12mm;
      left: 14mm;
      right: 14mm;
      display: flex;
      justify-content: space-between;
      align-items: center;
      z-index: 4;
    }
    .verify-left, .verify-right {
      font-family: 'EB Garamond', serif;
      font-size: 6pt;
      color: #555;
      display: flex;
      align-items: center;
      gap: 1.5mm;
    }
    .verify-icon {
      width: 5mm;
      height: 5mm;
      border: 1px solid #0d1e3e;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 7pt;
      color: #0d1e3e;
      flex-shrink: 0;
    }
    .globe-icon { font-size: 6pt; }

    @media print {
      body { width: 297mm; height: 210mm; }
      .cert-wrap { width: 297mm; height: 210mm; }
    }
  </style>
</head>
<body>
<div class="cert-wrap">
  <!-- Corners -->
  <div class="corner corner-tl"></div>
  <div class="corner corner-tr"></div>
  <div class="corner corner-bl"></div>
  <div class="corner corner-br"></div>

  <!-- Side accents -->
  <div class="accent-left"></div>
  <div class="accent-right"></div>

  <!-- Outer gold border -->
  <div class="outer-border"></div>

  <!-- University logo top-left -->
  <div class="university-row">
    <div class="uni-logo">
      <svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
        <circle cx="50" cy="50" r="48" fill="none" stroke="#0d1e3e" stroke-width="3"/>
        <circle cx="50" cy="50" r="42" fill="none" stroke="#c9a84c" stroke-width="1.5"/>
        <!-- Laurel leaves simplified -->
        <text x="50" y="38" text-anchor="middle" font-size="22" font-family="serif" fill="#0d1e3e">⚕</text>
        <text x="50" y="68" text-anchor="middle" font-size="7" font-family="sans-serif" font-weight="bold" fill="#0d1e3e" letter-spacing="1">SANJIVANI</text>
        <text x="50" y="78" text-anchor="middle" font-size="5.5" font-family="sans-serif" fill="#c9a84c" letter-spacing="0.5">UNIVERSITY</text>
      </svg>
    </div>
    <div class="uni-name">
      <div class="name1">Sanjivani</div>
      <div class="name2">University</div>
      <div class="name3">Kopargaon</div>
    </div>
  </div>

  <!-- Main Content -->
  <div class="content">
    <div class="ep-tag">EventPulse Verified Certificate</div>
    <div class="ornament">✦</div>

    <div class="cert-title">CERTIFICATE</div>
    <div class="cert-of">— OF —</div>
    <div class="cert-type">PARTICIPATION</div>

    <div class="presented-to">This is proudly presented to</div>

    <div class="name-line">
      <span class="student-name">${studentName.toUpperCase()}</span>
    </div>

    ${prn ? `<div class="prn-row"><span class="prn-label">PRN:</span><span class="prn-value">${prn}</span></div>` : ''}

    <div class="mid-divider">✦</div>

    <div class="body-text">For active participation and contribution in the event</div>
    <div class="event-name">&ldquo;${eventTitle}&rdquo;</div>

    <div class="held-row">
      <span class="held-label">Held on</span>
      <span class="held-value">${eventDate}</span>
    </div>

    <div class="flourish">
      <span>✦</span>❧ ❧ ✦ ❧ ❧<span>✦</span>
    </div>
  </div>

  <!-- Footer verification -->
  <div class="cert-footer">
    <div class="verify-left">
      <div class="verify-icon">✓</div>
      <span>Verification ID: ${verificationId}</span>
    </div>
    <div class="verify-right">
      <div class="globe-icon">🌐</div>
      <span>Verify at: ${verifyUrl}</span>
    </div>
  </div>
</div>

<script>
  window.addEventListener('load', () => {
    setTimeout(() => {
      window.print();
    }, 800);
  });
<\/script>
</body>
</html>`;

  return html;
}
