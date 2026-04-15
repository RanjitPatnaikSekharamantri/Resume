import { ApplicationStatus } from "@prisma/client";

import { ApplicationFormDialog } from "@/components/applications/application-form-dialog";
import { ApplicationsTable } from "@/components/applications/applications-table";
import { KanbanBoardClient } from "@/components/applications/kanban-board-client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { prisma } from "@/lib/prisma";
import { APPLICATION_STATUS_LABELS, APPLICATION_STATUS_ORDER } from "@/lib/constants";
import { requireUser } from "@/lib/auth/session";

export default async function ApplicationsPage() {
  const user = await requireUser();
  const applications = await prisma.application.findMany({
    where: { userId: user.id },
    include: {
      resumeVersions: {
        select: { id: true },
      },
      coverLetterVersions: {
        select: { id: true },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  const grouped = APPLICATION_STATUS_ORDER.map((status) => ({
    status,
    label: APPLICATION_STATUS_LABELS[status],
    count: applications.filter((item) => item.status === status).length,
  }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Applications</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Manage your full pipeline from saved roles to final offers.
          </p>
        </div>
        <ApplicationFormDialog />
      </div>

      <Card className="border-zinc-200/80 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pipeline Status</CardTitle>
          <CardDescription>Current count in each stage.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          {grouped.map((item) => (
            <Badge
              key={item.status}
              variant="secondary"
              className="rounded-full border border-zinc-200 bg-zinc-50 px-3 py-1 text-zinc-700"
            >
              {item.label}: {item.count}
            </Badge>
          ))}
        </CardContent>
      </Card>

      <KanbanBoardClient
        applications={applications.map((application) => ({
          id: application.id,
          status: application.status as ApplicationStatus,
          jobTitle: application.jobTitle,
          company: application.company,
          matchScore: application.matchScore ?? null,
          hasResume: application.resumeVersions.length > 0,
          hasNotes: Boolean(application.notes?.trim()),
        }))}
      />

      <ApplicationsTable applications={applications} />
    </div>
  );
}
