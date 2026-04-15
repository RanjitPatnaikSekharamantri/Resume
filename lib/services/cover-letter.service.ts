export type CoverLetterInput = {
  candidateName: string;
  role: string;
  company: string;
  jobDescription: string;
  profileSummary?: string | null;
  resumeText?: string;
  keySkills?: string[];
};

function firstSentence(text: string): string {
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (!cleaned) return "";

  const parts = cleaned.split(/(?<=[.!?])\s+/);
  return parts[0] ?? cleaned;
}

export function generateCoverLetter(input: CoverLetterInput): string {
  const hook = firstSentence(input.jobDescription);
  const skills = (input.keySkills ?? []).slice(0, 6).join(", ");

  return [
    `Dear Hiring Team at ${input.company},`,
    "",
    `I am excited to apply for the ${input.role} position. ${
      input.profileSummary?.trim() ||
      "I bring a strong track record of delivering high-quality outcomes in fast-moving environments."
    }`,
    "",
    hook
      ? `What stood out to me in your posting was this focus: "${hook}" This aligns with my recent work driving measurable impact through cross-functional execution and thoughtful communication.`
      : "Your role aligns with my experience delivering strategic initiatives, improving systems, and partnering across teams to ship meaningful results.",
    "",
    skills
      ? `My recent work has included hands-on execution across: ${skills}. I take a practical, ownership-driven approach and prioritize work that delivers clear business value.`
      : "I take a practical, ownership-driven approach and prioritize work that delivers clear business value while maintaining a high bar for quality.",
    "",
    `I would welcome the opportunity to discuss how my experience can support ${input.company}'s goals in this role.`,
    "",
    "Sincerely,",
    input.candidateName,
  ].join("\n");
}
