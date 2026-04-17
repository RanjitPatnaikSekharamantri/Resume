import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import {
  parseDocx,
  enhanceSections,
  sectionsToText,
  extractJdKeywords,
  applyHeaderRole,
  normalizeSectionTitles,
  type SectionKind,
  type ResumeSection,
  type ParsedResume,
} from "@/lib/docx-engine";
import {
  getActiveProviderForUser,
  type ResolvedProvider,
} from "@/lib/llm-provider";
import { enhanceWithLLM } from "@/lib/llm-enhance";
import {
  applyExperienceRoleOverrides,
  type ExperienceRoleOverrides,
} from "@/lib/role-alignment";
import { calculateAtsScore } from "@/lib/ats-scoring";
import { validateEnhancement } from "@/lib/output-validator";
import { analyzeResume } from "@/lib/resume-analysis";
import { analyzeJobDescription } from "@/lib/jd-analysis";

/**
 * Sections the enhancement engine is allowed to modify.
 *
 * - summary / skills / experience / projects: fully rewritable
 * - certifications: accepted but the deterministic engine treats it as
 *   a no-op (never fabricated). The LLM engine is instructed to only
 *   re-order existing entries.
 */
const VALID_SECTION_KINDS = new Set<SectionKind>([
  "summary",
  "skills",
  "experience",
  "projects",
  "certifications",
]);

interface EngineMeta {
  kind: "llm" | "deterministic" | "llm-fallback";
  label: string;
  providerConfigured: boolean;
  providerName: string | null;
  providerModel: string | null;
  fallbackReason?: string;
  note: string;
  logs: string[];
}

