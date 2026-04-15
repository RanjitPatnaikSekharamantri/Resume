"use client";

import Link from "next/link";

import { APPLICATION_STATUS_LABELS } from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { ApplicationStatus } from "@prisma/client";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type ApplicationsTableProps = {
  applications: Array<{
    id: string;
    jobTitle: string;
    company: string;
    status: ApplicationStatus;
    matchScore: number | null;
    updatedAt: Date;
  }>;
};

export function ApplicationsTable({ applications }: ApplicationsTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Application List</CardTitle>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-zinc-200 text-left text-xs uppercase tracking-wide text-zinc-500">
              <th className="px-3 py-2">Role</th>
              <th className="px-3 py-2">Company</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {applications.map((application) => (
              <tr key={application.id} className="border-b border-zinc-100 last:border-none">
                <td className="px-3 py-2 font-medium text-zinc-900">
                  <Link href={`/applications/${application.id}`} className="hover:underline">
                    {application.jobTitle}
                  </Link>
                </td>
                <td className="px-3 py-2 text-zinc-700">{application.company}</td>
                <td className="px-3 py-2">
                  <Badge variant="outline">
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </Badge>
                </td>
                <td className="px-3 py-2 text-zinc-700">
                  {application.matchScore ? `${application.matchScore}%` : "—"}
                </td>
                <td className="px-3 py-2 text-zinc-500">
                  {formatDateTime(application.updatedAt)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}
