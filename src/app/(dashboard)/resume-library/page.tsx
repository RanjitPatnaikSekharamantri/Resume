"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  FileText,
  Upload,
  Trash2,
  Download,
  Plus,
  MoreVertical,
  Pencil,
  File,
  AlertCircle,
  CheckCircle2,
  Loader2,
  X,
  CloudUpload,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

// ── constants ──

const ROLE_CATEGORIES = [
  "Software Engineering",
  "Frontend Engineering",
  "Backend Engineering",
  "Full Stack Engineering",
  "DevOps / SRE",
  "Data Science",
  "Data Engineering",
  "Machine Learning / AI",
  "Product Management",
  "Product Design / UX",
  "Engineering Management",
  "QA / Test Engineering",
  "Security Engineering",
  "Mobile Development",
  "Other",
];

const MAX_FILE_SIZE = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".pdf", ".docx"];

// ── types ──

interface BaseResume {
  id: string;
  name: string;
  fileName: string;
  fileUrl: string;
  fileType: string;
  roleCategory: string | null;
  createdAt: string;
  updatedAt: string;
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

// ── page ──

export default function ResumeLibraryPage() {
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<ToastData>(null);

  // upload dialog state
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadName, setUploadName] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // edit dialog state
  const [editOpen, setEditOpen] = useState(false);
  const [editResume, setEditResume] = useState<BaseResume | null>(null);
  const [editName, setEditName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [saving, setSaving] = useState(false);

  // delete confirm
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<BaseResume | null>(null);
  const [deleting, setDeleting] = useState(false);

  const fetchResumes = useCallback(async () => {
    try {
      const res = await fetch("/api/resumes");
      const data = await res.json();
      if (Array.isArray(data)) setResumes(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchResumes();
  }, [fetchResumes]);

  // ── file validation ──

  function validateFile(file: File): string | null {
    if (file.size > MAX_FILE_SIZE) return "File must be under 10 MB";
    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (!ALLOWED_EXTENSIONS.includes(ext)) return "Only PDF and DOCX files are accepted";
    return null;
  }

  // ── upload handlers ──

  function resetUploadForm() {
    setUploadName("");
    setUploadCategory("");
    setUploadFile(null);
    setUploadError("");
    setDragActive(false);
  }

  function handleFileSelect(file: File | null) {
    if (!file) return;
    const err = validateFile(file);
    if (err) {
      setUploadError(err);
      return;
    }
    setUploadError("");
    setUploadFile(file);
    if (!uploadName) {
      const nameWithoutExt = file.name.replace(/\.(pdf|docx)$/i, "");
      setUploadName(nameWithoutExt.replace(/[-_]/g, " "));
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadName.trim() || !uploadFile) return;
    setUploading(true);
    setUploadError("");

    try {
      const formData = new FormData();
      formData.append("name", uploadName.trim());
      formData.append("roleCategory", uploadCategory);
      formData.append("file", uploadFile);

      const res = await fetch("/api/resumes", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) {
        setUploadError(data.error || "Upload failed");
        setUploading(false);
        return;
      }

      setUploadOpen(false);
      resetUploadForm();
      fetchResumes();
      setToast({ message: "Resume uploaded successfully", variant: "success" });
    } catch {
      setUploadError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  // ── edit handlers ──

  function openEdit(resume: BaseResume) {
    setEditResume(resume);
    setEditName(resume.name);
    setEditCategory(resume.roleCategory || "");
    setEditOpen(true);
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editResume || !editName.trim()) return;
    setSaving(true);

    try {
      const res = await fetch(`/api/resumes/${editResume.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName.trim(),
          roleCategory: editCategory || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setToast({ message: data.error || "Save failed", variant: "error" });
        setSaving(false);
        return;
      }

      setEditOpen(false);
      fetchResumes();
      setToast({ message: "Resume updated", variant: "success" });
    } catch {
      setToast({ message: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  }

  // ── delete handlers ──

  function openDelete(resume: BaseResume) {
    setDeleteTarget(resume);
    setDeleteOpen(true);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    setDeleting(true);

    try {
      const res = await fetch(`/api/resumes/${deleteTarget.id}`, {
        method: "DELETE",
      });

      if (!res.ok) {
        setToast({ message: "Delete failed", variant: "error" });
        setDeleting(false);
        return;
      }

      setDeleteOpen(false);
      setDeleteTarget(null);
      fetchResumes();
      setToast({ message: "Resume deleted", variant: "success" });
    } catch {
      setToast({ message: "Delete failed", variant: "error" });
    } finally {
      setDeleting(false);
    }
  }

  // ── download ──

  async function handleDownload(resume: BaseResume) {
    try {
      const res = await fetch(`/api/resumes/${resume.id}/download`);
      const data = await res.json();

      if (!res.ok) {
        setToast({
          message: data.error || "Download failed",
          variant: "error",
        });
        return;
      }

      window.open(data.url, "_blank");
    } catch {
      setToast({ message: "Download failed", variant: "error" });
    }
  }

  // ── loading state ──

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="h-7 w-40 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 w-56 bg-gray-200 rounded animate-pulse" />
          </div>
          <div className="h-9 w-36 bg-gray-200 rounded-lg animate-pulse" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-44 bg-gray-200 rounded-xl animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  // ── render ──

  return (
    <>
      <PageHeader
        title="Resume Library"
        description={`${resumes.length} base resume${resumes.length !== 1 ? "s" : ""}`}
        action={
          <Button
            variant="primary"
            size="sm"
            onClick={() => {
              resetUploadForm();
              setUploadOpen(true);
            }}
          >
            <Plus className="w-4 h-4 mr-2" />
            Upload Resume
          </Button>
        }
      />

      {/* ── empty state ── */}
      {resumes.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20">
            <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mb-5">
              <FileText className="w-7 h-7 text-blue-500" />
            </div>
            <h3 className="text-base font-semibold text-gray-900 mb-1">
              No resumes yet
            </h3>
            <p className="text-sm text-gray-500 mb-6 text-center max-w-xs">
              Upload your base resumes so you can generate tailored versions for
              each application.
            </p>
            <Button
              variant="primary"
              onClick={() => {
                resetUploadForm();
                setUploadOpen(true);
              }}
            >
              <Upload className="w-4 h-4 mr-2" />
              Upload your first resume
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resumes.map((resume) => (
            <ResumeCard
              key={resume.id}
              resume={resume}
              onEdit={() => openEdit(resume)}
              onDelete={() => openDelete(resume)}
              onDownload={() => handleDownload(resume)}
            />
          ))}
        </div>
      )}

      {/* ── upload dialog ── */}
      <Dialog
        open={uploadOpen}
        onOpenChange={(open) => {
          setUploadOpen(open);
          if (!open) resetUploadForm();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Upload Resume</DialogTitle>
            <DialogDescription>
              Add a base resume (PDF or DOCX, max 10 MB)
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleUpload} className="space-y-4">
            {uploadError && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{uploadError}</span>
              </div>
            )}

            {/* Drop zone */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragActive(true);
              }}
              onDragLeave={() => setDragActive(false)}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 cursor-pointer transition-colors ${
                dragActive
                  ? "border-blue-400 bg-blue-50/50"
                  : uploadFile
                  ? "border-emerald-300 bg-emerald-50/30"
                  : "border-gray-200 bg-gray-50/50 hover:border-gray-300 hover:bg-gray-50"
              }`}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx"
                onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                className="hidden"
              />
              {uploadFile ? (
                <div className="flex flex-col items-center text-center">
                  <div className="w-10 h-10 rounded-xl bg-emerald-100 flex items-center justify-center mb-2">
                    <File className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-gray-900">
                    {uploadFile.name}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {(uploadFile.size / 1024).toFixed(0)} KB &middot;{" "}
                    {uploadFile.type.includes("pdf") ? "PDF" : "DOCX"}
                  </p>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setUploadFile(null);
                    }}
                    className="mt-2 text-xs text-gray-500 hover:text-red-600 transition-colors"
                  >
                    Remove file
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center text-center">
                  <CloudUpload className="w-8 h-8 text-gray-400 mb-2" />
                  <p className="text-sm font-medium text-gray-700">
                    Drop your file here or{" "}
                    <span className="text-blue-600">browse</span>
                  </p>
                  <p className="text-xs text-gray-400 mt-1">
                    PDF or DOCX &middot; Max 10 MB
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="upload-name">Resume Name</Label>
              <Input
                id="upload-name"
                value={uploadName}
                onChange={(e) => setUploadName(e.target.value)}
                placeholder="e.g. Senior Engineer Resume"
                required
                maxLength={100}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Role Category</Label>
              <Select value={uploadCategory} onValueChange={setUploadCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setUploadOpen(false)}
                disabled={uploading}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={uploading || !uploadFile || !uploadName.trim()}
              >
                {uploading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Uploading...
                  </>
                ) : (
                  <>
                    <Upload className="w-4 h-4 mr-2" />
                    Upload
                  </>
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── edit dialog ── */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Resume</DialogTitle>
            <DialogDescription>
              Update the name or category of this resume
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-name">Resume Name</Label>
              <Input
                id="edit-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                required
                maxLength={100}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Role Category</Label>
              <Select value={editCategory} onValueChange={setEditCategory}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a category (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {ROLE_CATEGORIES.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {editCategory && (
                <button
                  type="button"
                  onClick={() => setEditCategory("")}
                  className="text-xs text-gray-500 hover:text-gray-700 transition-colors"
                >
                  Clear category
                </button>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditOpen(false)}
                disabled={saving}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={saving || !editName.trim()}
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Changes"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── delete confirm dialog ── */}
      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Resume</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete{" "}
              <span className="font-medium text-gray-900">
                {deleteTarget?.name}
              </span>
              ? This will also remove the file from storage. This action cannot
              be undone.
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

// ── resume card ──

function ResumeCard({
  resume,
  onEdit,
  onDelete,
  onDownload,
}: {
  resume: BaseResume;
  onEdit: () => void;
  onDelete: () => void;
  onDownload: () => void;
}) {
  const fileIcon =
    resume.fileType === "pdf" ? (
      <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center">
        <FileText className="w-5 h-5 text-red-500" />
      </div>
    ) : (
      <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
        <FileText className="w-5 h-5 text-blue-500" />
      </div>
    );

  return (
    <Card className="group hover:shadow-md transition-all hover:border-gray-300">
      <CardContent className="p-5">
        <div className="flex items-start justify-between mb-4">
          {fileIcon}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <MoreVertical className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={onDownload}>
                <Download className="w-3.5 h-3.5 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={onEdit}>
                <Pencil className="w-3.5 h-3.5 mr-2" />
                Edit
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={onDelete}
                className="text-red-600 focus:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <h3 className="text-sm font-semibold text-gray-900 mb-0.5 line-clamp-1">
          {resume.name}
        </h3>
        <p className="text-xs text-gray-500 mb-3 line-clamp-1">
          {resume.fileName}
        </p>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {resume.roleCategory ? (
              <Badge variant="secondary" className="text-[11px] truncate max-w-[140px]">
                {resume.roleCategory}
              </Badge>
            ) : (
              <span className="text-[11px] text-gray-400 italic">
                No category
              </span>
            )}
            <Badge variant="outline" className="text-[11px] uppercase shrink-0">
              {resume.fileType}
            </Badge>
          </div>
          <span className="text-[11px] text-gray-400 shrink-0">
            {formatDate(resume.updatedAt)}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
