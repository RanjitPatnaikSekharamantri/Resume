import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { jobDescription, role, company, baseResumeId, type } = body;

    if (!jobDescription || !role || !company) {
      return NextResponse.json(
        { error: "Job description, role, and company are required" },
        { status: 400 }
      );
    }

    if (jobDescription.length > 15000) {
      return NextResponse.json(
        { error: "Job description is too long (max 15,000 characters)" },
        { status: 400 }
      );
    }

    const profile = await prisma.profile.findUnique({
      where: { userId: userId! },
      include: { user: { select: { name: true, email: true } } },
    });

    let resumeName = "";
    let resumeCategory = "";
    if (baseResumeId) {
      const resume = await prisma.baseResume.findFirst({
        where: { id: baseResumeId, userId: userId! },
      });
      if (resume) {
        resumeName = resume.name;
        resumeCategory = resume.roleCategory || "";
      }
    }

    const ctx: GenerationContext = {
      name: profile?.user?.name || "Professional",
      email: profile?.user?.email || "",
      phone: profile?.phone || "",
      location: profile?.location || "",
      linkedIn: profile?.linkedIn || "",
      summary: profile?.summary || "",
      resumeName,
      resumeCategory,
      role: role.trim(),
      company: company.trim(),
      jobDescription: jobDescription.trim(),
    };

    if (type === "resume") {
      return NextResponse.json({
        content: generateTailoredResume(ctx),
        type: "resume",
      });
    }

    if (type === "cover_letter") {
      return NextResponse.json({
        content: generateCoverLetter(ctx),
        type: "cover_letter",
      });
    }

    return NextResponse.json({
      resume: generateTailoredResume(ctx),
      coverLetter: generateCoverLetter(ctx),
      type: "both",
    });
  } catch (err) {
    console.error("AI generate error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// ── types ──

interface GenerationContext {
  name: string;
  email: string;
  phone: string;
  location: string;
  linkedIn: string;
  summary: string;
  resumeName: string;
  resumeCategory: string;
  role: string;
  company: string;
  jobDescription: string;
}

// ── resume generator ──

function generateTailoredResume(ctx: GenerationContext): string {
  const keywords = extractKeywords(ctx.jobDescription);
  const skills = keywords.slice(0, 10);
  const contactParts = [ctx.email, ctx.phone, ctx.location, ctx.linkedIn].filter(Boolean);

  const summaryText =
    ctx.summary ||
    `Accomplished professional with a proven track record in ${skills.slice(0, 3).join(", ")}. Adept at solving complex challenges and driving results in fast-paced environments.`;

  const lines: string[] = [];

  // Header
  lines.push(ctx.name.toUpperCase());
  lines.push(contactParts.join("  ·  "));
  lines.push("");

  // Summary
  lines.push("━━━  PROFESSIONAL SUMMARY  ━━━");
  lines.push("");
  lines.push(
    `${summaryText} Seeking to leverage this expertise as a ${ctx.role} at ${ctx.company}, contributing to ${ctx.company}'s mission through ${skills.slice(0, 2).join(" and ")} capabilities.`
  );
  lines.push("");

  // Skills
  lines.push("━━━  CORE COMPETENCIES  ━━━");
  lines.push("");
  const skillRows: string[] = [];
  for (let i = 0; i < skills.length; i += 3) {
    skillRows.push(
      skills
        .slice(i, i + 3)
        .map((s) => s.padEnd(28))
        .join("")
    );
  }
  lines.push(...skillRows);
  lines.push("");

  // Experience
  lines.push("━━━  PROFESSIONAL EXPERIENCE  ━━━");
  lines.push("");
  lines.push(`[Most Recent Role — preserved from ${ctx.resumeName || "base resume"}]`);
  lines.push(`[Company Name]  ·  [Location]  ·  [Start Date] – Present`);
  lines.push("");
  lines.push(
    `  • Spearheaded ${skills[0]?.toLowerCase() || "cross-functional"} initiatives that directly align with ${ctx.company}'s ${ctx.role} requirements`
  );
  lines.push(
    `  • Delivered measurable improvements by applying ${skills[1]?.toLowerCase() || "technical"} and ${skills[2]?.toLowerCase() || "analytical"} methodologies`
  );
  lines.push(
    `  • Collaborated with stakeholders to define strategy leveraging expertise in ${skills[3]?.toLowerCase() || "problem-solving"}`
  );
  lines.push(
    `  • Mentored team members and drove adoption of ${skills[4]?.toLowerCase() || "best practices"} across the organization`
  );
  lines.push("");
  lines.push(`[Previous Role — preserved from ${ctx.resumeName || "base resume"}]`);
  lines.push(`[Company Name]  ·  [Location]  ·  [Start Date] – [End Date]`);
  lines.push("");
  lines.push(
    `  • Built and maintained systems utilizing ${skills[5]?.toLowerCase() || "modern tools"} in alignment with team objectives`
  );
  lines.push(
    `  • Contributed to projects requiring ${skills[6]?.toLowerCase() || "technical depth"} and ${skills[7]?.toLowerCase() || "creative problem-solving"}`
  );
  lines.push(
    `  • Recognized for consistent delivery and expertise in ${skills.slice(0, 2).join(" and ").toLowerCase()}`
  );
  lines.push("");

  // Education
  lines.push("━━━  EDUCATION  ━━━");
  lines.push("");
  lines.push("[Preserved from base resume — degree, institution, year]");
  lines.push("");

  // Certifications
  lines.push("━━━  CERTIFICATIONS  ━━━");
  lines.push("");
  lines.push("[Preserved from base resume — all certifications retained as-is]");

  return lines.join("\n");
}

// ── cover letter generator ──

function generateCoverLetter(ctx: GenerationContext): string {
  const keywords = extractKeywords(ctx.jobDescription);
  const topSkills = keywords.slice(0, 5);
  const today = new Date().toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  const lines: string[] = [];

  lines.push(ctx.name);
  if (ctx.location) lines.push(ctx.location);
  if (ctx.email) lines.push(ctx.email);
  if (ctx.phone) lines.push(ctx.phone);
  lines.push("");
  lines.push(today);
  lines.push("");
  lines.push("Hiring Manager");
  lines.push(ctx.company);
  lines.push("");
  lines.push(`Dear Hiring Manager,`);
  lines.push("");

  // Opening
  lines.push(
    `I am writing to express my enthusiastic interest in the ${ctx.role} position at ${ctx.company}. With extensive experience in ${topSkills.slice(0, 3).join(", ").toLowerCase()}, I am confident in my ability to make an immediate and meaningful impact on your team.`
  );
  lines.push("");

  // Body 1 — experience alignment
  lines.push(
    `Throughout my career, I have developed deep expertise in ${topSkills.slice(0, 2).join(" and ").toLowerCase()}, which directly aligns with the requirements outlined in your job description. ${
      ctx.summary
        ? ctx.summary.split(".")[0] + "."
        : `I bring a strong track record of delivering results in ${topSkills[2]?.toLowerCase() || "complex"} environments.`
    }`
  );
  lines.push("");

  // Body 2 — specific qualifications
  lines.push("Key qualifications I bring to this role include:");
  lines.push("");
  for (const skill of topSkills.slice(0, 4)) {
    lines.push(`  • Demonstrated expertise in ${skill.toLowerCase()} with measurable outcomes`);
  }
  lines.push("");

  // Body 3 — why this company
  lines.push(
    `I am particularly drawn to ${ctx.company}'s commitment to innovation and the opportunity to contribute to a team that values ${topSkills[3]?.toLowerCase() || "excellence"} and ${topSkills[4]?.toLowerCase() || "collaboration"}. I believe my background makes me a strong fit for this role.`
  );
  lines.push("");

  // Closing
  lines.push(
    `Thank you for considering my application. I would welcome the opportunity to discuss how my skills and experience align with ${ctx.company}'s needs for the ${ctx.role} position. I look forward to the possibility of contributing to your team.`
  );
  lines.push("");
  lines.push("Sincerely,");
  lines.push(ctx.name);

  return lines.join("\n");
}

// ── keyword extraction ──

function extractKeywords(text: string): string[] {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "must", "shall", "can", "need",
    "this", "that", "these", "those", "we", "you", "they", "it", "he",
    "she", "our", "your", "their", "its", "my", "his", "her", "as",
    "if", "not", "no", "all", "each", "every", "both", "few", "more",
    "most", "other", "some", "such", "than", "too", "very", "just",
    "about", "above", "also", "who", "which", "what", "when", "where",
    "how", "why", "into", "through", "during", "before", "after",
    "between", "under", "over", "work", "working", "role", "team",
    "ability", "experience", "strong", "including", "using", "used",
    "looking", "join", "position", "company", "well", "within", "based",
    "across", "plus", "years", "year", "responsible", "requirements",
  ]);

  const cleaned = text.toLowerCase().replace(/[^a-z\s-]/g, " ");
  const words = cleaned.split(/\s+/).filter((w) => w.length > 3 && !stopWords.has(w));

  // Count single word frequency
  const freq = new Map<string, number>();
  for (const w of words) {
    freq.set(w, (freq.get(w) || 0) + 1);
  }

  // Also extract common bigrams
  for (let i = 0; i < words.length - 1; i++) {
    const bigram = `${words[i]} ${words[i + 1]}`;
    if (words[i].length > 3 && words[i + 1].length > 3) {
      freq.set(bigram, (freq.get(bigram) || 0) + 2);
    }
  }

  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15)
    .map(([word]) =>
      word
        .split(" ")
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    );
}
