import { useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, Pagination } from "../components/Table";
import { DateFilter, EmptyState, ErrorState, LoadingState, SearchField, StatusBadge } from "../components/ui";
import { errorMessage } from "../api/client";
import { useBooking, useBookings } from "../hooks/admin";
import { formatMoney, formatWhen } from "../utils/format";

const tripStatuses = ["DRIVER_ON_THE_WAY", "DRIVER_ARRIVED", "TRIP_STARTED", "TRIP_COMPLETED"];
const timeline = ["PENDING", "SEARCHING_DRIVER", "DRIVER_ASSIGNED", "DRIVER_ACCEPTED", "DRIVER_ON_THE_WAY", "DRIVER_ARRIVED", "TRIP_STARTED", "TRIP_COMPLETED"];

export function BookingsPage({ tripsOnly = false }: { tripsOnly?: boolean }) {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [user, setUser] = useState("");
  const [driver, setDriver] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const query = useBookings(page);
  const items = useMemo(() => {
    return (query.data?.items ?? []).filter((booking) => {
      if (tripsOnly && !tripStatuses.includes(booking.status)) return false;
      if (status && booking.status !== status) return false;
      if (user && !`${booking.user.fullName} ${booking.user.phone ?? ""}`.toLowerCase().includes(user.toLowerCase())) return false;
      if (driver && !`${booking.driver?.fullName ?? ""}`.toLowerCase().includes(driver.toLowerCase())) return false;
      if (from && new Date(booking.scheduledAt) < new Date(`${from}T00:00:00`)) return false;
      if (to && new Date(booking.scheduledAt) > new Date(`${to}T23:59:59`)) return false;
      return true;
    });
  }, [query.data, tripsOnly, status, user, driver, from, to]);

  return (
    <section>
      <h2 className="text-2xl font-semibold">{tripsOnly ? "Trips" : "Bookings"}</h2>
      <p className="mt-1 text-sm text-black/60">Filters apply to the page returned by the bookings API.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <SearchField value={user} onChange={setUser} placeholder="Filter user" />
        <SearchField value={driver} onChange={setDriver} placeholder="Filter driver" />
        <select value={status} onChange={(event) => setStatus(event.target.value)} className="rounded border px-3 py-2 text-sm">
          <option value="">All statuses</option>
          {(tripsOnly ? tripStatuses : timeline.concat(["CANCELLED_BY_USER", "CANCELLED_BY_DRIVER", "EXPIRED"])).map((item) => <option key={item}>{item}</option>)}
        </select>
        <DateFilter label="From" value={from} onChange={setFrom} />
        <DateFilter label="To" value={to} onChange={setTo} />
      </div>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {!query.isLoading && items.length === 0 ? <EmptyState title="No records" body="Nothing on this page matches the filters." /> : null}
        {items.length > 0 ? (
          <DataTable headers={["Reference", "Status", "User", "Driver", "When", "Fare", ""]}>
            {items.map((booking) => (
              <tr key={booking.id} className="border-t">
                <td className="px-3 py-2">{booking.referenceCode}</td>
                <td className="px-3 py-2"><StatusBadge value={booking.status} /></td>
                <td className="px-3 py-2">{booking.user.fullName}</td>
                <td className="px-3 py-2">{booking.driver?.fullName ?? "—"}</td>
                <td className="px-3 py-2">{formatWhen(booking.scheduledAt)}</td>
                <td className="px-3 py-2">{formatMoney(booking.estimatedFareMinor, booking.currency)}</td>
                <td className="px-3 py-2"><Link className="underline" to={`/bookings/${booking.id}`}>Details</Link></td>
              </tr>
            ))}
          </DataTable>
        ) : null}
        <Pagination page={page} onPage={setPage} info={query.data?.pagination} />
      </div>
    </section>
  );
}

export function BookingDetailPage() {
  const { id = "" } = useParams();
  const query = useBooking(id);
  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />;
  const booking = query.data;
  const current = timeline.indexOf(booking.status);
  return (
    <section>
      <Link to="/bookings" className="text-sm underline">Back to bookings</Link>
      <h2 className="mt-2 text-2xl font-semibold">{booking.referenceCode}</h2>
      <div className="mt-3"><StatusBadge value={booking.status} /></div>
      <dl className="mt-4 grid gap-3 text-sm md:grid-cols-2">
        <div><dt className="text-black/60">User</dt><dd>{booking.user.fullName}</dd></div>
        <div><dt className="text-black/60">Driver</dt><dd>{booking.driver?.fullName ?? "Unassigned"}</dd></div>
        <div><dt className="text-black/60">Pickup</dt><dd>{booking.pickup.address}</dd></div>
        <div><dt className="text-black/60">Destination</dt><dd>{booking.destination.address}</dd></div>
        <div><dt className="text-black/60">Fare</dt><dd>{formatMoney(booking.estimatedFareMinor, booking.currency)}</dd></div>
        <div><dt className="text-black/60">Platform fee</dt><dd>{formatMoney(booking.platformFeeMinor, booking.currency)}</dd></div>
      </dl>
      <h3 className="mt-8 font-semibold">Trip timeline</h3>
      <p className="mt-1 text-sm text-black/60">The booking payload includes the current status. Earlier steps are the legal path up to that status, not a separate history feed.</p>
      <ol className="mt-3 space-y-2">
        {timeline.map((step, index) => (
          <li key={step} className={index <= current ? "font-medium" : "text-black/40"}>{step.replaceAll("_", " ")}</li>
        ))}
      </ol>
      {booking.cancellation ? <p className="mt-4 text-sm">Cancelled {formatWhen(booking.cancellation.at)}: {booking.cancellation.reason ?? "No reason"}</p> : null}
    </section>
  );
}
