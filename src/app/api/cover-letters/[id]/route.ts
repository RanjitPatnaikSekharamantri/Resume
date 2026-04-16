import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();
    const { content } = body;

    if (!content || typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    if (content.length > 20000) {
      return NextResponse.json(
        { error: "Content is too long (max 20,000 characters)" },
        { status: 400 }
      );
    }

    const coverLetter = await prisma.coverLetterVersion.findFirst({
      where: { id },
      include: { application: { select: { userId: true, id: true } } },
    });

    if (!coverLetter || coverLetter.application.userId !== userId) {
      return NextResponse.json(
        { error: "Cover letter not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.coverLetterVersion.update({
      where: { id },
      data: { content },
    });

    await prisma.activity.create({
      data: {
        applicationId: coverLetter.applicationId,
        type: "cover_letter_updated",
        description: `Cover letter v${coverLetter.version} edited`,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update cover letter error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;

    const coverLetter = await prisma.coverLetterVersion.findFirst({
      where: { id },
      include: { application: { select: { userId: true, id: true } } },
    });

    if (!coverLetter || coverLetter.application.userId !== userId) {
      return NextResponse.json(
        { error: "Cover letter not found" },
        { status: 404 }
      );
    }

    await prisma.coverLetterVersion.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        applicationId: coverLetter.applicationId,
        type: "cover_letter_deleted",
        description: `Cover letter v${coverLetter.version} deleted`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete cover letter error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
