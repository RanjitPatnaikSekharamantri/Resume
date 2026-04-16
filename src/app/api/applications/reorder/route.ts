import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { APPLICATION_STATUSES, getStatusLabel } from "@/lib/utils";

export async function PATCH(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { applicationId, newStatus, newOrder } = body;

    if (!applicationId || typeof applicationId !== "string") {
      return NextResponse.json(
        { error: "applicationId is required" },
        { status: 400 }
      );
    }

    if (
      !newStatus ||
      !APPLICATION_STATUSES.includes(
        newStatus as (typeof APPLICATION_STATUSES)[number]
      )
    ) {
      return NextResponse.json(
        { error: `Invalid status: ${newStatus}` },
        { status: 400 }
      );
    }

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    if (existing.status === newStatus) {
      return NextResponse.json({ success: true, changed: false });
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        order: typeof newOrder === "number" ? newOrder : existing.order,
      },
    });

    await prisma.activity.create({
      data: {
        applicationId,
        type: "status_change",
        description: `Moved to ${getStatusLabel(newStatus)}`,
        metadata: JSON.stringify({
          from: existing.status,
          to: newStatus,
        }),
      },
    });

    return NextResponse.json({ success: true, changed: true });
  } catch (err) {
    console.error("Reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
