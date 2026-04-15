import mammoth from "mammoth";

export function normalizeWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}

export async function extractDocxText(buffer: Buffer): Promise<string> {
  const result = await mammoth.extractRawText({ buffer });
  return normalizeWhitespace(result.value ?? "");
}

export function extractPdfTextFallback(fileName: string): string {
  return `PDF parsing placeholder for ${fileName}. Connect a parser such as pdf-parse for full extraction.`;
}

export async function extractTextFromResume(buffer: Buffer, mimeType: string) {
  if (mimeType.includes("officedocument") || mimeType.includes("word")) {
    return extractDocxText(buffer);
  }

  if (mimeType.includes("pdf")) {
    return extractPdfTextFallback("resume.pdf");
  }

  return "";
}

export const parseResumeText = extractTextFromResume;
