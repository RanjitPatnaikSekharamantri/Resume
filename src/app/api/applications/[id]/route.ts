import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;
    const application = await prisma.application.findFirst({
      where: { id, userId: userId! },
      include: {
        resumeVersions: {
          orderBy: { version: "desc" },
          include: { baseResume: { select: { name: true } } },
        },
        coverLetters: { orderBy: { version: "desc" } },
        activities: { orderBy: { createdAt: "desc" } },
      },
    });

    if (!application) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(application);
  } catch (err) {
    console.error("Get application error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.application.findFirst({
      where: { id, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    const application = await prisma.application.update({
      where: { id },
      data: body,
    });

    if (body.status && body.status !== existing.status) {
      await prisma.activity.create({
        data: {
          applicationId: id,
          type: "status_change",
          description: `Status changed from ${existing.status} to ${body.status}`,
          metadata: JSON.stringify({
            from: existing.status,
            to: body.status,
          }),
        },
      });
    }

    return NextResponse.json(application);
  } catch (err) {
    console.error("Update application error:", err);
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
    const existing = await prisma.application.findFirst({
      where: { id, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    await prisma.application.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete application error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
