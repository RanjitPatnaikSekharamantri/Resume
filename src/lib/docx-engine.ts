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
//
// The app enforces a strict canonical resume structure to match the
// reference base-resume pattern:
//
//   • PROFILE SUMMARY    (paragraph, no bullets, no bold)
//   • TECHNICAL SKILLS   (bullets: "· Category: tool1, tool2, tool3")
//   • EDUCATION          (verbatim, preserved)
//   • WORK EXPERIENCE    (bold role/company/location/date header, bulleted body with inline bold on key tools)
//   • CERTIFICATIONS     (verbatim, preserved)
//
// Any other headings from an uploaded base resume are normalised to these
// canonical kinds at parse time.

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
  prioritizeRecent?: boolean;
  strongSummaryRewrite?: boolean;
}

export interface EnhanceOptions {
  jobDescription: string;
  role: string;
  company: string;
  sectionsToEnhance: SectionKind[];
  rules?: EnhanceRules;
}

/**
 * The canonical display title for every section kind. Used when rendering
 * DOCX / PDF / preview text so the output always matches the required
 * uppercase pattern regardless of the heading casing in the source file.
 *
 * Headings end with a colon to match the reference base-resume pattern:
 *   PROFILE SUMMARY:
 *   TECHNICAL SKILLS:
 *   EDUCATION:
 *   WORK EXPERIENCE:
 *   CERTIFICATIONS:
 */
export const CANONICAL_SECTION_TITLES: Record<SectionKind, string> = {
  header: "",
  summary: "PROFILE SUMMARY:",
  skills: "TECHNICAL SKILLS:",
  experience: "WORK EXPERIENCE:",
  projects: "PROJECTS:",
  education: "EDUCATION:",
  certifications: "CERTIFICATIONS:",
  other: "",
};

