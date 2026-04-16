import mammoth from "mammoth";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";

// ── Section types that the engine recognises ──

export type SectionKind =
  | "header"
  | "summary"
  | "skills"
  | "experience"
  | "projects"
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

export interface EnhanceRules {
  noNewSkills?: boolean;
  preserveLength?: boolean;
  rewriteIntensity?: "light" | "moderate" | "aggressive";
  focusDomain?: string;
}

export interface EnhanceOptions {
  jobDescription: string;
  role: string;
  company: string;
  sectionsToEnhance: SectionKind[];
  rules?: EnhanceRules;
}

const SECTION_HEADING_PATTERNS: [RegExp, SectionKind][] = [
  [/^(professional\s+)?summary|objective|profile/i, "summary"],
  [/^(core\s+)?(skills|competencies|technical\s+skills|technologies)/i, "skills"],
  [/^(professional\s+)?experience|work\s+(history|experience)|employment/i, "experience"],
  [/^projects?|personal\s+projects?|key\s+projects?|selected\s+projects?/i, "projects"],
  [/^education|academic/i, "education"],
  [/^certifications?|licenses?|credentials|awards?|honors?|publications?/i, "certifications"],
  [/^(additional|volunteer|interests|languages|references|activities)/i, "other"],
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
  return kind === "summary" || kind === "skills" || kind === "experience" || kind === "projects";
}

// ── Enhance sections ──

export function enhanceSections(
  parsed: ParsedResume,
  options: EnhanceOptions
): ParsedResume {
  const rules = options.rules || {};
  let keywords = extractKeywords(options.jobDescription);

  if (rules.focusDomain) {
    const domainLower = rules.focusDomain.toLowerCase();
    keywords = keywords.filter(
      (k) => k.toLowerCase().includes(domainLower) || domainLower.includes(k.toLowerCase())
    ).concat(keywords).slice(0, 15);
  }

  const intensity = rules.rewriteIntensity || "moderate";
  const maxBullets = intensity === "light" ? 3 : intensity === "aggressive" ? 12 : 8;
  const enabledSet = new Set(options.sectionsToEnhance);

  // Track which experience block we're on so that recent roles (first two
  // blocks) get stronger rewriting than older ones.
  let experienceRoleIndex = 0;

  const enhanced = parsed.sections.map((section) => {
    if (!section.modifiable || !enabledSet.has(section.kind)) {
      return section;
    }

    switch (section.kind) {
      case "summary":
        return rules.preserveLength
          ? preserveLengthEnhance(section, keywords, options)
          : enhanceSummary(section, keywords, options, intensity);
      case "skills":
        return rules.noNewSkills ? section : enhanceSkills(section, keywords, intensity);
      case "experience": {
        const result = enhanceExperience(
          section,
          keywords,
          options,
          maxBullets,
          intensity,
          experienceRoleIndex
        );
        experienceRoleIndex += 1;
        return result;
      }
      case "projects":
        return enhanceExperience(section, keywords, options, maxBullets, intensity, 99);
      default:
        return section;
    }
  });

  return { sections: enhanced, rawText: parsed.rawText };
}

function preserveLengthEnhance(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions
): ResumeSection {
  const original = section.lines.join(" ").trim();
  if (!original) return enhanceSummary(section, keywords, options, "moderate");

  const targetLen = original.length;
  const enhanced = enhanceSummary(section, keywords, options, "light");
  const enhancedText = enhanced.lines.join(" ").trim();

  if (enhancedText.length > targetLen * 1.15) {
    return { ...enhanced, lines: [enhancedText.slice(0, targetLen).replace(/\s+\S*$/, ".")] };
  }
  return enhanced;
}

