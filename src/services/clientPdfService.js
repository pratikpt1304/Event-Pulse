import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Client-Side Institutional Certificate PDF Generator
 * Uses `pdf-lib` to produce an authentic, printable, high-resolution A4 landscape PDF.
 */
export async function generateClientCertificatePDF({
  studentName = 'Student Name',
  prn = 'SU2024IMT0091',
  eventTitle = 'Campus Technical Event',
  eventDate = 'Academic Year 2025-2026',
  verificationId = 'SU-CERT-2026-VERIFIED',
  organizerName = 'Department Event Cell',
  department = 'Integrated M.Tech (AIML)'
}) {
  const pdfDoc = await PDFDocument.create();
  // Landscape A4: 841.89 x 595.28 points
  const page = pdfDoc.addPage([841.89, 595.28]);
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Official color palette
  const navy = rgb(0.05, 0.12, 0.28);      // #0d1e47
  const gold = rgb(0.79, 0.62, 0.22);      // #c99e38
  const darkGray = rgb(0.25, 0.25, 0.28);  // #404047
  const lightBg = rgb(0.99, 0.99, 0.98);   // Ivory parchment

  // Background Fill
  page.drawRectangle({
    x: 0,
    y: 0,
    width,
    height,
    color: lightBg,
  });

  // Outer Decorative Navy Border
  page.drawRectangle({
    x: 18,
    y: 18,
    width: width - 36,
    height: height - 36,
    borderWidth: 3.5,
    borderColor: navy,
  });

  // Inner Gold Accent Border
  page.drawRectangle({
    x: 25,
    y: 25,
    width: width - 50,
    height: height - 50,
    borderWidth: 1.2,
    borderColor: gold,
  });

  // Corner Ornaments (Navy triangles with gold dots)
  const cornerSize = 45;
  // Top-Left Corner Block
  page.drawRectangle({
    x: 18,
    y: height - 18 - cornerSize,
    width: cornerSize,
    height: cornerSize,
    color: navy,
  });
  // Top-Right Corner Block
  page.drawRectangle({
    x: width - 18 - cornerSize,
    y: height - 18 - cornerSize,
    width: cornerSize,
    height: cornerSize,
    color: navy,
  });
  // Bottom-Left Corner Block
  page.drawRectangle({
    x: 18,
    y: 18,
    width: cornerSize,
    height: cornerSize,
    color: navy,
  });
  // Bottom-Right Corner Block
  page.drawRectangle({
    x: width - 18 - cornerSize,
    y: 18,
    width: cornerSize,
    height: cornerSize,
    color: navy,
  });

  // 1. University Header
  const uniName = 'SANJIVANI UNIVERSITY';
  const uniWidth = fontBold.widthOfTextAtSize(uniName, 22);
  page.drawText(uniName, {
    x: (width - uniWidth) / 2,
    y: height - 70,
    size: 22,
    font: fontBold,
    color: navy,
  });

  const subHeader = 'DIRECTORATE OF STUDENT AFFAIRS & CAMPUS INNOVATION';
  const subWidth = fontHelvetica.widthOfTextAtSize(subHeader, 9.5);
  page.drawText(subHeader, {
    x: (width - subWidth) / 2,
    y: height - 88,
    size: 9.5,
    font: fontHelvetica,
    color: gold,
  });

  // 2. Certificate Title
  const certTitle = 'CERTIFICATE OF EXCELLENCE & PARTICIPATION';
  const certWidth = fontBold.widthOfTextAtSize(certTitle, 19);
  page.drawText(certTitle, {
    x: (width - certWidth) / 2,
    y: height - 135,
    size: 19,
    font: fontBold,
    color: navy,
  });

  const presentedText = 'This is proudly presented and certified to:';
  const presWidth = fontOblique.widthOfTextAtSize(presentedText, 12);
  page.drawText(presentedText, {
    x: (width - presWidth) / 2,
    y: height - 172,
    size: 12,
    font: fontOblique,
    color: darkGray,
  });

  // 3. Candidate Name
  const candidateName = studentName.toUpperCase();
  const nameWidth = fontBold.widthOfTextAtSize(candidateName, 25);
  page.drawText(candidateName, {
    x: Math.max(50, (width - nameWidth) / 2),
    y: height - 215,
    size: 25,
    font: fontBold,
    color: navy,
  });

  // Gold accent rule under name
  page.drawLine({
    start: { x: (width - Math.min(360, nameWidth + 60)) / 2, y: height - 225 },
    end: { x: (width + Math.min(360, nameWidth + 60)) / 2, y: height - 225 },
    thickness: 1.5,
    color: gold,
  });

  // 4. PRN & Department
  const prnLine = `PRN: ${prn}  |  Department: ${department}`;
  const prnWidth = fontHelvetica.widthOfTextAtSize(prnLine, 11);
  page.drawText(prnLine, {
    x: (width - prnWidth) / 2,
    y: height - 248,
    size: 11,
    font: fontHelvetica,
    color: darkGray,
  });

  // 5. Participation Statement
  const line1 = 'For active participation, exemplary engagement, and verified attendance in';
  const l1Width = fontHelvetica.widthOfTextAtSize(line1, 12.5);
  page.drawText(line1, {
    x: (width - l1Width) / 2,
    y: height - 290,
    size: 12.5,
    font: fontHelvetica,
    color: darkGray,
  });

  const evTitle = `"${eventTitle}"`;
  const evWidth = fontBold.widthOfTextAtSize(evTitle, 17);
  page.drawText(evTitle, {
    x: Math.max(50, (width - evWidth) / 2),
    y: height - 322,
    size: 17,
    font: fontBold,
    color: navy,
  });

  const dateLine = `Organized by ${organizerName} • Conducted on ${eventDate}`;
  const dateWidth = fontOblique.widthOfTextAtSize(dateLine, 11);
  page.drawText(dateLine, {
    x: (width - dateWidth) / 2,
    y: height - 355,
    size: 11,
    font: fontOblique,
    color: darkGray,
  });

  // 6. Signatures Section
  const sigY = 115;
  // Signature 1: HOD
  page.drawLine({ start: { x: 75, y: sigY }, end: { x: 235, y: sigY }, thickness: 1, color: darkGray });
  page.drawText('Dr. Arun Kulkarni', { x: 105, y: sigY - 16, size: 10.5, font: fontBold, color: navy });
  page.drawText('Head of Department (AIML)', { x: 80, y: sigY - 29, size: 8.5, font: fontHelvetica, color: darkGray });

  // Signature 2: Dean
  page.drawLine({ start: { x: (width - 160) / 2, y: sigY }, end: { x: (width + 160) / 2, y: sigY }, thickness: 1, color: darkGray });
  page.drawText('Dr. Neha Sharma', { x: (width - 85) / 2, y: sigY - 16, size: 10.5, font: fontBold, color: navy });
  page.drawText('Dean, Faculty of Engineering', { x: (width - 128) / 2, y: sigY - 29, size: 8.5, font: fontHelvetica, color: darkGray });

  // Signature 3: VC Sir
  page.drawLine({ start: { x: width - 235, y: sigY }, end: { x: width - 75, y: sigY }, thickness: 1, color: darkGray });
  page.drawText('Prof. K. V. Raman', { x: width - 195, y: sigY - 16, size: 10.5, font: fontBold, color: navy });
  page.drawText('Vice Chancellor, SU', { x: width - 192, y: sigY - 29, size: 8.5, font: fontHelvetica, color: darkGray });

  // 7. Security & Verification Footer
  const certIdText = `Certificate ID: ${verificationId}`;
  page.drawText(certIdText, {
    x: 42,
    y: 38,
    size: 8.5,
    font: fontHelvetica,
    color: darkGray,
  });

  const originUrl = typeof window !== 'undefined' ? window.location.origin : 'https://eventpulse-su-34a42.web.app';
  const verifyText = `Publicly verifiable at: ${originUrl}/#verify/${verificationId}`;
  const vTextWidth = fontHelvetica.widthOfTextAtSize(verifyText, 8.5);
  page.drawText(verifyText, {
    x: width - 42 - vTextWidth,
    y: 38,
    size: 8.5,
    font: fontHelvetica,
    color: navy,
  });

  return await pdfDoc.save();
}
