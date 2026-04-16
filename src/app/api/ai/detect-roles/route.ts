import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import { parseDocx } from "@/lib/docx-engine";
import {
  detectTargetRoleFromJd,
  extractCurrentHeaderRole,
  extractCurrentExperienceRoles,
  suggestExperienceAlignment,
} from "@/lib/role-alignment";

/**
 * POST /api/ai/detect-roles
 *
 * Used by the wizard's "Role Alignment" step.
 *
 * Body: { resumeId, jobDescription, applicationJobTitle }
 *
 * Returns:
 *   header: {
 *     current,            // current header role (from base resume)
 *     targetSuggested,    // suggested replacement
 *     variants,           // alternative variants in the same family
 *     reason
 *   }
 *   experience: [
 *     { index, originalTitle, suggestedTitle, preservedSuffix, reason }
 *   ]
 */
export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { resumeId, jobDescription, applicationJobTitle } = body;

    if (!resumeId) {
      return NextResponse.json({ error: "Resume ID is required" }, { status: 400 });
    }
    if (!jobDescription) {
      return NextResponse.json({ error: "Job description is required" }, { status: 400 });
    }

    const resume = await prisma.baseResume.findFirst({
      where: { id: resumeId, userId: userId! },
    });
    if (!resume) {
      return NextResponse.json({ error: "Resume not found" }, { status: 404 });
    }
    if (resume.fileType !== "docx") {
      return NextResponse.json(
        { error: "Only DOCX resumes can be analyzed for role alignment." },
        { status: 400 }
      );
    }

    let parsedResume;
    try {
      const url = await getSignedDownloadUrl(resume.fileUrl, 60);
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const arrayBuf = await response.arrayBuffer();
      const buffer = Buffer.from(arrayBuf);
      parsedResume = await parseDocx(buffer);
    } catch (err) {
      console.error("detect-roles: failed to load resume:", err);
      return NextResponse.json(
        { error: "Could not parse the base resume." },
        { status: 502 }
      );
    }

    const target = detectTargetRoleFromJd({
      jobDescription,
      applicationJobTitle: applicationJobTitle || "",
    });

    const currentHeader = extractCurrentHeaderRole(parsedResume);
    const experience = suggestExperienceAlignment(
      extractCurrentExperienceRoles(parsedResume),
      target
    );

    return NextResponse.json({
      header: {
        current: currentHeader,
        targetSuggested: target.suggested,
        variants: target.variants,
        family: target.family,
        seniority: target.seniority,
        reason: target.reason,
      },
      experience: experience.map((e) => ({
        index: e.index,
        originalTitle: e.originalTitle,
        suggestedTitle: e.suggestedTitle,
        preservedSuffix: e.preservedSuffix,
        reason: e.reason,
      })),
    });
  } catch (err) {
    console.error("detect-roles error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