function enhanceSummary(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions,
  intensity: "light" | "moderate" | "aggressive"
): ResumeSection {
  const original = section.lines.join(" ").trim();
  const topKeywords = keywords.slice(0, 8);

  if (!original) {
    return {
      ...section,
      lines: [
        `Results-driven ${options.role} with extensive experience in ${topKeywords
          .slice(0, 3)
          .join(", ")
          .toLowerCase()}. Proven track record of delivering measurable outcomes through ${topKeywords
          .slice(3, 5)
          .join(" and ")
          .toLowerCase()}. Seeking to leverage this expertise at ${options.company} to drive impact across ${topKeywords
          .slice(5, 7)
          .join(" and ")
          .toLowerCase()}.`,
      ],
    };
  }

  const lowerOriginal = original.toLowerCase();
  const missingKeywords = topKeywords.filter(
    (k) => !lowerOriginal.includes(k.toLowerCase())
  );

  if (intensity === "light") {
    if (missingKeywords.length === 0) return { ...section, lines: [original] };
    const enhanced =
      original.replace(/\.?\s*$/, "") +
      `. Skilled in ${missingKeywords.slice(0, 3).join(", ").toLowerCase()} with a focus on delivering measurable outcomes.`;
    return { ...section, lines: [enhanced] };
  }

  // Moderate / aggressive: open with a strong value proposition tailored to
  // the target role and company, then weave in the most relevant missing
  // keywords. Keep the original factual content at the end so truth is
  // preserved.
  const lead =
    intensity === "aggressive"
      ? `Accomplished ${options.role} specializing in ${topKeywords
          .slice(0, 3)
          .join(", ")
          .toLowerCase()}, with a proven record of driving measurable outcomes for ${options.company}-style organizations.`
      : `${options.role} with deep expertise in ${topKeywords
          .slice(0, 3)
          .join(", ")
          .toLowerCase()}.`;

  const bridge = missingKeywords.length
    ? ` Brings demonstrated strength in ${missingKeywords
        .slice(0, 4)
        .join(", ")
        .toLowerCase()}.`
    : "";

  const trailer = ` ${original}`.replace(/\s+/g, " ").trim();

  return { ...section, lines: [(lead + bridge + " " + trailer).trim()] };
}

function enhanceSkills(
  section: ResumeSection,
  keywords: string[],
  intensity: "light" | "moderate" | "aggressive"
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
    .slice(0, intensity === "aggressive" ? 10 : intensity === "moderate" ? 6 : 3);

  if (newSkills.length === 0) return section;

  return {
    ...section,
    lines: [...section.lines, ...newSkills.map((s) => `• ${s}`)],
  };
}

function enhanceExperience(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions,
  maxEnhancedBullets: number,
  intensity: "light" | "moderate" | "aggressive",
  roleIndex: number
): ResumeSection {
  const enhanced: string[] = [];
  let bulletCount = 0;

  // Only the first two roles in a candidate's experience are rewritten with
  // the highest intensity. Older roles receive a much lighter touch.
  const effectiveIntensity: typeof intensity =
    roleIndex < 2 ? intensity : intensity === "aggressive" ? "moderate" : "light";

  for (const line of section.lines) {
    if (/^[•\-–—\*]/.test(line.trim()) && bulletCount < maxEnhancedBullets) {
      const enhancedBullet = enhanceBullet(line, keywords, options, effectiveIntensity);
      enhanced.push(enhancedBullet);
      bulletCount++;
    } else {
      enhanced.push(line);
    }
  }

  return { ...section, lines: enhanced };
}

const BULLET_PHRASES = [
  (kw: string) => `, applying ${kw} methodologies`,
  (kw: string) => `, utilizing ${kw} best practices`,
  (kw: string) => ` with focus on ${kw}`,
  (kw: string) => `, demonstrating ${kw} proficiency`,
  (kw: string) => ` through ${kw} implementation`,
  (kw: string) => `, incorporating ${kw} principles`,
];

const STRONG_VERBS = [
  "Spearheaded", "Architected", "Delivered", "Led", "Drove", "Built",
  "Scaled", "Optimized", "Launched", "Transformed",
];

let bulletPhraseIdx = 0;
let strongVerbIdx = 0;

// Current verbs that often indicate weak/passive openings we can strengthen.
const WEAK_OPENING_RE = /^(responsible for|worked on|helped (with|to)?|assisted (with|in)?|participated in|involved in)\b/i;

