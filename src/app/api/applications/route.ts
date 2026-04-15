import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

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
        matchScore,
      },
    });

    await prisma.activity.create({
      data: {
        applicationId: application.id,
        type: "created",
        description: `Application created for ${jobTitle} at ${company}`,
      },
    });

    return NextResponse.json(application, { status: 201 });
  } catch (err) {
    console.error("Create application error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
