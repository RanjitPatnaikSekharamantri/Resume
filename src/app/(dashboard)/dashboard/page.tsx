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
} from "lucide-react";
import { getStatusLabel, getStatusColor } from "@/lib/utils";

interface Application {
  id: string;
  jobTitle: string;
  company: string;
  status: string;
  updatedAt: string;
  matchScore?: number;
}

interface Stats {
  totalApplications: number;
  activeApplications: number;
  interviewRate: number;
  offerRate: number;
}

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
        setApplications(apps.slice?.(0, 5) || []);
        setStats(analytics);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="animate-pulse space-y-6">
        <div className="h-8 w-48 bg-gray-200 rounded" />
        <div className="grid grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const statCards = [
    {
      label: "Total Applications",
      value: stats?.totalApplications || 0,
      icon: Briefcase,
      color: "text-blue-600 bg-blue-50",
    },
    {
      label: "Active",
      value: stats?.activeApplications || 0,
      icon: TrendingUp,
      color: "text-emerald-600 bg-emerald-50",
    },
    {
      label: "Interview Rate",
      value: `${stats?.interviewRate || 0}%`,
      icon: FileText,
      color: "text-purple-600 bg-purple-50",
    },
    {
      label: "Offer Rate",
      value: `${stats?.offerRate || 0}%`,
      icon: Sparkles,
      color: "text-amber-600 bg-amber-50",
    },
  ];

  return (
    <>
      <PageHeader
        title="Dashboard"
        description="Track your job search progress"
        action={
          <Link href="/applications">
            <Button variant="primary" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              New Application
            </Button>
          </Link>
        }
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {statCards.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-gray-500">{stat.label}</p>
                  <p className="text-2xl font-semibold text-gray-900 mt-1">
                    {stat.value}
                  </p>
                </div>
                <div className={`p-2.5 rounded-xl ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <CardTitle className="text-base">Recent Applications</CardTitle>
            <Link href="/applications">
              <Button variant="ghost" size="sm">
                View all
                <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </Link>
          </CardHeader>
          <CardContent>
            {applications.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-sm text-gray-500">No applications yet</p>
                <Link href="/applications">
                  <Button variant="outline" size="sm" className="mt-3">
                    Create your first application
                  </Button>
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {applications.map((app) => (
                  <Link
                    key={app.id}
                    href={`/applications/${app.id}`}
                    className="flex items-center justify-between p-3 rounded-lg hover:bg-gray-50 transition-colors group"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate group-hover:text-blue-600 transition-colors">
                        {app.jobTitle}
                      </p>
                      <p className="text-xs text-gray-500">{app.company}</p>
                    </div>
                    <Badge className={getStatusColor(app.status)} variant="secondary">
                      {getStatusLabel(app.status)}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              <Link href="/ai-studio">
                <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group">
                  <Sparkles className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    AI Studio
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Generate tailored documents
                  </p>
                </div>
              </Link>
              <Link href="/resume-library">
                <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group">
                  <FileText className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Resume Library
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Manage your resumes
                  </p>
                </div>
              </Link>
              <Link href="/analytics">
                <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group">
                  <TrendingUp className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Analytics
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    View your progress
                  </p>
                </div>
              </Link>
              <Link href="/applications">
                <div className="p-4 rounded-xl border border-gray-200 hover:border-blue-200 hover:bg-blue-50/50 transition-all cursor-pointer group">
                  <Briefcase className="w-5 h-5 text-blue-600 mb-2" />
                  <p className="text-sm font-medium text-gray-900">
                    Kanban Board
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Drag &amp; drop pipeline
                  </p>
                </div>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
