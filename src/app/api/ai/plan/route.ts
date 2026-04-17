import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import {
  parseDocx,
  applyHeaderRole,
  normalizeSectionTitles,
  type SectionKind,
} from "@/lib/docx-engine";
import { analyzeJobDescription } from "@/lib/jd-analysis";
import { analyzeResume } from "@/lib/resume-analysis";
import { buildAiContext, type AiContextPacket } from "@/lib/ai-context";
import { calculateAtsScore } from "@/lib/ats-scoring";
import { getActiveProviderForUser } from "@/lib/llm-provider";
import { runAnalysisPass } from "@/lib/llm-plan";

/**
 * POST /api/ai/plan
 *
 * Pass 1 of the two-pass LLM system — analysis and planning only. The
 * client receives a structured enhancement plan + the context packet it
 * was built from, shows them to the user for review, then calls
 * /api/ai/enhance (Pass 2) with the plan and the user's decisions.
 */
export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const {
      resumeId,
      applicationId,
      jobDescription,
      role,
      company,
      location,
      headerRole,
      headerRoleMode,
      userControls,
      scoringMode,
      userLockedFields,
    } = body as {
      resumeId: string;
      applicationId?: string | null;
      jobDescription: string;
      role: string;
      company: string;
      location?: string | null;
      headerRole?: string;
      headerRoleMode?: string;
      userControls?: Partial<AiContextPacket["userControls"]>;
      scoringMode?: "strict" | "realistic" | "bestfit";
      userLockedFields?: string[];
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
    if (!resume) return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    if (resume.fileType !== "docx") {
      return NextResponse.json(
        { error: "Only DOCX files can be analyzed for planning." },
        { status: 400 }
      );
    }

    // Fetch and parse the DOCX.
    let fileBuffer: Buffer;
    try {
      const url = await getSignedDownloadUrl(resume.fileUrl, 60);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuf = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } catch (err) {
      console.error("plan: failed to fetch resume:", err);
      return NextResponse.json(
        { error: "Could not fetch resume file. Check storage configuration." },
        { status: 502 }
      );
    }

    const parsed = await parseDocx(fileBuffer);
    const parsedWithHeader =
      headerRoleMode !== "original" && headerRole
        ? applyHeaderRole(parsed, headerRole)
        : parsed;
    const normalized = normalizeSectionTitles(parsedWithHeader);

    // Deterministic analyses — these are the ground truth passed into the LLM.
    const jd = analyzeJobDescription(jobDescription, role);
    const resumeAnalysis = analyzeResume(normalized, jd);
    const currentScore = calculateAtsScore({
      jobDescription,
      resumeText: normalized.sections
        .map((s) => s.lines.join("\n"))
        .join("\n"),
      jobTitle: role,
      company,
      mode: scoringMode,
    });

    const controls: AiContextPacket["userControls"] = {
      sectionsToEnhance: userControls?.sectionsToEnhance ?? [
        "summary",
        "skills",
        "experience",
      ],
      rewriteIntensity: userControls?.rewriteIntensity ?? "moderate",
      preserveLength: userControls?.preserveLength ?? false,
      allowNewTruthfulSkills: userControls?.allowNewTruthfulSkills ?? true,
      prioritizeRecent: userControls?.prioritizeRecent ?? true,
      strongSummaryRewrite: userControls?.strongSummaryRewrite ?? false,
      roleAlignmentMode: userControls?.roleAlignmentMode ?? "smart",
      experienceRoleOverrides: userControls?.experienceRoleOverrides ?? {},
    };

    const activeRv = applicationId
      ? await prisma.resumeVersion.findFirst({
          where: { applicationId, content: { not: null } },
          orderBy: { version: "desc" },
          select: { id: true },
        })
      : null;

    const context = buildAiContext({
      application: {
        id: applicationId ?? null,
        jobTitle: role,
        company,
        location: location ?? null,
        jobDescription,
        baseResumeId: resume.id,
        activeResumeVersionId: activeRv?.id ?? null,
      },
      parsedResumeSections: normalized.sections.map((s) => ({
        kind: s.kind,
        title: s.title,
        lines: s.lines,
      })),
      jd,
      resumeAnalysis,
      currentScore,
      scoringMode: scoringMode || "strict",
      userControls: controls,
      headerRoleMode: headerRoleMode || "application",
      selectedHeaderRole: headerRole || "",
      userLockedFields,
    });

    // Pass 1 — LLM analysis / planning. Uses the provider when available
    // and falls back to the deterministic plan otherwise.
    const provider = await getActiveProviderForUser(userId!);
    const planResult = await runAnalysisPass(provider, context);

    return NextResponse.json({
      context,
      plan: planResult.plan,
      engine: {
        kind: planResult.plan.producedBy,
        providerName: planResult.providerName ?? null,
        providerModel: planResult.providerModel ?? null,
        fallbackReason: planResult.fallbackReason ?? null,
        logs: planResult.logs,
      },
    });
  } catch (err) {
    console.error("Plan error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// Export for typing at call sites
export type { SectionKind };
