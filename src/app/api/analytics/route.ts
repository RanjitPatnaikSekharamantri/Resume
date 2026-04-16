import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const applications = await prisma.application.findMany({
      where: { userId: userId! },
      select: {
        id: true,
        status: true,
        company: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    const total = applications.length;

    // ── status counts ──
    const statusCounts: Record<string, number> = {};
    for (const app of applications) {
      statusCounts[app.status] = (statusCounts[app.status] || 0) + 1;
    }

    // ── stage groups ──
    const saved = statusCounts["saved"] || 0;
    const notApplied = statusCounts["not_applied"] || 0;
    const applied = total - saved - notApplied;
    const screeningPlus = applications.filter((a) =>
      ["screening", "interview", "offer"].includes(a.status)
    ).length;
    const interviewPlus = applications.filter((a) =>
      ["interview", "offer"].includes(a.status)
    ).length;
    const offers = statusCounts["offer"] || 0;
    const rejected = statusCounts["rejected"] || 0;
    const active = applications.filter(
      (a) => !["rejected", "archived"].includes(a.status)
    ).length;

    // ── weekly activity (last 12 weeks with real date labels) ──
    const now = new Date();
    const weeklyActivity: { name: string; applications: number; start: Date }[] = [];

    for (let i = 11; i >= 0; i--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - i * 7);
      weekStart.setHours(0, 0, 0, 0);
      const dayOfWeek = weekStart.getDay();
      weekStart.setDate(weekStart.getDate() - dayOfWeek);

      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);

      const label = weekStart.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });

      const count = applications.filter((a) => {
        const d = new Date(a.createdAt);
        return d >= weekStart && d < weekEnd;
      }).length;

      weeklyActivity.push({ name: label, applications: count, start: weekStart });
    }

    // Deduplicate weeks that may overlap
    const seen = new Set<string>();
    const dedupedWeekly = weeklyActivity.filter((w) => {
      if (seen.has(w.name)) return false;
      seen.add(w.name);
      return true;
    });

    // ── conversion rates ──
    const appToScreening =
      applied > 0 ? Math.round((screeningPlus / applied) * 100) : 0;
    const screeningToInterview =
      screeningPlus > 0
        ? Math.round((interviewPlus / screeningPlus) * 100)
        : 0;
    const interviewToOffer =
      interviewPlus > 0 ? Math.round((offers / interviewPlus) * 100) : 0;
    const responseRate =
      applied > 0
        ? Math.round(
            (applications.filter((a) =>
              ["screening", "interview", "offer", "rejected"].includes(a.status)
            ).length /
              applied) *
              100
          )
        : 0;

    // ── top companies ──
    const companyCounts: Record<string, number> = {};
    for (const app of applications) {
      companyCounts[app.company] = (companyCounts[app.company] || 0) + 1;
    }
    const topCompanies = Object.entries(companyCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([company, count]) => ({ company, count }));

    // ── status distribution (sorted by pipeline order) ──
    const statusOrder = [
      "not_applied",
      "saved",
      "applied",
      "screening",
      "interview",
      "offer",
      "rejected",
      "archived",
    ];
    const statusDistribution = statusOrder
      .filter((s) => (statusCounts[s] || 0) > 0)
      .map((s) => ({ name: s, value: statusCounts[s] || 0 }));

    // ── gamification: streaks & milestones ──
    const sortedByDate = [...applications].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    // Daily application streak (consecutive days with at least 1 app)
    let streak = 0;
    if (sortedByDate.length > 0) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dayMs = 24 * 60 * 60 * 1000;
      const appDays = new Set(
        sortedByDate.map((a) => {
          const d = new Date(a.createdAt);
          d.setHours(0, 0, 0, 0);
          return d.getTime();
        })
      );
      let checkDay = today.getTime();
      // Allow today or yesterday as start
      if (!appDays.has(checkDay)) checkDay -= dayMs;
      while (appDays.has(checkDay)) {
        streak++;
        checkDay -= dayMs;
      }
    }

    // Weekly apps this week
    const startOfWeek = new Date(now);
    startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
    startOfWeek.setHours(0, 0, 0, 0);
    const thisWeekApps = applications.filter(
      (a) => new Date(a.createdAt) >= startOfWeek
    ).length;

    // Milestones
    const milestones = [
      { label: "First Application", target: 1, reached: total >= 1 },
      { label: "10 Applications", target: 10, reached: total >= 10 },
      { label: "25 Applications", target: 25, reached: total >= 25 },
      { label: "50 Applications", target: 50, reached: total >= 50 },
      { label: "First Interview", target: 1, reached: interviewPlus >= 1 },
      { label: "First Offer", target: 1, reached: offers >= 1 },
    ];

    const weeklyGoal = 5;

    return NextResponse.json({
      statusDistribution,
      weeklyActivity: dedupedWeekly.map(({ name, applications: count }) => ({
        name,
        applications: count,
      })),
      funnel: [
        { stage: "Total", count: total },
        { stage: "Applied", count: applied },
        { stage: "Screening", count: screeningPlus },
        { stage: "Interview", count: interviewPlus },
        { stage: "Offer", count: offers },
      ],
      conversionRates: {
        applicationToScreening: appToScreening,
        screeningToInterview,
        interviewToOffer,
        responseRate,
      },
      totalApplications: total,
      activeApplications: active,
      appliedCount: applied,
      rejectedCount: rejected,
      offerCount: offers,
      interviewRate: screeningToInterview,
      offerRate: interviewToOffer,
      responseRate,
      topCompanies,
      gamification: {
        streak,
        thisWeekApps,
        weeklyGoal,
        milestones,
      },
    });
  } catch (err) {
    console.error("Get analytics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
