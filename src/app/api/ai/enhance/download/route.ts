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
    const { sections, fileName } = body;

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

    const docxBuffer = await buildDocx({
      sections: resumeSections,
      rawText: "",
    });

    const outputName = fileName
      ? fileName.replace(/\.docx$/i, "") + "_enhanced.docx"
      : "enhanced_resume.docx";

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${outputName}"`,
        "Content-Length": String(docxBuffer.length),
      },
    });
  } catch (err) {
    console.error("DOCX download error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
