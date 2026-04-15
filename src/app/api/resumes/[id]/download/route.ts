import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";

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

    try {
      const signedUrl = await getSignedDownloadUrl(resume.fileUrl, 120);
      return NextResponse.json({ url: signedUrl, fileName: resume.fileName });
    } catch (err) {
      console.error("Download URL generation failed:", err);
      return NextResponse.json(
        { error: "Could not generate download link. Check storage configuration." },
        { status: 502 }
      );
    }
  } catch (err) {
    console.error("Download resume error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
