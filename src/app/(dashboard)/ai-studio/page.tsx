"use client";

import React, { useEffect, useState } from "react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, FileText, Copy, Save, Download } from "lucide-react";

interface BaseResume {
  id: string;
  name: string;
  roleCategory?: string;
}

export default function AIStudioPage() {
  const [resumes, setResumes] = useState<BaseResume[]>([]);
  const [jobDescription, setJobDescription] = useState("");
  const [role, setRole] = useState("");
  const [company, setCompany] = useState("");
  const [selectedResume, setSelectedResume] = useState("");
  const [generating, setGenerating] = useState(false);
  const [generatedResume, setGeneratedResume] = useState("");
  const [generatedCoverLetter, setGeneratedCoverLetter] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch("/api/resumes")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) setResumes(data);
      })
      .catch(console.error);
  }, []);

  const handleGenerate = async () => {
    if (!jobDescription || !role || !company) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription,
          role,
          company,
          baseResumeId: selectedResume || undefined,
          type: "both",
        }),
      });
      const data = await res.json();
      setGeneratedResume(data.resume || "");
      setGeneratedCoverLetter(data.coverLetter || "");
    } catch (error) {
      console.error("Generation failed:", error);
    } finally {
      setGenerating(false);
    }
  };

  const handleSaveAsApplication = async () => {
    setSaving(true);
    try {
      const res = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobTitle: role,
          company,
          jobDescription,
          status: "not_applied",
        }),
      });
      const app = await res.json();

      if (generatedCoverLetter) {
        await fetch("/api/cover-letters", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            applicationId: app.id,
            jobTitle: role,
            company,
            content: generatedCoverLetter,
          }),
        });
      }

      alert("Application saved successfully!");
    } catch (error) {
      console.error("Save failed:", error);
    } finally {
      setSaving(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <>
      <PageHeader
        title="AI Studio"
        description="Generate tailored resumes and cover letters"
      />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-blue-600" />
              Input
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Role / Job Title</Label>
                <Input
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="Senior Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label>Company</Label>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Google"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Base Resume</Label>
              <Select value={selectedResume} onValueChange={setSelectedResume}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a base resume (optional)" />
                </SelectTrigger>
                <SelectContent>
                  {resumes.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.name}
                      {r.roleCategory && ` (${r.roleCategory})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Job Description</Label>
              <Textarea
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
                rows={12}
                placeholder="Paste the full job description here..."
              />
            </div>

            <Button
              variant="primary"
              className="w-full"
              onClick={handleGenerate}
              disabled={generating || !jobDescription || !role || !company}
            >
              {generating ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 mr-2" />
                  Generate Documents
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <div className="space-y-4">
          {(generatedResume || generatedCoverLetter) && (
            <div className="flex justify-end">
              <Button
                variant="outline"
                size="sm"
                onClick={handleSaveAsApplication}
                disabled={saving}
              >
                <Save className="w-4 h-4 mr-1.5" />
                {saving ? "Saving..." : "Save as Application"}
              </Button>
            </div>
          )}

          <Card>
            <CardContent className="p-0">
              <Tabs defaultValue="resume">
                <div className="border-b border-gray-200 px-4 pt-4">
                  <TabsList>
                    <TabsTrigger value="resume">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Tailored Resume
                    </TabsTrigger>
                    <TabsTrigger value="cover-letter">
                      <FileText className="w-3.5 h-3.5 mr-1.5" />
                      Cover Letter
                    </TabsTrigger>
                  </TabsList>
                </div>

                <TabsContent value="resume" className="p-4">
                  {generatedResume ? (
                    <>
                      <div className="flex justify-end gap-2 mb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => copyToClipboard(generatedResume)}
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download
                        </Button>
                      </div>
                      <div className="bg-gray-50 rounded-lg p-4 text-sm whitespace-pre-wrap text-gray-700 leading-relaxed font-mono max-h-[500px] overflow-y-auto">
                        {generatedResume}
                      </div>
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        Generated resume will appear here
                      </p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="cover-letter" className="p-4">
                  {generatedCoverLetter ? (
                    <>
                      <div className="flex justify-end gap-2 mb-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            copyToClipboard(generatedCoverLetter)
                          }
                        >
                          <Copy className="w-3.5 h-3.5 mr-1.5" />
                          Copy
                        </Button>
                        <Button variant="ghost" size="sm">
                          <Download className="w-3.5 h-3.5 mr-1.5" />
                          Download
                        </Button>
                      </div>
                      <Textarea
                        value={generatedCoverLetter}
                        onChange={(e) =>
                          setGeneratedCoverLetter(e.target.value)
                        }
                        rows={16}
                        className="font-mono text-sm"
                      />
                    </>
                  ) : (
                    <div className="text-center py-12">
                      <FileText className="w-8 h-8 text-gray-300 mx-auto mb-3" />
                      <p className="text-sm text-gray-500">
                        Generated cover letter will appear here
                      </p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
