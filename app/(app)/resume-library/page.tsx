import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/auth/session";
import { ResumeUploadForm } from "@/components/resumes/resume-upload-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function ResumeLibraryPage() {
  const user = await requireUser();
  const resumes = await prisma.baseResume.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 40,
  });

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-zinc-950">
          Resume Library
        </h1>
        <p className="text-sm text-zinc-600">
          Upload and manage base resumes by role category. Files are stored in Supabase
          Storage.
        </p>
      </div>

      <ResumeUploadForm />

      <Card>
        <CardHeader>
          <CardTitle>Uploaded resumes</CardTitle>
          <CardDescription>Each resume acts as a source for tailored versions.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {resumes.length === 0 ? (
            <p className="text-sm text-zinc-500">No resumes uploaded yet.</p>
          ) : (
            resumes.map((resume) => (
              <div
                key={resume.id}
                className="flex items-center justify-between rounded-lg border border-zinc-200 bg-white px-4 py-3"
              >
                <div>
                  <p className="font-medium text-zinc-900">{resume.fileName}</p>
                  <p className="text-xs text-zinc-500">
                    Uploaded {resume.createdAt.toLocaleDateString()}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{resume.roleCategory}</Badge>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
