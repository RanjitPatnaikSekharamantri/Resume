"use client";

import React, { useState, useEffect } from "react";
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
import {
  Sparkles,
  FileText,
  Loader2,
  AlertCircle,
  CheckCircle2,
  Download,
  Eye,
  Save,
  ArrowRight,
  ShieldCheck,
  Pencil,
  Lock,
  Copy,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { MatchScoreCard } from "@/components/applications/match-score-card";
import type { ScoreBreakdown } from "@/lib/match-scoring";
import { computeWordDiff, type DiffSpan } from "@/lib/text-diff";

// ── types ──

interface BaseResume {
  id: string;
  name: string;
  roleCategory: string | null;
  fileType: string;
}

interface SectionData {
  kind: string;
  title: string;
  lines: string[];
  modifiable: boolean;
}

interface EnhanceResult {
  original: { sections: SectionData[]; text: string };
  enhanced: { sections: SectionData[]; text: string };
  resumeName: string;
  fileName: string;
  engine?: {
    kind: string;
    label: string;
    providerConfigured: boolean;
    providerName: string | null;
    providerModel: string | null;
    note: string;
  };
}

type ToastData = { message: string; variant: "success" | "error" };

interface EnhanceResumeProps {
  resumes: BaseResume[];
  resumesLoading: boolean;
  onToast: (data: ToastData) => void;
  /** Prefill values from an application context */
  initialRole?: string;
  initialCompany?: string;
  initialJobDescription?: string;
  initialResumeId?: string;
  /** Application ID — if set, "Save" attaches to this app instead of creating one */
  applicationId?: string;
  /** Current active match score on the application, shown as context. */
  currentScore?: number | null;
}

const SECTION_LABELS: Record<string, string> = {
  header: "Header",
  summary: "Professional Summary",
  skills: "Skills & Competencies",
  experience: "Professional Experience",
  projects: "Projects",
  education: "Education",
  certifications: "Certifications",
  other: "Other",
};

const MODIFIABLE_SECTIONS = ["summary", "skills", "experience", "projects"] as const;

export function EnhanceResume({
  resumes,
  resumesLoading,
  onToast,
  initialRole,
  initialCompany,
  initialJobDescription,
  initialResumeId,
  applicationId,
  currentScore,
}: EnhanceResumeProps) {
  const [selectedResume, setSelectedResume] = useState(initialResumeId || "");
  const [role, setRole] = useState(initialRole || "");
  const [company, setCompany] = useState(initialCompany || "");
  const [jobDescription, setJobDescription] = useState(initialJobDescription || "");

  // When prefilled values arrive (e.g. user navigates from application detail),
  // sync them once.
  useEffect(() => {
    if (initialRole && !role) setRole(initialRole);
    if (initialCompany && !company) setCompany(initialCompany);
    if (initialJobDescription && !jobDescription) setJobDescription(initialJobDescription);
    if (initialResumeId && !selectedResume) setSelectedResume(initialResumeId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRole, initialCompany, initialJobDescription, initialResumeId]);
  const [sectionsToEnhance, setSectionsToEnhance] = useState<Set<string>>(
    new Set(MODIFIABLE_SECTIONS)
  );

  // Rules
  const [noNewSkills, setNoNewSkills] = useState(false);
  const [preserveLength, setPreserveLength] = useState(false);
  const [rewriteIntensity, setRewriteIntensity] = useState<"light" | "moderate" | "aggressive">("moderate");

  // Rule recommendations
  interface Recommendation {
    rewriteIntensity: "light" | "moderate" | "aggressive";
    noNewSkills: boolean;
    preserveLength: boolean;
    prioritizeRecent: boolean;
    strongSummaryRewrite: boolean;
    emphasizeTechnicalStack: boolean;
    focusDomain?: string;
    reasons: string[];
  }
  const [recommendation, setRecommendation] = useState<Recommendation | null>(null);
  const [recommendationAccepted, setRecommendationAccepted] = useState(false);
  const [loadingRecs, setLoadingRecs] = useState(false);

  // Save to application
  const [savingToApp, setSavingToApp] = useState(false);
  const [savedToApp, setSavedToApp] = useState(false);

  const [enhancing, setEnhancing] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<EnhanceResult | null>(null);
  const [previewMode, setPreviewMode] = useState<"enhanced" | "original" | "diff">("enhanced");
  const [downloading, setDownloading] = useState(false);
  const [beforeScore, setBeforeScore] = useState<ScoreBreakdown | null>(null);
  const [afterScore, setAfterScore] = useState<ScoreBreakdown | null>(null);

  const canEnhance =
    selectedResume && role.trim() && company.trim() && jobDescription.trim();

  const docxResumes = resumes.filter((r) => r.fileType === "docx");
  const selectedObj = resumes.find((r) => r.id === selectedResume);

  // ── rule recommendations ──

  const fetchRecommendations = async () => {
    if (!selectedResume || !jobDescription.trim()) return;
    setLoadingRecs(true);
    try {
      const res = await fetch("/api/ai/recommend-rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResume,
          jobDescription: jobDescription.trim(),
        }),
      });
      if (!res.ok) return;
      const data = await res.json();
      setRecommendation(data.recommendation);
      setRecommendationAccepted(false);
    } catch {
      /* non-critical */
    } finally {
      setLoadingRecs(false);
    }
  };

  const acceptRecommendation = () => {
    if (!recommendation) return;
    setRewriteIntensity(recommendation.rewriteIntensity);
    setNoNewSkills(recommendation.noNewSkills);
    setPreserveLength(recommendation.preserveLength);
    setRecommendationAccepted(true);
  };

  const toggleSection = (kind: string) => {
    setSectionsToEnhance((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });
  };

  // ── enhance handler ──

  const handleEnhance = async () => {
    if (!canEnhance) return;
    setEnhancing(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ai/enhance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          resumeId: selectedResume,
          jobDescription: jobDescription.trim(),
          role: role.trim(),
          company: company.trim(),
          sectionsToEnhance: [...sectionsToEnhance],
          rules: { noNewSkills, preserveLength, rewriteIntensity },
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Enhancement failed");
        setEnhancing(false);
        return;
      }

      const data: EnhanceResult = await res.json();
      setResult(data);
      setPreviewMode("enhanced");

      // Calculate before/after match scores
      try {
        const [bRes, aRes] = await Promise.all([
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: jobDescription.trim(), resumeText: data.original.text, jobTitle: role.trim(), company: company.trim() }),
          }),
          fetch("/api/ai/match-score", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ jobDescription: jobDescription.trim(), resumeText: data.enhanced.text, jobTitle: role.trim(), company: company.trim() }),
          }),
        ]);
        if (bRes.ok) setBeforeScore(await bRes.json());
        if (aRes.ok) setAfterScore(await aRes.json());
      } catch { /* non-critical */ }

      onToast({ message: "Resume enhanced successfully", variant: "success" });
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setEnhancing(false);
    }
  };

  // ── download handler ──

  const handleDownload = async (format: "docx" | "pdf" = "docx") => {
    if (!result) return;
    setDownloading(true);

    try {
      const res = await fetch("/api/ai/enhance/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sections: result.enhanced.sections,
          fileName: result.fileName,
          format,
        }),
      });

      if (!res.ok) {
        onToast({ message: "Download failed", variant: "error" });
        setDownloading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const baseName = result.fileName.replace(/\.(docx|pdf)$/i, "");
      a.download = `${baseName}_enhanced.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      onToast({ message: `${format.toUpperCase()} downloaded`, variant: "success" });
    } catch {
      onToast({ message: "Download failed", variant: "error" });
    } finally {
      setDownloading(false);
    }
  };

  const copyPreview = () => {
    if (!result) return;
    const text = previewMode === "enhanced" ? result.enhanced.text : result.original.text;
    navigator.clipboard.writeText(text);
    onToast({ message: "Copied to clipboard", variant: "success" });
  };

  const handleSaveToApplication = async () => {
    if (!result) return;
    setSavingToApp(true);
    try {
      let targetAppId = applicationId;

      // If no existing application was provided, create one.
      if (!targetAppId) {
        const appRes = await fetch("/api/applications", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jobTitle: role.trim(),
            company: company.trim(),
            jobDescription: jobDescription.trim(),
            status: "not_applied",
          }),
        });
        if (!appRes.ok) { onToast({ message: "Failed to create application", variant: "error" }); return; }
        const app = await appRes.json();
        targetAppId = app.id;
      }

      // ALWAYS create a new ResumeVersion. This guarantees base resumes are
      // never overwritten — each enhancement becomes a separate, versioned
      // record linked to the application.
      await fetch("/api/resume-versions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId: targetAppId,
          baseResumeId: selectedResume || undefined,
          content: result.enhanced.text,
          isTailored: true,
        }),
      });

      setSavedToApp(true);
      onToast({
        message: applicationId
          ? "Enhanced resume saved as new version on this application"
          : "Saved as application with enhanced resume",
        variant: "success",
      });
    } catch {
      onToast({ message: "Save failed", variant: "error" });
    } finally {
      setSavingToApp(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      {/* ─── Left: Config ─── */}
      <div className="lg:col-span-2 space-y-4">
        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Enhance Existing Resume
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Review: current score + target path */}
            {currentScore != null && (
              <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-3">
                <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-1.5">Review</p>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[11px] text-gray-500">Current active score</p>
                    <p className="text-2xl font-bold text-gray-900 tabular-nums">{currentScore}%</p>
                  </div>
                  <ArrowRight className="w-4 h-4 text-gray-300" />
                  <div>
                    <p className="text-[11px] text-gray-500">Target</p>
                    <p className="text-2xl font-bold text-emerald-600 tabular-nums">95%+</p>
                  </div>
                </div>
                {currentScore < 95 && (
                  <p className="mt-2 text-[11px] text-gray-600 leading-relaxed">
                    Gap of <span className="font-semibold">{95 - currentScore} pts</span>. Generate rule
                    recommendations below for the fastest path to close it.
                  </p>
                )}
              </div>
            )}
            {selectedObj && (
              <div className="flex items-center gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2">
                <FileText className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                <p className="text-xs text-gray-700 truncate">
                  <span className="font-medium">Base resume:</span> {selectedObj.name}
                </p>
              </div>
            )}
            {/* Resume select */}
            <div className="space-y-1.5">
              <Label>
                Base Resume (DOCX) <span className="text-red-500">*</span>
              </Label>
              {resumesLoading ? (
                <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
              ) : docxResumes.length === 0 ? (
                <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50/50 px-3 py-3 text-center">
                  <p className="text-xs text-gray-500">
                    No DOCX resumes found in your library
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    PDF enhancement is not supported — upload a DOCX file
                  </p>
                </div>
              ) : (
                <Select value={selectedResume} onValueChange={setSelectedResume}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select a DOCX resume" />
                  </SelectTrigger>
                  <SelectContent>
                    {docxResumes.map((r) => (
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

            {/* Role + Company */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label htmlFor="enh-role">
                  Target Role <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="enh-role"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Senior Engineer"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="enh-company">
                  Company <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="enh-company"
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Google"
                />
              </div>
            </div>

            {/* Job Description */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="enh-jd">
                  Job Description <span className="text-red-500">*</span>
                </Label>
                <span className="text-[11px] text-gray-400 tabular-nums">
                  {jobDescription.length.toLocaleString()} chars
                </span>
              </div>
              <Textarea
                id="enh-jd"
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={8}
                placeholder="Paste the job description..."
                className="resize-y text-sm"
              />
            </div>

            {/* Sections to enhance */}
            <div className="space-y-2">
              <Label>Sections to Enhance</Label>
              <div className="space-y-1.5">
                {MODIFIABLE_SECTIONS.map((kind) => (
                  <label
                    key={kind}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2 rounded-lg border cursor-pointer transition-all",
                      sectionsToEnhance.has(kind)
                        ? "border-blue-200 bg-blue-50/50"
                        : "border-gray-200 bg-white hover:bg-gray-50"
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={sectionsToEnhance.has(kind)}
                      onChange={() => toggleSection(kind)}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {SECTION_LABELS[kind]}
                      </p>
                      <p className="text-[11px] text-gray-500">
                        {kind === "summary" && "Tailor summary to the target role"}
                        {kind === "skills" && "Add missing keywords from the JD"}
                        {kind === "experience" && "Enhance bullet points (last 1–2 roles)"}
                        {kind === "projects" && "Enhance project descriptions with JD keywords"}
                      </p>
                    </div>
                    <Pencil className="w-3.5 h-3.5 text-gray-400" />
                  </label>
                ))}
              </div>
              {/* Rule recommendations */}
              <div className="border-t border-gray-100 pt-3">
                {!recommendation ? (
                  <button
                    type="button"
                    onClick={fetchRecommendations}
                    disabled={!selectedResume || !jobDescription.trim() || loadingRecs}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors border",
                      (!selectedResume || !jobDescription.trim())
                        ? "border-gray-100 text-gray-300 cursor-not-allowed"
                        : "border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-50"
                    )}
                  >
                    {loadingRecs ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="w-3.5 h-3.5" />
                    )}
                    {loadingRecs ? "Analyzing..." : "Recommend Rules"}
                  </button>
                ) : (
                  <div className="rounded-lg border border-blue-200 bg-blue-50/40 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold text-blue-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        Recommended Rules
                      </p>
                      {recommendationAccepted ? (
                        <Badge variant="success" className="text-[10px]">Applied</Badge>
                      ) : (
                        <button
                          type="button"
                          onClick={acceptRecommendation}
                          className="text-[11px] font-medium text-blue-700 hover:text-blue-800"
                        >
                          Accept all
                        </button>
                      )}
                    </div>
                    <ul className="space-y-1 text-[11px] text-blue-900">
                      <li>
                        <span className="font-medium">Intensity:</span> {recommendation.rewriteIntensity}
                      </li>
                      <li>
                        <span className="font-medium">Preserve length:</span> {recommendation.preserveLength ? "yes" : "no"}
                      </li>
                      <li>
                        <span className="font-medium">Add new skills:</span> {recommendation.noNewSkills ? "no" : "yes"}
                      </li>
                      <li>
                        <span className="font-medium">Prioritize recent roles:</span> {recommendation.prioritizeRecent ? "yes" : "no"}
                      </li>
                      {recommendation.focusDomain && (
                        <li>
                          <span className="font-medium">Focus domain:</span> {recommendation.focusDomain}
                        </li>
                      )}
                    </ul>
                    {recommendation.reasons.length > 0 && (
                      <div className="mt-2 pt-2 border-t border-blue-200/50">
                        <p className="text-[10px] text-blue-700 uppercase tracking-wider mb-1">Why</p>
                        <ul className="space-y-0.5">
                          {recommendation.reasons.map((r, i) => (
                            <li key={i} className="text-[11px] text-blue-800 leading-relaxed">
                              • {r}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="mt-2 flex items-center gap-2">
                      <button
                        type="button"
                        onClick={fetchRecommendations}
                        className="text-[11px] text-blue-600 hover:text-blue-800"
                      >
                        Refresh
                      </button>
                      <span className="text-blue-300">·</span>
                      <button
                        type="button"
                        onClick={() => setRecommendation(null)}
                        className="text-[11px] text-gray-500 hover:text-gray-700"
                      >
                        Dismiss (edit manually)
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Rules */}
              <div className="border-t border-gray-100 pt-3 space-y-2">
                <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Rules</p>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={noNewSkills} onChange={(e) => setNoNewSkills(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-gray-700">Don&apos;t add new skills</span>
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <input type="checkbox" checked={preserveLength} onChange={(e) => setPreserveLength(e.target.checked)} className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                  <span className="text-gray-700">Preserve original length</span>
                </label>
                <div className="space-y-1">
                  <p className="text-xs text-gray-500">Rewrite intensity</p>
                  <div className="flex gap-1.5">
                    {(["light", "moderate", "aggressive"] as const).map((v) => (
                      <button
                        key={v}
                        type="button"
                        onClick={() => setRewriteIntensity(v)}
                        className={cn("px-3 py-1 rounded-md text-xs font-medium border transition-colors capitalize", rewriteIntensity === v ? "border-blue-200 bg-blue-50 text-blue-700" : "border-gray-200 text-gray-500 hover:bg-gray-50")}
                      >
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-amber-50/60 border border-amber-200/60">
                <ShieldCheck className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-800 leading-relaxed">
                  <span className="font-semibold">Preserved:</span> Name,
                  company names, dates, education, and certifications are never
                  modified.
                </p>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 text-red-700 text-sm">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Enhance button */}
            <Button
              variant="primary"
              className="w-full"
              onClick={handleEnhance}
              disabled={enhancing || !canEnhance}
            >
              {enhancing ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Parsing &amp; enhancing...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Enhance Resume
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* ─── Right: Preview ─── */}
      <div className="lg:col-span-3 space-y-4">
        {result ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {/* Toggle original / enhanced */}
                <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                  <button
                    onClick={() => setPreviewMode("enhanced")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      previewMode === "enhanced"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Enhanced
                  </button>
                  <button
                    onClick={() => setPreviewMode("diff")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      previewMode === "diff"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Diff
                  </button>
                  <button
                    onClick={() => setPreviewMode("original")}
                    className={cn(
                      "px-3 py-1 rounded-md text-xs font-medium transition-colors",
                      previewMode === "original"
                        ? "bg-white shadow-sm text-gray-900"
                        : "text-gray-500 hover:text-gray-700"
                    )}
                  >
                    Original
                  </button>
                </div>
                <Badge variant="secondary" className="text-[11px]">
                  {result.resumeName}
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 text-xs"
                  onClick={copyPreview}
                >
                  <Copy className="w-3 h-3 mr-1.5" />
                  Copy
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={() => handleDownload("pdf")}
                  disabled={downloading}
                >
                  <Download className="w-3.5 h-3.5 mr-1.5" />
                  PDF
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8"
                  onClick={() => handleDownload("docx")}
                  disabled={downloading}
                >
                  {downloading ? (
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                  ) : (
                    <Download className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  DOCX
                </Button>
                {!savedToApp ? (
                  <Button
                    variant="primary"
                    size="sm"
                    className="h-8"
                    onClick={handleSaveToApplication}
                    disabled={savingToApp}
                  >
                    {savingToApp ? (
                      <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 mr-1.5" />
                    )}
                    Save to App
                  </Button>
                ) : (
                  <Badge variant="success" className="text-xs h-8 px-3 flex items-center">Saved</Badge>
                )}
              </div>
            </div>

            {/* Engine / provider status */}
            {result.engine && (
              <div className="flex items-start gap-2 p-3 rounded-lg bg-gray-50 border border-gray-100 text-[11px] text-gray-600">
                <ShieldCheck className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                <div>
                  <span className="font-medium text-gray-700">{result.engine.label}</span>
                  {result.engine.providerConfigured ? (
                    <span className="text-gray-500"> · provider configured: {result.engine.providerName}{result.engine.providerModel ? ` (${result.engine.providerModel})` : ""}</span>
                  ) : (
                    <span className="text-gray-500"> · no external AI provider configured</span>
                  )}
                  <p className="mt-0.5 text-gray-500 leading-relaxed">{result.engine.note}</p>
                </div>
              </div>
            )}

            {/* Re-enhance CTA when score is below 95% */}
            {afterScore && afterScore.overallScore < 95 && (
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-amber-50 border border-amber-200">
                <Sparkles className="w-4 h-4 mt-0.5 shrink-0 text-amber-600" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-amber-900">
                    Score below 95% target ({afterScore.overallScore}%)
                  </p>
                  <p className="text-[11px] text-amber-800 mt-0.5 leading-relaxed">
                    Try &quot;aggressive&quot; rewrite intensity, enable more sections, or
                    re-run enhancement for further gains.
                  </p>
                </div>
                <Button
                  variant="primary"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={handleEnhance}
                  disabled={enhancing}
                >
                  {enhancing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1.5" />}
                  Enhance Again
                </Button>
              </div>
            )}

            {/* Score comparison */}
            {(beforeScore || afterScore) && (
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Match Score</p>
                    {afterScore && beforeScore && afterScore.overallScore > beforeScore.overallScore && (
                      <Badge variant="success" className="text-[10px]">+{afterScore.overallScore - beforeScore.overallScore}% improvement</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    {beforeScore && (
                      <div className="rounded-lg border border-gray-200 p-3">
                        <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Base Resume Score</p>
                        <MatchScoreCard overallScore={beforeScore.overallScore} skillsMatch={beforeScore.skillsMatch} experienceMatch={beforeScore.experienceMatch} keywordCoverage={beforeScore.keywordCoverage} domainMatch={beforeScore.domainMatch} compact />
                      </div>
                    )}
                    {afterScore && (
                      <div className="rounded-lg border border-blue-200 bg-blue-50/30 p-3">
                        <p className="text-[10px] text-blue-600 uppercase tracking-wider mb-2">Enhanced Resume Score</p>
                        <MatchScoreCard overallScore={afterScore.overallScore} skillsMatch={afterScore.skillsMatch} experienceMatch={afterScore.experienceMatch} keywordCoverage={afterScore.keywordCoverage} domainMatch={afterScore.domainMatch} compact />
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Sections preview */}
            <Card>
              <CardContent className="p-0 divide-y divide-gray-100">
                {previewMode === "diff" ? (
                  result.enhanced.sections.map((section, i) => {
                    const origSection = result.original.sections[i];
                    const origText = origSection ? origSection.lines.join("\n") : "";
                    const enhText = section.lines.join("\n");
                    const diffSpans = sectionsToEnhance.has(section.kind)
                      ? computeWordDiff(origText, enhText)
                      : null;

                    return (
                      <SectionPreview
                        key={`${section.kind}-${i}`}
                        section={section}
                        isEnhanced={sectionsToEnhance.has(section.kind)}
                        diffSpans={diffSpans}
                      />
                    );
                  })
                ) : (
                  (previewMode === "enhanced"
                    ? result.enhanced.sections
                    : result.original.sections
                  ).map((section, i) => (
                    <SectionPreview
                      key={`${section.kind}-${i}`}
                      section={section}
                      isEnhanced={
                        previewMode === "enhanced" &&
                        sectionsToEnhance.has(section.kind)
                      }
                    />
                  ))
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-20">
              <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mb-4">
                <Eye className="w-7 h-7 text-gray-400" />
              </div>
              <h3 className="text-sm font-semibold text-gray-600 mb-1">
                Resume Preview
              </h3>
              <p className="text-xs text-gray-400 text-center max-w-xs">
                Select a DOCX resume and click Enhance to see a side-by-side
                preview of the original and enhanced content.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

// ── section preview card ──

function SectionPreview({
  section,
  isEnhanced,
  diffSpans,
}: {
  section: SectionData;
  isEnhanced: boolean;
  diffSpans?: DiffSpan[] | null;
}) {
  const label = SECTION_LABELS[section.kind] || section.title || "Section";

  return (
    <div className="px-5 py-4">
      <div className="flex items-center gap-2 mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
          {label}
        </h4>
        {isEnhanced ? (
          <Badge variant="info" className="text-[10px] px-1.5 py-0">
            <Sparkles className="w-2.5 h-2.5 mr-0.5" />
            Enhanced
          </Badge>
        ) : section.modifiable ? (
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Unchanged
          </Badge>
        ) : (
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            <Lock className="w-2.5 h-2.5 mr-0.5" />
            Preserved
          </Badge>
        )}
      </div>
      <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
        {diffSpans ? (
          <p>
            {diffSpans.map((span, i) => {
              if (span.type === "added") return <span key={i} className="bg-emerald-100 text-emerald-800 rounded-sm px-0.5">{span.text}</span>;
              if (span.type === "removed") return <span key={i} className="bg-red-100 text-red-800 line-through rounded-sm px-0.5">{span.text}</span>;
              return <span key={i}>{span.text}</span>;
            })}
          </p>
        ) : section.lines.filter(Boolean).length > 0 ? (
          section.lines.map((line, i) => (
            <p key={i} className={cn("mb-1", !line && "h-2")}>{line}</p>
          ))
        ) : (
          <p className="text-gray-400 italic text-xs">Empty section</p>
        )}
      </div>
    </div>
  );
}
