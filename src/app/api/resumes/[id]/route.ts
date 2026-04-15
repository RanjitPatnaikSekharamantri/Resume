import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;
    const resume = await prisma.baseResume.findFirst({
      where: { id, userId: userId! },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    await prisma.baseResume.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete resume error:", err);
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

    const resume = await prisma.baseResume.findFirst({
      where: { id, userId: userId! },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    const updated = await prisma.baseResume.update({
      where: { id },
      data: body,
    });

    return NextResponse.json(updated);
  } catch (err) {
    console.error("Update resume error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
