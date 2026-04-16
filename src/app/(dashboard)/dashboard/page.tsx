"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Briefcase,
  TrendingUp,
  FileText,
  Sparkles,
  ArrowRight,
  Plus,
  Send,
  Target,
  Wrench,
  Mail,
} from "lucide-react";
import { getStatusLabel, getStatusColor, APPLICATION_STATUSES, cn } from "@/lib/utils";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
  updatedAt: string;
  matchScore?: number | null;
}

interface Stats {
  totalApplications: number;
  activeApplications: number;
  appliedCount: number;
  interviewRate: number;
  offerRate: number;
  responseRate: number;
  statusDistribution: { name: string; value: number }[];
  weeklyActivity: { name: string; applications: number }[];
  upcomingReminders?: { id: string; jobTitle: string; company: string; followUpDate: string }[];
}

const STATUS_DOT_COLORS: Record<string, string> = {
  not_applied: "bg-gray-400",
  saved: "bg-blue-400",
  applied: "bg-indigo-400",
  screening: "bg-purple-400",
  interview: "bg-amber-400",
  offer: "bg-emerald-400",
  rejected: "bg-red-400",
  archived: "bg-gray-300",
};

export default function DashboardPage() {
  const [applications, setApplications] = useState<Application[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/applications").then((r) => r.json()),
      fetch("/api/analytics").then((r) => r.json()),
    ])
      .then(([apps, analytics]) => {
        setApplications(Array.isArray(apps) ? apps : []);
        setStats(analytics);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-24 bg-gray-200 rounded-xl" />
          ))}
        </div>
        <div className="h-40 bg-gray-200 rounded-xl" />
      </div>
    );
  }

  // Pipeline counts
  const pipeline: Record<string, number> = {};
  for (const s of APPLICATION_STATUSES) pipeline[s] = 0;
  for (const app of applications) {
    if (pipeline[app.status] !== undefined) pipeline[app.status]++;
  }
  const pipelineTotal = applications.length || 1;

  // Weekly sparkline data
  const weeklyData = stats?.weeklyActivity || [];
  const weekMax = Math.max(...weeklyData.map((w) => w.applications), 1);

  const statCards = [
    { label: "Total", value: stats?.totalApplications || 0, icon: Briefcase, color: "text-blue-600 bg-blue-50" },
    { label: "Applied", value: stats?.appliedCount || 0, icon: Send, color: "text-indigo-600 bg-indigo-50" },
    { label: "Interview Rate", value: `${stats?.interviewRate || 0}%`, icon: Target, color: "text-purple-600 bg-purple-50" },
    { label: "Response Rate", value: `${stats?.responseRate || 0}%`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-50" },
  ];

  return (
    <>
      <PageHeader
        title="Command Center"
        description="Your job search at a glance"
        action={
          <Link href="/applications">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          </Link>
        }
      />

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold text-gray-900 mt-0.5 tabular-nums">{stat.value}</p>
                </div>
                <div className={cn("p-2 rounded-xl", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Pipeline Bar + Weekly Sparkline */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-6">
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Pipeline</CardTitle>
            <Link href="/applications">
              <Button variant="ghost" size="sm" className="h-7 text-xs">View Kanban <ArrowRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            {/* Stacked bar */}
            <div className="flex rounded-full h-3 overflow-hidden bg-gray-100 mb-4">
              {APPLICATION_STATUSES.filter((s) => pipeline[s] > 0).map((s) => (
                <div
                  key={s}
                  className={cn("h-full transition-all", STATUS_DOT_COLORS[s])}
                  style={{ width: `${(pipeline[s] / pipelineTotal) * 100}%` }}
                  title={`${getStatusLabel(s)}: ${pipeline[s]}`}
                />
              ))}
            </div>
            <div className="grid grid-cols-4 gap-2">
              {APPLICATION_STATUSES.filter((s) => pipeline[s] > 0).map((s) => (
                <div key={s} className="flex items-center gap-1.5">
                  <span className={cn("w-2 h-2 rounded-full shrink-0", STATUS_DOT_COLORS[s])} />
                  <span className="text-[11px] text-gray-600 truncate">{getStatusLabel(s)}</span>
                  <span className="text-[11px] font-semibold text-gray-900 ml-auto tabular-nums">{pipeline[s]}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-sm font-semibold">Weekly Activity</CardTitle>
            <Link href="/analytics">
              <Button variant="ghost" size="sm" className="h-7 text-xs">Details <ArrowRight className="w-3 h-3 ml-1" /></Button>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="flex items-end gap-1 h-20">
              {weeklyData.slice(-12).map((w, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                  <div
                    className="w-full rounded-sm bg-blue-500/80 transition-all min-h-[2px]"
                    style={{ height: `${Math.max((w.applications / weekMax) * 100, 4)}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5">
              <span className="text-[10px] text-gray-400">{weeklyData[0]?.name || ""}</span>
              <span className="text-[10px] text-gray-400">{weeklyData[weeklyData.length - 1]?.name || ""}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions + Recent Applications */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="text-sm font-semibold">Recent Applications</CardTitle>
              <Link href="/applications">
                <Button variant="ghost" size="sm" className="h-7 text-xs">View all <ArrowRight className="w-3 h-3 ml-1" /></Button>
              </Link>
            </CardHeader>
            <CardContent>
              {applications.length === 0 ? (
                <div className="text-center py-10">
                  <p className="text-sm text-gray-500">No applications yet</p>
                  <Link href="/applications">
                    <Button variant="outline" size="sm" className="mt-3">Create your first application</Button>
                  </Link>
                </div>
              ) : (
                <div className="space-y-1">
                  {applications.slice(0, 6).map((app) => (
                    <Link
                      key={app.id}
                      href={`/applications/${app.id}`}
                      className="flex items-center justify-between p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">{app.jobTitle}</p>
                        <p className="text-xs text-gray-500">{app.company}</p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {app.matchScore != null && app.matchScore > 0 && (
                          <span className="text-[10px] font-semibold text-gray-500 tabular-nums">{app.matchScore}%</span>
                        )}
                        <Badge className={getStatusColor(app.status)} variant="secondary">
                          {getStatusLabel(app.status)}
                        </Badge>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {/* Upcoming Reminders */}
          {stats?.upcomingReminders && stats.upcomingReminders.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                  Follow-ups
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1.5">
                {stats.upcomingReminders.map((r) => (
                  <Link key={r.id} href={`/applications/${r.id}`} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 transition-colors group">
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-gray-900 truncate group-hover:text-blue-600">{r.jobTitle}</p>
                      <p className="text-[11px] text-gray-500">{r.company}</p>
                    </div>
                    <span className="text-[11px] text-amber-600 font-medium shrink-0">
                      {new Date(r.followUpDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <Link href="/applications" className="block">
                <QuickAction icon={<Plus className="w-4 h-4" />} label="New Application" desc="Track a new job" />
              </Link>
              <Link href="/ai-studio" className="block">
                <QuickAction icon={<Sparkles className="w-4 h-4" />} label="Generate Documents" desc="Resume + cover letter" />
              </Link>
              <Link href="/ai-studio?mode=enhance" className="block">
                <QuickAction icon={<Wrench className="w-4 h-4" />} label="Enhance Resume" desc="Tailor existing DOCX" />
              </Link>
              <Link href="/resume-library" className="block">
                <QuickAction icon={<FileText className="w-4 h-4" />} label="Upload Resume" desc="Add to your library" />
              </Link>
              <Link href="/analytics" className="block">
                <QuickAction icon={<TrendingUp className="w-4 h-4" />} label="View Analytics" desc="Track your progress" />
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}

function QuickAction({ icon, label, desc }: { icon: React.ReactNode; label: string; desc: string }) {
  return (
    <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg border border-gray-200 hover:border-blue-200 hover:bg-blue-50/30 transition-all cursor-pointer group">
      <div className="p-1.5 rounded-lg bg-gray-100 text-gray-500 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">{icon}</div>
      <div>
        <p className="text-sm font-medium text-gray-900">{label}</p>
        <p className="text-[11px] text-gray-500">{desc}</p>
      </div>
    </div>
  );
}
