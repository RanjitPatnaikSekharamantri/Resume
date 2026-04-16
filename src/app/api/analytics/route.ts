import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/api-auth";
import { prisma } from "@/lib/prisma";
import {
  calculateStreak,
  buildWeeklyActivity,
  getThisWeekCount,
  getUserDayKey,
} from "@/lib/analytics-tz";

// ── in-memory cache (per-user, 45-second TTL) ──

const cache = new Map<string, { data: unknown; expires: number }>();
const CACHE_TTL = 45_000;

function getCached(key: string): unknown | null {
  const entry = cache.get(key);
  if (!entry || Date.now() > entry.expires) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: unknown) {
  cache.set(key, { data, expires: Date.now() + CACHE_TTL });
}

export async function GET(req: Request) {
  try {
    const { error, userId } = await authenticateRequest();
    if (error) return error;

    const url = new URL(req.url);
    const userTz = url.searchParams.get("tz") || "UTC";

    const cacheKey = `analytics:${userId}:${userTz}`;
    const cached = getCached(cacheKey);
    if (cached) return NextResponse.json(cached);

    // ── 1. Status counts via Prisma groupBy (DB-level aggregation) ──

    const statusGroups = await prisma.application.groupBy({
      by: ["status"],
      where: { userId: userId! },
      _count: { _all: true },
    });

    const statusCounts: Record<string, number> = {};
    let total = 0;
    for (const g of statusGroups) {
      statusCounts[g.status] = g._count._all;
      total += g._count._all;
    }

    // ── 2. Stage calculations (no extra DB call) ──

    const applied = ["applied", "screening", "interview", "offer", "rejected"]
      .reduce((s, k) => s + (statusCounts[k] || 0), 0);
    const screeningPlus = ["screening", "interview", "offer"]
      .reduce((s, k) => s + (statusCounts[k] || 0), 0);
    const interviewPlus = ["interview", "offer"]
      .reduce((s, k) => s + (statusCounts[k] || 0), 0);
    const offers = statusCounts["offer"] || 0;
    const rejected = statusCounts["rejected"] || 0;
    const active = total - (statusCounts["rejected"] || 0) - (statusCounts["archived"] || 0);

    // ── 3. Fetch only what we need for time-based grouping (last 90 days) ──

    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const recentApps = await prisma.application.findMany({
      where: { userId: userId!, createdAt: { gte: ninetyDaysAgo } },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const createdDates = recentApps.map((a) => a.createdAt);

    // ── 4. Timezone-aware weekly activity ──

    const weeklyActivity = buildWeeklyActivity(createdDates, userTz, 12);

    // ── 5. Conversion rates ──

    const appToScreening = applied > 0 ? Math.round((screeningPlus / applied) * 100) : 0;
    const screeningToInterview = screeningPlus > 0 ? Math.round((interviewPlus / screeningPlus) * 100) : 0;
    const interviewToOffer = interviewPlus > 0 ? Math.round((offers / interviewPlus) * 100) : 0;
    const responded = ["screening", "interview", "offer", "rejected"]
      .reduce((s, k) => s + (statusCounts[k] || 0), 0);
    const responseRate = applied > 0 ? Math.round((responded / applied) * 100) : 0;

    // ── 6. Top companies (DB-level) ──

    const companyGroups = await prisma.application.groupBy({
      by: ["company"],
      where: { userId: userId! },
      _count: { _all: true },
      orderBy: { _count: { company: "desc" } },
      take: 5,
    });

    const topCompanies = companyGroups.map((g) => ({
      company: g.company,
      count: g._count._all,
    }));

    // ── 7. Status distribution (ordered) ──

    const statusOrder = [
      "not_applied", "saved", "applied", "screening",
      "interview", "offer", "rejected", "archived",
    ];
    const statusDistribution = statusOrder
      .filter((s) => (statusCounts[s] || 0) > 0)
      .map((s) => ({ name: s, value: statusCounts[s] || 0 }));

    // ── 8. Gamification (timezone-aware) ──

    const allCreatedDates = await prisma.application.findMany({
      where: { userId: userId! },
      select: { createdAt: true },
      orderBy: { createdAt: "desc" },
    });

    const allDates = allCreatedDates.map((a) => a.createdAt);
    const streak = calculateStreak(allDates, userTz);
    const thisWeekApps = getThisWeekCount(allDates, userTz);

    const milestones = [
      { label: "First Application", target: 1, reached: total >= 1 },
      { label: "10 Applications", target: 10, reached: total >= 10 },
      { label: "25 Applications", target: 25, reached: total >= 25 },
      { label: "50 Applications", target: 50, reached: total >= 50 },
      { label: "First Interview", target: 1, reached: interviewPlus >= 1 },
      { label: "First Offer", target: 1, reached: offers >= 1 },
    ];

    // ── 9. Upcoming reminders ──

    const todayStr = getUserDayKey(new Date(), userTz);
    const reminders = await prisma.application.findMany({
      where: {
        userId: userId!,
        reminderEnabled: true,
        followUpDate: { gte: new Date(todayStr + "T00:00:00Z") },
      },
      select: { id: true, jobTitle: true, company: true, followUpDate: true },
      orderBy: { followUpDate: "asc" },
      take: 5,
    });

    const result = {
      statusDistribution,
      weeklyActivity,
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
        weeklyGoal: 5,
        milestones,
      },
      upcomingReminders: reminders,
    };

    setCache(cacheKey, result);
    return NextResponse.json(result);
  } catch (err) {
    console.error("Get analytics error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
