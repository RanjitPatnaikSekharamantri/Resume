/**
 * Role alignment helpers.
 *
 * Used by the AI Studio "Role Alignment" step to:
 *   1. Detect a target role from the JD (`detectTargetRoleFromJd`)
 *   2. Extract the existing role lines from the parsed resume header and
 *      each Work Experience block (`extractCurrentRoles`)
 *   3. Suggest aligned variants where the new title is consistent with the
 *      current title family + JD target (`suggestAlignedRoles`)
 *   4. Apply user-approved overrides to the parsed resume in a way that
 *      NEVER touches company name, location, or dates
 *      (`applyExperienceRoleOverrides`)
 */

import type { ParsedResume, ResumeSection } from "./docx-engine";

// ── target-role detection ──────────────────────────────────────────────

/**
 * A small library of role aliases used to detect the canonical role family
 * of a free-text title. Keep it focused on common security / engineering
 * tracks (the user's domain) but extensible.
 */
const ROLE_FAMILIES: Array<{
  family: string;
  patterns: RegExp[];
  variants: string[];
}> = [
  {
    family: "cyber-security",
    patterns: [
      /\bcyber\s*security\b/i,
      /\bcybersecurity\b/i,
      /\binfosec\b/i,
    ],
    variants: [
      "Cyber Security Engineer",
      "Cyber Security Analyst",
      "Cyber Security Specialist",
      "Cyber Security Consultant",
    ],
  },
  {
    family: "information-security",
    patterns: [/\binformation\s*security\b/i, /\bIT\s*security\b/i],
    variants: [
      "Information Security Engineer",
      "Information Security Analyst",
      "Information Security Specialist",
      "Information Security Consultant",
    ],
  },
  {
    family: "grc",
    patterns: [
      /\bGRC\b/i,
      /\bgovernance,?\s*risk(?:,?\s*and)?\s*compliance\b/i,
      /\brisk\s*and\s*compliance\b/i,
      /\bcompliance\s*analyst\b/i,
    ],
    variants: ["GRC Analyst", "GRC Specialist", "Risk & Compliance Analyst"],
  },
  {
    family: "soc",
    patterns: [/\bSOC\s+(analyst|engineer|specialist)\b/i, /\bsecurity\s+operations\b/i],
    variants: [
      "SOC Analyst",
      "Security Operations Analyst",
      "Security Operations Engineer",
    ],
  },
  {
    family: "network",
    patterns: [/\bnetwork\s+(engineer|analyst|administrator)\b/i],
    variants: [
      "Network Engineer",
      "Network Security Engineer",
      "Network Analyst",
    ],
  },
  {
    family: "cloud-security",
    patterns: [
      /\bcloud\s+security\b/i,
      /\bAWS\s+security\b/i,
      /\bAzure\s+security\b/i,
    ],
    variants: ["Cloud Security Engineer", "Cloud Security Analyst"],
  },
  {
    family: "iam",
    patterns: [/\bIAM\b/, /\bidentity\s*(?:and|&)?\s*access\s*management\b/i],
    variants: ["IAM Analyst", "IAM Engineer", "Identity & Access Engineer"],
  },
  {
    family: "appsec",
    patterns: [
      /\bapplication\s+security\b/i,
      /\bappsec\b/i,
      /\bsecure\s+coding\b/i,
    ],
    variants: ["Application Security Engineer", "AppSec Engineer", "Application Security Analyst"],
  },
  {
    family: "devops",
    patterns: [/\bdevops\b/i, /\bsre\b/i, /\bsite\s+reliability\b/i],
    variants: ["DevOps Engineer", "Site Reliability Engineer", "Platform Engineer"],
  },
  {
    family: "swe",
    patterns: [
      /\bsoftware\s+engineer\b/i,
      /\bsoftware\s+developer\b/i,
      /\bbackend\s+engineer\b/i,
      /\bfrontend\s+engineer\b/i,
      /\bfull[\s-]*stack\b/i,
    ],
    variants: [
      "Software Engineer",
      "Senior Software Engineer",
      "Backend Engineer",
      "Frontend Engineer",
      "Full Stack Engineer",
    ],
  },
];

