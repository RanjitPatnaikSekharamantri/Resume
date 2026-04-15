"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useSession } from "next-auth/react";
import { PageHeader } from "@/components/layout/page-header";
import { ProfileSection, FieldDisplay } from "@/components/profile/profile-section";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  User,
  Link2,
  Shield,
  Heart,
  MapPin,
  Mail,
  Phone,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

// ── option sets for select dropdowns ──

const WORK_AUTH_OPTIONS = [
  "US Citizen",
  "Permanent Resident (Green Card)",
  "H-1B Visa",
  "L-1 Visa",
  "OPT / CPT",
  "TN Visa",
  "EAD",
  "Other",
];

const REMOTE_PREF_OPTIONS = [
  "Remote Only",
  "Hybrid",
  "On-site",
  "No Preference",
];

const GENDER_OPTIONS = [
  "Male",
  "Female",
  "Non-binary",
  "Prefer not to say",
  "Other",
];

const ETHNICITY_OPTIONS = [
  "American Indian or Alaska Native",
  "Asian",
  "Black or African American",
  "Hispanic or Latino",
  "Native Hawaiian or Other Pacific Islander",
  "White",
  "Two or More Races",
  "Prefer not to say",
];

const VETERAN_OPTIONS = [
  "I am not a protected veteran",
  "I identify as one or more of the classifications of a protected veteran",
  "Prefer not to say",
];

const DISABILITY_OPTIONS = [
  "Yes, I have a disability (or previously had a disability)",
  "No, I do not have a disability",
  "Prefer not to say",
];

// ── types ──

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

const EMPTY_PROFILE: ProfileData = {
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
};

// ── toast component ──

