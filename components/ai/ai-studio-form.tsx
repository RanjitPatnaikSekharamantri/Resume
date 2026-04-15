"use client";

import { useState } from "react";
import { Loader2, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

type ResumeOption = {
  id: string;
  fileName: string;
  roleCategory: string;
};

type StudioResult = {
  tailoredResumeText: string;
  coverLetterText: string;
  savedApplicationId?: string | null;
};

export function AIStudioForm({ resumes }: { resumes: ResumeOption[] }) {
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [baseResumeId, setBaseResumeId] = useState<string>("");
  const [saveAsApplication, setSaveAsApplication] = useState(true);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<StudioResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function onGenerate() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/studio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          role,
          company,
          jobDescription,
          baseResumeId: baseResumeId || undefined,
          saveAsApplication,
        }),
      });
      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error || "Generation failed.");
      }
      setResult(json.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Generation failed.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Card className="rounded-2xl border-zinc-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-900">Input</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role">Role</Label>
            <Input
              id="role"
              value={role}
              onChange={(e) => setRole(e.target.value)}
              placeholder="Senior Product Manager"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="company">Company</Label>
            <Input
              id="company"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              placeholder="Stripe"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="baseResume">Base Resume</Label>
            <select
              id="baseResume"
              value={baseResumeId}
              onChange={(e) => setBaseResumeId(e.target.value)}
              className="flex h-10 w-full rounded-xl border border-zinc-200 bg-white px-3 text-sm text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
            >
              <option value="">No base resume</option>
              {resumes.map((resume) => (
                <option key={resume.id} value={resume.id}>
                  {resume.fileName} ({resume.roleCategory})
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="jobDescription">Job Description</Label>
            <Textarea
              id="jobDescription"
              value={jobDescription}
              onChange={(e) => setJobDescription(e.target.value)}
              rows={12}
              placeholder="Paste job description..."
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={saveAsApplication}
              onChange={(e) => setSaveAsApplication(e.target.checked)}
              className="h-4 w-4 rounded border-zinc-300 text-blue-600 focus:ring-blue-500"
            />
            Save as Application
          </label>
          <Button
            onClick={onGenerate}
            disabled={loading}
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-500"
          >
            {loading ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Generating...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                Generate Tailored Docs
              </span>
            )}
          </Button>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
        </CardContent>
      </Card>

      <Card className="rounded-2xl border-zinc-200 bg-white">
        <CardHeader>
          <CardTitle className="text-lg text-zinc-900">Output</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {!result ? (
            <p className="text-sm text-zinc-500">
              Generated tailored resume and cover letter will appear here.
            </p>
          ) : (
            <>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Tailored Resume
                </p>
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-800">
                  {result.tailoredResumeText}
                </pre>
              </div>
              <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Cover Letter
                </p>
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap text-xs text-zinc-800">
                  {result.coverLetterText}
                </pre>
              </div>
              {result.savedApplicationId ? (
                <p className="text-xs text-blue-700">
                  Saved as application #{result.savedApplicationId}
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
