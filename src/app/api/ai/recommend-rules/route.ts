import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import { getSignedDownloadUrl } from "@/lib/supabase";
import { parseDocx, sectionsToText } from "@/lib/docx-engine";
import { calculateAtsScore } from "@/lib/ats-scoring";
import { recommendRules } from "@/lib/rule-recommender";

/**
 * POST /api/ai/recommend-rules
 *
 * Given an application's job description + a base resume ID, returns
 * recommended enhancement rules along with a current match-score breakdown.
 *
 * Used by the Enhance flow to pre-populate rule defaults before the user
 * runs enhancement.
 */
export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { resumeId, jobDescription, resumeText: providedText } = body;

    if (!jobDescription) {
      return NextResponse.json(
        { error: "Job description is required" },
        { status: 400 }
      );
    }

    let resumeText = providedText || "";

    if (!resumeText && resumeId) {
      const resume = await prisma.baseResume.findFirst({
        where: { id: resumeId, userId: userId! },
      });
      if (resume && resume.fileType === "docx") {
        try {
          const url = await getSignedDownloadUrl(resume.fileUrl, 60);
          const response = await fetch(url);
          if (response.ok) {
            const arrayBuf = await response.arrayBuffer();
            const buf = Buffer.from(arrayBuf);
            const parsed = await parseDocx(buf);
            resumeText = sectionsToText(parsed.sections);
          }
        } catch (err) {
          console.error("Recommend-rules: failed to load resume text:", err);
        }
      }
      if (!resumeText && resume) {
        resumeText = `${resume.name} ${resume.roleCategory || ""}`;
      }
    }

    if (!resumeText) {
      // Fall back to profile summary
      const prof = await prisma.profile.findUnique({
        where: { userId: userId! },
        include: { user: { select: { name: true } } },
      });
      resumeText = [prof?.summary, prof?.preferredRole, prof?.user?.name]
        .filter(Boolean)
        .join(" ");
    }

    const ats = resumeText
      ? calculateAtsScore({ jobDescription, resumeText })
      : null;

    const legacyScore = ats
      ? {
          overallScore: ats.overall,
          skillsMatch: ats.legacyBreakdown.skillsMatch,
          experienceMatch: ats.legacyBreakdown.experienceMatch,
          keywordCoverage: ats.legacyBreakdown.keywordCoverage,
          domainMatch: ats.legacyBreakdown.domainMatch,
        }
      : null;

    const recommendation = recommendRules({
      jobDescription,
      resumeText,
      score: legacyScore,
    });

    return NextResponse.json({ score: legacyScore, ats, recommendation });
  } catch (err) {
    console.error("Recommend rules error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
