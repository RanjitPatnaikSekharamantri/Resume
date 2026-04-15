import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
  BorderStyle,
} from "docx";

// ── Section types that the engine recognises ──

export type SectionKind =
  | "header"
  | "summary"
  | "skills"
  | "experience"
  | "education"
  | "certifications"
  | "other";

export interface ResumeSection {
  kind: SectionKind;
  title: string;
  lines: string[];
  modifiable: boolean;
}

export interface ParsedResume {
  sections: ResumeSection[];
  rawText: string;
}

export interface EnhanceOptions {
  jobDescription: string;
  role: string;
  company: string;
  sectionsToEnhance: SectionKind[];
}

const SECTION_HEADING_PATTERNS: [RegExp, SectionKind][] = [
  [/^(professional\s+)?summary|objective|profile/i, "summary"],
  [/^(core\s+)?(skills|competencies|technical\s+skills|technologies)/i, "skills"],
  [/^(professional\s+)?experience|work\s+(history|experience)|employment/i, "experience"],
  [/^education|academic/i, "education"],
  [/^certifications?|licenses?|credentials/i, "certifications"],
];

// ── Parse DOCX to sections ──

export async function parseDocx(buffer: Buffer): Promise<ParsedResume> {
  const result = await mammoth.extractRawText({ buffer });
  const rawText = result.value;
  const lines = rawText.split("\n");

  const sections: ResumeSection[] = [];
  let currentSection: ResumeSection = {
    kind: "header",
    title: "Header",
    lines: [],
    modifiable: false,
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      currentSection.lines.push("");
      continue;
    }

    const detected = detectSectionHeading(trimmed);
    if (detected) {
      if (currentSection.lines.length > 0 || currentSection.kind === "header") {
        sections.push(currentSection);
      }
      currentSection = {
        kind: detected.kind,
        title: trimmed,
        lines: [],
        modifiable: isModifiable(detected.kind),
      };
      continue;
    }

    currentSection.lines.push(trimmed);
  }

  if (currentSection.lines.length > 0) {
    sections.push(currentSection);
  }

  return { sections, rawText };
}

function detectSectionHeading(
  line: string
): { kind: SectionKind } | null {
  const cleaned = line.replace(/[^a-zA-Z\s]/g, "").trim();
  if (cleaned.length < 3 || cleaned.length > 60) return null;

  for (const [pattern, kind] of SECTION_HEADING_PATTERNS) {
    if (pattern.test(cleaned)) {
      return { kind };
    }
  }

  return null;
}

function isModifiable(kind: SectionKind): boolean {
  return kind === "summary" || kind === "skills" || kind === "experience";
}

// ── Enhance sections ──

export function enhanceSections(
  parsed: ParsedResume,
  options: EnhanceOptions
): ParsedResume {
  const keywords = extractKeywords(options.jobDescription);
  const enabledSet = new Set(options.sectionsToEnhance);

  const enhanced = parsed.sections.map((section) => {
    if (!section.modifiable || !enabledSet.has(section.kind)) {
      return section;
    }

    switch (section.kind) {
      case "summary":
        return enhanceSummary(section, keywords, options);
      case "skills":
        return enhanceSkills(section, keywords);
      case "experience":
        return enhanceExperience(section, keywords, options);
      default:
        return section;
    }
  });

  return { sections: enhanced, rawText: parsed.rawText };
}

function enhanceSummary(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions
): ResumeSection {
  const original = section.lines.join(" ").trim();
  if (!original) {
    return {
      ...section,
      lines: [
        `Results-driven professional with extensive experience in ${keywords.slice(0, 3).join(", ").toLowerCase()}. ` +
          `Seeking to leverage this expertise as a ${options.role} at ${options.company}, ` +
          `contributing through ${keywords.slice(3, 5).join(" and ").toLowerCase()} capabilities.`,
      ],
    };
  }

  let enhanced = original;
  const lowerOriginal = original.toLowerCase();

  const missingKeywords = keywords
    .slice(0, 5)
    .filter((k) => !lowerOriginal.includes(k.toLowerCase()));

  if (missingKeywords.length > 0) {
    enhanced += ` Skilled in ${missingKeywords.join(", ").toLowerCase()} with a focus on delivering measurable outcomes.`;
  }

  return { ...section, lines: [enhanced] };
}