const SECTION_HEADING_PATTERNS: [RegExp, SectionKind][] = [
  [/^(professional\s+)?(summary|profile\s+summary|profile|objective|about)/i, "summary"],
  [/^(core\s+)?(skills|competencies|technical\s+skills|technologies|tech\s+stack|tools)/i, "skills"],
  [/^(professional\s+)?(experience|work\s+experience)|work\s+(history)|employment/i, "experience"],
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

/**
 * Normalise section titles to the canonical uppercase pattern and clear
 * the index-level module state used by bullet enhancers. Called both at
 * parse time and before enhancement so that output is deterministic.
 */
export function normalizeSectionTitles(parsed: ParsedResume): ParsedResume {
  const sections = parsed.sections.map((s) => {
    const canonical = CANONICAL_SECTION_TITLES[s.kind];
    if (s.kind === "header") return s;
    if (!canonical) return s;
    return { ...s, title: canonical };
  });
  return { ...parsed, sections };
}

/**
 * Replace / insert the target-role line in the header section so the
 * resume header title matches the role the candidate is applying for.
 *
 * Heuristic: the first non-empty header line is the candidate name. The
 * second line is treated as the existing "role / tagline" — if it already
 * looks like a role (no phone/email/location markers), it gets replaced.
 * If no such line exists, we insert the new role right after the name.
 */
export function applyHeaderRole(parsed: ParsedResume, headerRole: string): ParsedResume {
  const role = headerRole.trim();
  if (!role) return parsed;

  const sections = parsed.sections.map((s) => {
    if (s.kind !== "header") return s;

    const lines = [...s.lines];
    // Find the name line (first non-empty).
    const nameIdx = lines.findIndex((l) => l.trim().length > 0);
    if (nameIdx === -1) return s;

    // Contact-line signals — we never overwrite these.
    const looksLikeContact = (l: string) =>
      /[@]/.test(l) || // email
      /https?:\/\//i.test(l) || // url
      /\+?\d[\d\s().\-]{6,}/.test(l) || // phone
      /,\s*[A-Z]{2}\b/.test(l) || // City, ST
      /linkedin|github/i.test(l);

    // Candidate role line: the first non-contact line after the name.
    let roleIdx = -1;
    for (let i = nameIdx + 1; i < lines.length; i++) {
      const t = lines[i].trim();
      if (!t) continue;
      if (looksLikeContact(t)) continue;
      roleIdx = i;
      break;
    }

    if (roleIdx === -1) {
      // Insert right after the name.
      lines.splice(nameIdx + 1, 0, role);
    } else {
      lines[roleIdx] = role;
    }

    return { ...s, lines };
  });

  return { ...parsed, sections };
}

export function enhanceSections(
  parsed: ParsedResume,
  options: EnhanceOptions
): ParsedResume {
  // Reset module-level indexes so repeated enhancements are deterministic.
  bulletPhraseIdx = 0;
  strongVerbIdx = 0;

  const normalized = normalizeSectionTitles(parsed);
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

  const enhanced = normalized.sections.map((section) => {
    if (!section.modifiable || !enabledSet.has(section.kind)) {
      return section;
    }

    switch (section.kind) {
      case "summary":
        return rules.preserveLength
          ? preserveLengthEnhance(section, keywords, options)
          : enhanceSummary(section, keywords, options, intensity, !!rules.strongSummaryRewrite);
      case "skills":
        return rules.noNewSkills ? section : enhanceSkills(section, keywords, intensity);
      case "experience": {
        const result = enhanceExperience(
          section,
          keywords,
          options,
          maxBullets,
          intensity,
          experienceRoleIndex,
          rules.prioritizeRecent !== false
        );
        experienceRoleIndex += 1;
        return result;
      }
      case "projects":
        return enhanceExperience(section, keywords, options, maxBullets, intensity, 99, false);
      default:
        return section;
    }
  });

  return { sections: enhanced, rawText: normalized.rawText };
}

function preserveLengthEnhance(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions
): ResumeSection {
  const original = section.lines.join(" ").trim();
  if (!original) return enhanceSummary(section, keywords, options, "moderate", false);

  const targetLen = original.length;
  const enhanced = enhanceSummary(section, keywords, options, "light", false);
  const enhancedText = enhanced.lines.join(" ").trim();

  if (enhancedText.length > targetLen * 1.15) {
    return { ...enhanced, lines: [enhancedText.slice(0, targetLen).replace(/\s+\S*$/, ".")] };
  }
  return enhanced;
}

/**
 * Summary rewriting.
 *
 * Rules (enforced regardless of intensity):
 *   • output is a single paragraph (one joined line)
 *   • no bullet prefix — the DOCX/PDF renderers refuse to add bullets to
 *     the summary section anyway
 *   • no bold markup in the text itself — emphasis happens at render time
 */
function enhanceSummary(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions,
  intensity: "light" | "moderate" | "aggressive",
  strongRewrite: boolean
): ResumeSection {
  const original = section.lines
    .map((l) => l.replace(/^[•\-–—\*·]\s*/, "").trim()) // strip any accidental bullets
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
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

  if (intensity === "light" && !strongRewrite) {
    if (missingKeywords.length === 0) return { ...section, lines: [original] };
    const enhanced =
      original.replace(/\.?\s*$/, "") +
      `. Skilled in ${missingKeywords.slice(0, 3).join(", ").toLowerCase()} with a focus on delivering measurable outcomes.`;
    return { ...section, lines: [enhanced] };
  }

  // Moderate / aggressive / strongRewrite: open with a strong value
  // proposition tailored to the target role and company, weave in the most
  // relevant missing keywords, then keep the original factual content at
  // the end so truth is preserved.
  const useAggressiveLead = intensity === "aggressive" || strongRewrite;
  const lead = useAggressiveLead
    ? `Accomplished ${options.role} specializing in ${topKeywords
        .slice(0, 3)
        .join(", ")
        .toLowerCase()}, with a proven record of driving measurable outcomes at ${options.company}-class organizations.`
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

/**
 * Skills section enhancement.
 *
 * The canonical format is:
 *   "· Category: tool1, tool2, tool3"
 *
 * If the existing resume already uses this structured "Category: items"
 * shape, we append new relevant keywords to the BEST-MATCHING category
 * rather than creating a grab-bag of new bullets. This keeps the visual
 * consistency of the base resume. If the resume uses flat bullets, we add
 * new bullets using the same canonical "· " prefix and put them under a
 * generic "Tools" category when we can infer one.
 */
function enhanceSkills(
  section: ResumeSection,
  keywords: string[],
  intensity: "light" | "moderate" | "aggressive"
): ResumeSection {
  const max = intensity === "aggressive" ? 10 : intensity === "moderate" ? 6 : 3;

  // Detect existing tokens (flattened, lowercased).
  const existing = new Set(
    section.lines
      .join(" ")
      .split(/[,•·|;\n]/)
      .map((s) => s.replace(/^[^:]*:\s*/, "").trim().toLowerCase()) // strip category prefix
      .filter(Boolean)
  );

  const newSkills = keywords
    .filter((k) => {
      const lower = k.toLowerCase();
      return ![...existing].some(
        (e) => e.includes(lower) || lower.includes(e)
      );
    })
    .slice(0, max);

  if (newSkills.length === 0) return section;

  // Does the existing section use the "Category: items" pattern?
  const categoryLineRe = /^([•\-–—\*·]\s*)?([^:]{2,40}):\s*(.+)$/;
  const categorized = section.lines
    .map((l, i) => ({ i, l: l.trim(), m: l.trim().match(categoryLineRe) }))
    .filter((x) => x.m);

  if (categorized.length >= 1) {
    // Distribute new skills across existing categories by best keyword
    // match. Each skill lands under the category whose items share the
    // most characters with it (very rough but stable heuristic). If no
    // category matches, we tack them onto the last category line.
    const updated = [...section.lines];
    for (const skill of newSkills) {
      const skillLower = skill.toLowerCase();
      let best = categorized[categorized.length - 1];
      let bestScore = -1;
      for (const c of categorized) {
        const items = c.m![3].toLowerCase();
        const score = items
          .split(/[,;]/)
          .reduce((acc, token) => acc + (token.trim() && skillLower.includes(token.trim().slice(0, 3)) ? 1 : 0), 0);
        if (score > bestScore) {
          bestScore = score;
          best = c;
        }
      }
      const parts = best.m!;
      const bulletPrefix = parts[1] || "· ";
      const categoryLabel = parts[2];
      const items = parts[3];
      updated[best.i] = `${bulletPrefix}${categoryLabel}: ${items}, ${skill}`;
      // Keep categorized cache in sync for subsequent iterations.
      best.m = updated[best.i].match(categoryLineRe);
    }
    return { ...section, lines: updated };
  }

  // Flat bullet list — preserve style by adding new bullets using "· "
  // prefix (the canonical bullet character for this template).
  return {
    ...section,
    lines: [...section.lines, ...newSkills.map((s) => `· ${s}`)],
  };
}

function enhanceExperience(
  section: ResumeSection,
  keywords: string[],
  options: EnhanceOptions,
  maxEnhancedBullets: number,
  intensity: "light" | "moderate" | "aggressive",
  roleIndex: number,
  prioritizeRecent: boolean
): ResumeSection {
  const enhanced: string[] = [];
  let bulletCount = 0;

  // When "prioritize recent" is on, only the first two roles in a
  // candidate's experience receive the full rewrite intensity; older
  // roles get a much lighter touch. When it's off (user explicitly
  // disabled it), every role is rewritten at the requested intensity.
  const effectiveIntensity: typeof intensity = prioritizeRecent
    ? roleIndex < 2
      ? intensity
      : intensity === "aggressive"
        ? "moderate"
        : "light"
    : intensity;

  for (const line of section.lines) {
    if (/^[•\-–—\*·]/.test(line.trim()) && bulletCount < maxEnhancedBullets) {
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
  // Preserve the source's bullet character (· matches the canonical base
  // resume pattern; normalise anything else to ·).
  const bulletMatch = /^([•\-–—\*·])\s*/.exec(text);
  const sourceBullet = bulletMatch?.[1] || "·";
  const bulletPrefix = `${sourceBullet === "·" ? "·" : sourceBullet} `;
  text = text.replace(/^[•\-–—\*·]\s*/, "");

  // Replace weak openings with strong action verbs (moderate / aggressive only).
  if (intensity !== "light" && WEAK_OPENING_RE.test(text)) {
    const verb = STRONG_VERBS[strongVerbIdx % STRONG_VERBS.length];
    strongVerbIdx++;
    text = text.replace(WEAK_OPENING_RE, verb);
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
 * Heuristic: detect a line that is the role/company/location/date header
 * in an experience / projects section. These lines are bolded in full
 * (e.g. "Senior Engineer | Google | SF | Jan 2021 – Present").
 *
 * Accepts " | ", " · ", " — " or " - " as separators to match common
 * formatting conventions.
 */
const ROLE_HEADER_HINTS = [
  /\bpresent\b/i,
  /\b(19|20)\d{2}\s*[–—\-]\s*((19|20)\d{2}|present)/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i,
  /\s[·|•–—]\s/,
  /\s\|\s/,
];

function isRoleHeaderLine(line: string): boolean {
  const trimmed = line.trim();
  if (!trimmed) return false;
  if (/^[•\-–—\*·]/.test(trimmed)) return false;
  if (trimmed.length > 200) return false;
  return ROLE_HEADER_HINTS.some((re) => re.test(trimmed));
}

/**
 * Fixed list of technical tokens that are always worth bolding inline
 * (ATS-safe, proper-noun-ish, widely recognised). We keep this conservative
 * to avoid over-bolding. The enhancer also passes JD-extracted keywords
 * which are merged in at render time so resume-specific tools get bolded.
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

function escapeRegex(s: string) {
  return s.replace(/[.+*?^${}()|[\]\\]/g, "\\$&");
}

function buildEmphasizeRegex(extraTokens: string[]): RegExp {
  const merged = new Set<string>();
  for (const t of BASE_EMPHASIZE_TOKENS) merged.add(t);
  for (const t of extraTokens) {
    // Only promote single words or very short tool-like phrases (≤ 24 chars
    // total) so we don't end up bolding entire sentences derived from the
    // JD's bigrams.
    if (t.length <= 24 && /^[A-Za-z][A-Za-z0-9./+#\- ]*$/.test(t)) merged.add(t);
  }
  const pattern = [...merged].map(escapeRegex).join("|");
  return new RegExp(`\\b(${pattern})\\b`, "g");
}

function buildEmphasizedRuns(text: string, emphasizeRe: RegExp): TextRun[] {
  if (!text) return [new TextRun({ text: "", size: 21, font: "Calibri" })];

  const runs: TextRun[] = [];
  let lastIdx = 0;
  let match: RegExpExecArray | null;
  // RegExp with /g state must be reset each call.
  emphasizeRe.lastIndex = 0;
  while ((match = emphasizeRe.exec(text)) !== null) {
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

export interface BuildDocxOptions {
  /**
   * Extra tokens (usually JD-derived keywords) that should be bolded inline
   * in addition to the built-in technical tokens.
   */
  emphasizeTokens?: string[];
}

export async function buildDocx(
  parsed: ParsedResume,
  opts: BuildDocxOptions = {}
): Promise<Buffer> {
  const children: Paragraph[] = [];
  const emphasizeRe = buildEmphasizeRegex(opts.emphasizeTokens || []);

  // Work in a title-normalised copy so headings in the document always use
  // the canonical uppercase names even if the source file used a different
  // casing / synonym (e.g. "Professional Experience").
  const normalized = normalizeSectionTitles(parsed);

  for (const section of normalized.sections) {
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
          spacing: { before: 180, after: 40 },
        })
      );
    }

    for (let lineIdx = 0; lineIdx < section.lines.length; lineIdx++) {
      const line = section.lines[lineIdx];
      if (!line) {
        children.push(new Paragraph({ children: [] }));
        continue;
      }

      const isBullet = /^[•\-–—\*·]/.test(line);
      const cleanLine = isBullet ? line.replace(/^[•\-–—\*·]\s*/, "") : line;

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
        continue;
      }
      if (section.kind === "header") {
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
        continue;
      }

      // PROFILE SUMMARY — strict paragraph, no bullets, no bold.
      if (section.kind === "summary") {
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                size: 21,
                font: "Calibri",
              }),
            ],
            spacing: { after: 60 },
          })
        );
        continue;
      }

      // TECHNICAL SKILLS — "· Category: tool1, tool2, tool3"
      // Rule: category label is NOT bold. The items after the colon may
      // contain tech tokens that ARE bolded via the inline-emphasis runs.
      if (section.kind === "skills") {
        const catMatch = cleanLine.match(/^([^:]{2,40}):\s*(.+)$/);
        if (catMatch) {
          const category = catMatch[1];
          const items = catMatch[2];
          children.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: `${category}: `,
                  size: 21,
                  font: "Calibri",
                }),
                ...buildEmphasizedRuns(items, emphasizeRe),
              ],
              bullet: { level: 0 },
              spacing: { after: 40 },
            })
          );
        } else {
          children.push(
            new Paragraph({
              children: buildEmphasizedRuns(cleanLine, emphasizeRe),
              bullet: { level: 0 },
              spacing: { after: 40 },
            })
          );
        }
        continue;
      }

      // WORK EXPERIENCE — bold role/company/location/date header,
      // selective inline bold on bullet bodies.
      if (section.kind === "experience" || section.kind === "projects") {
        if (!isBullet && isRoleHeaderLine(cleanLine)) {
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
              spacing: { before: 100, after: 30 },
            })
          );
          continue;
        }
        if (isBullet) {
          children.push(
            new Paragraph({
              children: buildEmphasizedRuns(cleanLine, emphasizeRe),
              bullet: { level: 0 },
              spacing: { after: 40 },
            })
          );
          continue;
        }
        // Non-bullet, non-header line inside experience: treat as the
        // single-line company description directly under the role header.
        children.push(
          new Paragraph({
            children: [
              new TextRun({
                text: cleanLine,
                italics: true,
                size: 20,
                font: "Calibri",
                color: "555555",
              }),
            ],
            spacing: { after: 40 },
          })
        );
        continue;
      }

      // EDUCATION / CERTIFICATIONS — preserve verbatim (bulletize if prefix
      // existed, otherwise paragraph). No inline emphasis to keep ATS clean.
      if (isBullet) {
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
      const canonical = CANONICAL_SECTION_TITLES[section.kind];
      const title = (canonical || section.title).toUpperCase();
      lines.push(title);
      lines.push("─".repeat(40));
    }

    for (const line of section.lines) {
      lines.push(line);
    }
  }

  return lines.join("\n").trim();
}

// ── Keyword extraction (shared with generate route) ──

export function extractJdKeywords(text: string): string[] {
  return extractKeywords(text);
}

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
