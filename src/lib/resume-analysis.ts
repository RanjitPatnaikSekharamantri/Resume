/**
 * Deterministic resume analyzer.
 *
 * Runs BEFORE any LLM call. Takes the parsed resume (from docx-engine) +
 * the JD analysis (from jd-analysis) and produces a structured audit of:
 *
 *   - strong sections (high signal, well-evidenced)
 *   - weak sections (generic filler, weak verbs, missing evidence)
 *   - keyword gaps (JD terms the resume doesn't mention)
 *   - realistic improvements (gaps that can be filled truthfully)
 *   - non-fixable gaps (years/education/domain that truly aren't there)
 *
 * All of this is fed into the AI context packet so the LLM never has to
 * guess "what should change". It already has a list.
 */

import type { ParsedResume, ResumeSection } from "./docx-engine";
import type { JdAnalysis } from "./jd-analysis";

// ── public types ───────────────────────────────────────────────────────

export interface ResumeAnalysis {
  header: {
    name: string;
    role: string;
    contactLines: string[];
  };
  sections: {
    summary: SectionAudit;
    skills: SectionAudit;
    experience: ExperienceAudit;
    education: SectionAudit;
    certifications: SectionAudit;
  };
  /** The 1–2 roles most relevant to the target JD. */
  mostRelevantRoles: Array<{
    index: number;
    title: string;
    company: string;
    relevance: number; // 0..1
  }>;
  keywordCoverage: {
    covered: string[];
    missing: string[];
  };
  realisticImprovements: string[];
  nonFixableGaps: string[];
}

export interface SectionAudit {
  present: boolean;
  length: number;
  strength: "strong" | "average" | "weak";
  notes: string[];
}

export interface ExperienceAudit extends SectionAudit {
  roleCount: number;
  weakBulletsTotal: number;
  /** Bullets grouped per role, for LLM prompt efficiency. */
  roles: Array<{
    index: number;
    headerLine: string;
    title: string;
    company: string;
    bulletCount: number;
    weakBullets: number; // # bullets with weak openings
    jdOverlap: number; // 0..1 — how many JD tokens the bullets cover
  }>;
}

// ── analyzer ──────────────────────────────────────────────────────────

export function analyzeResume(
  parsed: ParsedResume,
  jd: JdAnalysis
): ResumeAnalysis {
  const sections = indexSections(parsed);
  const header = extractHeader(sections.header);
  const summary = auditSummary(sections.summary);
  const skills = auditSkills(sections.skills, jd);
  const experience = auditExperience(sections.experience, jd);
  const education = auditGeneric(sections.education);
  const certifications = auditGeneric(sections.certifications);

  const fullText = parsed.sections.map((s) => s.lines.join("\n")).join("\n").toLowerCase();
  const coverage = buildKeywordCoverage(fullText, jd);
  const mostRelevant = pickRelevantRoles(experience);

  const realistic: string[] = [];
  const nonFixable: string[] = [];

  // Keyword gaps that can be realistically closed if the candidate has used
  // the adjacent tools. The LLM will decide; we just seed the list.
  if (coverage.missing.length > 0) {
    realistic.push(
      `Weave these JD terms into summary / bullets where truthful: ${coverage.missing
        .slice(0, 6)
        .join(", ")}.`
    );
  }
  if (summary.strength !== "strong") {
    realistic.push("Rewrite profile summary with a value-prop opening and quantified results.");
  }
  if (experience.weakBulletsTotal >= 2) {
    realistic.push(
      `Upgrade ${experience.weakBulletsTotal} weak-opening bullets in recent roles to strong action verbs.`
    );
  }
  if (skills.strength !== "strong") {
    realistic.push("Organise skills into JD-aligned categories with category labels and comma-separated items.");
  }

  // Non-fixable gaps — things we can't honestly invent.
  if (jd.requiredYears > 0) {
    const resumeYears = estimateYears(parsed);
    if (resumeYears > 0 && resumeYears < jd.requiredYears - 1) {
      nonFixable.push(
        `JD asks for ${jd.requiredYears}+ years; resume shows ~${resumeYears}. Don't inflate.`
      );
    }
  }
  for (const req of jd.hardRequirements) {
    const reqLower = req.toLowerCase();
    if (
      /cert|cissp|cism|cisa|crisc|ceh|security\+|aws certified|azure/i.test(reqLower) &&
      !fullText.includes(reqLower)
    ) {
      nonFixable.push(`JD requires "${req}" — not in resume. Don't fabricate.`);
    }
  }

  return {
    header,
    sections: { summary, skills, experience, education, certifications },
    mostRelevantRoles: mostRelevant,
    keywordCoverage: coverage,
    realisticImprovements: realistic,
    nonFixableGaps: nonFixable.slice(0, 6),
  };
}