const SENIORITY_TOKENS: Array<{
  pattern: RegExp;
  prefix: string;
}> = [
  { pattern: /\bprincipal\b/i, prefix: "Principal " },
  { pattern: /\bstaff\b/i, prefix: "Staff " },
  { pattern: /\b(senior|sr\.?)\b/i, prefix: "Senior " },
  { pattern: /\b(lead|leader)\b/i, prefix: "Lead " },
  { pattern: /\b(junior|jr\.?|entry[ -]level)\b/i, prefix: "Junior " },
];

export interface DetectedRoleSuggestion {
  /** Canonical title we'd suggest using for the resume header. */
  suggested: string;
  /** Optional alternative variants the user can pick from. */
  variants: string[];
  /** Family identifier — used by experience alignment too. */
  family: string | null;
  /** Seniority tag inferred from the JD (or null). */
  seniority: string | null;
  /** Plain-English explanation for the suggestion. */
  reason: string;
}

/**
 * Best-effort detection of the target role from a job description.
 * Falls back to the application's stored `jobTitle` when no role family
 * matches the JD text.
 */
export function detectTargetRoleFromJd(args: {
  jobDescription: string;
  applicationJobTitle: string;
}): DetectedRoleSuggestion {
  const jd = args.jobDescription || "";
  const fallbackTitle = (args.applicationJobTitle || "").trim();
  const seniorityPrefix = inferSeniority(jd) || inferSeniority(fallbackTitle) || "";

  // Find the first role family that matches the JD.
  for (const fam of ROLE_FAMILIES) {
    if (fam.patterns.some((re) => re.test(jd))) {
      // Within this family, prefer the variant that appears most often in
      // the JD (helps disambiguate Engineer vs Analyst vs Specialist).
      const counts = fam.variants.map((v) => ({
        v,
        n: countOccurrences(jd, v),
      }));
      counts.sort((a, b) => b.n - a.n);
      const topNonZero = counts.find((c) => c.n > 0);
      const baseTitle =
        (topNonZero?.v || fam.variants[0])
          .replace(/^(senior|staff|lead|principal|junior)\s+/i, "")
          .trim();

      const finalTitle =
        seniorityPrefix && !baseTitle.toLowerCase().startsWith(seniorityPrefix.trim().toLowerCase())
          ? `${seniorityPrefix}${baseTitle}`
          : baseTitle;

      return {
        suggested: finalTitle,
        variants: fam.variants,
        family: fam.family,
        seniority: seniorityPrefix.trim() || null,
        reason: topNonZero
          ? `JD references "${topNonZero.v}" ${topNonZero.n}× and matches the ${fam.family} family.`
          : `JD matches the ${fam.family} family — defaulting to "${baseTitle}".`,
      };
    }
  }

  // Nothing matched — fall back to the application's posted title.
  return {
    suggested: fallbackTitle || "Professional",
    variants: fallbackTitle ? [fallbackTitle] : [],
    family: null,
    seniority: seniorityPrefix.trim() || null,
    reason: fallbackTitle
      ? `No role family detected in the JD — using the application's posted title "${fallbackTitle}".`
      : "No role detected.",
  };
}

function inferSeniority(text: string): string {
  for (const { pattern, prefix } of SENIORITY_TOKENS) {
    if (pattern.test(text)) return prefix;
  }
  return "";
}

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  const re = new RegExp(`\\b${needle.replace(/[.+*?^${}()|[\]\\]/g, "\\$&")}\\b`, "gi");
  const m = haystack.match(re);
  return m ? m.length : 0;
}

// ── current header role extraction ─────────────────────────────────────

/**
 * Heuristic to find the current header role (the line under the name that
 * isn't the contact line). Mirrors the logic in `applyHeaderRole` in
 * docx-engine.
 */
