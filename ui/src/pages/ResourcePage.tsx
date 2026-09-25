import { EmptyState, ErrorState, LoadingState } from "../components/ui";
import { errorMessage } from "../api/client";
import { useAdminResource } from "../hooks/admin";

const paths: Record<string, string> = {
  users: "/api/v1/admin/users",
  complaints: "/api/v1/admin/complaints",
  ratings: "/api/v1/admin/ratings",
  reports: "/api/v1/admin/reports/revenue",
  coupons: "/api/v1/admin/coupons",
  settings: "/api/v1/admin/settings",
  "audit-logs": "/api/v1/admin/audit-logs",
};

function ResourceResult({ data }: { data: unknown }) {
  const items = Array.isArray(data)
    ? data
    : data && typeof data === "object" && "items" in data && Array.isArray(data.items)
      ? data.items
      : null;
  if (!items || items.length === 0) {
    return <EmptyState title="No rows" body="The endpoint responded, and there is nothing to list yet." />;
  }
  return <p className="text-sm">The endpoint returned {items.length} records. This screen does not invent columns for an unmapped payload.</p>;
}

export function ResourcePage({ title, resource }: { title: string; resource: keyof typeof paths }) {
  const query = useAdminResource(paths[resource]);
  return (
    <section>
      <h2 className="text-2xl font-semibold">{title}</h2>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {query.isSuccess ? <ResourceResult data={query.data} /> : null}
      </div>
    </section>
  );
}
