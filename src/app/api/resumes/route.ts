import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { uploadResume, validateResumeFile, validateFileBuffer } from "@/lib/supabase";

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const resumes = await prisma.baseResume.findMany({
      where: { userId: userId! },
      orderBy: { updatedAt: "desc" },
      include: {
        resumeVersions: {
          select: {
            id: true,
            applicationId: true,
            application: { select: { jobTitle: true, company: true } },
          },
        },
      },
    });

    return NextResponse.json(resumes);
  } catch (err) {
    console.error("Get resumes error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const formData = await req.formData();
    const name = (formData.get("name") as string)?.trim();
    const roleCategory = (formData.get("roleCategory") as string)?.trim() || null;
    const file = formData.get("file") as File | null;

    if (!name) {
      return NextResponse.json(
        { error: "Resume name is required" },
        { status: 400 }
      );
    }

    if (name.length > 100) {
      return NextResponse.json(
        { error: "Resume name must be 100 characters or fewer" },
        { status: 400 }
      );
    }

    if (!file || file.size === 0) {
      return NextResponse.json(
        { error: "A file is required" },
        { status: 400 }
      );
    }

    const validation = validateResumeFile({
      name: file.name,
      size: file.size,
      type: file.type,
    });

    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    const fileType = ext === ".pdf" ? "pdf" : "docx";
    const contentType =
      fileType === "pdf"
        ? "application/pdf"
        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (!validateFileBuffer(buffer, ext)) {
      return NextResponse.json(
        { error: "File content does not match its extension. Please upload a valid PDF or DOCX." },
        { status: 400 }
      );
    }

    let storagePath: string;

    try {
      const result = await uploadResume(userId!, file.name, buffer, contentType);
      storagePath = result.path;
    } catch (uploadErr) {
      console.error("Supabase upload failed:", uploadErr);
      return NextResponse.json(
        { error: "File upload failed. Please check your Supabase configuration and try again." },
        { status: 502 }
      );
    }

    const resume = await prisma.baseResume.create({
      data: {
        userId: userId!,
        name,
        fileName: file.name,
        fileUrl: storagePath, // store the path, not the public URL
        fileType,
        roleCategory,
      },
    });

    return NextResponse.json(resume, { status: 201 });
  } catch (err) {
    console.error("Create resume error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
