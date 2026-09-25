import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, Pagination } from "../components/Table";
import { EmptyState, ErrorState, LoadingState, StatusBadge } from "../components/ui";
import { errorMessage } from "../api/client";
import { useDriverFinancials, usePayment, usePayments, usePlatformFees, useSettlements } from "../hooks/admin";
import { formatMoney, formatWhen } from "../utils/format";

export function PaymentsPage() {
  const [page, setPage] = useState(1);
  const [rail, setRail] = useState("");
  const query = usePayments(page);
  const items = (query.data?.items ?? []).filter((payment) => !rail || payment.rail === rail);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Payments</h2>
      <select value={rail} onChange={(event) => setRail(event.target.value)} className="mt-4 rounded border px-3 py-2 text-sm">
        <option value="">Online and direct</option>
        <option value="PLATFORM_PAYMENT">Online / platform</option>
        <option value="DIRECT_PAYMENT">Direct</option>
      </select>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {query.data && items.length === 0 ? <EmptyState title="No payments" body="No payments match this filter." /> : null}
        {items.length > 0 ? (
          <DataTable headers={["Booking", "Rail", "Method", "Status", "Reference", "Amount", ""]}>
            {items.map((payment) => (
              <tr key={payment.id} className="border-t">
                <td className="px-3 py-2">{payment.bookingId}</td>
                <td className="px-3 py-2">{payment.rail === "PLATFORM_PAYMENT" ? "Online" : "Direct"}</td>
                <td className="px-3 py-2">{payment.directMethod ?? payment.provider ?? "—"}</td>
                <td className="px-3 py-2"><StatusBadge value={payment.status} /></td>
                <td className="px-3 py-2">{payment.customerReference ?? payment.providerRef ?? "—"}</td>
                <td className="px-3 py-2">{formatMoney(payment.amountMinor, payment.currency)}</td>
                <td className="px-3 py-2"><Link className="underline" to={`/payments/${payment.id}`}>Details</Link></td>
              </tr>
            ))}
          </DataTable>
        ) : null}
        <Pagination page={page} onPage={setPage} info={query.data?.pagination} />
      </div>
    </section>
  );
}

export function PaymentDetailPage() {
  const { id = "" } = useParams();
  const query = usePayment(id);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />;
  const payment = query.data;
  return (
    <section>
      <Link to="/payments" className="text-sm underline">Back to payments</Link>
      <h2 className="mt-2 text-2xl font-semibold">Payment</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="text-black/60">Amount</dt><dd>{formatMoney(payment.amountMinor, payment.currency)}</dd></div>
        <div><dt className="text-black/60">Status</dt><dd><StatusBadge value={payment.status} /></dd></div>
        <div><dt className="text-black/60">Rail</dt><dd>{payment.rail}</dd></div>
        <div><dt className="text-black/60">Receiver</dt><dd>{payment.receiver}</dd></div>
        <div><dt className="text-black/60">UTR / reference</dt><dd>{payment.customerReference ?? "—"}</dd></div>
        <div><dt className="text-black/60">Provider reference</dt><dd>{payment.providerRef ?? "—"}</dd></div>
        <div><dt className="text-black/60">Confirmation</dt><dd>{payment.directConfirmStatus ?? "—"}</dd></div>
        <div><dt className="text-black/60">Created</dt><dd>{formatWhen(payment.createdAt)}</dd></div>
      </dl>
    </section>
  );
}

