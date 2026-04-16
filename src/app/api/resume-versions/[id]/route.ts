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

    const rv = await prisma.resumeVersion.findFirst({
      where: { id },
      include: { application: { select: { userId: true, id: true } } },
    });

    if (!rv || rv.application.userId !== userId) {
      return NextResponse.json(
        { error: "Resume version not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.resumeVersion.update({
      where: { id },
      data: { content: content.slice(0, 50000) },
    });

    await prisma.activity.create({
      data: {
        applicationId: rv.applicationId,
        type: "resume_version_updated",
        description: `Resume v${rv.version} edited`,
      },
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update resume version error:", err);
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

    const rv = await prisma.resumeVersion.findFirst({
      where: { id },
      include: { application: { select: { userId: true, id: true } } },
    });

    if (!rv || rv.application.userId !== userId) {
      return NextResponse.json(
        { error: "Resume version not found" },
        { status: 404 }
      );
    }

    await prisma.resumeVersion.delete({ where: { id } });

    await prisma.activity.create({
      data: {
        applicationId: rv.applicationId,
        type: "resume_version_deleted",
        description: `Resume v${rv.version} deleted`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete resume version error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
