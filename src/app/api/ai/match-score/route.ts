import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateAtsScore } from "@/lib/ats-scoring";

/**
 * POST /api/ai/match-score
 *
 * Single source of truth for resume-to-JD scoring across the app. Uses the
 * deterministic ATS scoring engine in `src/lib/ats-scoring.ts` — never an
 * LLM. Every screen (application list, application detail, AI Studio
 * before/after) calls this route (directly or transitively) to guarantee
 * the numbers agree.
 *
 * Body:
 *   jobDescription   required
 *   resumeText       required
 *   jobTitle         optional
 *   company          optional
 *   applicationId    optional; pair with persistAsActive=true to persist
 *                    the score as the application's Current Active Resume
 *                    Score. Any other call is non-mutating.
 *   persistAsActive  default false
 *   sourceLabel      optional: "base" | "enhanced" | "active" — observability
 *
 * Returns the full AtsScore (breakdown, penalties, missingRequirements,
 * suggestions) PLUS legacy fields for backward compat with older UI paths.
 */
export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const {
      applicationId,
      jobDescription,
      resumeText,
      jobTitle,
      company,
      persistAsActive,
      sourceLabel,
      mode,
      ignorePenalties,
    } = body as {
      applicationId?: string;
      jobDescription: string;
      resumeText: string;
      jobTitle?: string;
      company?: string;
      persistAsActive?: boolean;
      sourceLabel?: string;
      mode?: "strict" | "realistic" | "bestfit";
      ignorePenalties?: Array<
        "missingRequired" | "titleMismatch" | "years" | "evidence" | "domain"
      >;
    };

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }
    if (!resumeText) {
      return NextResponse.json(
        { error: "Resume text is required for scoring" },
        { status: 400 }
      );
    }

    const score = calculateAtsScore({
      jobDescription,
      resumeText,
      jobTitle,
      company,
      mode,
      ignorePenalties,
    });

    if (applicationId && persistAsActive) {
      const app = await prisma.application.findFirst({
        where: { id: applicationId, userId: userId! },
      });

      if (app) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            matchScore: score.overall,
            skillsMatch: score.legacyBreakdown.skillsMatch,
            experienceMatch: score.legacyBreakdown.experienceMatch,
            keywordCoverage: score.legacyBreakdown.keywordCoverage,
            domainMatch: score.legacyBreakdown.domainMatch,
          },
        });

        await prisma.activity.create({
          data: {
            applicationId,
            type: "match_score_calculated",
            description: `Active Resume Score updated: ${score.overall}/100${
              sourceLabel ? ` (source: ${sourceLabel})` : ""
            }`,
            metadata: JSON.stringify({
              overall: score.overall,
              dimensions: Object.fromEntries(
                Object.entries(score.dimensions).map(([k, d]) => [
                  k,
                  { value: d.value, max: d.max },
                ])
              ),
              missingRequirements: score.missingRequirements,
              penalties: score.penalties,
              sourceLabel: sourceLabel || null,
            }),
          },
        });
      }
    }

    // Legacy shape for older consumers + full shape for new UI.
    return NextResponse.json({
      // legacy fields
      overallScore: score.overall,
      skillsMatch: score.legacyBreakdown.skillsMatch,
      experienceMatch: score.legacyBreakdown.experienceMatch,
      keywordCoverage: score.legacyBreakdown.keywordCoverage,
      domainMatch: score.legacyBreakdown.domainMatch,
      // new ATS fields
      ats: score,
      sourceLabel: sourceLabel || null,
    });
  } catch (err) {
    console.error("Match score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