export function PlatformFeesPage() {
  const [page, setPage] = useState(1);
  const query = usePlatformFees(page);
  const groups = useMemo(() => {
    const map = new Map<string, { trips: number; total: number; paid: number; outstanding: number }>();
    for (const fee of query.data?.items ?? []) {
      const current = map.get(fee.driverId) ?? { trips: 0, total: 0, paid: 0, outstanding: 0 };
      current.trips += 1;
      current.total += fee.amountMinor;
      if (fee.status === "PAID") current.paid += fee.amountMinor;
      if (fee.status === "DUE") current.outstanding += fee.amountMinor;
      map.set(fee.driverId, current);
    }
    return [...map.entries()];
  }, [query.data]);
  const complete = query.data?.pagination.totalPages === 1;
  return (
    <section>
      <h2 className="text-2xl font-semibold">Platform fees</h2>
      <p className="mt-1 text-sm text-black/60">
        {complete ? "Totals use every fee returned for this result." : "Totals below are only the current page. A partial page is not shown as the company-wide total."}
      </p>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {groups.length === 0 && !query.isLoading ? <EmptyState title="No platform fees" body="No fee records were returned." /> : null}
        {groups.length > 0 ? (
          <DataTable headers={["Driver", "Total trips", "Total platform fees", "Paid", "Outstanding", ""]}>
            {groups.map(([driverId, group]) => (
              <tr key={driverId} className="border-t">
                <td className="px-3 py-2">{driverId}</td>
                <td className="px-3 py-2">{group.trips}</td>
                <td className="px-3 py-2">{formatMoney(group.total)}</td>
                <td className="px-3 py-2">{formatMoney(group.paid)}</td>
                <td className="px-3 py-2">{formatMoney(group.outstanding)}</td>
                <td className="px-3 py-2"><Link className="underline" to={`/platform-fees/${driverId}`}>Financial detail</Link></td>
              </tr>
            ))}
          </DataTable>
        ) : null}
        <Pagination page={page} onPage={setPage} info={query.data?.pagination} />
      </div>
    </section>
  );
}

export function DriverFinancialPage() {
  const { driverId = "" } = useParams();
  const query = useDriverFinancials(driverId);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />;
  const data = query.data;
  const latest = data.recentSettlements[0];
  return (
    <section>
      <Link to="/platform-fees" className="text-sm underline">Back to platform fees</Link>
      <h2 className="mt-2 text-2xl font-semibold">Driver financials</h2>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-3">
        <div><dt className="text-black/60">Outstanding</dt><dd>{formatMoney(data.wallet.outstandingFeeMinor, data.wallet.currency)}</dd></div>
        <div><dt className="text-black/60">Payable</dt><dd>{formatMoney(data.wallet.payableMinor, data.wallet.currency)}</dd></div>
        <div><dt className="text-black/60">Last settlement</dt><dd>{latest ? `${latest.status} · ${formatWhen(latest.completedAt ?? latest.createdAt)}` : "—"}</dd></div>
      </dl>
      <h3 className="mt-8 font-semibold">Outstanding fees</h3>
      <div className="mt-3">
        {data.outstandingFees.length === 0 ? <EmptyState title="No outstanding fees" body="This driver has no fees in DUE status." /> : (
          <DataTable headers={["Booking", "Trip amount source", "Platform fee", "Status"]}>
            {data.outstandingFees.map((fee) => (
              <tr key={fee.id} className="border-t">
                <td className="px-3 py-2">{fee.bookingId}</td>
                <td className="px-3 py-2">Fee record</td>
                <td className="px-3 py-2">{formatMoney(fee.amountMinor, fee.currency)}</td>
                <td className="px-3 py-2"><StatusBadge value={fee.status} /></td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
    </section>
  );
}

export function SettlementsPage() {
  const [page, setPage] = useState(1);
  const query = useSettlements(page);
  return (
    <section>
      <h2 className="text-2xl font-semibold">Settlements</h2>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {query.data && query.data.items.length === 0 ? <EmptyState title="No settlements" body="No settlement records were returned." /> : null}
        {query.data && query.data.items.length > 0 ? (
          <DataTable headers={["Driver", "Direction", "Amount", "Status", "When"]}>
            {query.data.items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="px-3 py-2"><Link className="underline" to={`/platform-fees/${item.driverId}`}>{item.driverId}</Link></td>
                <td className="px-3 py-2">{item.direction}</td>
                <td className="px-3 py-2">{formatMoney(item.amountMinor, item.currency)}</td>
                <td className="px-3 py-2"><StatusBadge value={item.status} /></td>
                <td className="px-3 py-2">{formatWhen(item.completedAt ?? item.createdAt)}</td>
              </tr>
            ))}
          </DataTable>
        ) : null}
        <Pagination page={page} onPage={setPage} info={query.data?.pagination} />
      </div>
    </section>
  );
}
