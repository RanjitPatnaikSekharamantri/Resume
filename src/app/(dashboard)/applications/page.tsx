"use client";

import React, { useEffect, useState, useCallback } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { KanbanBoard } from "@/components/kanban/kanban-board";
import { ApplicationForm } from "@/components/applications/application-form";
import { KanbanCardData } from "@/components/kanban/kanban-card";
import { Plus, LayoutGrid, List } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { getStatusLabel, getStatusColor, formatDate } from "@/lib/utils";

type ViewMode = "kanban" | "list";

export default function ApplicationsPage() {
  const [applications, setApplications] = useState<KanbanCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [viewMode, setViewMode] = useState<ViewMode>("kanban");

  const fetchApplications = useCallback(async () => {
    try {
      const res = await fetch("/api/applications");
      const data = await res.json();
      setApplications(data);
    } catch (error) {
      console.error("Failed to fetch applications:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchApplications();
  }, [fetchApplications]);

  const handleCreate = async (data: Record<string, string>) => {
    try {
      await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      fetchApplications();
    } catch (error) {
      console.error("Failed to create application:", error);
    }
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
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="flex gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="w-[280px] h-96 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Applications"
        description={`${applications.length} total applications`}
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

      {viewMode === "kanban" ? (
        <KanbanBoard
          applications={applications}
          onStatusChange={handleStatusChange}
        />
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50/50">
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Job Title
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Company
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Match
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
                  <td className="px-4 py-3">
                    <Badge className={getStatusColor(app.status)} variant="secondary">
                      {getStatusLabel(app.status)}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {app.matchScore ? `${app.matchScore}%` : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatDate((app as unknown as { updatedAt: string }).updatedAt || new Date().toISOString())}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {applications.length === 0 && (
            <div className="text-center py-12">
              <p className="text-sm text-gray-500">No applications yet</p>
            </div>
          )}
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
