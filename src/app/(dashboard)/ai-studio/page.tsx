"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sparkles,
  FileText,
  Copy,
  Save,
  Loader2,
  AlertCircle,
  CheckCircle2,
  RotateCcw,
  Mail,
  Briefcase,
  ArrowRight,
  Wand2,
  Wrench,
  Send,
} from "lucide-react";
import Link from "next/link";
import { EnhanceResume } from "@/components/ai-studio/enhance-resume";
import { MatchScoreCard, ScoreBadge } from "@/components/applications/match-score-card";
import type { ScoreBreakdown } from "@/lib/match-scoring";

// ── types ──

interface BaseResume {
  id: string;
  name: string;
  roleCategory: string | null;
  fileType: string;
}

type GenerateMode = "both" | "resume" | "cover_letter";

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

type StudioMode = "generate" | "enhance";

export default function AIStudioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Prefill from query params (e.g. coming from /applications/[id])
  const prefillRole = searchParams.get("role") || "";
  const prefillCompany = searchParams.get("company") || "";
  const prefillJd = searchParams.get("jd") || "";
  const prefillResumeId = searchParams.get("resumeId") || "";
  const prefillAppId = searchParams.get("applicationId") || "";
  const prefillMode = searchParams.get("mode");

  // Top-level mode
  const [studioMode, setStudioMode] = useState<StudioMode>(
    prefillMode === "enhance" ? "enhance" : "generate"
  );

  // Input state — prefilled from the application context when available
  const [role, setRole] = useState(prefillRole);
  const [company, setCompany] = useState(prefillCompany);
  const [jobDescription, setJobDescription] = useState(prefillJd);
  const [selectedResume, setSelectedResume] = useState(prefillResumeId);
  const [generateMode, setGenerateMode] = useState<GenerateMode>("both");
  const [currentAppScore, setCurrentAppScore] = useState<number | null>(null);

  // Resume library
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [resumesLoading, setResumesLoading] = useState(true);

  // Output state
  const [generatedResume, setGeneratedResume] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");

  // Score state
  const [beforeScore, setBeforeScore] = useState<ScoreBreakdown | null>(null);
  const [afterScore, setAfterScore] = useState<ScoreBreakdown | null>(null);

  // Save state
  const [saving, setSaving] = useState(false);
  const [savedAppId, setSavedAppId] = useState<string | null>(null);

  // Mark saved app when coming from an existing application context.
  useEffect(() => {
    if (prefillAppId) setSavedAppId(prefillAppId);
  }, [prefillAppId]);

  // Fetch current active score on the prefilled application (for context).
  useEffect(() => {
    if (!prefillAppId) return;
    fetch(`/api/applications/${prefillAppId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data && typeof data.matchScore === "number") {
          setCurrentAppScore(data.matchScore);
        }
      })
      .catch(() => {});
  }, [prefillAppId]);

  // Toast
  const [toast, setToast] = useState<ToastData>(null);

  // Active output tab
  const [activeTab, setActiveTab] = useState("resume");

  const hasOutput = generatedResume || generatedCoverLetter;
  const canGenerate = role.trim() && company.trim() && jobDescription.trim();

  // ── fetch resumes ──

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResumes(data);
      })
      .catch(() => {})
      .finally(() => setResumesLoading(false));
  }, []);

  // ── generate ──

  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setGenError("");
    setSavedAppId(null);

    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jobDescription.trim(),
          role: role.trim(),
          company: company.trim(),
          baseResumeId: selectedResume || undefined,
          type: generateMode,
        }),
      });

      if (!res.ok) {
        const errData = await res.json();
        setGenError(errData.error || "Generation failed");
        setGenerating(false);
        return;
      }

      const data = await res.json();

      if (generateMode === "resume") {
        setGeneratedResume(data.content || "");
        setActiveTab("resume");
      } else if (generateMode === "cover_letter") {
        setGeneratedCoverLetter(data.content || "");
        setActiveTab("cover-letter");
      } else {
        setGeneratedResume(data.resume || "");
        setGeneratedCoverLetter(data.coverLetter || "");
        setActiveTab("resume");
      }

      // Calculate before/after match scores using the SAME scoring engine.
      // "Before" = profile summary + preferred role (when we have no base
      // resume content) or the base resume name/category. Without this, we
      // used to feed the target role as the before-text which produced
      // wildly inaccurate "before" scores.
      try {
        let beforeText = "";
        try {
          const profRes = await fetch("/api/profile");
          if (profRes.ok) {
            const prof = await profRes.json();
            beforeText = [
              prof?.summary,
              prof?.preferredRole,
              prof?.user?.name,
            ].filter(Boolean).join(" ");
          }
        } catch { /* ignore */ }

        if (!beforeText && selectedResumeObj) {
          beforeText = `${selectedResumeObj.name} ${selectedResumeObj.roleCategory || ""}`;
        }

        if (beforeText && beforeText.length > 10) {
          const beforeRes = await fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobDescription: jobDescription.trim(),
              resumeText: beforeText,
              jobTitle: role.trim(),
              company: company.trim(),
            }),
          });
          if (beforeRes.ok) setBeforeScore(await beforeRes.json());
        }

        const genResume = generateMode === "cover_letter" ? "" : (data.resume || data.content || "");
        if (genResume) {
          const afterRes = await fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jobDescription: jobDescription.trim(),
              resumeText: genResume,
              jobTitle: role.trim(),
              company: company.trim(),
            }),
          });
          if (afterRes.ok) setAfterScore(await afterRes.json());
        }
      } catch {
        // scoring is non-critical
      }

      setToast({ message: "Documents generated", variant: "success" });
    } catch {
      setGenError("Something went wrong. Please try again.");
    } finally {
      setGenerating(false);
    }
  };

  // ── save as application ──

  const handleSaveAsApplication = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: role.trim(),
          company: company.trim(),
          jobDescription: jobDescription.trim(),
          status: "not_applied",
          baseResumeId: selectedResume || undefined,
        }),
      });

      if (!res.ok) {
        setToast({ message: "Failed to create application", variant: "error" });
        setSaving(false);
        return;
      }

      const app = await res.json();

      const promises: Promise<Response>[] = [];

      if (generatedResume) {
        promises.push(
          fetch("/api/resume-versions", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicationId: app.id,
              baseResumeId: selectedResume || undefined,
              content: generatedResume,
              isTailored: true,
            }),
          })
        );
      }

      if (generatedCoverLetter) {
        promises.push(
          fetch("/api/cover-letters", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              applicationId: app.id,
              jobTitle: role.trim(),
              company: company.trim(),
              content: generatedCoverLetter,
            }),
          })
        );
      }

      await Promise.all(promises);

      setSavedAppId(app.id);
      const docCount = promises.length;
      setToast({
        message: `Application created with ${docCount} document${docCount !== 1 ? "s" : ""}`,
        variant: "success",
      });
    } catch {
      setToast({ message: "Save failed", variant: "error" });
    } finally {
      setSaving(false);
    }
  };

  // ── copy ──

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setToast({ message: "Copied to clipboard", variant: "success" });
  };

  // ── reset ──

  const handleReset = () => {
    setRole("");
    setCompany("");
    setJobDescription("");
    setSelectedResume("");
    setGeneratedResume("");
    setGeneratedCoverLetter("");
    setGenError("");
    setSavedAppId(null);
    setGenerateMode("both");
    setBeforeScore(null);
    setAfterScore(null);
  };

  // ── resume badge for the selected one ──

  const selectedResumeObj = resumes.find((r) => r.id === selectedResume);

  return (
    <>
      <PageHeader
        title="AI Studio"
        description="Generate tailored resumes and cover letters from job descriptions"
        action={
          studioMode === "generate" && hasOutput ? (
            <Button variant="outline" size="sm" onClick={handleReset}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              New Session
            </Button>
          ) : undefined
        }
      />

      {/* Mode toggle */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        <button
          onClick={() => setStudioMode("generate")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            studioMode === "generate"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Wand2 className="w-3.5 h-3.5" />
          Generate
        </button>
        <button
          onClick={() => setStudioMode("enhance")}
          className={`flex items-center gap-1.5 px-4 py-1.5 rounded-md text-sm font-medium transition-all ${
            studioMode === "enhance"
              ? "bg-white shadow-sm text-gray-900"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          <Wrench className="w-3.5 h-3.5" />
          Enhance Resume
        </button>
      </div>

      {/* In-context banner when launched from an application */}
      {prefillAppId && (
        <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-blue-900">
            <Briefcase className="w-4 h-4 text-blue-600" />
            <span>
              Working in context of{" "}
              <span className="font-semibold">{prefillRole}</span>
              {prefillCompany ? <> at <span className="font-semibold">{prefillCompany}</span></> : null}
            </span>
            {currentAppScore != null && (
              <Badge variant="secondary" className="ml-2">
                Current score: {currentAppScore}%
              </Badge>
            )}
          </div>
          <Link href={`/applications/${prefillAppId}`}>
            <Button variant="outline" size="sm" className="h-8">
              <ArrowRight className="w-3.5 h-3.5 mr-1.5" />
              Back to Application
            </Button>
          </Link>
        </div>
      )}

      {studioMode === "enhance" ? (
        <EnhanceResume
          resumes={resumes}
          resumesLoading={resumesLoading}
          onToast={setToast}
          initialRole={prefillRole}
          initialCompany={prefillCompany}
          initialJobDescription={prefillJd}
          initialResumeId={prefillResumeId}
          applicationId={prefillAppId || undefined}
          currentScore={currentAppScore}
        />
      ) : (
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* ─── Left Panel: Input ─── */}
        <div className="lg:col-span-2 space-y-4">
          <Card>
            <CardHeader className="pb-4">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Wand2 className="w-4 h-4 text-blue-600" />
                Input
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Role + Company */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="ai-role">
                    Role <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ai-role"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Senior Software Engineer"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="ai-company">
                    Company <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="ai-company"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Google"
                  />
                </div>
              </div>

              {/* Base Resume */}
              <div className="space-y-1.5">
                <Label>Base Resume</Label>
                {resumesLoading ? (
                  <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
                ) : resumes.length === 0 ? (
                  <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 text-center">
                    <p className="text-xs text-gray-500">
                      No resumes in your library
                    </p>
                    <Link
                      href="/resume-library"
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1 inline-block"
                    >
                      Upload one first →
                    </Link>
                  </div>
                ) : (
                  <Select
                    value={selectedResume}
                    onValueChange={setSelectedResume}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a base resume (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {resumes.map((r) => (
                        <SelectItem key={r.id} value={r.id}>
                          <span className="flex items-center gap-2">
                            {r.name}
                            {r.roleCategory && (
                              <span className="text-gray-400 text-xs">
                                · {r.roleCategory}
                              </span>
                            )}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {selectedResumeObj && (
                  <div className="flex items-center gap-2 mt-1.5">
                    <Badge variant="secondary" className="text-[11px]">
                      <FileText className="w-3 h-3 mr-1" />
                      {selectedResumeObj.name}
                    </Badge>
                    <button
                      onClick={() => setSelectedResume("")}
                      className="text-[11px] text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                )}
              </div>

              {/* Job Description */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <Label htmlFor="ai-jd">
                    Job Description <span className="text-red-500">*</span>
                  </Label>
                  <span className="text-[11px] text-gray-400 tabular-nums">
                    {jobDescription.length.toLocaleString()} chars
                  </span>
                </div>
                <Textarea
                  id="ai-jd"
                  value={jobDescription}
                  onChange={(e) => setJobDescription(e.target.value)}
                  rows={10}
                  placeholder="Paste the full job description here..."
                  className="resize-y text-sm"
                />
              </div>

              {/* Generate Mode */}
              <div className="space-y-1.5">
                <Label>Generate</Label>
                <div className="flex gap-2">
                  {(
                    [
                      { value: "both", label: "Both", icon: Sparkles },
                      { value: "resume", label: "Resume Only", icon: FileText },
                      { value: "cover_letter", label: "Cover Letter Only", icon: Mail },
                    ] as const
                  ).map(({ value, label, icon: Icon }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setGenerateMode(value)}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                        generateMode === value
                          ? "border-blue-200 bg-blue-50 text-blue-700"
                          : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50"
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Error */}
              {genError && (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <span>{genError}</span>
                </div>
              )}

              {/* Generate button */}
              <Button
                variant="primary"
                className="w-full"
                onClick={handleGenerate}
                disabled={generating || !canGenerate}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 mr-2" />
                    Generate{" "}
                    {generateMode === "both"
                      ? "Documents"
                      : generateMode === "resume"
                      ? "Resume"
                      : "Cover Letter"}
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* ─── Right Panel: Output ─── */}
        <div className="lg:col-span-3 space-y-4">
          {/* Save bar */}
          {hasOutput && (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {savedAppId ? (
                  <div className="flex items-center gap-2">
                    <Link href={`/applications/${savedAppId}`}>
                      <Button variant="outline" size="sm">
                        <Briefcase className="w-3.5 h-3.5 mr-1.5" />
                        View Application
                        <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                      </Button>
                    </Link>
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={async () => {
                        await fetch(`/api/applications/${savedAppId}`, {
                          method: "PATCH",
                          headers: { "Content-Type": "application/json" },
                          body: JSON.stringify({ status: "applied" }),
                        });
                        setToast({ message: "Marked as Applied", variant: "success" });
                      }}
                    >
                      <Send className="w-3.5 h-3.5 mr-1.5" />
                      Mark Applied
                    </Button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSaveAsApplication}
                    disabled={saving}
                  >
                    {saving ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5 mr-1.5" />
                        Save as Application
                      </>
                    )}
                  </Button>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <span className="flex items-center gap-1">
                  <Briefcase className="w-3 h-3" />
                  {role}
                </span>
                <span>at</span>
                <span className="font-medium text-gray-600">{company}</span>
              </div>
            </div>
          )}

          {/* Score comparison */}
          {(beforeScore || afterScore) && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                    Match Score
                  </p>
                  {afterScore && beforeScore && afterScore.overallScore > beforeScore.overallScore && (
                    <Badge variant="success" className="text-[10px]">
                      +{afterScore.overallScore - beforeScore.overallScore}% improvement
                    </Badge>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {beforeScore && (
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                        Base Resume Score
                      </p>
                      <MatchScoreCard
                        overallScore={beforeScore.overallScore}
                        skillsMatch={beforeScore.skillsMatch}
                        experienceMatch={beforeScore.experienceMatch}
                        keywordCoverage={beforeScore.keywordCoverage}
                        domainMatch={beforeScore.domainMatch}
                        compact
                      />
                    </div>
                  )}
                  {afterScore && (
                    <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                      <p className="text-[10px] text-blue-600 uppercase tracking-wider mb-2">
                        Enhanced Resume Score
                      </p>
                      <MatchScoreCard
                        overallScore={afterScore.overallScore}
                        skillsMatch={afterScore.skillsMatch}
                        experienceMatch={afterScore.experienceMatch}
                        keywordCoverage={afterScore.keywordCoverage}
                        domainMatch={afterScore.domainMatch}
                        compact
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Output tabs */}
          <Card className="overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <div className="border-b border-gray-200 px-4 pt-4 flex items-center justify-between">
                <TabsList>
                  <TabsTrigger value="resume" disabled={!generatedResume && generateMode === "cover_letter"}>
                    <FileText className="w-3.5 h-3.5 mr-1.5" />
                    Tailored Resume
                    {generatedResume && (
                      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="cover-letter" disabled={!generatedCoverLetter && generateMode === "resume"}>
                    <Mail className="w-3.5 h-3.5 mr-1.5" />
                    Cover Letter
                    {generatedCoverLetter && (
                      <span className="ml-1.5 w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
                    )}
                  </TabsTrigger>
                </TabsList>
              </div>

              {/* Resume tab */}
              <TabsContent value="resume" className="m-0">
                {generatedResume ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {generatedResume.length.toLocaleString()} characters
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyToClipboard(generatedResume)}
                      >
                        <Copy className="w-3 h-3 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                    <Textarea
                      value={generatedResume}
                      onChange={(e) => setGeneratedResume(e.target.value)}
                      rows={20}
                      className="font-mono text-sm leading-relaxed resize-y"
                    />
                  </div>
                ) : (
                  <EmptyOutput
                    icon={<FileText className="w-8 h-8" />}
                    title="Tailored Resume"
                    description="Your AI-generated resume will appear here after generation"
                  />
                )}
              </TabsContent>

              {/* Cover letter tab */}
              <TabsContent value="cover-letter" className="m-0">
                {generatedCoverLetter ? (
                  <div className="p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">
                        {generatedCoverLetter.length.toLocaleString()} characters
                      </p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyToClipboard(generatedCoverLetter)}
                      >
                        <Copy className="w-3 h-3 mr-1.5" />
                        Copy
                      </Button>
                    </div>
                    <Textarea
                      value={generatedCoverLetter}
                      onChange={(e) => setGeneratedCoverLetter(e.target.value)}
                      rows={18}
                      className="text-sm leading-relaxed resize-y"
                    />
                  </div>
                ) : (
                  <EmptyOutput
                    icon={<Mail className="w-8 h-8" />}
                    title="Cover Letter"
                    description="Your AI-generated cover letter will appear here after generation"
                  />
                )}
              </TabsContent>
            </Tabs>
          </Card>
        </div>
      </div>
      )}

      {toast && <Toast data={toast} onDismiss={() => setToast(null)} />}
    </>
  );
}

// ── empty output placeholder ──

function EmptyOutput({
  icon,
  title,
  description,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="text-gray-300 mb-3">{icon}</div>
      <p className="text-sm font-medium text-gray-500">{title}</p>
      <p className="text-xs text-gray-400 mt-1 max-w-xs">{description}</p>
    </div>
  );
}
