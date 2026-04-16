"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { ApplicationForm, ApplicationFormData } from "@/components/applications/application-form";
import { CoverLetterSection } from "@/components/applications/cover-letter-section";
import { ResumeVersionSection } from "@/components/applications/resume-version-section";
import { MatchScoreCard } from "@/components/applications/match-score-card";
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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  ExternalLink,
  FileText,
  Download,
  Trash2,
  Sparkles,
  Pencil,
  Loader2,
  MapPin,
  DollarSign,
  Globe,
  CalendarDays,
  Building2,
  CheckCircle2,
  AlertCircle,
  Clock,
  FilePlus,
  RefreshCw,
  StickyNote,
} from "lucide-react";
import {
  formatDate,
  getStatusLabel,
  getStatusColor,
  APPLICATION_STATUSES,
} from "@/lib/utils";

// ── types ──

interface ResumeVersion {
  id: string;
  version: number;
  fileName: string;
  fileUrl: string;
  content: string | null;
  isTailored: boolean;
  createdAt: string;
  baseResumeId: string | null;
  baseResume?: { id: string; name: string } | null;
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
  skillsMatch?: number;
  experienceMatch?: number;
  keywordCoverage?: number;
  domainMatch?: number;
  followUpDate?: string;
  reminderEnabled?: boolean;
  createdAt: string;
  updatedAt: string;
  resumeVersions: ResumeVersion[];
  coverLetters: CoverLetter[];
  activities: Activity[];
}

type ToastData = { message: string; variant: "success" | "error" } | null;

// ── toast ──

