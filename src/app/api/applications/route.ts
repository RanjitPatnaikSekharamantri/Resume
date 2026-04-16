import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { calculateMatchScore } from "@/lib/match-scoring";

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const applications = await prisma.application.findMany({
      where: { userId: userId! },
      include: {
        resumeVersions: { select: { id: true } },
        coverLetters: { select: { id: true } },
      },
      orderBy: { updatedAt: "desc" },
    });

    return NextResponse.json(applications);
  } catch (err) {
    console.error("Get applications error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const {
      jobTitle,
      company,
      location,
      salary,
      postedDate,
      jobDescription,
      jobUrl,
      source,
      notes,
      status,
      matchScore,
    } = body;

    if (!jobTitle || !company) {
      return NextResponse.json(
        { error: "Job title and company are required" },
        { status: 400 }
      );
    }

    // Auto-calculate match score if JD is present
    let scoreData: {
      matchScore?: number;
      skillsMatch?: number;
      experienceMatch?: number;
      keywordCoverage?: number;
      domainMatch?: number;
    } = {};

    if (jobDescription) {
      // Try to use actual resume content if baseResumeId provided
      let resumeText = "";

      if (body.baseResumeId) {
        const baseResume = await prisma.baseResume.findFirst({
          where: { id: body.baseResumeId, userId: userId! },
        });
        // Check for any existing resume versions with content
        if (baseResume) {
          const latestVersion = await prisma.resumeVersion.findFirst({
            where: { baseResumeId: baseResume.id },
            orderBy: { createdAt: "desc" },
            select: { content: true },
          });
          resumeText = latestVersion?.content || baseResume.name + " " + (baseResume.roleCategory || "");
        }
      }

      // Fall back to profile data
      if (!resumeText) {
        const profile = await prisma.profile.findUnique({
          where: { userId: userId! },
        });
        resumeText = [
          profile?.summary || "",
          profile?.preferredRole || "",
          jobTitle,
        ].filter(Boolean).join(" ");
      }

      if (resumeText.length > 10) {
        const score = calculateMatchScore({
          jobDescription,
          resumeText,
          jobTitle,
          company,
        });
        scoreData = {
          matchScore: score.overallScore,
          skillsMatch: score.skillsMatch,
          experienceMatch: score.experienceMatch,
          keywordCoverage: score.keywordCoverage,
          domainMatch: score.domainMatch,
        };
      }
    }

    const application = await prisma.application.create({
      data: {
        userId: userId!,
        jobTitle,
        company,
        location,
        salary,
        postedDate: postedDate ? new Date(postedDate) : null,
        jobDescription,
        jobUrl,
        source,
        notes,
        status: status || "not_applied",
        ...scoreData,
      },
    });

    await prisma.activity.create({
      data: {
        applicationId: application.id,
        type: "created",
        description: `Application created for ${jobTitle} at ${company}`,
      },
    });

    // Link base resume as a version if provided
    if (body.baseResumeId) {
      const baseResume = await prisma.baseResume.findFirst({
        where: { id: body.baseResumeId, userId: userId! },
      });
      if (baseResume) {
        await prisma.resumeVersion.create({
          data: {
            applicationId: application.id,
            baseResumeId: baseResume.id,
            jobTitle,
            company,
            version: 1,
            fileName: baseResume.fileName,
            fileUrl: baseResume.fileUrl,
            isTailored: false,
          },
        });
      }
    }

    return NextResponse.json(application, { status: 201 });
  } catch (err) {
    console.error("Create application error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
