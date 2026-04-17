/**
 * Structured AI Context Packet — the single source of truth passed into
 * both LLM passes (Pass 1 planning, Pass 2 generation).
 *
 * Produced by `buildAiContext()` from:
 *   - the application row + selected base resume
 *   - the parsed resume (docx-engine)
 *   - the deterministic JD analysis (jd-analysis)
 *   - the deterministic resume analysis (resume-analysis)
 *   - the current ATS score (ats-scoring)
 *   - the user's configured rule / role / section preferences
 *
 * The LLM never sees the raw JD or raw resume alone — always this packet.
 */

import type { JdAnalysis } from "./jd-analysis";
import type { ResumeAnalysis } from "./resume-analysis";
import type { AtsScore } from "./ats-scoring";

// ── public types ───────────────────────────────────────────────────────

export interface AiContextPacket {
  /** Version tag so downstream code can detect breaking changes safely. */
  version: "1.0";

  application: {
    id: string | null;
    targetRole: string;
    company: string;
    location: string | null;
    source: string | null;
    postedDate: string | null;
    jobDescription: string;
    baseResumeId: string | null;
    activeResumeVersionId: string | null;
  };

  resume: {
    originalHeaderRole: string;
    /** Final header role the user decided on (empty string = keep original). */
    selectedHeaderRole: string;
    /** "application" | "keep-original" | "custom" | "suggested" */
    headerRoleMode: string;
    parsedSections: Array<{
      kind: string;
      title: string;
      lineCount: number;
      /** Content clipped for prompt efficiency. */
      preview: string;
    }>;
    mostRelevantRoleIndexes: number[];
    keywordCoverage: {
      covered: string[];
      missing: string[];
    };
  };

  /**
   * Protected / locked fields — the LLM is NEVER allowed to change these.
   * Listed here so the prompt can echo them back explicitly.
   */
  locked: {
    name: string;
    contactLines: string[];
    companyNames: string[];
    dates: string[];
    education: string[];
    certifications: string[];
    userLocked: string[];
  };

  jdAnalysis: JdAnalysis;

  resumeAnalysis: {
    strongSections: string[];
    weakSections: string[];
    realisticImprovements: string[];
    nonFixableGaps: string[];
    experienceSummary: Array<{
      index: number;
      title: string;
      company: string;
      bulletCount: number;
      weakBullets: number;
      jdOverlap: number;
    }>;
  };

  scoring: {
    current: {
      overall: number;
      dimensions: Record<string, { value: number; max: number; reason: string }>;
      penalties: Array<{ label: string; value: number; reason: string }>;
      missingRequirements: string[];
    };
    mode: string;
  };

  userControls: {
    sectionsToEnhance: string[];
    rewriteIntensity: "light" | "moderate" | "aggressive";
    preserveLength: boolean;
    allowNewTruthfulSkills: boolean;
    prioritizeRecent: boolean;
    strongSummaryRewrite: boolean;
    roleAlignmentMode: "keep" | "smart" | "manual";
    experienceRoleOverrides: Record<number, string>;
  };
}

// ── builder helpers ────────────────────────────────────────────────────

export interface BuildAiContextInput {
  application: {
    id: string | null;
    jobTitle: string;
    company: string;
    location?: string | null;
    source?: string | null;
    postedDate?: Date | string | null;
    jobDescription: string;
    baseResumeId: string | null;
    activeResumeVersionId?: string | null;
  };
  parsedResumeSections: Array<{ kind: string; title: string; lines: string[] }>;
  jd: JdAnalysis;
  resumeAnalysis: ResumeAnalysis;
  currentScore: AtsScore;
  scoringMode: string;
  userControls: AiContextPacket["userControls"];
  headerRoleMode: string;
  selectedHeaderRole: string;
  userLockedFields?: string[];
}

