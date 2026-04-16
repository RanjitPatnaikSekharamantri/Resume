import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateMatchScore } from "@/lib/match-scoring";

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { applicationId, baseResumeId, content, isTailored } = body;

    if (!applicationId) {
      return NextResponse.json(
        { error: "Application ID is required" },
        { status: 400 }
      );
    }

    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId: userId! },
    });

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (baseResumeId) {
      const resume = await prisma.baseResume.findFirst({
        where: { id: baseResumeId, userId: userId! },
      });
      if (!resume) {
        return NextResponse.json(
          { error: "Base resume not found" },
          { status: 404 }
        );
      }
    }

    const latestVersion = await prisma.resumeVersion.findFirst({
      where: { applicationId },
      orderBy: { version: "desc" },
    });

    const version = (latestVersion?.version || 0) + 1;
    const label = isTailored ? "Tailored" : "Base";

    const safeContent = content ? String(content).slice(0, 50000) : null;

    const resumeVersion = await prisma.resumeVersion.create({
      data: {
        applicationId,
        baseResumeId: baseResumeId || null,
        jobTitle: app.jobTitle,
        company: app.company,
        version,
        fileName: `${label}_Resume_v${version}.docx`,
        fileUrl: "",
        content: safeContent,
        isTailored: !!isTailored,
      },
    });

    // ── Recompute the Active Resume Score against this new version ──
    //
    // The "Current Active Resume Score" shown on the application detail
    // page is defined as: the score of the most recently saved
    // ResumeVersion against the application's current JD. Recompute and
    // persist it here so no screen shows a stale number after a save.
    let persistedScore: {
      matchScore: number;
      skillsMatch: number;
      experienceMatch: number;
      keywordCoverage: number;
      domainMatch: number;
    } | null = null;

    if (safeContent && app.jobDescription && safeContent.length > 10) {
      const score = calculateMatchScore({
        jobDescription: app.jobDescription,
        resumeText: safeContent,
        jobTitle: app.jobTitle,
        company: app.company,
      });
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
      persistedScore = {
        matchScore: score.overallScore,
        skillsMatch: score.skillsMatch,
        experienceMatch: score.experienceMatch,
        keywordCoverage: score.keywordCoverage,
        domainMatch: score.domainMatch,
      };

      await prisma.activity.create({
        data: {
          applicationId,
          type: "match_score_calculated",
          description: `Active Resume Score updated: ${score.overallScore}% (v${version})`,
          metadata: JSON.stringify(score),
        },
      });
    }

    await prisma.activity.create({
      data: {
        applicationId,
        type: "resume_version_created",
        description: `${label} resume v${version} added`,
      },
    });

    return NextResponse.json(
      { ...resumeVersion, activeScore: persistedScore },
      { status: 201 }
    );
  } catch (err) {
    console.error("Create resume version error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
