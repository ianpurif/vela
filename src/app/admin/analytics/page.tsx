import type { Metadata } from "next";
import { getSession } from "@/server/auth";
import { getAdminAnalytics } from "@/server/services/operations";
import { AdminPageHeading } from "@/components/admin/admin-ui";
import { AnalyticsMetrics, AnalyticsScope } from "@/components/admin/analytics-summary";
import { AnalyticsPeriod } from "@/components/admin/analytics-period";
import { BestsellersChart, RevenueChart } from "@/components/admin/analytics-charts";

export const metadata: Metadata = { title: "Analytics" };
export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ days?: string | string[] }>;
}) {
  if (!(await getSession())?.admin) return null;
  const params = await searchParams;
  const requested = Number(params.days);
  const days = [7, 30, 90].includes(requested) ? requested : 30;
  const analytics = await getAdminAnalytics(days);
  return (
    <>
      <AdminPageHeading
        eyebrow="Measured with care"
        title="Analytics"
        description="Verified payments, order activity, and the essentials customers choose. Every figure comes from recorded test-store activity."
        action={<AnalyticsPeriod days={days} />}
      />
      <AnalyticsMetrics analytics={analytics} />
      <AnalyticsScope analytics={analytics} />
      <div className="grid items-start gap-6 2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <RevenueChart trend={analytics.trend} />
        <BestsellersChart products={analytics.bestsellers} />
      </div>
    </>
  );
}
