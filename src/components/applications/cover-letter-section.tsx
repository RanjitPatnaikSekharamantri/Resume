"use client";

import React, { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { computeWordDiff } from "@/lib/text-diff";
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
  Save,
  Plus,
  X,
  Check,
  GitCompare,
  Download,
} from "lucide-react";
import { formatDate } from "@/lib/utils";
import { cn } from "@/lib/utils";

// ── types ──

interface CoverLetter {
  id: string;
  version: number;
  content: string;
  createdAt: string;
}

interface BaseResume {
  id: string;
  name: string;
  roleCategory: string | null;
}

interface CoverLetterSectionProps {
  applicationId: string;
  jobTitle: string;
  company: string;
  jobDescription: string;
  coverLetters: CoverLetter[];
  resumes: BaseResume[];
  onRefresh: () => void;
  onToast: (msg: string, variant: "success" | "error") => void;
}

export function CoverLetterSection({
  applicationId,
  jobTitle,
  company,
  jobDescription,
  coverLetters,
  resumes,
  onRefresh,
  onToast,
}: CoverLetterSectionProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);

  // Generate state
  const [generateOpen, setGenerateOpen] = useState(false);
  const [generateResumeId, setGenerateResumeId] = useState("");
  const [generating, setGenerating] = useState(false);

  // Write new
  const [writeOpen, setWriteOpen] = useState(false);
  const [writeContent, setWriteContent] = useState("");
  const [savingNew, setSavingNew] = useState(false);

  // Delete
  const [deleteTarget, setDeleteTarget] = useState<CoverLetter | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Compare
  const [compareOpen, setCompareOpen] = useState(false);
  const [compareA, setCompareA] = useState<string>("");
  const [compareB, setCompareB] = useState<string>("");

  // ── generate ──

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const genRes = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          role: jobTitle,
          company,
          baseResumeId: generateResumeId || undefined,
          type: "cover_letter",
        }),
      });

      if (!genRes.ok) {
        onToast("Generation failed", "error");
        return;
      }

      const genData = await genRes.json();

      const saveRes = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          jobTitle,
          company,
          content: genData.content,
        }),
      });

      if (!saveRes.ok) {
        onToast("Failed to save cover letter", "error");
        return;
      }

      setGenerateOpen(false);
      onRefresh();
      onToast("Cover letter generated", "success");
    } catch {
      onToast("Generation failed", "error");
    } finally {
      setGenerating(false);
    }
  };

  // ── save new (manually written) ──

  const handleSaveNew = async () => {
    if (!writeContent.trim()) return;
    setSavingNew(true);
    try {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          jobTitle,
          company,
          content: writeContent.trim(),
        }),
      });

      if (!res.ok) {
        onToast("Failed to save", "error");
        return;
      }

      setWriteOpen(false);
      setWriteContent("");
      onRefresh();
      onToast("Cover letter saved as new version", "success");
    } catch {
      onToast("Save failed", "error");
    } finally {
      setSavingNew(false);
    }
  };

  // ── edit existing ──

  const startEdit = (cl: CoverLetter) => {
    setEditingId(cl.id);
    setEditContent(cl.content);
    setExpandedId(cl.id);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const handleSaveEdit = async (id: string) => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch(`/api/cover-letters/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: editContent.trim() }),
      });

      if (!res.ok) {
        onToast("Failed to save changes", "error");
        return;
      }

      setEditingId(null);
      onRefresh();
      onToast("Cover letter updated", "success");
    } catch {
      onToast("Save failed", "error");
    } finally {
      setSavingEdit(false);
    }
  };

  // ── save edited as new version ──

  const handleSaveAsNewVersion = async () => {
    if (!editContent.trim()) return;
    setSavingEdit(true);
    try {
      const res = await fetch("/api/cover-letters", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          jobTitle,
          company,
          content: editContent.trim(),
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
      const res = await fetch(`/api/cover-letters/${deleteTarget.id}`, {
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
      onToast("Cover letter deleted", "success");
    } catch {
      onToast("Delete failed", "error");
    } finally {
      setDeleting(false);
    }
  };

  // ── copy ──

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    onToast("Copied to clipboard", "success");
  };

  const downloadCoverLetter = async (content: string, fileName: string, format: "pdf" | "docx") => {
    try {
      const res = await fetch("/api/cover-letters/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content, fileName, format }),
      });
      if (!res.ok) { onToast("Download failed", "error"); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${fileName}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      onToast(`${format.toUpperCase()} downloaded`, "success");
    } catch { onToast("Download failed", "error"); }
  };

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm font-semibold">
              Cover Letters
            </CardTitle>
            {coverLetters.length > 0 && (
              <Badge variant="secondary" className="text-[10px]">
                {coverLetters.length} version{coverLetters.length !== 1 ? "s" : ""}
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-1.5">
            {coverLetters.length >= 2 && (
              <Button
                variant="outline"
                size="sm"
                className="h-8"
                onClick={() => {
                  setCompareA(coverLetters[0]?.id || "");
                  setCompareB(coverLetters[1]?.id || "");
                  setCompareOpen(true);
                }}
              >
                <GitCompare className="w-3.5 h-3.5 mr-1" />
                Compare
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setWriteContent("");
                setWriteOpen(true);
              }}
            >
              <Plus className="w-3.5 h-3.5 mr-1" />
              Write
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8"
              onClick={() => {
                setGenerateResumeId("");
                setGenerateOpen(true);
              }}
            >
              <Sparkles className="w-3.5 h-3.5 mr-1" />
              Generate
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {coverLetters.length === 0 ? (
            <div className="text-center py-10">
              <FileText className="w-7 h-7 text-gray-300 mx-auto mb-2" />
              <p className="text-sm text-gray-500">No cover letters yet</p>
              <p className="text-xs text-gray-400 mt-0.5 max-w-xs mx-auto">
                Generate one from the job description or write your own
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {coverLetters.map((cl) => {
                const isExpanded = expandedId === cl.id;
                const isEditing = editingId === cl.id;

                return (
                  <div
                    key={cl.id}
                    className={cn(
                      "rounded-lg border overflow-hidden transition-colors",
                      isExpanded ? "border-gray-200" : "border-gray-100"
                    )}
                  >
                    {/* Header row */}
                    <div
                      className="flex items-center justify-between p-3 hover:bg-gray-50/50 transition-colors cursor-pointer"
                      onClick={() => {
                        if (!isEditing) setExpandedId(isExpanded ? null : cl.id);
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center shrink-0">
                          <FileText className="w-4 h-4" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">
                            Cover Letter v{cl.version}
                          </p>
                          <p className="text-xs text-gray-500">
                            {formatDate(cl.createdAt)} ·{" "}
                            {cl.content.length.toLocaleString()} chars
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(cl.content);
                          }}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Copy"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            startEdit(cl);
                          }}
                          className="p-1.5 rounded-md hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setDeleteTarget(cl);
                          }}
                          className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                        {isExpanded ? (
                          <ChevronUp className="w-4 h-4 text-gray-400 ml-0.5" />
                        ) : (
                          <ChevronDown className="w-4 h-4 text-gray-400 ml-0.5" />
                        )}
                      </div>
                    </div>

                    {/* Expanded content */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 p-4 bg-gray-50/30">
                        {isEditing ? (
                          <div className="space-y-3">
                            <Textarea
                              value={editContent}
                              onChange={(e) => setEditContent(e.target.value)}
                              rows={14}
                              className="text-sm leading-relaxed resize-y bg-white"
                            />
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-gray-400 tabular-nums">
                                {editContent.length.toLocaleString()} chars
                              </span>
                              <div className="flex items-center gap-2">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={cancelEdit}
                                  disabled={savingEdit}
                                  className="h-8"
                                >
                                  <X className="w-3.5 h-3.5 mr-1" />
                                  Cancel
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={handleSaveAsNewVersion}
                                  disabled={savingEdit || !editContent.trim()}
                                  className="h-8"
                                >
                                  <Plus className="w-3.5 h-3.5 mr-1" />
                                  Save as New Version
                                </Button>
                                <Button
                                  variant="primary"
                                  size="sm"
                                  onClick={() => handleSaveEdit(cl.id)}
                                  disabled={savingEdit || !editContent.trim()}
                                  className="h-8"
                                >
                                  {savingEdit ? (
                                    <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" />
                                  ) : (
                                    <Check className="w-3.5 h-3.5 mr-1" />
                                  )}
                                  Save
                                </Button>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                              {cl.content}
                            </p>
                            <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await downloadCoverLetter(cl.content, `${jobTitle}_${company}_CoverLetter_v${cl.version}`, "pdf");
                                }}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                PDF
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={async (e) => {
                                  e.stopPropagation();
                                  await downloadCoverLetter(cl.content, `${jobTitle}_${company}_CoverLetter_v${cl.version}`, "docx");
                                }}
                              >
                                <Download className="w-3 h-3 mr-1" />
                                DOCX
                              </Button>
                            </div>
                          </div>
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

      {/* ── Generate dialog ── */}
      <Dialog open={generateOpen} onOpenChange={setGenerateOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Generate Cover Letter</DialogTitle>
            <DialogDescription>
              Create a cover letter tailored to {jobTitle} at {company}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-700">
                Base Resume (optional)
              </label>
              {resumes.length === 0 ? (
                <p className="text-xs text-gray-500">
                  No resumes uploaded — generation will use your profile data
                </p>
              ) : (
                <Select
                  value={generateResumeId}
                  onValueChange={setGenerateResumeId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a resume for context" />
                  </SelectTrigger>
                  <SelectContent>
                    {resumes.map((r) => (
                      <SelectItem key={r.id} value={r.id}>
                        {r.name}
                        {r.roleCategory && (
                          <span className="text-gray-400 text-xs ml-1">
                            · {r.roleCategory}
                          </span>
                        )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            {!jobDescription && (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50 text-amber-800 text-xs">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Add a job description to the application for better results
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setGenerateOpen(false)}
              disabled={generating}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Write new dialog ── */}
      <Dialog open={writeOpen} onOpenChange={setWriteOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Write Cover Letter</DialogTitle>
            <DialogDescription>
              Compose a cover letter for {jobTitle} at {company}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={writeContent}
              onChange={(e) => setWriteContent(e.target.value)}
              rows={16}
              placeholder="Dear Hiring Manager,&#10;&#10;I am writing to express my interest..."
              className="text-sm leading-relaxed resize-y"
            />
            <div className="flex items-center justify-between">
              <span className="text-[11px] text-gray-400 tabular-nums">
                {writeContent.length.toLocaleString()} chars
              </span>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setWriteOpen(false)}
              disabled={savingNew}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleSaveNew}
              disabled={savingNew || !writeContent.trim()}
            >
              {savingNew ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save as New Version
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete confirm ── */}
      <Dialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Cover Letter</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete Cover Letter v
              {deleteTarget?.version}? This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteTarget(null)}
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

      {/* ── Compare dialog ── */}
      <Dialog open={compareOpen} onOpenChange={setCompareOpen}>
        <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Compare Versions</DialogTitle>
            <DialogDescription>Side-by-side diff with highlighted changes</DialogDescription>
          </DialogHeader>
          <div className="flex gap-3 mb-4">
            <select value={compareA} onChange={(e) => setCompareA(e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none">
              {coverLetters.map((cl) => <option key={cl.id} value={cl.id}>v{cl.version}</option>)}
            </select>
            <span className="text-gray-400 self-center text-xs">vs</span>
            <select value={compareB} onChange={(e) => setCompareB(e.target.value)} className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-1.5 focus:ring-2 focus:ring-blue-500 outline-none">
              {coverLetters.map((cl) => <option key={cl.id} value={cl.id}>v{cl.version}</option>)}
            </select>
          </div>
          <CompareView
            textA={coverLetters.find((c) => c.id === compareA)?.content || ""}
            textB={coverLetters.find((c) => c.id === compareB)?.content || ""}
            labelA={`v${coverLetters.find((c) => c.id === compareA)?.version || "?"}`}
            labelB={`v${coverLetters.find((c) => c.id === compareB)?.version || "?"}`}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}

function CompareView({ textA, textB, labelA, labelB }: { textA: string; textB: string; labelA: string; labelB: string }) {
  const diff = useMemo(() => computeWordDiff(textA, textB), [textA, textB]);

  return (
    <div className="grid grid-cols-2 gap-4">
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{labelA}</p>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap rounded-lg border border-gray-200 p-3 max-h-[50vh] overflow-y-auto">
          {diff.map((span, i) => {
            if (span.type === "removed") return <span key={i} className="bg-red-100 text-red-800 rounded-sm">{span.text}</span>;
            if (span.type === "added") return null;
            return <span key={i}>{span.text}</span>;
          })}
        </div>
      </div>
      <div>
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">{labelB}</p>
        <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap rounded-lg border border-gray-200 p-3 max-h-[50vh] overflow-y-auto">
          {diff.map((span, i) => {
            if (span.type === "added") return <span key={i} className="bg-emerald-100 text-emerald-800 rounded-sm">{span.text}</span>;
            if (span.type === "removed") return null;
            return <span key={i}>{span.text}</span>;
          })}
        </div>
      </div>
    </div>
  );
}
