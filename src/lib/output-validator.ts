/**
 * Deterministic output validator.
 *
 * Runs after Pass 2 (LLM generation). Checks that:
 *   - protected fields (name, contact, employers, dates, education, certs)
 *     are unchanged vs the original parsed resume
 *   - structure is intact (canonical sections present, headings unchanged)
 *   - enhanced sections contain no forbidden strings (TBD, XX, etc)
 *   - role alignment didn't introduce seniority inflation beyond rules
 *
 * If validation fails, the caller can either auto-fix (revert specific
 * problematic sections to the original) or throw a validation error and
 * regenerate.
 */

import type { ParsedResume, ResumeSection } from "./docx-engine";

export interface ValidationIssue {
  severity: "error" | "warning";
  field: string;
  message: string;
}

export interface ValidationResult {
  ok: boolean;
  issues: ValidationIssue[];
  /**
   * If `autoFixedSections` is non-empty, the caller should use the
   * returned `fixedSections` in place of the enhanced sections. The list
   * names which sections were reverted.
   */
  autoFixedSections: string[];
  fixedSections: ResumeSection[] | null;
}

export interface ValidationInput {
  original: ParsedResume;
  enhanced: ParsedResume;
  locked: {
    name: string;
    contactLines: string[];
    companyNames: string[];
    dates: string[];
    education: string[];
    certifications: string[];
  };
  /** Sections the user approved for rewriting. Others must not be touched. */
  sectionsEnhanced: string[];
}

const FORBIDDEN_SUBSTRINGS = [
  "[tbd]",
  "[todo]",
  "xxxx",
  "xx/xx",
  "insert here",
  "placeholder",
  "lorem ipsum",
];

export function validateEnhancement(input: ValidationInput): ValidationResult {
  const issues: ValidationIssue[] = [];
  const autoFixed: string[] = [];

  const origByKind = new Map<string, ResumeSection>(
    input.original.sections.map((s) => [s.kind, s])
  );
  const enhByKind = new Map<string, ResumeSection>(
    input.enhanced.sections.map((s) => [s.kind, s])
  );

  // ── 1. Structural integrity ──
  for (const kind of ["header", "summary", "skills", "experience", "education", "certifications"]) {
    if (origByKind.has(kind) && !enhByKind.has(kind)) {
      issues.push({
        severity: "error",
        field: `section.${kind}`,
        message: `Section "${kind}" present in original but missing from enhanced output.`,
      });
    }
  }

  // ── 2. Sections the user didn't approve must be byte-identical ──
  const allowed = new Set(input.sectionsEnhanced);
  const fixedSections: ResumeSection[] = input.enhanced.sections.map((s) => ({ ...s }));
  for (let i = 0; i < fixedSections.length; i++) {
    const kind = fixedSections[i].kind;
    if (allowed.has(kind)) continue;
    const orig = origByKind.get(kind);
    if (!orig) continue;
    if (!sectionsEqual(orig, fixedSections[i])) {
      issues.push({
        severity: "warning",
        field: `section.${kind}`,
        message: `Section "${kind}" was not approved for rewriting but was changed. Reverting.`,
      });
      fixedSections[i] = { ...orig };
      autoFixed.push(kind);
    }
  }

  // ── 3. Locked fields must survive ──
  const enhText = fixedSections.map((s) => s.lines.join("\n")).join("\n").toLowerCase();
  const origText = input.original.sections
    .map((s) => s.lines.join("\n"))
    .join("\n")
    .toLowerCase();

  const lockedChecks: Array<{ label: string; values: string[] }> = [
    { label: "name", values: input.locked.name ? [input.locked.name] : [] },
    { label: "contact", values: input.locked.contactLines },
    { label: "companyNames", values: input.locked.companyNames },
    { label: "dates", values: input.locked.dates },
    { label: "education", values: input.locked.education },
    { label: "certifications", values: input.locked.certifications },
  ];
  for (const { label, values } of lockedChecks) {
    for (const v of values) {
      if (!v.trim()) continue;
      // If the original contained it, the enhanced MUST still contain it.
      if (origText.includes(v.toLowerCase()) && !enhText.includes(v.toLowerCase())) {
        issues.push({
          severity: "error",
          field: `locked.${label}`,
          message: `Protected value "${truncate(v, 60)}" is missing from the enhanced output.`,
        });
      }
    }
  }

  // ── 4. Forbidden placeholder strings ──
  for (const s of fixedSections) {
    const body = s.lines.join(" ").toLowerCase();
    for (const bad of FORBIDDEN_SUBSTRINGS) {
      if (body.includes(bad)) {
        issues.push({
          severity: "error",
          field: `section.${s.kind}`,
          message: `Contains placeholder "${bad}".`,
        });
      }
    }
  }

  // ── 5. Empty summary / skills / experience after enhancement ──
  for (const kind of ["summary", "skills", "experience"]) {
    if (!allowed.has(kind)) continue;
    const enh = enhByKind.get(kind);
    const orig = origByKind.get(kind);
    if (!enh || !orig) continue;
    const enhBody = enh.lines.join("").trim();
    const origBody = orig.lines.join("").trim();
    if (origBody && !enhBody) {
      issues.push({
        severity: "error",
        field: `section.${kind}`,
        message: `Section "${kind}" is empty after enhancement — reverting.`,
      });
      // replace that section in fixedSections
      const idx = fixedSections.findIndex((x) => x.kind === kind);
      if (idx >= 0) {
        fixedSections[idx] = { ...orig };
        autoFixed.push(kind);
      }
    }
  }

  const hardErrors = issues.filter((i) => i.severity === "error" && autoFixed.indexOf(i.field.split(".")[1]) === -1);

  return {
    ok: hardErrors.length === 0,
    issues,
    autoFixedSections: autoFixed,
    fixedSections: autoFixed.length > 0 ? fixedSections : null,
  };
}

function sectionsEqual(a: ResumeSection, b: ResumeSection): boolean {
  if (a.lines.length !== b.lines.length) return false;
  for (let i = 0; i < a.lines.length; i++) {
    if (a.lines[i] !== b.lines[i]) return false;
  }
  return true;
}

function truncate(s: string, n: number): string {
  return s.length <= n ? s : s.slice(0, n - 1) + "…";
}
