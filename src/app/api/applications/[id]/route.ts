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
  "skillsMatch",
  "experienceMatch",
  "keywordCoverage",
  "domainMatch",
  "followUpDate",
  "reminderEnabled",
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
      } else if (key === "postedDate" || key === "followUpDate") {
        data[key] = value ? new Date(value as string) : null;
      } else if (key === "reminderEnabled") {
        data.reminderEnabled = !!value;
      } else if (["matchScore", "skillsMatch", "experienceMatch", "keywordCoverage", "domainMatch", "order"].includes(key)) {
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

    // Log other field edits
    const trackableFields = ["jobTitle", "company", "location", "salary", "jobUrl", "source", "jobDescription"];
    const editedFields = trackableFields.filter(
      (f) => data[f] !== undefined && data[f] !== (existing as Record<string, unknown>)[f]
    );
    if (editedFields.length > 0) {
      await prisma.activity.create({
        data: {
          applicationId: id,
          type: "fields_updated",
          description: `Updated ${editedFields.join(", ")}`,
        },
      });
    }

    if (data.followUpDate !== undefined) {
      await prisma.activity.create({
        data: {
          applicationId: id,
          type: "reminder_set",
          description: data.followUpDate
            ? `Follow-up set for ${new Date(data.followUpDate as Date).toLocaleDateString()}`
            : "Follow-up reminder cleared",
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
