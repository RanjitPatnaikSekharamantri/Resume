import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/encryption";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const { id } = await params;
    const body = await req.json();

    const existing = await prisma.aIProvider.findFirst({
      where: { id, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    const data: Record<string, unknown> = {};
    if (body.name !== undefined) data.name = String(body.name).trim().slice(0, 100);
    if (body.model !== undefined) data.model = body.model ? String(body.model).trim().slice(0, 100) : null;
    if (body.isActive !== undefined) data.isActive = !!body.isActive;
    if (body.apiKey && typeof body.apiKey === "string" && body.apiKey.length > 0) {
      data.apiKey = encrypt(body.apiKey);
    }

    const updated = await prisma.aIProvider.update({ where: { id }, data });

    return NextResponse.json({
      id: updated.id,
      name: updated.name,
      model: updated.model,
      isActive: updated.isActive,
    });
  } catch (err) {
    console.error("Update provider error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
    const existing = await prisma.aIProvider.findFirst({
      where: { id, userId: userId! },
    });

    if (!existing) {
      return NextResponse.json({ error: "Provider not found" }, { status: 404 });
    }

    await prisma.aIProvider.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Delete provider error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
