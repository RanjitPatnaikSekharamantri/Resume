import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import {
  parseDocx,
  enhanceSections,
  sectionsToText,
  extractJdKeywords,
  type SectionKind,
  type ResumeSection,
} from "@/lib/docx-engine";

/**
 * NOTE on AI provider usage:
 *
 * This route currently runs the deterministic, built-in enhancement engine
 * from `src/lib/docx-engine.ts`. That engine performs keyword-weighted
 * section rewriting locally and does NOT call any external LLM.
 *
 * If the user has configured an active AI provider (OpenAI / Anthropic /
 * etc) under Settings > AI Providers, that fact is reported back to the
 * client so the UI can label the result honestly ("Enhanced using built-in
 * engine" vs "Enhanced using <provider>"). Full end-to-end provider-based
 * rewriting is not implemented here — adding it requires a prompt template
 * + streaming JSON parser per provider, which is tracked separately.
 */

const VALID_SECTION_KINDS = new Set<SectionKind>([
  "summary",
  "skills",
  "experience",
  "projects",
]);

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { resumeId, jobDescription, role, company, sectionsToEnhance, rules } = body;

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
      rules: rules || {},
    });

    // Build preview text
    const previewText = sectionsToText(enhanced.sections);

    // Detect whether a real AI provider is configured so the UI can label
    // the output honestly (built-in deterministic engine vs. external LLM).
    const activeProvider = await prisma.aIProvider.findFirst({
      where: { userId: userId!, isActive: true },
      select: { name: true, model: true },
    });

    // JD-derived keywords bolded inline at render time (DOCX/PDF).
    const emphasizeTokens = extractJdKeywords(jobDescription);

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
      emphasizeTokens,
      engine: {
        kind: "deterministic",
        label: "Built-in enhancement engine",
        providerConfigured: !!activeProvider,
        providerName: activeProvider?.name || null,
        providerModel: activeProvider?.model || null,
        note: activeProvider
          ? "An AI provider is configured but end-to-end LLM rewriting is not implemented; using the built-in deterministic engine."
          : "No AI provider configured; using the built-in deterministic engine.",
      },
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