// ── section indexing ──────────────────────────────────────────────────

function indexSections(parsed: ParsedResume) {
  const out: Record<string, ResumeSection | null> = {
    header: null,
    summary: null,
    skills: null,
    experience: null,
    education: null,
    certifications: null,
  };
  for (const s of parsed.sections) {
    if (out[s.kind] === null || out[s.kind] === undefined) {
      out[s.kind] = s;
    }
  }
  return out as {
    header: ResumeSection | null;
    summary: ResumeSection | null;
    skills: ResumeSection | null;
    experience: ResumeSection | null;
    education: ResumeSection | null;
    certifications: ResumeSection | null;
  };
}

function extractHeader(section: ResumeSection | null): ResumeAnalysis["header"] {
  if (!section) return { name: "", role: "", contactLines: [] };
  const lines = section.lines.filter((l) => l.trim().length > 0);
  const name = lines[0]?.trim() || "";
  const looksLikeContact = (l: string) =>
    /[@]/.test(l) ||
    /https?:\/\//i.test(l) ||
    /\+?\d[\d\s().\-]{6,}/.test(l) ||
    /,\s*[A-Z]{2}\b/.test(l) ||
    /linkedin|github/i.test(l);
  let role = "";
  const contactLines: string[] = [];
  for (let i = 1; i < lines.length; i++) {
    const l = lines[i].trim();
    if (looksLikeContact(l)) contactLines.push(l);
    else if (!role) role = l;
    else contactLines.push(l);
  }
  return { name, role, contactLines };
}

// ── section audits ────────────────────────────────────────────────────

const WEAK_OPENINGS =
  /^(responsible for|worked on|helped (with|to)?|assisted (with|in)?|participated in|involved in|supported|tasked with)\b/i;

