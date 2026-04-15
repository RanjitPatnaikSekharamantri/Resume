import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { requireUser } from "@/lib/auth/session";
import { getAnalytics } from "@/lib/services/analytics.service";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const user = await requireUser();
  const analytics = await getAnalytics(user.id);
  const resumeCount = await prisma.baseResume.count({
    where: { userId: user.id },
  });

  return (
    <DashboardOverview
      metrics={{
        totalApplications: analytics.totalApplications,
        interviews:
          analytics.funnel.find((item) => item.status === "INTERVIEW")?.count ?? 0,
        offers: analytics.funnel.find((item) => item.status === "OFFER")?.count ?? 0,
        resumes: resumeCount,
      }}
    />
  );
}
