"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Download,
  Trash2,
  Clock,
  Sparkles,
} from "lucide-react";
import { formatDate, getStatusLabel, getStatusColor, APPLICATION_STATUSES } from "@/lib/utils";
import Link from "next/link";

interface ResumeVersion {
  id: string;
  version: number;
  fileName: string;
  fileUrl: string;
  isTailored: boolean;
  createdAt: string;
  baseResume?: { name: string } | null;
}

interface CoverLetter {
  id: string;
  version: number;
  content: string;
  createdAt: string;
}

interface Activity {
  id: string;
  type: string;
  description: string;
  createdAt: string;
}

interface ApplicationDetail {
  id: string;
  jobTitle: string;
  company: string;
  location?: string;
  salary?: string;
  postedDate?: string;
  jobDescription?: string;
  jobUrl?: string;
  source?: string;
  notes?: string;
  status: string;
  matchScore?: number;
  createdAt: string;
  updatedAt: string;
  resumeVersions: ResumeVersion[];
  coverLetters: CoverLetter[];
  activities: Activity[];
}

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [application, setApplication] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  const fetchApplication = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${params.id}`);
      if (!res.ok) {
        router.push("/applications");
        return;
      }
      const data = await res.json();
      setApplication(data);
      setNotes(data.notes || "");
    } catch {
      router.push("/applications");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchApplication();
  }, [fetchApplication]);

  const handleStatusChange = async (newStatus: string) => {
    try {
      await fetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      fetchApplication();
    } catch (error) {
      console.error("Failed to update status:", error);
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      await fetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      fetchApplication();
    } catch (error) {
      console.error("Failed to save notes:", error);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to delete this application?")) return;
    try {
      await fetch(`/api/applications/${params.id}`, { method: "DELETE" });
      router.push("/applications");
    } catch (error) {
      console.error("Failed to delete:", error);
    }
  };

  const handleGenerateCoverLetter = async () => {
    if (!application) return;
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: application.jobDescription || "",
          role: application.jobTitle,
          company: application.company,
          type: "cover_letter",
        }),
      });
      const data = await res.json();

      await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: application.id,
          jobTitle: application.jobTitle,
          company: application.company,
          content: data.content,
        }),
      });

      fetchApplication();
    } catch (error) {
      console.error("Failed to generate cover letter:", error);
    }
  };

  if (loading || !application) {
    return (
      <div className="animate-pulse space-y-4">
        <div className="h-8 w-64 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <div className="mb-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
      </div>

      <PageHeader
        title={application.jobTitle}
        description={`${application.company}${application.location ? ` · ${application.location}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Select
              value={application.status}
              onValueChange={handleStatusChange}
            >
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {APPLICATION_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {getStatusLabel(s)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={handleDelete}>
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notes">Notes</TabsTrigger>
              <TabsTrigger value="documents">Documents</TabsTrigger>
              <TabsTrigger value="activity">Activity</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <Card>
                <CardContent className="p-6 space-y-6">
                  <div className="grid grid-cols-2 gap-6">
                    <div>
                      <p className="text-xs text-gray-500 uppercase tracking-wider">
                        Status
                      </p>
                      <Badge
                        className={`mt-1 ${getStatusColor(application.status)}`}
                        variant="secondary"
                      >
                        {getStatusLabel(application.status)}
                      </Badge>
                    </div>
                    {application.salary && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          Salary
                        </p>
                        <p className="text-sm text-gray-900 mt-1">
                          {application.salary}
                        </p>
                      </div>
                    )}
                    {application.source && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          Source
                        </p>
                        <p className="text-sm text-gray-900 mt-1">
                          {application.source}
                        </p>
                      </div>
                    )}
                    {application.matchScore && (
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider">
                          Match Score
                        </p>
                        <p className="text-sm text-gray-900 mt-1">
                          {application.matchScore}%
                        </p>
                      </div>
                    )}
                  </div>

                  {application.jobUrl && (
                    <>
                      <Separator />
                      <a
                        href={application.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700"
                      >
                        View Job Posting
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}

                  {application.jobDescription && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">
                          Job Description
                        </p>
                        <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                          {application.jobDescription}
                        </p>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notes">
              <Card>
                <CardContent className="p-6">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={10}
                    placeholder="Add notes about this application..."
                    className="mb-4"
                  />
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSaveNotes}
                    disabled={savingNotes}
                  >
                    {savingNotes ? "Saving..." : "Save Notes"}
                  </Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="documents">
              <div className="space-y-4">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">Resume Versions</CardTitle>
                    <Link href="/ai-studio">
                      <Button variant="outline" size="sm">
                        <Sparkles className="w-4 h-4 mr-1.5" />
                        Generate Tailored
                      </Button>
                    </Link>
                  </CardHeader>
                  <CardContent>
                    {application.resumeVersions.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        No resume versions yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {application.resumeVersions.map((rv) => (
                          <div
                            key={rv.id}
                            className="flex items-center justify-between p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50"
                          >
                            <div className="flex items-center gap-3">
                              <FileText className="w-4 h-4 text-gray-400" />
                              <div>
                                <p className="text-sm font-medium text-gray-900">
                                  {rv.isTailored
                                    ? `Tailored v${rv.version}`
                                    : `Base Resume v${rv.version}`}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {formatDate(rv.createdAt)}
                                  {rv.baseResume &&
                                    ` · From: ${rv.baseResume.name}`}
                                </p>
                              </div>
                            </div>
                            <Button variant="ghost" size="icon">
                              <Download className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle className="text-base">
                      Cover Letter Versions
                    </CardTitle>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={handleGenerateCoverLetter}
                    >
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Generate
                    </Button>
                  </CardHeader>
                  <CardContent>
                    {application.coverLetters.length === 0 ? (
                      <p className="text-sm text-gray-500 text-center py-6">
                        No cover letters yet
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {application.coverLetters.map((cl) => (
                          <div
                            key={cl.id}
                            className="p-3 rounded-lg border border-gray-100 hover:bg-gray-50/50"
                          >
                            <div className="flex items-center justify-between mb-2">
                              <p className="text-sm font-medium text-gray-900">
                                Cover Letter v{cl.version}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(cl.createdAt)}
                              </p>
                            </div>
                            <p className="text-sm text-gray-600 line-clamp-3 whitespace-pre-wrap">
                              {cl.content}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="activity">
              <Card>
                <CardContent className="p-6">
                  {application.activities.length === 0 ? (
                    <p className="text-sm text-gray-500 text-center py-6">
                      No activity yet
                    </p>
                  ) : (
                    <div className="space-y-4">
                      {application.activities.map((act) => (
                        <div
                          key={act.id}
                          className="flex items-start gap-3"
                        >
                          <div className="mt-0.5 p-1.5 rounded-full bg-gray-100">
                            <Clock className="w-3 h-3 text-gray-500" />
                          </div>
                          <div>
                            <p className="text-sm text-gray-700">
                              {act.description}
                            </p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              {formatDate(act.createdAt)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Created</span>
                <span className="text-gray-900">
                  {formatDate(application.createdAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Updated</span>
                <span className="text-gray-900">
                  {formatDate(application.updatedAt)}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Resumes</span>
                <span className="text-gray-900">
                  {application.resumeVersions.length}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Cover Letters</span>
                <span className="text-gray-900">
                  {application.coverLetters.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
