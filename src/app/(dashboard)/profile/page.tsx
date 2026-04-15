"use client";

import React, { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Save } from "lucide-react";

interface ProfileData {
  phone: string;
  location: string;
  linkedIn: string;
  website: string;
  github: string;
  portfolio: string;
  workAuthorization: string;
  veteranStatus: string;
  disabilityStatus: string;
  ethnicity: string;
  gender: string;
  preferredRole: string;
  preferredLocation: string;
  salaryExpectation: string;
  remotePreference: string;
  summary: string;
}

export default function ProfilePage() {
  const { data: session } = useSession();
  const [name, setName] = useState("");
  const [profile, setProfile] = useState<ProfileData>({
    phone: "",
    location: "",
    linkedIn: "",
    website: "",
    github: "",
    portfolio: "",
    workAuthorization: "",
    veteranStatus: "",
    disabilityStatus: "",
    ethnicity: "",
    gender: "",
    preferredRole: "",
    preferredLocation: "",
    salaryExpectation: "",
    remotePreference: "",
    summary: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (session?.user?.name) setName(session.user.name);
    fetch("/api/profile")
      .then((r) => r.json())
      .then((data) => {
        if (data) {
          setProfile((prev) => ({
            ...prev,
            phone: data.phone || "",
            location: data.location || "",
            linkedIn: data.linkedIn || "",
            website: data.website || "",
            github: data.github || "",
            portfolio: data.portfolio || "",
            workAuthorization: data.workAuthorization || "",
            veteranStatus: data.veteranStatus || "",
            disabilityStatus: data.disabilityStatus || "",
            ethnicity: data.ethnicity || "",
            gender: data.gender || "",
            preferredRole: data.preferredRole || "",
            preferredLocation: data.preferredLocation || "",
            salaryExpectation: data.salaryExpectation || "",
            remotePreference: data.remotePreference || "",
            summary: data.summary || "",
          }));
          if (data.user?.name) setName(data.user.name);
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [session]);

  const handleSave = async () => {
    setSaving(true);
    setMessage("");
    try {
      await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, ...profile }),
      });
      setMessage("Profile saved successfully");
      setTimeout(() => setMessage(""), 3000);
    } catch {
      setMessage("Failed to save profile");
    } finally {
      setSaving(false);
    }
  };

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="h-96 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal information"
        action={
          <Button variant="primary" size="sm" onClick={handleSave} disabled={saving}>
            <Save className="w-4 h-4 mr-2" />
            {saving ? "Saving..." : "Save Profile"}
          </Button>
        }
      />

      {message && (
        <div
          className={`mb-6 p-3 rounded-lg text-sm ${
            message.includes("success")
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {message}
        </div>
      )}

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Full Name</Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input value={session?.user?.email || ""} disabled />
              </div>
              <div className="space-y-2">
                <Label>Phone</Label>
                <Input
                  value={profile.phone}
                  onChange={(e) => updateField("phone", e.target.value)}
                  placeholder="+1 (555) 000-0000"
                />
              </div>
              <div className="space-y-2">
                <Label>Location</Label>
                <Input
                  value={profile.location}
                  onChange={(e) => updateField("location", e.target.value)}
                  placeholder="City, State"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Professional Summary</Label>
              <Textarea
                value={profile.summary}
                onChange={(e) => updateField("summary", e.target.value)}
                rows={4}
                placeholder="Brief summary of your professional background..."
              />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>LinkedIn</Label>
                <Input
                  value={profile.linkedIn}
                  onChange={(e) => updateField("linkedIn", e.target.value)}
                  placeholder="https://linkedin.com/in/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Website</Label>
                <Input
                  value={profile.website}
                  onChange={(e) => updateField("website", e.target.value)}
                  placeholder="https://..."
                />
              </div>
              <div className="space-y-2">
                <Label>GitHub</Label>
                <Input
                  value={profile.github}
                  onChange={(e) => updateField("github", e.target.value)}
                  placeholder="https://github.com/..."
                />
              </div>
              <div className="space-y-2">
                <Label>Portfolio</Label>
                <Input
                  value={profile.portfolio}
                  onChange={(e) => updateField("portfolio", e.target.value)}
                  placeholder="https://..."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preferences</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Preferred Role</Label>
                <Input
                  value={profile.preferredRole}
                  onChange={(e) => updateField("preferredRole", e.target.value)}
                  placeholder="Software Engineer"
                />
              </div>
              <div className="space-y-2">
                <Label>Preferred Location</Label>
                <Input
                  value={profile.preferredLocation}
                  onChange={(e) =>
                    updateField("preferredLocation", e.target.value)
                  }
                  placeholder="Remote, NYC, SF..."
                />
              </div>
              <div className="space-y-2">
                <Label>Salary Expectation</Label>
                <Input
                  value={profile.salaryExpectation}
                  onChange={(e) =>
                    updateField("salaryExpectation", e.target.value)
                  }
                  placeholder="$120k - $150k"
                />
              </div>
              <div className="space-y-2">
                <Label>Remote Preference</Label>
                <Input
                  value={profile.remotePreference}
                  onChange={(e) =>
                    updateField("remotePreference", e.target.value)
                  }
                  placeholder="Remote, Hybrid, On-site"
                />
              </div>
              <div className="space-y-2">
                <Label>Work Authorization</Label>
                <Input
                  value={profile.workAuthorization}
                  onChange={(e) =>
                    updateField("workAuthorization", e.target.value)
                  }
                  placeholder="US Citizen, Green Card, etc."
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Equal Opportunity (Optional)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-gray-500 mb-4">
              This information is optional and is only used to auto-fill forms.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Gender</Label>
                <Input
                  value={profile.gender}
                  onChange={(e) => updateField("gender", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Ethnicity</Label>
                <Input
                  value={profile.ethnicity}
                  onChange={(e) => updateField("ethnicity", e.target.value)}
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Veteran Status</Label>
                <Input
                  value={profile.veteranStatus}
                  onChange={(e) =>
                    updateField("veteranStatus", e.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
              <div className="space-y-2">
                <Label>Disability Status</Label>
                <Input
                  value={profile.disabilityStatus}
                  onChange={(e) =>
                    updateField("disabilityStatus", e.target.value)
                  }
                  placeholder="Optional"
                />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
