import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { applicationId, newStatus, newOrder } = body;

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json(
        { error: "Application not found" },
        { status: 404 }
      );
    }

    await prisma.application.update({
      where: { id: applicationId },
      data: {
        status: newStatus,
        order: newOrder,
      },
    });

    if (newStatus !== existing.status) {
      await prisma.activity.create({
        data: {
          applicationId,
          type: "status_change",
          description: `Status changed from ${existing.status} to ${newStatus}`,
          metadata: JSON.stringify({
            from: existing.status,
            to: newStatus,
          }),
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Reorder error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
