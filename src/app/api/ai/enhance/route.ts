import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import {
  parseDocx,
  enhanceSections,
  sectionsToText,
  type SectionKind,
  type ResumeSection,
} from "@/lib/docx-engine";

const VALID_SECTION_KINDS = new Set<SectionKind>([
  "summary",
  "skills",
  "experience",
]);

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { resumeId, jobDescription, role, company, sectionsToEnhance } = body;

    if (!resumeId) {
      return NextResponse.json(
        { error: "Resume ID is required" },
        { status: 400 }
      );
    }
    if (!jobDescription || !role || !company) {
      return NextResponse.json(
        { error: "Job description, role, and company are required" },
        { status: 400 }
      );
    }

    const resume = await prisma.baseResume.findFirst({
      where: { id: resumeId, userId: userId! },
    });

    if (!resume) {
      return NextResponse.json(
        { error: "Resume not found" },
        { status: 404 }
      );
    }

    if (resume.fileType !== "docx") {
      return NextResponse.json(
        { error: "Only DOCX files can be enhanced. PDF parsing is not supported yet." },
        { status: 400 }
      );
    }

    // Fetch the file from Supabase
    let fileBuffer: Buffer;
    try {
      const url = await getSignedDownloadUrl(resume.fileUrl, 60);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuf = await response.arrayBuffer();
      fileBuffer = Buffer.from(arrayBuf);
    } catch (fetchErr) {
      console.error("Failed to fetch resume from storage:", fetchErr);
      return NextResponse.json(
        { error: "Could not fetch resume file. Check storage configuration." },
        { status: 502 }
      );
    }

    // Parse
    const parsed = await parseDocx(fileBuffer);

    // Validate requested sections
    const validSections: SectionKind[] = (sectionsToEnhance || ["summary", "skills", "experience"])
      .filter((s: string) => VALID_SECTION_KINDS.has(s as SectionKind)) as SectionKind[];

    // Enhance
    const enhanced = enhanceSections(parsed, {
      jobDescription: jobDescription.trim(),
      role: role.trim(),
      company: company.trim(),
      sectionsToEnhance: validSections,
    });

    // Build preview text
    const previewText = sectionsToText(enhanced.sections);

    // Return parsed sections (original + enhanced) for preview
    return NextResponse.json({
      original: {
        sections: parsed.sections.map(sectionToJson),
        text: sectionsToText(parsed.sections),
      },
      enhanced: {
        sections: enhanced.sections.map(sectionToJson),
        text: previewText,
      },
      resumeName: resume.name,
      fileName: resume.fileName,
    });
  } catch (err) {
    console.error("Enhance error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function sectionToJson(s: ResumeSection) {
  return {
    kind: s.kind,
    title: s.title,
    lines: s.lines,
    modifiable: s.modifiable,
  };
}