export async function POST(req: Request) {
  const logs: string[] = [];
  const log = (msg: string) => {
    const entry = `[enhance] ${msg}`;
    console.log(entry);
    logs.push(msg);
  };

  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const {
      resumeId,
      jobDescription,
      role,
      company,
      headerRole,
      sectionsToEnhance,
      rules,
      experienceRoleOverrides,
      scoringMode,
      ignorePenalties,
      plan,
      context,
    } = body as {
      resumeId: string;
      jobDescription: string;
      role: string;
      company: string;
      headerRole?: string;
      sectionsToEnhance?: string[];
      rules?: Record<string, unknown>;
      experienceRoleOverrides?: Record<string, string> | null;
      scoringMode?: "strict" | "realistic" | "bestfit";
      ignorePenalties?: Array<
        "missingRequired" | "titleMismatch" | "years" | "evidence" | "domain"
      >;
      /** Pass 1 plan — required when calling as Pass 2. */
      plan?: unknown;
      /** AI context packet built alongside the plan. */
      context?: unknown;
    };

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }
    if (!jobDescription || !role || !company) {
      return NextResponse.json(
        { error: "Job description, role, and company are required" },
        { status: 400 }
      );
    }

    const resume = await prisma.baseResume.findFirst({
      where: { id: resumeId, userId: userId! },
    });

    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }

    if (resume.fileType !== "docx") {
      return NextResponse.json(
        { error: "Only DOCX files can be enhanced. PDF parsing is not supported yet." },
        { status: 400 }
      );
    }

    // Fetch the file from Supabase
    let fileBuffer: Buffer;
    try {
      const url = await getSignedDownloadUrl(resume.fileUrl, 60);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuf = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } catch (fetchErr) {
      console.error("Failed to fetch resume from storage:", fetchErr);
      return NextResponse.json(
        { error: "Could not fetch resume file. Check storage configuration." },
        { status: 502 }
      );
    }

    const parsed = await parseDocx(fileBuffer);

    // Validate requested sections
    const validSections: SectionKind[] = (
      sectionsToEnhance || ["summary", "skills", "experience"]
    ).filter((s: string) => VALID_SECTION_KINDS.has(s as SectionKind)) as SectionKind[];

    // Desired header role — explicit value from client, otherwise target role.
    // An empty string is a SIGNAL from the client that the user picked
    // "Keep original header" — in that case we do NOT touch the header.
    const effectiveHeaderRole =
      typeof headerRole === "string" ? headerRole.trim() : (role || "").trim();
    const keepOriginalHeader = headerRole === "";

    // Apply the header role BEFORE enhancement so both engines see the
    // updated header as context.
    let withHeader = parsed;
    if (!keepOriginalHeader && effectiveHeaderRole) {
      withHeader = applyHeaderRole(parsed, effectiveHeaderRole);
    }

    // Apply user-approved experience role overrides. Each override only
    // touches the role title segment — company / location / dates are
    // preserved verbatim. Keys are numeric strings in JSON, so convert.
    let roleAlignedExperience = false;
    if (experienceRoleOverrides && typeof experienceRoleOverrides === "object") {
      const clean: ExperienceRoleOverrides = {};
      for (const [k, v] of Object.entries(experienceRoleOverrides)) {
        if (typeof v === "string" && v.trim()) {
          const idx = Number(k);
          if (Number.isFinite(idx) && idx >= 0) {
            clean[idx] = v.trim();
          }
        }
      }
      if (Object.keys(clean).length > 0) {
        withHeader = applyExperienceRoleOverrides(withHeader, clean);
        roleAlignedExperience = true;
        log(`applied ${Object.keys(clean).length} experience role override(s)`);
      }
    }

    // ── AI provider path ──

    const provider = await getActiveProviderForUser(userId!);

    let enhanced: ParsedResume | null = null;
    let usage: { promptTokens?: number; completionTokens?: number } | undefined;
    let engineKind: EngineMeta["kind"] = "deterministic";
    let fallbackReason: string | undefined;
    let engineLabel = "Built-in enhancement engine";

    if (provider && (provider.kind === "openai" || provider.kind === "anthropic")) {
      log(`provider found: name=${provider.name} kind=${provider.kind} model=${provider.model}`);
      try {
        const result = await enhanceWithLLM(
          provider,
          withHeader,
          {
            jobDescription: jobDescription.trim(),
            role: role.trim(),
            company: company.trim(),
            headerRole: effectiveHeaderRole,
            sectionsToEnhance: validSections,
            rules: rules || {},
            plan,
            context,
          },
          log
        );
        enhanced = result.enhanced;
        usage = result.usage;
        engineKind = "llm";
        engineLabel = `LLM-powered (${provider.name}${provider.model ? ` · ${provider.model}` : ""})`;
        log(`llm enhancement succeeded`);
      } catch (err) {
        fallbackReason = err instanceof Error ? err.message : String(err);
        engineKind = "llm-fallback";
        engineLabel = `LLM failed — deterministic fallback (${provider.name})`;
        log(`llm enhancement FAILED, falling back: ${fallbackReason}`);
      }
    } else {
      log(
        provider
          ? `provider found but kind="${provider.kind}" is not supported — using deterministic engine`
          : `no active AI provider configured — using deterministic engine`
      );
    }

    if (!enhanced) {
      const deterministic = enhanceSections(withHeader, {
        jobDescription: jobDescription.trim(),
        role: role.trim(),
        company: company.trim(),
        sectionsToEnhance: validSections,
        rules: rules || {},
      });
      enhanced = deterministic;
    }

    // Always normalise titles so output headings match the canonical pattern.
    enhanced = normalizeSectionTitles(enhanced);

    // ── Post-generation validation ──
    //
    // Deterministic guard that protected fields (name, contact, employers,
    // dates, education, certifications) survived the rewrite, that only
    // approved sections changed, and that no placeholder strings leaked
    // into the output. Any unapproved section edits are auto-reverted.
    const jdForValidation = analyzeJobDescription(jobDescription, role);
    const resumeForValidation = analyzeResume(withHeader, jdForValidation);
    const validation = validateEnhancement({
      original: withHeader,
      enhanced,
      locked: {
        name: resumeForValidation.header.name,
        contactLines: resumeForValidation.header.contactLines,
        companyNames: [
          ...new Set(
            resumeForValidation.sections.experience.roles.map((r) => r.company).filter(Boolean)
          ),
        ],
        dates: (withHeader.sections.find((s) => s.kind === "experience")?.lines || []).filter((l) =>
          /\b(19|20)\d{2}\b/.test(l)
        ),
        education:
          (withHeader.sections.find((s) => s.kind === "education")?.lines || []).filter(
            (l) => l.trim().length > 0
          ),
        certifications:
          (withHeader.sections.find((s) => s.kind === "certifications")?.lines || []).filter(
            (l) => l.trim().length > 0
          ),
      },
      sectionsEnhanced: validSections,
    });
    if (validation.fixedSections) {
      log(`validation auto-fixed: ${validation.autoFixedSections.join(", ")}`);
      enhanced = {
        sections: validation.fixedSections,
        rawText: enhanced.rawText,
      };
    }

    // Build preview text using the enhanced (title-normalised) sections.
    const previewText = sectionsToText(enhanced.sections);
    const originalText = sectionsToText(normalizeSectionTitles(withHeader).sections);

    // ── Scoring: compute BOTH base (original + header role applied) and
    // enhanced scores using the SAME scoring engine and SAME JD. This is
    // the single source of truth for "Base Resume Score" vs "Enhanced
    // Resume Score" labels in the UI — no separate calls from the client.
    const baseScore = calculateAtsScore({
      jobDescription: jobDescription.trim(),
      resumeText: originalText,
      jobTitle: role.trim(),
      company: company.trim(),
      mode: scoringMode,
      ignorePenalties,
    });
    const enhancedScore = calculateAtsScore({
      jobDescription: jobDescription.trim(),
      resumeText: previewText,
      jobTitle: role.trim(),
      company: company.trim(),
      mode: scoringMode,
      ignorePenalties,
    });

    // JD-derived keywords bolded inline at render time (DOCX/PDF).
    const emphasizeTokens = extractJdKeywords(jobDescription);

    const providerConfigured = !!provider;
    const engine: EngineMeta = {
      kind: engineKind,
      label: engineLabel,
      providerConfigured,
      providerName: provider?.name || null,
      providerModel: provider?.model || null,
      fallbackReason,
      note: noteForEngine({
        engineKind,
        provider,
        fallbackReason,
      }),
      logs,
    };

    return NextResponse.json({
      original: {
        sections: (withHeader ? normalizeSectionTitles(withHeader) : withHeader).sections.map(sectionToJson),
        text: originalText,
      },
      enhanced: {
        sections: enhanced.sections.map(sectionToJson),
        text: previewText,
      },
      resumeName: resume.name,
      fileName: resume.fileName,
      emphasizeTokens,
      headerRole: keepOriginalHeader ? null : effectiveHeaderRole,
      keepOriginalHeader,
      experienceRoleAlignments: roleAlignedExperience
        ? Object.keys(experienceRoleOverrides || {}).length
        : 0,
      scores: {
        // Legacy shape expected by existing MatchScoreCard consumers.
        base: {
          overallScore: baseScore.overall,
          skillsMatch: baseScore.legacyBreakdown.skillsMatch,
          experienceMatch: baseScore.legacyBreakdown.experienceMatch,
          keywordCoverage: baseScore.legacyBreakdown.keywordCoverage,
          domainMatch: baseScore.legacyBreakdown.domainMatch,
        },
        enhanced: {
          overallScore: enhancedScore.overall,
          skillsMatch: enhancedScore.legacyBreakdown.skillsMatch,
          experienceMatch: enhancedScore.legacyBreakdown.experienceMatch,
          keywordCoverage: enhancedScore.legacyBreakdown.keywordCoverage,
          domainMatch: enhancedScore.legacyBreakdown.domainMatch,
        },
        // Full ATS shape (new UI).
        baseAts: baseScore,
        enhancedAts: enhancedScore,
      },
      usage: usage || null,
      engine,
      validation: {
        ok: validation.ok,
        issues: validation.issues,
        autoFixedSections: validation.autoFixedSections,
      },
    });
  } catch (err) {
    console.error("Enhance error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function sectionToJson(s: ResumeSection) {
  return {
    kind: s.kind,
    title: s.title,
    lines: s.lines,
    modifiable: s.modifiable,
  };
}

function noteForEngine(args: {
  engineKind: EngineMeta["kind"];
  provider: ResolvedProvider | null;
  fallbackReason: string | undefined;
}): string {
  const { engineKind, provider, fallbackReason } = args;
  if (engineKind === "llm") {
    return `Enhanced using ${provider?.name || "provider"}${provider?.model ? ` (${provider.model})` : ""}. LLM-based rewriting is active.`;
  }
  if (engineKind === "llm-fallback") {
    return `Provider call failed and the deterministic fallback engine was used instead. Reason: ${fallbackReason || "unknown"}.`;
  }
  if (provider) {
    return `Provider "${provider.name}" is configured but kind is unsupported (${provider.kind}); used deterministic engine. Try naming the provider OpenAI or Anthropic.`;
  }
  return "No AI provider configured; using the built-in deterministic engine.";
}
