"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function ResumeUploadForm() {
  const [roleCategory, setRoleCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !roleCategory.trim()) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("roleCategory", roleCategory.trim());

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/base-resumes", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data?.error ?? "Upload failed.");
      }
      setRoleCategory("");
      setFile(null);
      setMessage("Resume uploaded successfully.");
      window.location.reload();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="grid gap-4 rounded-xl border border-zinc-200 bg-white p-4">
      <div className="grid gap-2">
        <Label htmlFor="roleCategory">Role Category</Label>
        <Input
          id="roleCategory"
          value={roleCategory}
          onChange={(e) => setRoleCategory(e.target.value)}
          placeholder="e.g. Product Manager"
          required
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="resumeFile">Resume File (DOCX or PDF)</Label>
        <Input
          id="resumeFile"
          type="file"
          accept=".docx,.pdf,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          required
        />
      </div>
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-zinc-500">{message}</p>
        <Button type="submit" disabled={loading}>
          {loading ? "Uploading..." : "Upload Resume"}
        </Button>
      </div>
    </form>
  );
}
