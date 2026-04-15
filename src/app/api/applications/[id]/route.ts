import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { APPLICATION_STATUSES } from "@/lib/utils";

const ALLOWED_FIELDS = new Set([
  "jobTitle",
  "company",
  "location",
  "salary",
  "postedDate",
  "jobDescription",
  "jobUrl",
  "source",
  "notes",
  "status",
  "matchScore",
  "order",
]);

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
          include: { baseResume: { select: { id: true, name: true } } },
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

    // Whitelist and sanitize
    const data: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_FIELDS.has(key)) continue;

      if (key === "status") {
        if (!APPLICATION_STATUSES.includes(value as (typeof APPLICATION_STATUSES)[number])) {
          return NextResponse.json(
            { error: `Invalid status: ${value}` },
            { status: 400 }
          );
        }
        data.status = value;
      } else if (key === "postedDate") {
        data.postedDate = value ? new Date(value as string) : null;
      } else if (key === "matchScore" || key === "order") {
        data[key] = value != null ? Number(value) : null;
      } else {
        data[key] = value != null ? String(value).slice(0, key === "jobDescription" || key === "notes" ? 10000 : 500) : null;
      }
    }

    if (Object.keys(data).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const application = await prisma.application.update({
      where: { id },
      data,
    });

    if (data.status && data.status !== existing.status) {
      await prisma.activity.create({
        data: {
          applicationId: id,
          type: "status_change",
          description: `Status changed to ${data.status}`,
          metadata: JSON.stringify({
            from: existing.status,
            to: data.status,
          }),
        },
      });
    }

    if (data.notes !== undefined && data.notes !== existing.notes) {
      await prisma.activity.create({
        data: {
          applicationId: id,
          type: "notes_updated",
          description: "Notes updated",
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
