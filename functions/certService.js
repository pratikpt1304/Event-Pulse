const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');

/**
 * Generate a PDF Certificate buffer
 */
async function buildCertificatePDF({ studentName, prn, eventTitle, eventDate, verificationId, organizerId }) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([842, 595]); // Landscape A4 (842 x 595 pt)
  const { width, height } = page.getSize();

  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // Background frame / border
  const navy = rgb(0.08, 0.18, 0.36);
  const gold = rgb(0.85, 0.65, 0.13);
  const darkGray = rgb(0.2, 0.2, 0.2);

  // Outer Border
  page.drawRectangle({
    x: 20,
    y: 20,
    width: width - 40,
    height: height - 40,
    borderWidth: 3,
    borderColor: navy,
    color: rgb(0.98, 0.98, 1.0),
  });

  // Inner Decorative Border
  page.drawRectangle({
    x: 30,
    y: 30,
    width: width - 60,
    height: height - 60,
    borderWidth: 1,
    borderColor: gold,
  });

  // Title: EventPulse Header
  page.drawText('EVENTPULSE VERIFIED CERTIFICATE', {
    x: width / 2 - 160,
    y: height - 80,
    size: 16,
    font: fontBold,
    color: gold,
  });

  // Subtitle
  page.drawText('CERTIFICATE OF ATTENDANCE', {
    x: width / 2 - 210,
    y: height - 125,
    size: 26,
    font: fontBold,
    color: navy,
  });

  // Body text
  page.drawText('This is proudly presented to', {
    x: width / 2 - 90,
    y: height - 180,
    size: 14,
    font: fontOblique,
    color: darkGray,
  });

  // Student Name
  page.drawText(studentName.toUpperCase(), {
    x: width / 2 - (studentName.length * 10),
    y: height - 230,
    size: 28,
    font: fontBold,
    color: navy,
  });

  // PRN if available
  if (prn) {
    page.drawText(`PRN: ${prn}`, {
      x: width / 2 - 40,
      y: height - 255,
      size: 12,
      font: fontHelvetica,
      color: darkGray,
    });
  }

  // Participation Details
  const line1 = `For active participation and successful attendance at`;
  page.drawText(line1, {
    x: width / 2 - 160,
    y: height - 300,
    size: 14,
    font: fontHelvetica,
    color: darkGray,
  });

  page.drawText(`"${eventTitle}"`, {
    x: width / 2 - (eventTitle.length * 5),
    y: height - 335,
    size: 20,
    font: fontBold,
    color: navy,
  });

  page.drawText(`Held on ${eventDate}`, {
    x: width / 2 - 70,
    y: height - 370,
    size: 12,
    font: fontOblique,
    color: darkGray,
  });

  // Verification Footer
  page.drawText(`Verification ID: ${verificationId}`, {
    x: 50,
    y: 50,
    size: 10,
    font: fontHelvetica,
    color: darkGray,
  });

  page.drawText(`Verify at: eventpulse.univ.edu/#verify/${verificationId}`, {
    x: width - 360,
    y: 50,
    size: 10,
    font: fontHelvetica,
    color: navy,
  });

  const pdfBytes = await pdfDoc.save();
  return Buffer.from(pdfBytes);
}

module.exports = {
  buildCertificatePDF,
};