function enhanceBullet(
  bullet: string,
  keywords: string[],
  _options: EnhanceOptions,
  intensity: "light" | "moderate" | "aggressive"
): string {
  let text = bullet.trim();
  const bulletPrefix = /^[•\-–—\*]\s*/.exec(text)?.[0] || "• ";
  text = text.replace(/^[•\-–—\*]\s*/, "");

  // Replace weak openings with strong action verbs (moderate / aggressive only).
  if (intensity !== "light" && WEAK_OPENING_RE.test(text)) {
    const verb = STRONG_VERBS[strongVerbIdx % STRONG_VERBS.length];
    strongVerbIdx++;
    text = text.replace(WEAK_OPENING_RE, verb).replace(/^([A-Z])/, (m) => m);
  }

  const lowerText = text.toLowerCase();
  const relevantKeyword = keywords.find(
    (k) => !lowerText.includes(k.toLowerCase())
  );

  if (relevantKeyword && intensity !== "light") {
    text = text.replace(/\.?\s*$/, "");
    const phrase = BULLET_PHRASES[bulletPhraseIdx % BULLET_PHRASES.length];
    text += phrase(relevantKeyword.toLowerCase()) + ".";
    bulletPhraseIdx++;
  }

  return bulletPrefix + text;
}

// ── Build DOCX from sections ──

/**
 * Heuristic: detect a line that likely contains a role header in an
 * experience / projects section. These are the lines worth bolding
 * ("Senior Engineer · Google · SF · 2021 – Present").
 */
const ROLE_HEADER_HINTS = [
  /\bpresent\b/i,
  /\b(19|20)\d{2}\s*[–—\-]\s*((19|20)\d{2}|present)/i, // year range
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i,
  /\s[·|•–—]\s/, // clear separator between role / company / location / date
];

function isRoleHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[•\-–—\*]/.test(trimmed)) return false; // bullets aren't headers
  if (trimmed.length > 160) return false;
  return ROLE_HEADER_HINTS.some((re) => re.test(trimmed));
}

/**
 * Technical tokens & proper-noun-ish phrases worth bolding inline (ATS-safe).
 * Kept conservative to avoid over-bolding.
 */
const EMPHASIZE_TOKENS = [
  "TypeScript", "JavaScript", "Python", "Go", "Golang", "Rust", "Java", "Kotlin",
  "React", "Next.js", "Node.js", "GraphQL", "REST",
  "AWS", "GCP", "Azure", "Kubernetes", "Docker", "Terraform",
  "PostgreSQL", "MySQL", "Redis", "Kafka",
  "CI/CD", "SRE",
];

function buildEmphasizedRuns(text: string): TextRun[] {
  if (!text) return [new TextRun({ text: "", size: 21, font: "Calibri" })];

  // Build a single regex that matches any emphasize token as a whole word.
  const pattern = EMPHASIZE_TOKENS.map((t) =>
    t.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")
  ).join("|");
  const re = new RegExp(`\\b(${pattern})\\b`, "g");

  const runs: TextRun[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  while ((match = re.exec(text)) !== null) {
    if (match.index > lastIdx) {
      runs.push(
        new TextRun({
          text: text.slice(lastIdx, match.index),
          size: 21,
          font: "Calibri",
        })
      );
    }
    runs.push(
      new TextRun({
        text: match[0],
        bold: true,
        size: 21,
        font: "Calibri",
      })
    );
    lastIdx = match.index + match[0].length;
  }
  if (lastIdx < text.length) {
    runs.push(
      new TextRun({
        text: text.slice(lastIdx),
        size: 21,
        font: "Calibri",
      })
    );
  }
  return runs.length ? runs : [new TextRun({ text, size: 21, font: "Calibri" })];
}

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
          spacing: { before: 240, after: 80 },
        })
      );
    }

    for (let lineIdx = 0; lineIdx < section.lines.length; lineIdx++) {
      const line = section.lines[lineIdx];
      if (!line) {
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      const isBullet = /^[•\-–—\*]/.test(line);
      const cleanLine = isBullet ? line.replace(/^[•\-–—\*]\s*/, "") : line;

      if (section.kind === "header" && lineIdx === 0) {
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
            children: buildEmphasizedRuns(cleanLine),
            bullet: { level: 0 },
            spacing: { after: 40 },
          })
        );
      } else if (
        (section.kind === "experience" || section.kind === "projects") &&
        isRoleHeaderLine(cleanLine)
      ) {
        // Role / company / location / date line — bold in full for stronger
        // visual hierarchy in the experience section.
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                bold: true,
                size: 21,
                font: "Calibri",
              }),
            ],
            spacing: { before: 80, after: 40 },
          })
        );
      } else {
        children.push(
          new Paragraph({
            children: buildEmphasizedRuns(cleanLine),
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
