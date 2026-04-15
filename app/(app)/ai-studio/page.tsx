import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { AIStudioForm } from "@/components/ai/ai-studio-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AIStudioPage() {
  const user = await requireUser();
  const resumes = await prisma.baseResume.findMany({
    where: { userId: user.id },
    select: { id: true, fileName: true, roleCategory: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          AI Studio
        </h1>
        <p className="text-sm text-zinc-500">
          Generate tailored resume content and cover letters from a job description.
        </p>
      </div>

      <AIStudioForm resumes={resumes} />

      <Card className="border border-zinc-200 bg-white">
        <CardHeader>
          <CardTitle className="text-base text-zinc-900">
            Resume engine guardrails
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600">
          <ul className="list-disc space-y-2 pl-4">
            <li>Preserves document layout and section structure for DOCX inputs.</li>
            <li>
              Edits only summary, skills, and recent-role bullets while preserving names,
              dates, and certifications.
            </li>
            <li>Maintains original tone with role-specific keyword emphasis.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
