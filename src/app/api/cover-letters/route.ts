import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, jobTitle, company, content } = body;

    if (!applicationId || !content) {
      return NextResponse.json(
        { error: "Application ID and content are required" },
        { status: 400 }
      );
    }

    const app = await prisma.application.findFirst({
      where: { id: applicationId, userId: session.user.id },
    });

    if (!app) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const latestVersion = await prisma.coverLetterVersion.findFirst({
      where: { applicationId },
      orderBy: { version: "desc" },
    });

    const coverLetter = await prisma.coverLetterVersion.create({
      data: {
        applicationId,
        jobTitle: jobTitle || app.jobTitle,
        company: company || app.company,
        version: (latestVersion?.version || 0) + 1,
        content,
      },
    });

    await prisma.activity.create({
      data: {
        applicationId,
        type: "cover_letter_created",
        description: `Cover letter v${coverLetter.version} created`,
      },
    });

    return NextResponse.json(coverLetter, { status: 201 });
  } catch (error) {
    console.error("Create cover letter error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
