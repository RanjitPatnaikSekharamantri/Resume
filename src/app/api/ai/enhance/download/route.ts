import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import {
  buildDocx,
  type ResumeSection,
} from "@/lib/docx-engine";

export async function POST(req: Request) {
  try {
    const { error } = await authenticateRequest();
    if (error) return error;

    const body = await req.json();
    const { sections, fileName, format } = body;

    if (!sections || !Array.isArray(sections)) {
      return NextResponse.json(
        { error: "Sections data is required" },
        { status: 400 }
      );
    }

    const resumeSections: ResumeSection[] = sections.map(
      (s: { kind: string; title: string; lines: string[]; modifiable: boolean }) => ({
        kind: s.kind as ResumeSection["kind"],
        title: s.title,
        lines: s.lines,
        modifiable: s.modifiable,
      })
    );

    const baseName = fileName
      ? fileName.replace(/\.(docx|pdf)$/i, "")
      : "enhanced_resume";

    if (format === "pdf") {
      const { buildPdf } = await import("@/lib/pdf-engine");
      const text = resumeSections
        .map((s) => {
          const parts: string[] = [];
          if (s.kind !== "header" && s.title) parts.push(s.title.toUpperCase());
          parts.push(...s.lines);
          return parts.join("\n");
        })
        .join("\n\n");

      const pdfBuffer = await buildPdf(text, `${baseName}_enhanced`);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}_enhanced.pdf"`,
          "Content-Length": String(pdfBuffer.length),
        },
      });
    }

    // Default: DOCX
    const docxBuffer = await buildDocx({
      sections: resumeSections,
      rawText: "",
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}_enhanced.docx"`,
        "Content-Length": String(docxBuffer.length),
      },
    });
  } catch (err) {
    console.error("Download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
