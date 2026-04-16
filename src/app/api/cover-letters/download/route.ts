import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { buildPdf } from "@/lib/pdf-engine";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  AlignmentType,
} from "docx";

export async function POST(req: Request) {
  try {
    const { error } = await authenticateRequest();
    if (error) return error;

    const { content, fileName, format } = await req.json();

    if (!content || typeof content !== "string") {
      return NextResponse.json({ error: "Content is required" }, { status: 400 });
    }

    const baseName = fileName || "cover_letter";

    if (format === "pdf") {
      const pdfBuffer = await buildPdf(content, baseName);
      return new NextResponse(new Uint8Array(pdfBuffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${baseName}.pdf"`,
        },
      });
    }

    // DOCX
    const paragraphs = content.split("\n").map((line: string) => {
      const trimmed = line.trim();
      if (!trimmed) return new Paragraph({ children: [] });
      return new Paragraph({
        children: [
          new TextRun({
            text: trimmed,
            size: 22,
            font: "Calibri",
          }),
        ],
        spacing: { after: 80 },
      });
    });

    const doc = new Document({
      sections: [{
        properties: { page: { margin: { top: 720, right: 720, bottom: 720, left: 720 } } },
        children: paragraphs,
      }],
    });

    const docxBuffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${baseName}.docx"`,
      },
    });
  } catch (err) {
    console.error("Cover letter download error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
