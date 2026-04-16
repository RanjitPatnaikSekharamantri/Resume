import PDFDocument from "pdfkit";

/**
 * Generates a clean, ATS-friendly PDF from plain text.
 * Uses Helvetica (always available in PDFKit, universally ATS-safe).
 */
export async function buildPdf(text: string, title?: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: "LETTER",
      margins: { top: 54, bottom: 54, left: 54, right: 54 },
      info: {
        Title: title || "Resume",
        Creator: "AI Career OS",
      },
    });

    const chunks: Buffer[] = [];
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);

    const lines = text.split("\n");
    let isFirstLine = true;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown(0.3);
        continue;
      }

      // Detect section headings (all-caps lines or lines with ━ or ─)
      const isHeading =
        /^[A-Z\s━─/&]+$/.test(trimmed) &&
        trimmed.length > 3 &&
        trimmed.length < 50;
      const isDivider = /^[━──]+$/.test(trimmed);

      if (isDivider) {
        doc
          .moveTo(doc.x, doc.y)
          .lineTo(doc.page.width - doc.page.margins.right, doc.y)
          .strokeColor("#cccccc")
          .lineWidth(0.5)
          .stroke();
        doc.moveDown(0.3);
        continue;
      }

      if (isFirstLine) {
        doc.fontSize(16).font("Helvetica-Bold").text(trimmed, { align: "center" });
        isFirstLine = false;
        continue;
      }

      if (isHeading) {
        doc.moveDown(0.4);
        doc.fontSize(11).font("Helvetica-Bold").text(trimmed);
        doc.moveDown(0.15);
        continue;
      }

      // Bullet points
      const isBullet = /^[•\-–—\*]/.test(trimmed);
      if (isBullet) {
        const bulletText = trimmed.replace(/^[•\-–—\*]\s*/, "");
        doc.fontSize(10).font("Helvetica").text(`  •  ${bulletText}`, {
          indent: 10,
          lineGap: 2,
        });
        continue;
      }

      // Regular text
      doc.fontSize(10).font("Helvetica").text(trimmed, { lineGap: 2 });
    }

    doc.end();
  });
}
