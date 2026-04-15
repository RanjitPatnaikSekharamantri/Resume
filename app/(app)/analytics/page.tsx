import { AnalyticsCharts } from "@/components/analytics/analytics-charts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireUser } from "@/lib/auth/session";
import { getAnalytics } from "@/lib/services/analytics.service";

export default async function AnalyticsPage() {
  const user = await requireUser();
  const analytics = await getAnalytics(user.id);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">Analytics</h1>
        <p className="mt-1 text-sm text-zinc-500">
          Funnel, status distribution, and weekly performance.
        </p>
      </div>

      <AnalyticsCharts analytics={analytics} />

      <Card>
        <CardHeader>
          <CardTitle>Conversion Insights</CardTitle>
          <CardDescription>Use this data to improve application quality and process speed.</CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-zinc-600">
          <p>
            Track where opportunities drop off and identify stages that need improvement. Focus optimization on
            your biggest bottleneck to compound results over time.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
