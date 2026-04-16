import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateMatchScore } from "@/lib/match-scoring";

/**
 * POST /api/ai/match-score
 *
 * Single source of truth for computing match scores. All screens call
 * this route with the same engine & the same inputs so scores stay
 * consistent across:
 *   - application list
 *   - application detail (Current Active Resume Score)
 *   - AI Studio (Base Resume Score / Enhanced Resume Score)
 *
 * Body:
 *   jobDescription (required)
 *   resumeText     (required)
 *   jobTitle, company — optional, used by the scoring engine
 *   applicationId  — optional; when set AND `persistAsActive` is true,
 *                    the score is persisted to the Application row as the
 *                    Current Active Resume Score.
 *   persistAsActive — default false. Only set to true when the scored
 *                    document represents the currently-active saved
 *                    resume version (not a one-off "base" or "before"
 *                    comparison).
 *   sourceLabel    — optional log/activity label: "base" | "enhanced" |
 *                    "active" — purely for observability.
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
    } = body;

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

    const score = calculateMatchScore({
      jobDescription,
      resumeText,
      jobTitle,
      company,
    });

    if (applicationId && persistAsActive) {
      const app = await prisma.application.findFirst({
        where: { id: applicationId, userId: userId! },
      });

      if (app) {
        await prisma.application.update({
          where: { id: applicationId },
          data: {
            matchScore: score.overallScore,
            skillsMatch: score.skillsMatch,
            experienceMatch: score.experienceMatch,
            keywordCoverage: score.keywordCoverage,
            domainMatch: score.domainMatch,
          },
        });

        await prisma.activity.create({
          data: {
            applicationId,
            type: "match_score_calculated",
            description: `Active Resume Score updated: ${score.overallScore}%${
              sourceLabel ? ` (source: ${sourceLabel})` : ""
            }`,
            metadata: JSON.stringify({ ...score, sourceLabel }),
          },
        });
      }
    }

    return NextResponse.json({ ...score, sourceLabel: sourceLabel || null });
  } catch (err) {
    console.error("Match score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