function enhanceSkills(
  section: ResumeSection,
  keywords: string[]
): ResumeSection {
  const existing = new Set(
    section.lines
      .join(" ")
      .split(/[,•·|;\n]/)
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
  );

  const newSkills = keywords
    .filter((k) => {
      const lower = k.toLowerCase();
      return ![...existing].some(
        (e) => e.includes(lower) || lower.includes(e)
      );
    })
    .slice(0, 5);

  if (newSkills.length === 0) return section;

  return {
    ...section,
    lines: [...section.lines, ...newSkills.map((s) => `• ${s}`)],
  };
}

function enhanceExperience(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions
): ResumeSection {
  const enhanced: string[] = [];
  let bulletCount = 0;
  const maxEnhancedBullets = 6;

  for (const line of section.lines) {
    if (/^[•\-–—\*]/.test(line.trim()) && bulletCount < maxEnhancedBullets) {
      const enhancedBullet = enhanceBullet(line, keywords, options);
      enhanced.push(enhancedBullet);
      bulletCount++;
    } else {
      enhanced.push(line);
    }
  }

  return { ...section, lines: enhanced };
}

function enhanceBullet(
  bullet: string,
  keywords: string[],
  options: EnhanceOptions
): string {
  let text = bullet.trim();
  const lowerText = text.toLowerCase();

  const relevantKeyword = keywords.find(
    (k) => !lowerText.includes(k.toLowerCase())
  );

  if (relevantKeyword) {
    text = text.replace(/\.?\s*$/, "");
    text += `, leveraging ${relevantKeyword.toLowerCase()} expertise.`;
  }

  return text;
}

// ── Build DOCX from sections ──

export async function buildDocx(parsed: ParsedResume): Promise<Buffer> {
  const children: Paragraph[] = [];

  for (const section of parsed.sections) {
    if (section.kind !== "header" && section.title) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({
              text: section.title.toUpperCase(),
              bold: true,
              size: 24,
              font: "Calibri",
            }),
          ],
          heading: HeadingLevel.HEADING_2,
          spacing: { before: 240, after: 120 },
          border: {
            bottom: {
              style: BorderStyle.SINGLE,
              size: 1,
              color: "999999",
            },
          },
        })
      );
    }

    for (const line of section.lines) {
      if (!line) {
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      const isBullet = /^[•\-–—\*]/.test(line);
      const cleanLine = isBullet ? line.replace(/^[•\-–—\*]\s*/, "") : line;

      if (section.kind === "header" && section.lines.indexOf(line) === 0) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                bold: true,
                size: 32,
                font: "Calibri",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 60 },
          })
        );
      } else if (section.kind === "header") {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                size: 20,
                font: "Calibri",
                color: "666666",
              }),
            ],
            alignment: AlignmentType.CENTER,
            spacing: { after: 40 },
          })
        );
      } else if (isBullet) {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                size: 21,
                font: "Calibri",
              }),
            ],
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                size: 21,
                font: "Calibri",
              }),
            ],
            spacing: { after: 40 },
          })
        );
      }
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {
          page: {
            margin: {
              top: 720,
              right: 720,
              bottom: 720,
              left: 720,
            },
          },
        },
        children,
      },
    ],
  });

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ── Reconstruct plain text from sections (for preview) ──

export function sectionsToText(sections: ResumeSection[]): string {
  const lines: string[] = [];

  for (const section of sections) {
    if (section.kind !== "header" && section.title) {
      lines.push("");
      lines.push(section.title.toUpperCase());
      lines.push("─".repeat(40));
    }

    for (const line of section.lines) {
      lines.push(line);
    }
  }

  return lines.join("\n").trim();
}

// ── Keyword extraction (shared with generate route) ──

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "this", "that", "these", "those", "we", "you", "they", "it", "he",
    "she", "our", "your", "their", "its", "my", "his", "her", "as",
    "if", "not", "no", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "than", "too", "very", "just",
    "about", "above", "also", "who", "which", "what", "when", "where",
    "how", "why", "into", "through", "during", "before", "after",
    "between", "under", "over", "work", "working", "role", "team",
    "ability", "experience", "strong", "including", "using", "used",
    "looking", "join", "position", "company", "well", "within", "based",
    "across", "plus", "years", "year", "responsible", "requirements",
  ]);

  const cleaned = text.toLowerCase().replace(/[^a-z\s-]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  for (let i = 0; i < words.length - 1; i++) {
    if (words[i].length > 3 && words[i + 1].length > 3) {
      const bigram = `${words[i]} ${words[i + 1]}`;
      freq.set(bigram, (freq.get(bigram) || 0) + 2);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) =>
      word.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    );
}
