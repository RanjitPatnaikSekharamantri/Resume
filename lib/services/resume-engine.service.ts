import JSZip from "jszip";

import { normalizeWhitespace } from "@/lib/services/resume-parser.service";

export type ResumeTailorInput = {
  resumeText: string;
  jobDescription: string;
  role: string;
  company: string;
  profileSummary?: string | null;
};

function topKeywords(text: string, limit = 12): string[] {
  const stopWords = new Set([
    "the",
    "and",
    "for",
    "with",
    "that",
    "this",
    "you",
    "your",
    "from",
    "have",
    "will",
    "are",
    "our",
    "job",
    "role",
    "team",
    "years",
    "experience",
    "work",
    "required",
  ]);

  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([word]) => word);
}

function toSentences(text: string) {
  return text
    .replace(/\r\n/g, "\n")
    .split(/[.!?]\s+/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function updateSummary(input: ResumeTailorInput): string {
  const jdKeywords = topKeywords(input.jobDescription, 8);
  const keywordSnippet =
    jdKeywords.length > 0
      ? jdKeywords.slice(0, 5).join(", ")
      : "cross-functional delivery";

  const base = input.profileSummary?.trim()
    ? input.profileSummary.trim()
    : `Results-driven ${input.role} professional focused on measurable outcomes.`;

  return `${base} Recent focus areas aligned to ${input.company}: ${keywordSnippet}.`;
}

function updateSkills(input: ResumeTailorInput): string {
  const jdKeywords = topKeywords(input.jobDescription, 16);
  return jdKeywords
    .slice(0, 10)
    .map((k) => `${k[0]?.toUpperCase()}${k.slice(1)}`)
    .join(", ");
}

function updateRecentBullets(input: ResumeTailorInput): string[] {
  const sentences = toSentences(input.resumeText);
  const primaryFocus = topKeywords(input.jobDescription, 1)[0] ?? "execution";

  return sentences.slice(0, 4).map((sentence) => {
    const bullet = sentence.startsWith("-") ? sentence : `- ${sentence}`;
    return `${bullet} Emphasized ${primaryFocus} impact while keeping original companies, dates, and certifications unchanged.`;
  });
}

export function tailorResumeText(input: ResumeTailorInput) {
  const summary = updateSummary(input);
  const skills = updateSkills(input);
  const bullets = updateRecentBullets(input);

  return normalizeWhitespace(
    [
      "SUMMARY",
      summary,
      "",
      "SKILLS",
      skills,
      "",
      "RECENT EXPERIENCE HIGHLIGHTS",
      ...bullets,
    ].join("\n"),
  );
}

function escapeXml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export async function tailorDocxBuffer(
  docxBuffer: Buffer,
  replacementText: string,
): Promise<Buffer> {
  const zip = await JSZip.loadAsync(docxBuffer);
  const documentXmlPath = "word/document.xml";
  const originalXml = await zip.file(documentXmlPath)?.async("string");

  if (!originalXml) {
    throw new Error("Unsupported DOCX structure.");
  }

  const bodyMatch = originalXml.match(/<w:body>[\s\S]*<\/w:body>/);
  if (!bodyMatch) {
    throw new Error("Unable to locate DOCX body.");
  }

  const sectionPropsMatch = bodyMatch[0].match(/<w:sectPr[\s\S]*<\/w:sectPr>/);
  const sectionProps = sectionPropsMatch?.[0] ?? "<w:sectPr/>";

  // Replace only text blocks while preserving section/page properties.
  const paragraphs = replacementText
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map(
      (line) =>
        `<w:p><w:r><w:t xml:space="preserve">${escapeXml(line)}</w:t></w:r></w:p>`,
    )
    .join("");

  const replaced = originalXml.replace(
    /<w:body>[\s\S]*<\/w:body>/,
    `<w:body>${paragraphs}${sectionProps}</w:body>`,
  );

  zip.file(documentXmlPath, replaced);
  return Buffer.from(await zip.generateAsync({ type: "nodebuffer" }));
}