function auditSummary(section: ResumeSection | null): SectionAudit {
  if (!section) return { present: false, length: 0, strength: "weak", notes: ["No summary section."] };
  const text = section.lines.join(" ").replace(/\s+/g, " ").trim();
  const notes: string[] = [];
  if (text.length < 40) notes.push("Summary is very short.");
  if (text.length > 800) notes.push("Summary is longer than recommended (≤500 chars).");
  if (/i am a|i'm a|my name is/i.test(text)) notes.push("First-person openings are discouraged in resumes.");
  const strength: SectionAudit["strength"] =
    text.length < 80
      ? "weak"
      : text.length > 160 && /\b\d+\+?\s*(?:years|yrs)\b/i.test(text)
        ? "strong"
        : "average";
  return {
    present: true,
    length: text.length,
    strength,
    notes,
  };
}

function auditSkills(
  section: ResumeSection | null,
  jd: JdAnalysis
): SectionAudit {
  if (!section) return { present: false, length: 0, strength: "weak", notes: ["No skills section."] };
  const text = section.lines.join("\n");
  const lower = text.toLowerCase();
  const hasCategoryFormat = section.lines.some((l) => /^[·•\-–—\*]?\s*[^:]{2,40}:/i.test(l.trim()));
  const notes: string[] = [];
  if (!hasCategoryFormat) notes.push('Not using the "Category: items" bullet pattern.');
  let clusterHits = 0;
  for (const terms of Object.values(jd.keywordClusters)) {
    if (terms.some((t) => lower.includes(t))) clusterHits++;
  }
  const clusterCount = Object.keys(jd.keywordClusters).length;
  if (clusterCount > 0 && clusterHits < clusterCount * 0.5) {
    notes.push("Less than half of JD skill clusters referenced in skills section.");
  }
  const strength: SectionAudit["strength"] =
    hasCategoryFormat && clusterHits >= clusterCount * 0.7
      ? "strong"
      : clusterHits >= clusterCount * 0.4
        ? "average"
        : "weak";
  return { present: true, length: text.length, strength, notes };
}

function auditExperience(
  section: ResumeSection | null,
  jd: JdAnalysis
): ExperienceAudit {
  if (!section)
    return {
      present: false,
      length: 0,
      strength: "weak",
      notes: ["No experience section."],
      roleCount: 0,
      roles: [],
      weakBulletsTotal: 0,
    } as ExperienceAudit;

  const lines = section.lines;
  const roles: ExperienceAudit["roles"] = [];
  let currentHeader = "";
  let currentBullets: string[] = [];
  let currentIdx = 0;

  const jdTokens = new Set(
    jd.topKeywords.map((k) => k.toLowerCase()).filter((k) => k.length > 3)
  );

  const flush = () => {
    if (!currentHeader) return;
    const weakCount = currentBullets.filter((b) => WEAK_OPENINGS.test(b.replace(/^[·•\-–—\*]\s*/, ""))).length;
    const bodyTokens = new Set(
      currentBullets
        .join(" ")
        .toLowerCase()
        .split(/\W+/)
        .filter((w) => w.length > 3)
    );
    let overlap = 0;
    for (const t of bodyTokens) if (jdTokens.has(t)) overlap++;
    const jdOverlap = jdTokens.size === 0 ? 0 : overlap / jdTokens.size;

    const parts = currentHeader.split(/\s[|·•—–]\s/).map((p) => p.trim());
    roles.push({
      index: roles.length,
      headerLine: currentHeader,
      title: parts[0] || currentHeader,
      company: parts[1] || "",
      bulletCount: currentBullets.length,
      weakBullets: weakCount,
      jdOverlap: Math.round(jdOverlap * 100) / 100,
    });
    currentIdx++;
  };

  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    const isBullet = /^[•·\-–—\*]/.test(t);
    const isRoleHeader = !isBullet && /\s[|·•—–]\s|\b(20|19)\d{2}\b|\bpresent\b/i.test(t) && t.length < 200;
    if (isRoleHeader) {
      flush();
      currentHeader = t;
      currentBullets = [];
    } else if (isBullet) {
      currentBullets.push(t);
    }
  }
  flush();
  void currentIdx;

  const notes: string[] = [];
  const weakTotal = roles.reduce((n, r) => n + r.weakBullets, 0);
  if (weakTotal >= 2) notes.push(`${weakTotal} bullets use weak openings ("responsible for", "worked on", …).`);
  const avgJdOverlap =
    roles.length === 0 ? 0 : roles.reduce((n, r) => n + r.jdOverlap, 0) / roles.length;
  if (avgJdOverlap < 0.08) notes.push("Experience bullets have low overlap with JD keywords.");

  const strength: SectionAudit["strength"] =
    roles.length >= 2 && weakTotal <= 1 && avgJdOverlap >= 0.15
      ? "strong"
      : weakTotal >= 3 || avgJdOverlap < 0.06
        ? "weak"
        : "average";

  return {
    present: true,
    length: lines.join("\n").length,
    strength,
    notes,
    roleCount: roles.length,
    roles,
    weakBulletsTotal: weakTotal,
  };
}

function auditGeneric(
  section: ResumeSection | null
): SectionAudit {
  if (!section) return { present: false, length: 0, strength: "weak", notes: ["Not present."] };
  const text = section.lines.join("\n");
  return {
    present: true,
    length: text.length,
    strength: text.length > 40 ? "average" : "weak",
    notes: [],
  };
}

// ── keyword coverage ──────────────────────────────────────────────────

function buildKeywordCoverage(resumeLower: string, jd: JdAnalysis) {
  const covered: string[] = [];
  const missing: string[] = [];
  for (const kw of jd.topKeywords) {
    if (resumeLower.includes(kw.toLowerCase())) covered.push(kw);
    else missing.push(kw);
  }
  return { covered, missing: missing.slice(0, 12) };
}

// ── relevance picker ──────────────────────────────────────────────────

function pickRelevantRoles(
  experience: ExperienceAudit
): ResumeAnalysis["mostRelevantRoles"] {
  return experience.roles
    .map((r) => ({
      index: r.index,
      title: r.title,
      company: r.company,
      relevance: r.jdOverlap,
    }))
    .sort((a, b) => b.relevance - a.relevance)
    .slice(0, 2);
}

function estimateYears(parsed: ParsedResume): number {
  const experience = parsed.sections.find((s) => s.kind === "experience");
  if (!experience) return 0;
  const text = experience.lines.join("\n");
  const years = [...text.matchAll(/\b(19|20)\d{2}\b/g)].map((m) => parseInt(m[0], 10));
  if (years.length === 0) return 0;
  const min = Math.min(...years);
  const thisYear = new Date().getFullYear();
  const hasPresent = /\bpresent\b/i.test(text);
  const max = hasPresent ? thisYear : Math.max(...years);
  return Math.max(0, max - min);
}
