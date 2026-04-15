"use client";

import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { APPLICATION_STATUSES, getStatusLabel } from "@/lib/utils";
import { Loader2, AlertCircle } from "lucide-react";

const SOURCE_OPTIONS = [
  "LinkedIn",
  "Indeed",
  "Glassdoor",
  "Company Website",
  "Referral",
  "Recruiter",
  "AngelList / Wellfound",
  "Hacker News",
  "Twitter / X",
  "Other",
];

export interface ApplicationFormData {
  jobTitle: string;
  company: string;
  location: string;
  salary: string;
  postedDate: string;
  jobUrl: string;
  source: string;
  status: string;
  jobDescription: string;
  notes: string;
  [key: string]: string;
}

const EMPTY_FORM: ApplicationFormData = {
  jobTitle: "",
  company: "",
  location: "",
  salary: "",
  postedDate: "",
  jobUrl: "",
  source: "",
  status: "not_applied",
  jobDescription: "",
  notes: "",
};

interface ApplicationFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: ApplicationFormData) => Promise<void>;
  initialData?: Partial<ApplicationFormData>;
  mode?: "create" | "edit";
}

export function ApplicationForm({
  open,
  onOpenChange,
  onSubmit,
  initialData,
  mode = "create",
}: ApplicationFormProps) {
  const [form, setForm] = useState<ApplicationFormData>(EMPTY_FORM);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      if (initialData) {
        const merged = { ...EMPTY_FORM };
        for (const key of Object.keys(merged)) {
          const val = initialData[key as keyof ApplicationFormData];
          if (val !== undefined) merged[key] = val;
        }
        setForm(merged);
      } else {
        setForm(EMPTY_FORM);
      }
      setError("");
    }
  }, [open, initialData]);

  const update = (field: keyof ApplicationFormData, value: string) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!form.jobTitle.trim()) {
      setError("Job title is required");
      return;
    }
    if (!form.company.trim()) {
      setError("Company is required");
      return;
    }

    setLoading(true);
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const isEdit = mode === "edit";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Application" : "New Application"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the details for this application"
              : "Track a new job application"}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Row 1: Title + Company */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-title">
                Job Title <span className="text-red-500">*</span>
              </Label>
              <Input
                id="af-title"
                value={form.jobTitle}
                onChange={(e) => update("jobTitle", e.target.value)}
                placeholder="Senior Software Engineer"
                autoFocus
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-company">
                Company <span className="text-red-500">*</span>
              </Label>
              <Input
                id="af-company"
                value={form.company}
                onChange={(e) => update("company", e.target.value)}
                placeholder="Google"
                required
              />
            </div>
          </div>

          {/* Row 2: Location + Salary */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-location">Location</Label>
              <Input
                id="af-location"
                value={form.location}
                onChange={(e) => update("location", e.target.value)}
                placeholder="Remote, New York, SF..."
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-salary">Salary</Label>
              <Input
                id="af-salary"
                value={form.salary}
                onChange={(e) => update("salary", e.target.value)}
                placeholder="$150k – $180k"
              />
            </div>
          </div>

          {/* Row 3: URL + Source */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="af-url">Job URL</Label>
              <Input
                id="af-url"
                value={form.jobUrl}
                onChange={(e) => update("jobUrl", e.target.value)}
                placeholder="https://..."
                type="url"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Source</Label>
              <Select
                value={form.source || undefined}
                onValueChange={(v) => update("source", v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Where did you find this?" />
                </SelectTrigger>
                <SelectContent>
                  {SOURCE_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 4: Status + Posted Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => update("status", v)}
              >
                <SelectTrigger>
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
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="af-posted">Posted Date</Label>
              <Input
                id="af-posted"
                type="date"
                value={form.postedDate}
                onChange={(e) => update("postedDate", e.target.value)}
              />
            </div>
          </div>

          {/* Job Description */}
          <div className="space-y-1.5">
            <Label htmlFor="af-jd">Job Description</Label>
            <Textarea
              id="af-jd"
              value={form.jobDescription}
              onChange={(e) => update("jobDescription", e.target.value)}
              rows={5}
              placeholder="Paste the full job description here..."
              className="resize-y"
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="af-notes">Notes</Label>
            <Textarea
              id="af-notes"
              value={form.notes}
              onChange={(e) => update("notes", e.target.value)}
              rows={2}
              placeholder="Referral contact, interviewer name, prep notes..."
              className="resize-y"
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button type="submit" variant="primary" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {isEdit ? "Saving..." : "Creating..."}
                </>
              ) : isEdit ? (
                "Save Changes"
              ) : (
                "Create Application"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
