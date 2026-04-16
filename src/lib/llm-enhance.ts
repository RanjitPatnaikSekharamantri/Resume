/**
 * LLM-powered resume enhancement.
 *
 * Takes a parsed resume (from docx-engine), a job description, a set of
 * rules, and an active AI provider, then rewrites the requested sections
 * via the LLM. Preserves locked fields (name, contact, employer names,
 * dates, education, certifications) by passing them into the prompt as
 * "DO NOT MODIFY".
 *
 * Returns the same { sections, rawText } shape the deterministic engine
 * produces, so the rest of the pipeline (preview, scoring, download) is
 * unchanged.
 */

import type { ParsedResume, ResumeSection, SectionKind } from "./docx-engine";
import { normalizeSectionTitles } from "./docx-engine";
import {
  callLLM,
  extractJsonObject,
  type ResolvedProvider,
} from "./llm-provider";

export interface LlmEnhanceRules {
  rewriteIntensity?: "light" | "moderate" | "aggressive";
  preserveLength?: boolean;
  noNewSkills?: boolean;
  prioritizeRecent?: boolean;
  strongSummaryRewrite?: boolean;
  focusDomain?: string;
}

export interface LlmEnhanceOptions {
  jobDescription: string;
  role: string;
  company: string;
  /**
   * Desired header role for the resume. If the user explicitly picked a
   * different header role than the application role, this may differ from
   * `role`. The LLM is told to use this in the summary.
   */
  headerRole?: string;
  sectionsToEnhance: SectionKind[];
  rules: LlmEnhanceRules;
}

export interface LlmEnhanceResult {
  enhanced: ParsedResume;
  usage?: { promptTokens?: number; completionTokens?: number };
}

// Sections the LLM is allowed to touch. Certifications are included so
// users can ask the model to re-order them, but the prompt explicitly
// forbids fabricating new certification entries.
const MODIFIABLE_KINDS = new Set<SectionKind>([
  "summary",
  "skills",
  "experience",
  "projects",
  "certifications",
]);

/**
 * Main entry: rewrites the requested sections and returns a new parsed
 * resume. Throws if the LLM call fails — caller is responsible for
 * falling back to the deterministic engine.
 */
export async function enhanceWithLLM(
  provider: ResolvedProvider,
  parsed: ParsedResume,
  options: LlmEnhanceOptions,
  log: (msg: string) => void = () => {}
): Promise<LlmEnhanceResult> {
  const normalized = normalizeSectionTitles(parsed);
  const enabled = new Set(
    options.sectionsToEnhance.filter((k) => MODIFIABLE_KINDS.has(k))
  );

  // Build a compact JSON representation of the resume for the LLM.
  // We expose only section kind + lines so the model cannot tamper with
  // structural fields (title is restored from the canonical map on output).
  const resumeInput = normalized.sections.map((s) => ({
    kind: s.kind,
    lines: s.lines,
  }));

  const systemPrompt = buildSystemPrompt();
  const userPrompt = buildUserPrompt({
    resume: resumeInput,
    sectionsToEnhance: [...enabled],
    options,
  });

  log(
    `llm-enhance: sections=${[...enabled].join(",")} intensity=${options.rules.rewriteIntensity || "moderate"}`
  );

  const result = await callLLM(provider, {
    systemPrompt,
    userPrompt,
    temperature:
      options.rules.rewriteIntensity === "aggressive"
        ? 0.6
        : options.rules.rewriteIntensity === "light"
          ? 0.2
          : 0.4,
    maxTokens: 3000,
    json: true,
    onLog: log,
  });

  if (!result.ok) {
    throw new Error(result.reason);
  }

  const json = extractJsonObject(result.text) as
    | { sections?: Array<{ kind?: string; lines?: unknown }> }
    | null;

  if (!json || !Array.isArray(json.sections)) {
    throw new Error("LLM returned a non-JSON or malformed response");
  }

  // Merge: replace lines for enabled sections, keep everything else verbatim.
  const byKind = new Map<string, string[]>();
  for (const s of json.sections) {
    if (!s || typeof s.kind !== "string" || !Array.isArray(s.lines)) continue;
    const safeLines = (s.lines as unknown[])
      .filter((l) => typeof l === "string")
      .map((l) => (l as string).replace(/\r/g, "").trim());
    byKind.set(s.kind, safeLines);
  }

  const mergedSections: ResumeSection[] = normalized.sections.map((section) => {
    if (!enabled.has(section.kind)) return section;
    const replacement = byKind.get(section.kind);
    if (!replacement || replacement.length === 0) return section;
    return {
      ...section,
      lines: sanitizeSectionLines(section.kind, replacement),
    };
  });

  return {
    enhanced: { sections: mergedSections, rawText: normalized.rawText },
    usage: result.usage,
  };
}

// ── prompt construction ──

