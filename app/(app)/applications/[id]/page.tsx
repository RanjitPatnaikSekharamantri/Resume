import { notFound } from "next/navigation";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APPLICATION_STATUS_LABELS,
  documentTypeLabels,
} from "@/lib/constants";
import { requireUser } from "@/lib/auth/session";
import { getApplicationDetail } from "@/lib/services/application.service";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ApplicationDetailPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const application = await getApplicationDetail(user.id, id);

  if (!application) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {application.jobTitle}
        </h1>
        <div className="flex flex-wrap items-center gap-3 text-sm text-zinc-500">
          <span>{application.company}</span>
          {application.location ? <span>• {application.location}</span> : null}
          <Badge variant="secondary">
            {APPLICATION_STATUS_LABELS[application.status]}
          </Badge>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-zinc-600">
            <p>
              <span className="font-medium text-zinc-800">Salary:</span>{" "}
              {application.salary || "Not specified"}
            </p>
            <p>
              <span className="font-medium text-zinc-800">Source:</span>{" "}
              {application.source || "Unknown"}
            </p>
            <p className="leading-relaxed">
              <span className="font-medium text-zinc-800">Job description:</span>{" "}
              {application.jobDescription || "No description provided yet."}
            </p>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-zinc-600">
            {application.notes || "No notes yet."}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Documents</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h3 className="text-sm font-medium text-zinc-800">
                {documentTypeLabels.RESUME}
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                {application.resumeVersions.length === 0 ? (
                  <li>No resume versions yet.</li>
                ) : (
                  application.resumeVersions.map((version) => (
                    <li key={version.id} className="rounded-md border border-zinc-200 p-3">
                      v{version.version} • {version.fileName} •{" "}
                      {version.createdAt.toLocaleDateString()}
                    </li>
                  ))
                )}
              </ul>
            </div>
            <div>
              <h3 className="text-sm font-medium text-zinc-800">
                {documentTypeLabels.COVER_LETTER}
              </h3>
              <ul className="mt-2 space-y-2 text-sm text-zinc-600">
                {application.coverLetterVersions.length === 0 ? (
                  <li>No cover letter versions yet.</li>
                ) : (
                  application.coverLetterVersions.map((version) => (
                    <li key={version.id} className="rounded-md border border-zinc-200 p-3">
                      v{version.version} • {version.createdAt.toLocaleDateString()}
                    </li>
                  ))
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="border-zinc-200">
          <CardHeader>
            <CardTitle>Activity</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm text-zinc-600">
              {application.activities.length === 0 ? (
                <li>No activity yet.</li>
              ) : (
                application.activities.map((activity) => (
                  <li key={activity.id} className="rounded-md border border-zinc-200 p-3">
                    <p className="font-medium text-zinc-800">{activity.message}</p>
                    <p className="text-xs text-zinc-500">
                      {activity.createdAt.toLocaleString()}
                    </p>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
