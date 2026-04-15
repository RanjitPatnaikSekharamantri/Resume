import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { applicationId, newStatus, newOrder } = body;

    const existing = await prisma.application.findFirst({
      where: { id: applicationId, userId: session.user.id },
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
  } catch (error) {
    console.error("Reorder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
