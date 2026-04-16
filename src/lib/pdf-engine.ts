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

    // Heuristics for detecting role header lines inside experience sections.
    const ROLE_HEADER_HINTS = [
      /\bpresent\b/i,
      /\b(19|20)\d{2}\s*[–—\-]\s*((19|20)\d{2}|present)/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i,
      /\s[·|•–—]\s/,
    ];
    const isRoleHeaderLine = (s: string) =>
      ROLE_HEADER_HINTS.some((re) => re.test(s)) &&
      !/^[•\-–—\*]/.test(s) &&
      s.length < 160;

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown(0.3);
        continue;
      }

      const words = trimmed.split(/\s+/);
      const isHeading =
        /^[A-Z\s━─/&]+$/.test(trimmed) &&
        trimmed.length > 5 &&
        trimmed.length < 50 &&
        words.length >= 2 &&
        !/^\d/.test(trimmed) &&
        !/,\s*[A-Z]{2}$/.test(trimmed);
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

      // Role / company / location / dates line — bold for hierarchy.
      if (isRoleHeaderLine(trimmed)) {
        doc.moveDown(0.2);
        doc.fontSize(10.5).font("Helvetica-Bold").text(trimmed, { lineGap: 2 });
        continue;
      }

      // Regular text
      doc.fontSize(10).font("Helvetica").text(trimmed, { lineGap: 2 });
    }

    doc.end();
  });
}