export function buildAiContext(input: BuildAiContextInput): AiContextPacket {
  const {
    application,
    parsedResumeSections,
    jd,
    resumeAnalysis,
    currentScore,
    scoringMode,
    userControls,
    headerRoleMode,
    selectedHeaderRole,
  } = input;

  // ── Protected / locked fields derived from the parsed resume ──
  const experienceSection = parsedResumeSections.find((s) => s.kind === "experience");
  const educationSection = parsedResumeSections.find((s) => s.kind === "education");
  const certSection = parsedResumeSections.find((s) => s.kind === "certifications");

  const companyNames = extractCompanyNames(experienceSection?.lines || []);
  const dates = extractDates(experienceSection?.lines || []);
  const education = (educationSection?.lines || []).filter((l) => l.trim().length > 0);
  const certifications = (certSection?.lines || []).filter((l) => l.trim().length > 0);

  // ── strong / weak sections ──
  const strongSections: string[] = [];
  const weakSections: string[] = [];
  const sectionAudits = {
    summary: resumeAnalysis.sections.summary,
    skills: resumeAnalysis.sections.skills,
    experience: resumeAnalysis.sections.experience,
    education: resumeAnalysis.sections.education,
    certifications: resumeAnalysis.sections.certifications,
  };
  for (const [name, audit] of Object.entries(sectionAudits)) {
    if (!audit.present) continue;
    if (audit.strength === "strong") strongSections.push(name);
    else if (audit.strength === "weak") weakSections.push(name);
  }

  // ── preview strings ──
  const parsedSectionsPreview = parsedResumeSections.map((s) => ({
    kind: s.kind,
    title: s.title,
    lineCount: s.lines.length,
    preview: s.lines.join("\n").slice(0, 1800),
  }));

  return {
    version: "1.0",
    application: {
      id: application.id,
      targetRole: application.jobTitle,
      company: application.company,
      location: application.location || null,
      source: application.source || null,
      postedDate:
        application.postedDate instanceof Date
          ? application.postedDate.toISOString()
          : application.postedDate || null,
      jobDescription: application.jobDescription,
      baseResumeId: application.baseResumeId,
      activeResumeVersionId: application.activeResumeVersionId || null,
    },
    resume: {
      originalHeaderRole: resumeAnalysis.header.role,
      selectedHeaderRole,
      headerRoleMode,
      parsedSections: parsedSectionsPreview,
      mostRelevantRoleIndexes: resumeAnalysis.mostRelevantRoles.map((r) => r.index),
      keywordCoverage: resumeAnalysis.keywordCoverage,
    },
    locked: {
      name: resumeAnalysis.header.name,
      contactLines: resumeAnalysis.header.contactLines,
      companyNames,
      dates,
      education,
      certifications,
      userLocked: input.userLockedFields || [],
    },
    jdAnalysis: jd,
    resumeAnalysis: {
      strongSections,
      weakSections,
      realisticImprovements: resumeAnalysis.realisticImprovements,
      nonFixableGaps: resumeAnalysis.nonFixableGaps,
      experienceSummary: resumeAnalysis.sections.experience.roles.map((r) => ({
        index: r.index,
        title: r.title,
        company: r.company,
        bulletCount: r.bulletCount,
        weakBullets: r.weakBullets,
        jdOverlap: r.jdOverlap,
      })),
    },
    scoring: {
      current: {
        overall: currentScore.overall,
        dimensions: Object.fromEntries(
          Object.entries(currentScore.dimensions).map(([k, d]) => [
            k,
            { value: d.value, max: d.max, reason: d.reason },
          ])
        ),
        penalties: currentScore.penalties.map((p) => ({
          label: p.label,
          value: p.value,
          reason: p.reason,
        })),
        missingRequirements: currentScore.missingRequirements,
      },
      mode: scoringMode,
    },
    userControls,
  };
}

// ── helpers ───────────────────────────────────────────────────────────

function extractCompanyNames(lines: string[]): string[] {
  const names = new Set<string>();
  for (const l of lines) {
    const t = l.trim();
    if (!t) continue;
    if (/^[•·\-–—\*]/.test(t)) continue;
    const parts = t.split(/\s[|·•—–]\s/).map((p) => p.trim()).filter(Boolean);
    // role | company | location | date → companies are part[1]
    if (parts.length >= 2 && parts[1].length <= 60 && !/\d{4}/.test(parts[1])) {
      names.add(parts[1]);
    }
  }
  return [...names].slice(0, 12);
}

function extractDates(lines: string[]): string[] {
  const dates = new Set<string>();
  for (const l of lines) {
    const matches = l.match(
      /((?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(19|20)\d{2}\s*[–—\-]\s*(?:Present|(?:(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?\s+)?(?:19|20)\d{2})/gi
    );
    if (matches) for (const m of matches) dates.add(m.trim());
  }
  return [...dates].slice(0, 12);
}