export function extractCurrentHeaderRole(parsed: ParsedResume): string {
  const header = parsed.sections.find((s) => s.kind === "header");
  if (!header) return "";
  const lines = header.lines;
  const nameIdx = lines.findIndex((l) => l.trim().length > 0);
  if (nameIdx === -1) return "";
  const looksLikeContact = (l: string) =>
    /[@]/.test(l) ||
    /https?:\/\//i.test(l) ||
    /\+?\d[\d\s().\-]{6,}/.test(l) ||
    /,\s*[A-Z]{2}\b/.test(l) ||
    /linkedin|github/i.test(l);
  for (let i = nameIdx + 1; i < lines.length; i++) {
    const t = lines[i].trim();
    if (!t) continue;
    if (looksLikeContact(t)) continue;
    return t;
  }
  return "";
}

// ── experience role extraction & alignment ─────────────────────────────

export interface ExperienceRoleEntry {
  /**
   * Stable index — the order in which Role | Company | Date headers appear
   * inside the WORK EXPERIENCE section. Used as the key for overrides.
   */
  index: number;
  /** The original header line from the resume verbatim. */
  rawHeaderLine: string;
  /** The role title extracted from the header (the "Role" segment). */
  originalTitle: string;
  /** The full company / location / date suffix preserved verbatim. */
  preservedSuffix: string;
  /** Suggested alignment for the role title (or original when no change). */
  suggestedTitle: string;
  /** Reason for the suggestion (or "" when keeping original). */
  reason: string;
}

const HEADER_SEPARATORS = /\s[|·•—–-]\s/g;

/**
 * Detect experience role entries inside the parsed resume.
 *
 * A "role header" line is detected the same way `docx-engine`'s
 * `isRoleHeaderLine` works (date hint + separator).
 */
export function extractCurrentExperienceRoles(parsed: ParsedResume): ExperienceRoleEntry[] {
  const out: ExperienceRoleEntry[] = [];

  for (const section of parsed.sections) {
    if (section.kind !== "experience" && section.kind !== "projects") continue;
    let idx = 0;
    for (const line of section.lines) {
      const t = line.trim();
      if (!t) continue;
      if (/^[•\-–—\*·]/.test(t)) continue; // bullets
      if (!isLikelyRoleHeader(t)) continue;

      const parts = t.split(HEADER_SEPARATORS).map((p) => p.trim()).filter(Boolean);
      // Convention used by the canonical pattern is:
      //   Role | Company | Location | Date
      // The first segment is the role title; everything else is preserved.
      const originalTitle = (parts[0] || t).trim();
      const preservedSuffix = parts.length > 1 ? "| " + parts.slice(1).join(" | ") : "";

      out.push({
        index: idx++,
        rawHeaderLine: t,
        originalTitle,
        preservedSuffix,
        suggestedTitle: originalTitle,
        reason: "",
      });
    }
  }

  return out;
}

const ROLE_HEADER_HINTS = [
  /\bpresent\b/i,
  /\b(19|20)\d{2}\s*[–—\-]\s*((19|20)\d{2}|present)/i,
  /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(19|20)\d{2}/i,
  /\s[·|•–—]\s/,
  /\s\|\s/,
];
function isLikelyRoleHeader(s: string): boolean {
  return ROLE_HEADER_HINTS.some((re) => re.test(s)) && s.length < 200;
}

/**
 * For each existing role, if its title is in the same family as the target
 * role and the suggested swap is realistic (engineer↔analyst↔specialist),
 * propose the aligned variant. Otherwise keep the original.
 *
 * STRICT: never changes seniority outside the originally-stated seniority
 * tier, never invents new families, never suggests a wholly unrelated role.
 */