function buildSystemPrompt(): string {
  return `You are a senior resume writer. Rewrite the requested sections of a candidate's resume so they better match a target job description, while preserving factual accuracy.

STRICT RULES — obey ALL of these:

1. Output ONLY a single JSON object, no prose, no markdown fences.
2. Schema: {"sections":[{"kind":"summary|skills|experience|projects","lines":["..."]}]}
3. Only include sections you are explicitly asked to modify.
4. Never change, invent, or omit any of these protected facts:
   - candidate name, email, phone, LinkedIn, website
   - employer company names
   - employment start/end dates
   - job titles that are clearly labeled as "previous" roles
   - education entries (school, degree, year)
   - certification names and issuers
5. Section-specific formatting — MUST match:
   • summary: an array with EXACTLY ONE line containing a single paragraph. No bullets. No bold markers. No leading symbols. 3–6 sentences.
   • skills: an array of bullet strings. Each bullet MUST start with "· " and follow the pattern "· Category: item1, item2, item3". Never use numbered lists. Never bold category labels.
   • experience: preserve structure exactly:
       Line 1: "Role | Company | Location | Date"  (role header — separator is " | ")
       Line 2: short company description (one sentence, no bullet)
       Line 3..N: bullets starting with "· " — strong action verbs, past tense, quantified when possible, include relevant tools/technologies from the job description.
       Each new role block repeats this pattern.
   • projects: same bullet style as experience.
6. Keep content truthful. If the candidate clearly lacks a skill, do NOT fabricate it.
7. Do not add closing remarks, commentary, or any text outside the JSON object.`;
}

function buildUserPrompt(args: {
  resume: Array<{ kind: SectionKind; lines: string[] }>;
  sectionsToEnhance: SectionKind[];
  options: LlmEnhanceOptions;
}): string {
  const { resume, sectionsToEnhance, options } = args;
  const intensity = options.rules.rewriteIntensity || "moderate";
  const headerRole = options.headerRole?.trim() || options.role.trim();

  const ruleLines: string[] = [
    `- Target job title: ${options.role}`,
    `- Target company: ${options.company}`,
    `- Use this header/target role in the summary's opening: "${headerRole}"`,
    `- Rewrite intensity: ${intensity}`,
    options.rules.preserveLength
      ? "- Preserve original section length (±15%)."
      : "- Length may change modestly to accommodate better phrasing.",
    options.rules.noNewSkills
      ? "- Do NOT add skills the candidate does not already have."
      : "- You may add highly relevant skills from the JD ONLY if they are plausibly supported by existing experience bullets.",
    options.rules.prioritizeRecent !== false
      ? "- Prioritize rewriting the most recent 1–2 roles. Older roles should receive a lighter touch."
      : "- Apply the requested intensity uniformly across all roles.",
    options.rules.strongSummaryRewrite
      ? "- Rewrite the profile summary with a strong value-proposition opening that positions the candidate for the target role."
      : "",
    options.rules.focusDomain
      ? `- Focus domain emphasis: ${options.rules.focusDomain}.`
      : "",
  ].filter(Boolean);

  return [
    "Enhance the following resume for the target job. Only modify the sections listed under SECTIONS_TO_ENHANCE. Return a strict JSON object per the schema in the system prompt.",
    "",
    "JOB_DESCRIPTION:",
    options.jobDescription.slice(0, 8000),
    "",
    "RULES:",
    ...ruleLines,
    "",
    `SECTIONS_TO_ENHANCE: ${JSON.stringify(sectionsToEnhance)}`,
    "",
    "CURRENT_RESUME (JSON):",
    JSON.stringify({ sections: resume }, null, 2),
    "",
    "Return ONLY the JSON. No markdown, no commentary.",
  ].join("\n");
}

// ── safety / normalisation ──

function sanitizeSectionLines(kind: SectionKind, lines: string[]): string[] {
  const trimmed = lines.map((l) => l.replace(/\s+$/g, ""));

  if (kind === "summary") {
    // Collapse to a single paragraph string, strip any accidental bullets.
    const joined = trimmed
      .map((l) => l.replace(/^[•\-–—\*·]\s*/, "").trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    return joined ? [joined] : [];
  }

  if (kind === "skills") {
    // Enforce "· Category: items" pattern; drop empties.
    return trimmed
      .filter((l) => l.trim().length > 0)
      .map((l) => {
        let v = l.trim();
        // Strip numbered list prefixes (1., 2), 3-, etc).
        v = v.replace(/^\d+[.)\-]\s+/, "");
        if (!/^[•\-–—\*·]/.test(v)) v = `· ${v}`;
        else v = v.replace(/^[•\-–—\*·]\s*/, "· ");
        return v;
      });
  }

  if (kind === "experience" || kind === "projects") {
    // Don't touch role headers; normalise bullet markers to "·".
    return trimmed
      .filter((l) => l.length > 0 || true) // keep blanks for spacing
      .map((l) => {
        if (/^[•\-–—\*·]/.test(l.trim())) {
          return l.trim().replace(/^[•\-–—\*·]\s*/, "· ");
        }
        return l;
      });
  }

  return trimmed;
}
