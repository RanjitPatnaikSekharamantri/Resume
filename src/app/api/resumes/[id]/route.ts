import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { deleteResume, getSignedDownloadUrl } from "@/lib/supabase";

const ALLOWED_PATCH_FIELDS = new Set(["name", "roleCategory"]);

export async function GET(
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

    return NextResponse.json(resume);
  } catch (err) {
    console.error("Get resume error:", err);
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

    // Whitelist fields
    const updateData: Record<string, string | null> = {};
    for (const [key, value] of Object.entries(body)) {
      if (!ALLOWED_PATCH_FIELDS.has(key)) continue;
      if (key === "name") {
        const trimmed = String(value ?? "").trim();
        if (!trimmed || trimmed.length > 100) {
          return NextResponse.json(
            { error: "Name must be between 1 and 100 characters" },
            { status: 400 }
          );
        }
        updateData.name = trimmed;
      } else if (key === "roleCategory") {
        updateData.roleCategory = value ? String(value).trim().slice(0, 100) : null;
      }
    }

    if (Object.keys(updateData).length === 0) {
      return NextResponse.json(
        { error: "No valid fields to update" },
        { status: 400 }
      );
    }

    const updated = await prisma.baseResume.update({
      where: { id },
      data: updateData,
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

    // Delete from Supabase storage
    try {
      await deleteResume(resume.fileUrl);
    } catch (storageErr) {
      console.error("Supabase storage delete failed (continuing):", storageErr);
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
