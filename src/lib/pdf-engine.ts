import PDFDocument from "pdfkit";

interface BuildPdfOptions {
  emphasizeTokens?: string[];
}

/**
 * Generates a clean, ATS-friendly PDF from plain text.
 *
 * The text is pre-formatted by `sectionsToText` (or the enhancement route)
 * with canonical uppercase section headings:
 *
 *   PROFILE SUMMARY     — paragraph, no bullets, no bold
 *   TECHNICAL SKILLS    — "· Category: tool1, tool2, tool3"
 *   WORK EXPERIENCE     — bold "Role | Company | Location | Date" header,
 *                          bullets with selective inline bold
 *   EDUCATION           — verbatim
 *   CERTIFICATIONS      — verbatim
 *
 * We render with Helvetica (universally ATS-safe).
 */
const BASE_EMPHASIZE_TOKENS = [
  "TypeScript", "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "Kotlin",
  "React", "Next.js", "Node.js", "GraphQL", "REST",
  "AWS", "GCP", "Azure", "Kubernetes", "Docker", "Terraform",
  "PostgreSQL", "MySQL", "Redis", "Kafka",
  "CI/CD", "SRE",
  "Splunk", "Nessus", "CrowdStrike", "SentinelOne", "Wireshark", "Burp Suite",
  "SIEM", "SOAR", "EDR", "MITRE",
  "Tableau", "Power BI", "Snowflake", "Databricks", "Airflow",
];

const CANONICAL_HEADINGS = new Set([
  "PROFILE SUMMARY",
  "TECHNICAL SKILLS",
  "WORK EXPERIENCE",
  "EDUCATION",
  "CERTIFICATIONS",
  "PROJECTS",
]);

function escapeRegex(s: string) {
  return s.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
}

function buildEmphasizeRegex(extra: string[]): RegExp {
  const merged = new Set<string>();
  for (const t of BASE_EMPHASIZE_TOKENS) merged.add(t);
  for (const t of extra) {
    if (t && t.length <= 24 && /^[A-Za-z][A-Za-z0-9./+#\- ]*$/.test(t)) merged.add(t);
  }
  const pattern = [...merged].map(escapeRegex).join("|");
  return new RegExp(`\\b(${pattern})\\b`, "g");
}

interface RenderSpan {
  text: string;
  bold: boolean;
}

function splitBoldSpans(text: string, re: RegExp): RenderSpan[] {
  if (!text) return [{ text: "", bold: false }];
  re.lastIndex = 0;
  const spans: RenderSpan[] = [];
  let lastIdx = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > lastIdx) spans.push({ text: text.slice(lastIdx, m.index), bold: false });
    spans.push({ text: m[0], bold: true });
    lastIdx = m.index + m[0].length;
  }
  if (lastIdx < text.length) spans.push({ text: text.slice(lastIdx), bold: false });
  return spans.length ? spans : [{ text, bold: false }];
}

/**
 * Section-aware PDF renderer. Walks the text line-by-line and applies the
 * canonical formatting rules depending on the active section.
 */
