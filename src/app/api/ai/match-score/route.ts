import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateMatchScore } from "@/lib/match-scoring";

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { applicationId, jobDescription, resumeText, jobTitle, company } = body;

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

    // Persist score to application if ID provided
    if (applicationId) {
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
            description: `Match score calculated: ${score.overallScore}%`,
            metadata: JSON.stringify(score),
          },
        });
      }
    }

    return NextResponse.json(score);
  } catch (err) {
    console.error("Match score error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