export function suggestExperienceAlignment(
  entries: ExperienceRoleEntry[],
  target: DetectedRoleSuggestion
): ExperienceRoleEntry[] {
  if (!target.family) return entries.map((e) => ({ ...e }));

  const family = ROLE_FAMILIES.find((f) => f.family === target.family);
  if (!family) return entries.map((e) => ({ ...e }));

  const allowedSwap = pickAllowedSwap(target);

  return entries.map((entry) => {
    const original = entry.originalTitle;
    const isInFamily = family.patterns.some((re) => re.test(original));
    if (!isInFamily) {
      return {
        ...entry,
        suggestedTitle: original,
        reason: "Different role family — keeping original.",
      };
    }
    if (!allowedSwap) {
      return { ...entry, suggestedTitle: original, reason: "" };
    }

    // Preserve the original seniority prefix (Senior, Junior, etc.) when
    // re-titling, so we never quietly upgrade or downgrade the candidate.
    const originalSeniority = stripSeniority(original).prefix;
    const aligned = `${originalSeniority}${allowedSwap}`.trim();

    if (aligned.toLowerCase() === original.toLowerCase()) {
      return { ...entry, suggestedTitle: original, reason: "" };
    }

    return {
      ...entry,
      suggestedTitle: aligned,
      reason: `${original} → ${aligned} (within the same family; seniority preserved).`,
    };
  });
}

function pickAllowedSwap(target: DetectedRoleSuggestion): string | null {
  const t = target.suggested.toLowerCase();
  if (/\banalyst\b/.test(t)) {
    if (target.family === "cyber-security") return "Cyber Security Analyst";
    if (target.family === "information-security") return "Information Security Analyst";
    if (target.family === "grc") return "GRC Analyst";
    if (target.family === "soc") return "SOC Analyst";
    if (target.family === "iam") return "IAM Analyst";
    if (target.family === "cloud-security") return "Cloud Security Analyst";
  }
  if (/\bengineer\b/.test(t)) {
    if (target.family === "cyber-security") return "Cyber Security Engineer";
    if (target.family === "information-security") return "Information Security Engineer";
    if (target.family === "soc") return "Security Operations Engineer";
    if (target.family === "iam") return "IAM Engineer";
    if (target.family === "cloud-security") return "Cloud Security Engineer";
    if (target.family === "appsec") return "Application Security Engineer";
    if (target.family === "swe") return "Software Engineer";
    if (target.family === "devops") return "DevOps Engineer";
  }
  if (/\bspecialist\b/.test(t)) {
    if (target.family === "cyber-security") return "Cyber Security Specialist";
    if (target.family === "information-security") return "Information Security Specialist";
  }
  return null;
}

function stripSeniority(title: string): { prefix: string; rest: string } {
  for (const { pattern, prefix } of SENIORITY_TOKENS) {
    if (pattern.test(title)) {
      const rest = title.replace(pattern, "").replace(/\s+/g, " ").trim();
      return { prefix, rest };
    }
  }
  return { prefix: "", rest: title };
}

// ── apply user-approved overrides ──────────────────────────────────────

/**
 * Map of `{ index → newTitle }` for the experience entries the user
 * approved. Entries not present are left untouched.
 */
export type ExperienceRoleOverrides = Record<number, string>;

/**
 * Returns a new ParsedResume with the chosen experience role titles
 * substituted in. Company / location / dates are preserved verbatim.
 */
export function applyExperienceRoleOverrides(
  parsed: ParsedResume,
  overrides: ExperienceRoleOverrides
): ParsedResume {
  if (!overrides || Object.keys(overrides).length === 0) return parsed;

  const sections: ResumeSection[] = parsed.sections.map((section) => {
    if (section.kind !== "experience" && section.kind !== "projects") return section;

    let idx = 0;
    const newLines = section.lines.map((line) => {
      const t = line.trim();
      if (!t) return line;
      if (/^[•\-–—\*·]/.test(t)) return line;
      if (!isLikelyRoleHeader(t)) return line;

      const currentIdx = idx++;
      const replacement = overrides[currentIdx];
      if (!replacement) return line;

      const parts = t.split(HEADER_SEPARATORS).map((p) => p.trim()).filter(Boolean);
      if (parts.length === 0) return line;

      // Replace ONLY the first segment (role); preserve everything else.
      const rebuilt = [replacement.trim(), ...parts.slice(1)].join(" | ");
      // Preserve any leading whitespace on the original line.
      const leading = line.match(/^\s*/)?.[0] || "";
      return `${leading}${rebuilt}`;
    });

    return { ...section, lines: newLines };
  });

  return { ...parsed, sections };
}