export async function buildPdf(
  text: string,
  title?: string,
  opts: BuildPdfOptions = {}
): Promise<Buffer> {
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

    const emphasizeRe = buildEmphasizeRegex(opts.emphasizeTokens || []);

    const ROLE_HEADER_HINTS = [
      /\bpresent\b/i,
      /\b(19|20)\d{2}\s*[–—\-]\s*((19|20)\d{2}|present)/i,
      /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i,
      /\s[·|•–—]\s/,
      /\s\|\s/,
    ];
    const isRoleHeaderLine = (s: string) =>
      ROLE_HEADER_HINTS.some((re) => re.test(s)) &&
      !/^[•\-–—\*·]/.test(s) &&
      s.length < 200;

    const lines = text.split("\n");
    let isFirstLine = true;
    type SectionKind =
      | "header"
      | "summary"
      | "skills"
      | "experience"
      | "education"
      | "certifications"
      | "other";
    let currentSection: SectionKind = "header";

    const headingToKind: Record<string, SectionKind> = {
      "PROFILE SUMMARY": "summary",
      "TECHNICAL SKILLS": "skills",
      "WORK EXPERIENCE": "experience",
      EDUCATION: "education",
      CERTIFICATIONS: "certifications",
      PROJECTS: "experience",
    };

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        doc.moveDown(0.3);
        continue;
      }

      const isDivider = /^[━─\-]{3,}$/.test(trimmed);
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

      const upper = trimmed.toUpperCase();
      if (CANONICAL_HEADINGS.has(upper)) {
        currentSection = headingToKind[upper] || "other";
        doc.moveDown(0.5);
        doc.fontSize(11).font("Helvetica-Bold").fillColor("#000").text(upper);
        doc.moveDown(0.15);
        continue;
      }

      // Generic heading fallback (older base resumes with non-canonical titles)
      const words = trimmed.split(/\s+/);
      const genericHeading =
        /^[A-Z\s&/\-]+$/.test(trimmed) &&
        trimmed.length > 4 &&
        trimmed.length < 50 &&
        words.length >= 1 &&
        words.length <= 5 &&
        !/^\d/.test(trimmed) &&
        !/,\s*[A-Z]{2}$/.test(trimmed);
      if (genericHeading) {
        currentSection = "other";
        doc.moveDown(0.4);
        doc.fontSize(11).font("Helvetica-Bold").text(trimmed);
        doc.moveDown(0.15);
        continue;
      }

      const isBullet = /^[•\-–—\*·]/.test(trimmed);
      const bulletText = isBullet ? trimmed.replace(/^[•\-–—\*·]\s*/, "") : trimmed;

      // ── Section-specific rendering ──

      if (currentSection === "summary") {
        // Paragraph, no bullet, no bold
        doc.fontSize(10).font("Helvetica").fillColor("#000").text(bulletText, { lineGap: 2 });
        continue;
      }

      if (currentSection === "skills") {
        const catMatch = bulletText.match(/^([^:]{2,40}):\s*(.+)$/);
        if (catMatch) {
          const category = catMatch[1];
          const items = catMatch[2];
          doc.fontSize(10).font("Helvetica").text(`  •  ${category}: `, {
            indent: 10,
            lineGap: 2,
            continued: true,
          });
          const spans = splitBoldSpans(items, emphasizeRe);
          for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            const last = i === spans.length - 1;
            doc.font(span.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
            doc.text(span.text, { continued: !last, lineGap: 2 });
          }
        } else {
          doc.fontSize(10).font("Helvetica").text(`  •  ${bulletText}`, { indent: 10, lineGap: 2 });
        }
        continue;
      }

      if (currentSection === "experience") {
        if (!isBullet && isRoleHeaderLine(trimmed)) {
          doc.moveDown(0.25);
          doc.fontSize(10.5).font("Helvetica-Bold").fillColor("#000").text(trimmed, { lineGap: 2 });
          continue;
        }
        if (isBullet) {
          doc.fontSize(10).font("Helvetica").text(`  •  `, { indent: 10, lineGap: 2, continued: true });
          const spans = splitBoldSpans(bulletText, emphasizeRe);
          for (let i = 0; i < spans.length; i++) {
            const span = spans[i];
            const last = i === spans.length - 1;
            doc.font(span.bold ? "Helvetica-Bold" : "Helvetica").fontSize(10);
            doc.text(span.text, { continued: !last, lineGap: 2 });
          }
          continue;
        }
        // Non-bullet line inside experience: treat as company description
        doc.fontSize(9.5).font("Helvetica-Oblique").fillColor("#555").text(trimmed, { lineGap: 2 });
        doc.fillColor("#000");
        continue;
      }

      // EDUCATION / CERTIFICATIONS / other — verbatim, no inline bold
      if (isBullet) {
        doc.fontSize(10).font("Helvetica").fillColor("#000").text(`  •  ${bulletText}`, {
          indent: 10,
          lineGap: 2,
        });
      } else {
        doc.fontSize(10).font("Helvetica").fillColor("#000").text(trimmed, { lineGap: 2 });
      }
    }

    doc.end();
  });
}
