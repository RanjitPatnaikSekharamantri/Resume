import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { jobDescription, role, company, baseResumeId, type } = body;

    if (!jobDescription || !role || !company) {
      return NextResponse.json(
        { error: "Job description, role, and company are required" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: session.user.id },
      include: { user: { select: { name: true, email: true } } },
    });

    let resumeContent = "";
    if (baseResumeId) {
      const resume = await prisma.baseResume.findFirst({
        where: { id: baseResumeId, userId: session.user.id },
      });
      if (resume) {
        resumeContent = `Resume: ${resume.name} (${resume.roleCategory || "General"})`;
      }
    }

    if (type === "resume") {
      const tailoredResume = generateTailoredResume(
        resumeContent,
        jobDescription,
        role,
        company,
        profile
      );
      return NextResponse.json({ content: tailoredResume, type: "resume" });
    }

    if (type === "cover_letter") {
      const coverLetter = generateCoverLetter(
        resumeContent,
        jobDescription,
        role,
        company,
        profile
      );
      return NextResponse.json({ content: coverLetter, type: "cover_letter" });
    }

    const tailoredResume = generateTailoredResume(
      resumeContent,
      jobDescription,
      role,
      company,
      profile
    );
    const coverLetter = generateCoverLetter(
      resumeContent,
      jobDescription,
      role,
      company,
      profile
    );

    return NextResponse.json({
      resume: tailoredResume,
      coverLetter,
      type: "both",
    });
  } catch (error) {
    console.error("AI generate error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

function generateTailoredResume(
  resumeContent: string,
  jobDescription: string,
  role: string,
  company: string,
  profile: unknown
): string {
  const p = profile as { user?: { name?: string; email?: string }; phone?: string; location?: string; linkedIn?: string; summary?: string } | null;
  const name = p?.user?.name || "Professional";
  const email = p?.user?.email || "";
  const phone = p?.phone || "";
  const location = p?.location || "";
  const linkedIn = p?.linkedIn || "";

  const keywords = extractKeywords(jobDescription);

  return `${name}
${[email, phone, location, linkedIn].filter(Boolean).join(" | ")}

PROFESSIONAL SUMMARY
Results-driven professional with extensive experience aligned with ${role} requirements at ${company}. ${p?.summary || `Proven track record in ${keywords.slice(0, 3).join(", ")}, with a strong focus on delivering measurable outcomes.`}

CORE COMPETENCIES
${keywords.slice(0, 8).map((k) => `• ${k}`).join("\n")}

PROFESSIONAL EXPERIENCE
[Preserved from base resume - enhanced bullet points targeting ${role} at ${company}]
• Led initiatives resulting in significant improvements aligned with ${company}'s mission
• Implemented solutions leveraging ${keywords.slice(0, 2).join(" and ")} expertise
• Collaborated with cross-functional teams to deliver projects on time and within scope
• Achieved measurable results demonstrating expertise in ${keywords.slice(2, 4).join(" and ")}

EDUCATION
[Preserved from base resume]

CERTIFICATIONS
[Preserved from base resume]`;
}

function generateCoverLetter(
  _resumeContent: string,
  jobDescription: string,
  role: string,
  company: string,
  profile: unknown
): string {
  const p = profile as { user?: { name?: string }; location?: string } | null;
  const name = p?.user?.name || "Professional";
  const keywords = extractKeywords(jobDescription);

  return `Dear Hiring Manager,

I am writing to express my strong interest in the ${role} position at ${company}. With my background in ${keywords.slice(0, 3).join(", ")}, I am confident in my ability to make meaningful contributions to your team.

Throughout my career, I have developed deep expertise in ${keywords.slice(0, 2).join(" and ")}, which directly aligns with the requirements outlined in your job description. I am particularly drawn to ${company}'s commitment to innovation and excellence.

Key qualifications I bring include:
${keywords.slice(0, 4).map((k) => `• Strong expertise in ${k}`).join("\n")}

I am excited about the opportunity to bring my skills and experience to ${company} and contribute to your continued success. I would welcome the opportunity to discuss how my background aligns with your team's needs.

Thank you for considering my application. I look forward to speaking with you.

Best regards,
${name}
${p?.location || ""}`;
}

function extractKeywords(text: string): string[] {
  const commonWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "dare", "ought", "used", "this", "that", "these", "those", "we",
    "you", "they", "it", "he", "she", "our", "your", "their", "its",
    "my", "his", "her", "as", "if", "not", "no", "all", "each",
    "every", "both", "few", "more", "most", "other", "some", "such",
    "than", "too", "very", "just", "about", "above", "also", "who",
    "which", "what", "when", "where", "how", "why", "into", "through",
    "during", "before", "after", "between", "under", "over",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !commonWords.has(w));

  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
    .map(([word]) => word.charAt(0).toUpperCase() + word.slice(1));
}
