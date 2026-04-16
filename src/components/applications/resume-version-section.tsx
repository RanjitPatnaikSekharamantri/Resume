"use client";

import React, { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  FileText,
  Sparkles,
  Loader2,
  ChevronDown,
  ChevronUp,
  Copy,
  Pencil,
  Trash2,
  Plus,
  X,
  Check,
  Link2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatToUserTime } from "@/lib/timezone";

interface ResumeVersion {
  id: string;
  version: number;
  fileName: string;
  fileUrl: string;
  content: string | null;
  isTailored: boolean;
  createdAt: string;
  baseResumeId: string | null;
  baseResume?: { name: string } | null;
}

interface BaseResume {
  id: string;
  name: string;
  roleCategory: string | null;
}

interface ResumeVersionSectionProps {
  applicationId: string;
  jobTitle: string;
  company: string;
  resumeVersions: ResumeVersion[];
  resumes: BaseResume[];
  onRefresh: () => void;
  onToast: (msg: string, variant: "success" | "error") => void;
}

export function ResumeVersionSection({
  applicationId,
  jobTitle,
  company,
  resumeVersions,
  resumes,
  onRefresh,
  onToast,
}: ResumeVersionSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Link base resume dialog
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkResumeId, setLinkResumeId] = useState("");
  const [linking, setLinking] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<ResumeVersion | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── link base resume ──

  const handleLink = async () => {
    if (!linkResumeId) return;
    setLinking(true);
    try {
      const res = await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          baseResumeId: linkResumeId,
          isTailored: false,
        }),
      });
      if (!res.ok) {
        onToast("Failed to link resume", "error");
        return;
      }
      setLinkOpen(false);
      setLinkResumeId("");
      onRefresh();
      onToast("Base resume linked", "success");
    } catch {
      onToast("Failed to link resume", "error");
    } finally {
      setLinking(false);
    }
  };

  // ── edit ──

  const startEdit = (rv: ResumeVersion) => {
    setEditingId(rv.id);
    setEditContent(rv.content || "");
    setExpandedId(rv.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/resume-versions/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });
      if (!res.ok) {
        onToast("Failed to save", "error");
        return;
      }
      setEditingId(null);
      onRefresh();
      onToast("Resume version updated", "success");
    } catch {
      onToast("Save failed", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSaveAsNewVersion = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          content: editContent.trim(),
          isTailored: true,
        }),
      });
      if (!res.ok) {
        onToast("Failed to save new version", "error");
        return;
      }
      setEditingId(null);
      onRefresh();
      onToast("Saved as new version", "success");
    } catch {
      onToast("Save failed", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── delete ──

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/resume-versions/${deleteTarget.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        onToast("Delete failed", "error");
        return;
      }
      setDeleteTarget(null);
      if (expandedId === deleteTarget.id) setExpandedId(null);
      if (editingId === deleteTarget.id) cancelEdit();
      onRefresh();
      onToast("Resume version deleted", "success");
    } catch {
      onToast("Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onToast("Copied to clipboard", "success");
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">Resume Versions</CardTitle>
            {resumeVersions.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {resumeVersions.length} version{resumeVersions.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setLinkResumeId("");
                setLinkOpen(true);
              }}
            >
              <Link2 className="w-3.5 h-3.5 mr-1" />
              Link Resume
            </Button>
            <Link href="/ai-studio">
              <Button variant="outline" size="sm" className="h-8">
                <Sparkles className="w-3.5 h-3.5 mr-1" />
                Generate
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {resumeVersions.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No resume versions yet</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                Link a base resume or generate a tailored version from AI Studio
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {resumeVersions.map((rv) => {
                const isExpanded = expandedId === rv.id;
                const isEditing = editingId === rv.id;
                const hasContent = rv.content && rv.content.trim().length > 0;

                return (
                  <div
                    key={rv.id}
                    className={cn(
                      "rounded-lg border overflow-hidden transition-colors",
                      isExpanded ? "border-gray-200" : "border-gray-100"
                    )}
                  >
                    {/* Row */}
                    <div
                      className="flex items-center justify-between p-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (!isEditing && hasContent)
                          setExpandedId(isExpanded ? null : rv.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            rv.isTailored
                              ? "bg-blue-50 text-blue-600"
                              : "bg-gray-100 text-gray-500"
                          )}
                        >
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium text-gray-900">
                              {rv.isTailored ? "Tailored" : "Base"} Resume v{rv.version}
                            </p>
                            {rv.isTailored && (
                              <Badge variant="info" className="text-[9px] px-1.5 py-0">
                                AI
                              </Badge>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">
                            {formatToUserTime(rv.createdAt)}
                            {rv.baseResume && (
                              <span> · From: {rv.baseResume.name}</span>
                            )}
                            {hasContent && (
                              <span> · {rv.content!.length.toLocaleString()} chars</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        {hasContent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleCopy(rv.content!);
                            }}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Copy"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {hasContent && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              startEdit(rv);
                            }}
                            className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                            title="Edit"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(rv);
                          }}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {hasContent && (
                          isExpanded ? (
                            <ChevronUp className="w-4 h-4 text-gray-400 ml-0.5" />
                          ) : (
                            <ChevronDown className="w-4 h-4 text-gray-400 ml-0.5" />
                          )
                        )}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && hasContent && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={16}
                              className="text-sm leading-relaxed resize-y font-mono bg-white"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-gray-400 tabular-nums">
                                {editContent.length.toLocaleString()} chars
                              </span>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={cancelEdit} disabled={savingEdit} className="h-8">
                                  <X className="w-3.5 h-3.5 mr-1" /> Cancel
                                </Button>
                                <Button variant="outline" size="sm" onClick={handleSaveAsNewVersion} disabled={savingEdit || !editContent.trim()} className="h-8">
                                  <Plus className="w-3.5 h-3.5 mr-1" /> New Version
                                </Button>
                                <Button variant="primary" size="sm" onClick={() => handleSaveEdit(rv.id)} disabled={savingEdit || !editContent.trim()} className="h-8">
                                  {savingEdit ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Check className="w-3.5 h-3.5 mr-1" />}
                                  Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <pre className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed font-mono">
                            {rv.content}
                          </pre>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Link dialog */}
      <Dialog open={linkOpen} onOpenChange={setLinkOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Link Base Resume</DialogTitle>
            <DialogDescription>
              Attach a base resume to {jobTitle} at {company}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-gray-700">Base Resume</label>
            {resumes.length === 0 ? (
              <p className="text-xs text-gray-500">
                No resumes in your library —{" "}
                <Link href="/resume-library" className="text-blue-600 hover:underline">
                  upload one first
                </Link>
              </p>
            ) : (
              <Select value={linkResumeId} onValueChange={setLinkResumeId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a resume" />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.roleCategory && <span className="text-gray-400 text-xs ml-1">· {r.roleCategory}</span>}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLinkOpen(false)} disabled={linking}>Cancel</Button>
            <Button variant="primary" onClick={handleLink} disabled={linking || !linkResumeId}>
              {linking ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Linking...</> : <><Link2 className="w-4 h-4 mr-2" /> Link Resume</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Resume Version</DialogTitle>
            <DialogDescription>
              Delete {deleteTarget?.isTailored ? "Tailored" : "Base"} Resume v{deleteTarget?.version}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={deleting}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting}>
              {deleting ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Deleting...</> : <><Trash2 className="w-4 h-4 mr-2" /> Delete</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