function Toast({
  data,
  onDismiss,
}: {
  data: NonNullable<ToastData>;
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg animate-in slide-in-from-bottom-4 fade-in ${
        data.variant === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {data.variant === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="text-sm font-medium">{data.message}</span>
    </div>
  );
}

// ── main page ──

export default function ApplicationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [app, setApp] = useState<ApplicationDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastData>(null);

  // notes
  const [notes, setNotes] = useState("");
  const [savedNotes, setSavedNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // edit
  const [editOpen, setEditOpen] = useState(false);

  // delete
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // resumes for cover letter generation
  const [resumes, setResumes] = useState<{ id: string; name: string; roleCategory: string | null }[]>([]);

  const fetchApp = useCallback(async () => {
    try {
      const res = await fetch(`/api/applications/${params.id}`);
      if (!res.ok) {
        router.push("/applications");
        return;
      }
      const data: ApplicationDetail = await res.json();
      setApp(data);
      setNotes(data.notes || "");
      setSavedNotes(data.notes || "");
    } catch {
      router.push("/applications");
    } finally {
      setLoading(false);
    }
  }, [params.id, router]);

  useEffect(() => {
    fetchApp();
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((data) => { if (Array.isArray(data)) setResumes(data); })
      .catch(() => {});
  }, [fetchApp]);

  const notesDirty = notes !== savedNotes;

  // ── handlers ──

  const handleStatusChange = async (newStatus: string) => {
    try {
      const res = await fetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setToast({ message: `Status changed to ${getStatusLabel(newStatus)}`, variant: "success" });
        fetchApp();
      }
    } catch {
      setToast({ message: "Failed to update status", variant: "error" });
    }
  };

  const handleSaveNotes = async () => {
    setSavingNotes(true);
    try {
      const res = await fetch(`/api/applications/${params.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (res.ok) {
        setSavedNotes(notes);
        setToast({ message: "Notes saved", variant: "success" });
        fetchApp();
      }
    } catch {
      setToast({ message: "Failed to save notes", variant: "error" });
    } finally {
      setSavingNotes(false);
    }
  };

  const handleEdit = async (data: ApplicationFormData) => {
    const res = await fetch(`/api/applications/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error("Failed");
    setToast({ message: "Application updated", variant: "success" });
    fetchApp();
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await fetch(`/api/applications/${params.id}`, { method: "DELETE" });
      router.push("/applications");
    } catch {
      setToast({ message: "Failed to delete", variant: "error" });
      setDeleting(false);
    }
  };

  const handleCoverLetterToast = (msg: string, variant: "success" | "error") => {
    setToast({ message: msg, variant });
  };

  // ── loading ──

  if (loading || !app) {
    return (
      <div className="space-y-6">
        <div className="h-4 w-32 bg-gray-200 rounded animate-pulse" />
        <div className="h-8 w-72 bg-gray-200 rounded animate-pulse" />
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 h-96 bg-gray-200 rounded-xl animate-pulse" />
          <div className="h-64 bg-gray-200 rounded-xl animate-pulse" />
        </div>
      </div>
    );
  }

  const editInitial: Record<string, string> = {
    jobTitle: app.jobTitle,
    company: app.company,
    location: app.location || "",
    salary: app.salary || "",
    postedDate: app.postedDate ? new Date(app.postedDate).toISOString().split("T")[0] : "",
    jobUrl: app.jobUrl || "",
    source: app.source || "",
    status: app.status,
    jobDescription: app.jobDescription || "",
    notes: app.notes || "",
  };

  // ── activity icon ──

  function activityIcon(type: string) {
    switch (type) {
      case "created":
        return <FilePlus className="w-3 h-3" />;
      case "status_change":
        return <RefreshCw className="w-3 h-3" />;
      case "notes_updated":
        return <StickyNote className="w-3 h-3" />;
      case "cover_letter_created":
        return <FileText className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  }

  return (
    <>
      {/* Back link */}
      <div className="mb-6">
        <Link
          href="/applications"
          className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Applications
        </Link>
      </div>

      {/* Header */}
      <PageHeader
        title={app.jobTitle}
        description={`${app.company}${app.location ? ` · ${app.location}` : ""}`}
        action={
          <div className="flex items-center gap-2">
            <Select value={app.status} onValueChange={handleStatusChange}>
              <SelectTrigger className="w-[150px] h-9">
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
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={() => setEditOpen(true)}
            >
              <Pencil className="w-3.5 h-3.5 mr-1.5" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9"
              onClick={() => setDeleteOpen(true)}
            >
              <Trash2 className="w-4 h-4 text-red-500" />
            </Button>
          </div>
        }
      />

      {/* Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main area */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="overview">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="notes">
                Notes
                {notesDirty && (
                  <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
                )}
              </TabsTrigger>
              <TabsTrigger value="documents">
                Documents
                {(app.resumeVersions.length > 0 || app.coverLetters.length > 0) && (
                  <span className="ml-1.5 text-[10px] bg-gray-200 text-gray-600 rounded-full px-1.5">
                    {app.resumeVersions.length + app.coverLetters.length}
                  </span>
                )}
              </TabsTrigger>
            </TabsList>

            {/* ── Overview ── */}
            <TabsContent value="overview">
              <Card>
                <CardContent className="p-6 space-y-6">
                  {/* Metadata grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
                    <MetaField
                      icon={<Building2 className="w-3.5 h-3.5" />}
                      label="Company"
                      value={app.company}
                    />
                    {app.location && (
                      <MetaField
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        label="Location"
                        value={app.location}
                      />
                    )}
                    {app.salary && (
                      <MetaField
                        icon={<DollarSign className="w-3.5 h-3.5" />}
                        label="Salary"
                        value={app.salary}
                      />
                    )}
                    {app.source && (
                      <MetaField
                        icon={<Globe className="w-3.5 h-3.5" />}
                        label="Source"
                        value={app.source}
                      />
                    )}
                    {app.postedDate && (
                      <MetaField
                        icon={<CalendarDays className="w-3.5 h-3.5" />}
                        label="Posted"
                        value={formatDate(app.postedDate)}
                      />
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">Status</p>
                      <Badge
                        className={getStatusColor(app.status)}
                        variant="secondary"
                      >
                        {getStatusLabel(app.status)}
                      </Badge>
                    </div>
                  </div>

                  {app.jobUrl && (
                    <>
                      <Separator />
                      <a
                        href={app.jobUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700 font-medium"
                      >
                        View Job Posting
                        <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                    </>
                  )}

                  {app.jobDescription && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                          Job Description
                        </p>
                        <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-[400px] overflow-y-auto pr-2 scrollbar-thin">
                          {app.jobDescription}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Notes ── */}
            <TabsContent value="notes">
              <Card>
                <CardContent className="p-6">
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={12}
                    placeholder="Add notes about this application — interview prep, recruiter details, follow-up reminders..."
                    className="resize-y mb-4"
                  />
                  <div className="flex items-center justify-between">
                    <div>
                      {notesDirty && (
                        <span className="text-xs text-amber-600 font-medium">
                          Unsaved changes
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {notesDirty && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setNotes(savedNotes)}
                        >
                          Discard
                        </Button>
                      )}
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={handleSaveNotes}
                        disabled={savingNotes || !notesDirty}
                      >
                        {savingNotes ? (
                          <>
                            <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                            Saving...
                          </>
                        ) : (
                          "Save Notes"
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* ── Documents ── */}
            <TabsContent value="documents">
              <div className="space-y-4">
                {/* Resume Versions */}
                <ResumeVersionSection
                  applicationId={app.id}
                  jobTitle={app.jobTitle}
                  company={app.company}
                  resumeVersions={app.resumeVersions}
                  resumes={resumes}
                  onRefresh={fetchApp}
                  onToast={handleCoverLetterToast}
                />

                {/* Cover Letters */}
                <CoverLetterSection
                  applicationId={app.id}
                  jobTitle={app.jobTitle}
                  company={app.company}
                  jobDescription={app.jobDescription || ""}
                  coverLetters={app.coverLetters}
                  resumes={resumes}
                  onRefresh={fetchApp}
                  onToast={handleCoverLetterToast}
                />
              </div>
            </TabsContent>
          </Tabs>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {app.matchScore != null && (
            <MatchScoreCard
              overallScore={app.matchScore}
              skillsMatch={app.skillsMatch}
              experienceMatch={app.experienceMatch}
              keywordCoverage={app.keywordCoverage}
              domainMatch={app.domainMatch}
            />
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <SidebarRow label="Created" value={formatDate(app.createdAt)} />
              <SidebarRow label="Updated" value={formatDate(app.updatedAt)} />
              <Separator />
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-500 text-sm">Follow-up</span>
                  <input
                    type="date"
                    value={app.followUpDate ? new Date(app.followUpDate).toISOString().split("T")[0] : ""}
                    onChange={async (e) => {
                      await fetch(`/api/applications/${params.id}`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          followUpDate: e.target.value || null,
                          reminderEnabled: !!e.target.value,
                        }),
                      });
                      fetchApp();
                    }}
                    className="text-xs border border-gray-200 rounded px-2 py-1 text-gray-700 focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                  />
                </div>
              </div>
              <Separator />
              <SidebarRow
                label="Resumes"
                value={String(app.resumeVersions.length)}
              />
              <SidebarRow
                label="Cover Letters"
                value={String(app.coverLetters.length)}
              />
              <SidebarRow
                label="Activities"
                value={String(app.activities.length)}
              />
            </CardContent>
          </Card>

          {/* Activity timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {app.activities.length === 0 ? (
                <p className="text-xs text-gray-400 text-center py-4">
                  No activity yet
                </p>
              ) : (
                <div className="space-y-3">
                  {app.activities.slice(0, 8).map((act, i) => (
                    <div key={act.id} className="flex items-start gap-2.5">
                      <div className="mt-0.5 p-1 rounded-full bg-gray-100 text-gray-500 shrink-0">
                        {activityIcon(act.type)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs text-gray-700 leading-relaxed">
                          {act.description}
                        </p>
                        <p className="text-[11px] text-gray-400 mt-0.5">
                          {formatDate(act.createdAt)}
                        </p>
                      </div>
                    </div>
                  ))}
                  {app.activities.length > 8 && (
                    <p className="text-xs text-gray-400 text-center">
                      +{app.activities.length - 8} more
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Edit dialog */}
      <ApplicationForm
        open={editOpen}
        onOpenChange={setEditOpen}
        onSubmit={handleEdit}
        initialData={editInitial}
        mode="edit"
      />

      {/* Delete confirmation */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Application</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {app.jobTitle}
              </span>{" "}
              at{" "}
              <span className="font-medium text-gray-900">
                {app.company}
              </span>
              ? All associated documents and activity will be permanently
              removed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteOpen(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              {deleting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Deleting...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4 mr-2" />
                  Delete
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {toast && <Toast data={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

// ── helpers ──

function MetaField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-1">
        <span className="text-gray-400">{icon}</span>
        <p className="text-xs text-gray-500">{label}</p>
      </div>
      <p className="text-sm font-medium text-gray-900">{value}</p>
    </div>
  );
}

function SidebarRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-900 font-medium">{value}</span>
    </div>
  );
}
