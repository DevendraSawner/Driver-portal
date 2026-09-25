import { useDashboard } from "../hooks/admin";
import { ErrorState, LoadingState } from "../components/ui";
import { formatMoney } from "../utils/format";
import type { Metric } from "../api/dashboard";

const moneyKeys = new Set(["grossBookingValue", "platformRevenue", "outstandingFees", "directPaymentVolume"]);

const labels = [
  ["totalUsers", "Total users"],
  ["totalDrivers", "Total drivers"],
  ["activeDrivers", "Active drivers"],
  ["todaysBookings", "Today's bookings"],
  ["completedTrips", "Completed trips"],
  ["cancelledTrips", "Cancelled trips"],
  ["grossBookingValue", "Gross booking value"],
  ["platformRevenue", "Platform revenue"],
  ["outstandingFees", "Outstanding driver fees"],
  ["directPaymentVolume", "Direct payment volume"],
] as const;

function MetricCard({ label, metric, money }: { label: string; metric: Metric; money: boolean }) {
  return (
    <article className="rounded bg-white p-4 shadow-sm">
      <p className="text-sm text-black/60">{label}</p>
      {metric.state === "ready" ? (
        <p className="mt-3 text-2xl font-semibold">{money ? formatMoney(metric.value) : metric.value}</p>
      ) : (
        <p className="mt-3 text-sm text-black/70">{metric.reason}</p>
      )}
    </article>
  );
}

export function DashboardPage() {
  const query = useDashboard();
  if (query.isLoading) {
    return <LoadingState label="Loading dashboard…" />;
  }
  if (query.isError || !query.data) {
    return <ErrorState message="Dashboard data could not be loaded." />;
  }
  return (
    <section>
      <h2 className="text-2xl font-semibold">Dashboard</h2>
      <div className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {labels.map(([key, label]) => (
          <MetricCard key={key} label={label} metric={query.data[key]} money={moneyKeys.has(key)} />
        ))}
      </div>
    </section>
  );
}
