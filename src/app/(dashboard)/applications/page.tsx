"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ApplicationForm, ApplicationFormData } from "@/components/applications/application-form";
import { KanbanCardData } from "@/components/kanban/kanban-card";
import { Plus, LayoutGrid, List, Briefcase } from "lucide-react";
import Link from "next/link";
import { getStatusLabel, getStatusColor, formatDate } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";

type ViewMode = "kanban" | "list";

interface AppRow extends KanbanCardData {
  location?: string | null;
  salary?: string | null;
  updatedAt: string;
}

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<AppRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications");
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data)) setApplications(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleCreate = async (data: ApplicationFormData) => {
    const res = await fetch("/api/applications", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Failed to create");
    }
    fetchApplications();
  };

  const handleStatusChange = async (
    applicationId: string,
    newStatus: string
  ) => {
    try {
      await fetch("/api/applications/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ applicationId, newStatus, newOrder: 0 }),
      });
      fetchApplications();
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-36 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-48 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-9 w-40 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="flex gap-4 overflow-hidden">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="min-w-[280px] h-96 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description={`${applications.length} total application${applications.length !== 1 ? "s" : ""}`}
        action={
          <div className="flex items-center gap-2">
            <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
              <button
                onClick={() => setViewMode("kanban")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "kanban"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                aria-label="Kanban view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-md transition-colors ${
                  viewMode === "list"
                    ? "bg-white shadow-sm text-gray-900"
                    : "text-gray-500 hover:text-gray-700"
                }`}
                aria-label="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <Button variant="primary" size="sm" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Application
            </Button>
          </div>
        }
      />

      {applications.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <Briefcase className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              No applications yet
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
              Start tracking your job search by adding your first application.
            </p>
            <Button variant="primary" onClick={() => setFormOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add your first application
            </Button>
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <KanbanBoard
          applications={applications}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px]">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50/50">
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Job Title
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Location
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Updated
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {applications.map((app) => (
                  <tr
                    key={app.id}
                    className="hover:bg-gray-50/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/applications/${app.id}`}
                        className="text-sm font-medium text-gray-900 hover:text-blue-600 transition-colors"
                      >
                        {app.jobTitle}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {app.company}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {app.location || "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Badge
                        className={getStatusColor(app.status)}
                        variant="secondary"
                      >
                        {getStatusLabel(app.status)}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {formatDate(app.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <ApplicationForm
        open={formOpen}
        onOpenChange={setFormOpen}
        onSubmit={handleCreate}
      />
    </>
  );
}