function Toast({
  message,
  variant,
  onDismiss,
}: {
  message: string;
  variant: "success" | "error";
  onDismiss: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onDismiss, 4000);
    return () => clearTimeout(t);
  }, [onDismiss]);

  return (
    <div
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-2.5 rounded-xl border px-4 py-3 shadow-lg transition-all animate-in slide-in-from-bottom-4 fade-in ${
        variant === "success"
          ? "border-emerald-200 bg-emerald-50 text-emerald-800"
          : "border-red-200 bg-red-50 text-red-800"
      }`}
    >
      {variant === "success" ? (
        <CheckCircle2 className="w-4 h-4 shrink-0" />
      ) : (
        <AlertCircle className="w-4 h-4 shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
    </div>
  );
}

// ── main page ──

export default function ProfilePage() {
  const { data: session, update: updateSession } = useSession();

  const [name, setName] = useState("");
  const [profile, setProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [savedProfile, setSavedProfile] = useState<ProfileData>(EMPTY_PROFILE);
  const [savedName, setSavedName] = useState("");
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{
    message: string;
    variant: "success" | "error";
  } | null>(null);

  const fetchProfile = useCallback(async () => {
    try {
      const res = await fetch("/api/profile");
      if (!res.ok) return;
      const data = await res.json();
      if (!data) return;
      const loaded: ProfileData = {
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
      };
      setProfile(loaded);
      setSavedProfile(loaded);
      if (data.user?.name) {
        setName(data.user.name);
        setSavedName(data.user.name);
      }
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session?.user?.name && !name) {
      setName(session.user.name);
      setSavedName(session.user.name);
    }
    fetchProfile();
  }, [session, fetchProfile, name]);

  const updateField = (field: keyof ProfileData, value: string) => {
    setProfile((prev) => ({ ...prev, [field]: value }));
  };

  const saveSection = async (fields: Partial<ProfileData & { name?: string }>) => {
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fields),
      });
      if (!res.ok) throw new Error("Save failed");

      setSavedProfile((prev) => {
        const next = { ...prev };
        for (const [k, v] of Object.entries(fields)) {
          if (k !== "name" && k in next) {
            (next as Record<string, string>)[k] = v as string;
          }
        }
        return next;
      });
      if (fields.name) {
        setSavedName(fields.name);
        await updateSession({ name: fields.name });
      }

      setToast({ message: "Changes saved", variant: "success" });
    } catch {
      setToast({ message: "Failed to save changes", variant: "error" });
      throw new Error("save_failed");
    }
  };

  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
    : session?.user?.email?.[0]?.toUpperCase() || "?";

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded animate-pulse" />
        <div className="flex items-center gap-4 animate-pulse">
          <div className="h-16 w-16 rounded-full bg-gray-200" />
          <div className="space-y-2">
            <div className="h-5 w-40 bg-gray-200 rounded" />
            <div className="h-4 w-56 bg-gray-200 rounded" />
          </div>
        </div>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-52 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  // ── completeness indicator ──

  const filledCount = [
    name,
    profile.phone,
    profile.location,
    profile.summary,
    profile.linkedIn,
    profile.github,
    profile.website,
    profile.workAuthorization,
    profile.preferredRole,
    profile.salaryExpectation,
    profile.remotePreference,
  ].filter(Boolean).length;
  const totalFields = 11;
  const completeness = Math.round((filledCount / totalFields) * 100);

  return (
    <>
      <PageHeader
        title="Profile"
        description="Manage your personal information and preferences"
      />

      {/* Avatar header */}
      <div className="mb-8 flex items-center gap-5">
        <Avatar className="h-16 w-16">
          <AvatarFallback className="text-lg bg-blue-100 text-blue-700 font-semibold">
            {initials}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-semibold text-gray-900 truncate">
            {name || "Your Name"}
          </h2>
          <div className="flex items-center gap-3 mt-1 text-sm text-gray-500 flex-wrap">
            {session?.user?.email && (
              <span className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                {session.user.email}
              </span>
            )}
            {profile.location && (
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                {profile.location}
              </span>
            )}
            {profile.phone && (
              <span className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                {profile.phone}
              </span>
            )}
          </div>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1">
          <Badge variant={completeness === 100 ? "success" : "secondary"}>
            {completeness}% complete
          </Badge>
          <div className="w-24 h-1.5 rounded-full bg-gray-200 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                completeness === 100 ? "bg-emerald-500" : "bg-blue-500"
              }`}
              style={{ width: `${completeness}%` }}
            />
          </div>
        </div>
      </div>

      <div className="space-y-6">
        {/* ─── Section 1: Personal Information ─── */}
        <ProfileSection
          title="Personal Information"
          description="Your basic contact details and professional summary"
          icon={<User className="w-4 h-4" />}
          onSave={() =>
            saveSection({
              name,
              phone: profile.phone,
              location: profile.location,
              summary: profile.summary,
              preferredRole: profile.preferredRole,
              preferredLocation: profile.preferredLocation,
              salaryExpectation: profile.salaryExpectation,
              remotePreference: profile.remotePreference,
            })
          }
        >
          {(editing) =>
            editing ? (
              <div className="space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-name">Full Name</Label>
                    <Input
                      id="prof-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="John Doe"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Email</Label>
                    <Input
                      value={session?.user?.email || ""}
                      disabled
                      className="bg-gray-50 text-gray-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-phone">Phone</Label>
                    <Input
                      id="prof-phone"
                      value={profile.phone}
                      onChange={(e) => updateField("phone", e.target.value)}
                      placeholder="+1 (555) 000-0000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="prof-location">Location</Label>
                    <Input
                      id="prof-location"
                      value={profile.location}
                      onChange={(e) => updateField("location", e.target.value)}
                      placeholder="San Francisco, CA"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-summary">Professional Summary</Label>
                  <Textarea
                    id="prof-summary"
                    value={profile.summary}
                    onChange={(e) => updateField("summary", e.target.value)}
                    rows={4}
                    placeholder="Brief summary of your experience and career goals..."
                    className="resize-y"
                  />
                  <p className="text-xs text-gray-400">
                    {profile.summary.length}/500 characters
                  </p>
                </div>
                <div className="border-t border-gray-100 pt-4">
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                    Job Preferences
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-role">Preferred Role</Label>
                      <Input
                        id="prof-role"
                        value={profile.preferredRole}
                        onChange={(e) =>
                          updateField("preferredRole", e.target.value)
                        }
                        placeholder="Senior Software Engineer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-prefloc">Preferred Location</Label>
                      <Input
                        id="prof-prefloc"
                        value={profile.preferredLocation}
                        onChange={(e) =>
                          updateField("preferredLocation", e.target.value)
                        }
                        placeholder="Remote, NYC, SF Bay Area..."
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor="prof-salary">Salary Expectation</Label>
                      <Input
                        id="prof-salary"
                        value={profile.salaryExpectation}
                        onChange={(e) =>
                          updateField("salaryExpectation", e.target.value)
                        }
                        placeholder="$150,000 - $180,000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label>Remote Preference</Label>
                      <Select
                        value={profile.remotePreference || undefined}
                        onValueChange={(v) => updateField("remotePreference", v)}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select preference" />
                        </SelectTrigger>
                        <SelectContent>
                          {REMOTE_PREF_OPTIONS.map((opt) => (
                            <SelectItem key={opt} value={opt}>
                              {opt}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                  <FieldDisplay label="Full Name" value={name} />
                  <FieldDisplay
                    label="Email"
                    value={session?.user?.email}
                  />
                  <FieldDisplay
                    label="Phone"
                    value={profile.phone}
                    placeholder="Add phone number"
                  />
                  <FieldDisplay
                    label="Location"
                    value={profile.location}
                    placeholder="Add location"
                  />
                </div>
                {profile.summary && (
                  <div className="space-y-1 pt-1">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Professional Summary
                    </p>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">
                      {profile.summary}
                    </p>
                  </div>
                )}
                {(profile.preferredRole ||
                  profile.preferredLocation ||
                  profile.salaryExpectation ||
                  profile.remotePreference) && (
                  <div className="border-t border-gray-100 pt-4">
                    <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
                      Job Preferences
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-4">
                      <FieldDisplay
                        label="Preferred Role"
                        value={profile.preferredRole}
                        placeholder="Not set"
                      />
                      <FieldDisplay
                        label="Preferred Location"
                        value={profile.preferredLocation}
                        placeholder="Not set"
                      />
                      <FieldDisplay
                        label="Salary Expectation"
                        value={profile.salaryExpectation}
                        placeholder="Not set"
                      />
                      <FieldDisplay
                        label="Remote Preference"
                        value={profile.remotePreference}
                        placeholder="Not set"
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          }
        </ProfileSection>

        {/* ─── Section 2: Links ─── */}
        <ProfileSection
          title="Links"
          description="Your online presence and portfolio"
          icon={<Link2 className="w-4 h-4" />}
          onSave={() =>
            saveSection({
              linkedIn: profile.linkedIn,
              website: profile.website,
              github: profile.github,
              portfolio: profile.portfolio,
            })
          }
        >
          {(editing) =>
            editing ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="prof-linkedin">LinkedIn</Label>
                  <Input
                    id="prof-linkedin"
                    value={profile.linkedIn}
                    onChange={(e) => updateField("linkedIn", e.target.value)}
                    placeholder="https://linkedin.com/in/johndoe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-website">Website</Label>
                  <Input
                    id="prof-website"
                    value={profile.website}
                    onChange={(e) => updateField("website", e.target.value)}
                    placeholder="https://johndoe.com"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-github">GitHub</Label>
                  <Input
                    id="prof-github"
                    value={profile.github}
                    onChange={(e) => updateField("github", e.target.value)}
                    placeholder="https://github.com/johndoe"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="prof-portfolio">Portfolio</Label>
                  <Input
                    id="prof-portfolio"
                    value={profile.portfolio}
                    onChange={(e) => updateField("portfolio", e.target.value)}
                    placeholder="https://portfolio.johndoe.com"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                <LinkDisplay label="LinkedIn" value={profile.linkedIn} />
                <LinkDisplay label="Website" value={profile.website} />
                <LinkDisplay label="GitHub" value={profile.github} />
                <LinkDisplay label="Portfolio" value={profile.portfolio} />
              </div>
            )
          }
        </ProfileSection>

        {/* ─── Section 3: Work Authorization ─── */}
        <ProfileSection
          title="Work Authorization"
          description="Your employment eligibility status"
          icon={<Shield className="w-4 h-4" />}
          onSave={() =>
            saveSection({
              workAuthorization: profile.workAuthorization,
            })
          }
        >
          {(editing) =>
            editing ? (
              <div className="max-w-md space-y-1.5">
                <Label>Authorization Status</Label>
                <Select
                  value={profile.workAuthorization || undefined}
                  onValueChange={(v) => updateField("workAuthorization", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select your work authorization" />
                  </SelectTrigger>
                  <SelectContent>
                    {WORK_AUTH_OPTIONS.map((opt) => (
                      <SelectItem key={opt} value={opt}>
                        {opt}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <FieldDisplay
                label="Authorization Status"
                value={profile.workAuthorization}
                placeholder="Not set — click Edit to add"
              />
            )
          }
        </ProfileSection>

        {/* ─── Section 4: Equal Opportunity (Optional) ─── */}
        <ProfileSection
          title="Equal Opportunity"
          description="Optional — used only to pre-fill application forms"
          icon={<Heart className="w-4 h-4" />}
          onSave={() =>
            saveSection({
              gender: profile.gender,
              ethnicity: profile.ethnicity,
              veteranStatus: profile.veteranStatus,
              disabilityStatus: profile.disabilityStatus,
            })
          }
        >
          {(editing) =>
            editing ? (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  Providing this information is entirely voluntary. It will
                  never be shared externally — it is only used to pre-fill
                  equal opportunity questions on job application forms.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label>Gender</Label>
                    <Select
                      value={profile.gender || undefined}
                      onValueChange={(v) => updateField("gender", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {GENDER_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Ethnicity</Label>
                    <Select
                      value={profile.ethnicity || undefined}
                      onValueChange={(v) => updateField("ethnicity", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {ETHNICITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Veteran Status</Label>
                    <Select
                      value={profile.veteranStatus || undefined}
                      onValueChange={(v) => updateField("veteranStatus", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {VETERAN_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label>Disability Status</Label>
                    <Select
                      value={profile.disabilityStatus || undefined}
                      onValueChange={(v) => updateField("disabilityStatus", v)}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select" />
                      </SelectTrigger>
                      <SelectContent>
                        {DISABILITY_OPTIONS.map((opt) => (
                          <SelectItem key={opt} value={opt}>
                            {opt}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-xs text-gray-500 leading-relaxed">
                  This information is optional and only used to pre-fill
                  application forms.
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
                  <FieldDisplay
                    label="Gender"
                    value={profile.gender}
                    placeholder="Not provided"
                  />
                  <FieldDisplay
                    label="Ethnicity"
                    value={profile.ethnicity}
                    placeholder="Not provided"
                  />
                  <FieldDisplay
                    label="Veteran Status"
                    value={profile.veteranStatus}
                    placeholder="Not provided"
                  />
                  <FieldDisplay
                    label="Disability Status"
                    value={profile.disabilityStatus}
                    placeholder="Not provided"
                  />
                </div>
              </div>
            )
          }
        </ProfileSection>
      </div>

      {toast && (
        <Toast
          message={toast.message}
          variant={toast.variant}
          onDismiss={() => setToast(null)}
        />
      )}
    </>
  );
}

// ── Link display helper ──

function LinkDisplay({
  label,
  value,
}: {
  label: string;
  value: string | undefined | null;
}) {
  if (!value) {
    return (
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
          {label}
        </p>
        <p className="text-sm text-gray-400 italic">Not set</p>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">
        {label}
      </p>
      <a
        href={value.startsWith("http") ? value : `https://${value}`}
        target="_blank"
        rel="noopener noreferrer"
        className="text-sm text-blue-600 hover:text-blue-700 hover:underline break-all"
      >
        {value}
      </a>
    </div>
  );
}
