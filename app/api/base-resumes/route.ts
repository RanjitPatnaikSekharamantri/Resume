import { ZodError } from "zod";

import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import {
  badRequest,
  errorResponse,
  successResponse,
  unauthorized,
} from "@/lib/http";
import { extractTextFromResume } from "@/lib/services/resume-parser.service";
import { uploadUserDocument } from "@/lib/services/storage.service";

export async function GET() {
  try {
    const user = await requireUser();
    const resumes = await prisma.baseResume.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    return successResponse(resumes);
  } catch (error) {
    if (error instanceof ZodError) {
      return badRequest("Invalid request.", error.flatten());
    }

    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUser();
    const formData = await request.formData();
    const file = formData.get("file");
    const roleCategory = String(formData.get("roleCategory") ?? "").trim();

    if (!(file instanceof File)) {
      return errorResponse("A resume file is required.", 400);
    }

    if (!roleCategory) {
      return errorResponse("Role category is required.", 400);
    }

    const mimeType = file.type || "application/octet-stream";
    if (
      mimeType !==
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document" &&
      mimeType !== "application/pdf"
    ) {
      return errorResponse("Only DOCX and PDF resumes are supported.", 400);
    }

    const arrayBuffer = await file.arrayBuffer();
    const parsedText = await extractTextFromResume(Buffer.from(arrayBuffer), mimeType);
    const storagePath = await uploadUserDocument({
      userId: user.id,
      category: "base-resumes",
      fileName: file.name,
      file,
      contentType: mimeType,
    });

    const resume = await prisma.baseResume.create({
      data: {
        userId: user.id,
        roleCategory,
        fileName: file.name,
        mimeType,
        storagePath,
        parsedText,
      },
    });

    return successResponse(resume, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Unauthorized") {
      return unauthorized();
    }

    if (error instanceof ZodError) {
      return badRequest("Invalid request.", error.flatten());
    }

    return errorResponse(error);
  }
}
