import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const resumes = await prisma.baseResume.findMany({
      where: { userId: userId! },
      orderBy: { updatedAt: "desc" },
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
    const name = formData.get("name") as string;
    const roleCategory = formData.get("roleCategory") as string;
    const file = formData.get("file") as File;

    if (!name || !file) {
      return NextResponse.json(
        { error: "Name and file are required" },
        { status: 400 }
      );
    }

    const fileType = file.name.endsWith(".pdf") ? "pdf" : "docx";
    const fileUrl = `/uploads/${userId}/${Date.now()}-${file.name}`;

    const resume = await prisma.baseResume.create({
      data: {
        userId: userId!,
        name,
        fileName: file.name,
        fileUrl,
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
