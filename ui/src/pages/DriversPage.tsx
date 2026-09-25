import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { DataTable, Pagination } from "../components/Table";
import { ConfirmDialog, EmptyState, ErrorState, LoadingState, Modal, SearchField, StatusBadge, TextForm } from "../components/ui";
import { errorMessage } from "../api/client";
import { useCreateDriver, useDriver, useDriverActions, useDrivers } from "../hooks/admin";

export function DriversPage({ mode = "drivers" }: { mode?: "drivers" | "kyc" }) {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [kycStatus, setKycStatus] = useState(mode === "kyc" ? "UNDER_REVIEW" : "");
  const [accountStatus, setAccountStatus] = useState("");
  const [adding, setAdding] = useState(false);
  const query = useDrivers({ page, search, kycStatus, accountStatus });
  const create = useCreateDriver();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [city, setCity] = useState("");

  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">{mode === "kyc" ? "Driver KYC" : "Drivers"}</h2>
        {mode === "drivers" ? (
          <button type="button" className="rounded bg-[#1c1915] px-3 py-2 text-sm text-white" onClick={() => setAdding(true)}>
            Add driver
          </button>
        ) : null}
      </div>
      <div className="mt-4 flex flex-col gap-3 md:flex-row">
        <SearchField value={search} onChange={(value) => { setSearch(value); setPage(1); }} placeholder="Search name, phone, or city" />
        <select value={kycStatus} onChange={(event) => { setKycStatus(event.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm">
          <option value="">All KYC</option>
          {["PENDING", "UNDER_REVIEW", "APPROVED", "REJECTED"].map((status) => <option key={status}>{status}</option>)}
        </select>
        <select value={accountStatus} onChange={(event) => { setAccountStatus(event.target.value); setPage(1); }} className="rounded border px-3 py-2 text-sm">
          <option value="">All accounts</option>
          {["ACTIVE", "SUSPENDED", "BLOCKED", "INACTIVE", "PENDING_VERIFICATION"].map((status) => <option key={status}>{status}</option>)}
        </select>
      </div>
      <div className="mt-4">
        {query.isLoading ? <LoadingState /> : null}
        {query.isError ? <ErrorState message={errorMessage(query.error)} /> : null}
        {query.data && query.data.items.length === 0 ? <EmptyState title="No drivers" body="No drivers match these filters." /> : null}
        {query.data && query.data.items.length > 0 ? (
          <DataTable headers={["Name", "Phone", "KYC", "Account", "Online", ""]}>
            {query.data.items.map((driver) => (
              <tr key={driver.id} className="border-t">
                <td className="px-3 py-2">{driver.fullName}</td>
                <td className="px-3 py-2">{driver.phone}</td>
                <td className="px-3 py-2"><StatusBadge value={driver.kycStatus} /></td>
                <td className="px-3 py-2"><StatusBadge value={driver.accountStatus} /></td>
                <td className="px-3 py-2">{driver.onlineStatus}</td>
                <td className="px-3 py-2"><Link className="underline" to={`${mode === "kyc" ? "/kyc" : "/drivers"}/${driver.id}`}>Details</Link></td>
              </tr>
            ))}
          </DataTable>
        ) : null}
        <Pagination page={page} onPage={setPage} info={query.data?.pagination} />
      </div>
      {adding ? (
        <Modal title="Add driver" onClose={() => setAdding(false)}>
          <form
            className="space-y-3"
            onSubmit={(event) => {
              event.preventDefault();
              create.mutate(
                { fullName: fullName.trim(), phone: phone.trim(), password, city: city.trim() || undefined },
                {
                  onSuccess: () => {
                    setAdding(false);
                    setFullName("");
                    setPhone("");
                    setPassword("");
                    setCity("");
                  },
                },
              );
            }}
          >
            <label className="block text-sm">
              Full name
              <input value={fullName} onChange={(event) => setFullName(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Phone
              <input value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+919876543210" className="mt-1 w-full rounded border px-3 py-2" required />
            </label>
            <label className="block text-sm">
              Temporary password
              <input type="password" value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" required />
            </label>
            <label className="block text-sm">
              City
              <input value={city} onChange={(event) => setCity(event.target.value)} className="mt-1 w-full rounded border px-3 py-2" />
            </label>
            {create.isError ? <ErrorState message={errorMessage(create.error)} /> : null}
            <p className="text-xs text-black/60">Account becomes ACTIVE immediately. KYC stays PENDING until the driver submits documents and you approve them.</p>
            <button type="submit" disabled={create.isPending} className="rounded bg-[#1c1915] px-3 py-2 text-sm text-white disabled:opacity-60">
              {create.isPending ? "Creating…" : "Create driver"}
            </button>
          </form>
        </Modal>
      ) : null}
    </section>
  );
}

export function DriverDetailPage() {
  const { id = "" } = useParams();
  const query = useDriver(id);
  const actions = useDriverActions(id);
  const [mode, setMode] = useState<"approve" | "reject" | "suspend" | "activate" | null>(null);
  const error = actions.approve.error ?? actions.reject.error ?? actions.suspend.error ?? actions.activate.error;

  if (query.isLoading) return <LoadingState />;
  if (query.isError || !query.data) return <ErrorState message={errorMessage(query.error)} />;
  const driver = query.data;

  return (
    <section>
      <Link to="/drivers" className="text-sm underline">Back to drivers</Link>
      <h2 className="mt-2 text-2xl font-semibold">{driver.fullName}</h2>
      <p className="mt-1 text-sm text-black/60">{driver.phone} · {driver.city ?? "No city"}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        <StatusBadge value={driver.kycStatus} />
        <StatusBadge value={driver.accountStatus} />
        <StatusBadge value={driver.onlineStatus} />
      </div>
      {driver.kycRejectionReason ? <p className="mt-3 text-sm">Rejection: {driver.kycRejectionReason}</p> : null}
      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="rounded bg-[#1c1915] px-3 py-2 text-sm text-white" onClick={() => setMode("approve")}>Approve</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setMode("reject")}>Reject</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setMode("suspend")}>Suspend</button>
        <button type="button" className="rounded border px-3 py-2 text-sm" onClick={() => setMode("activate")}>Activate</button>
      </div>
      {error ? <div className="mt-3"><ErrorState message={errorMessage(error)} /></div> : null}
      <h3 className="mt-8 text-lg font-semibold">KYC documents</h3>
      <div className="mt-3">
        {(driver.documents ?? []).length === 0 ? <EmptyState title="No documents" body="This driver has not submitted KYC documents." /> : (
          <DataTable headers={["Type", "Status", "File", "Note"]}>
            {driver.documents?.map((document) => (
              <tr key={document.id} className="border-t">
                <td className="px-3 py-2">{document.type}</td>
                <td className="px-3 py-2"><StatusBadge value={document.status} /></td>
                <td className="px-3 py-2"><DocumentPreview fileKey={document.fileKey} mimeType={document.mimeType} /></td>
                <td className="px-3 py-2">{document.reviewNote ?? "—"}</td>
              </tr>
            ))}
          </DataTable>
        )}
      </div>
      {mode === "approve" ? (
        <ConfirmDialog title="Approve driver" body="Approve this KYC submission? The driver must already be under review and active." confirmLabel="Approve" pending={actions.approve.isPending} onClose={() => setMode(null)} onConfirm={() => { actions.approve.mutate(undefined, { onSuccess: () => setMode(null) }); }} />
      ) : null}
      {mode === "activate" ? (
        <ConfirmDialog title="Activate driver" body="This calls the account activation endpoint." confirmLabel="Activate" pending={actions.activate.isPending} onClose={() => setMode(null)} onConfirm={() => { actions.activate.mutate(undefined, { onSuccess: () => setMode(null) }); }} />
      ) : null}
      {mode === "reject" || mode === "suspend" ? (
        <Modal title={mode === "reject" ? "Reject KYC" : "Suspend driver"} onClose={() => setMode(null)}>
          <TextForm
            label="Reason"
            submitLabel={mode === "reject" ? "Reject" : "Suspend"}
            pending={mode === "reject" ? actions.reject.isPending : actions.suspend.isPending}
            onSubmit={(reason) => {
              const action = mode === "reject" ? actions.reject : actions.suspend;
              action.mutate(reason, { onSuccess: () => setMode(null) });
            }}
          />
        </Modal>
      ) : null}
    </section>
  );
}

export function DocumentPreview({ fileKey, mimeType }: { fileKey: string; mimeType: string }) {
  if (fileKey.startsWith("http")) {
    return mimeType.startsWith("image/") ? <img src={fileKey} alt="" className="h-16 w-16 object-cover" /> : <a className="underline" href={fileKey}>Open</a>;
  }
  return <span className="text-xs text-black/60">Private file key. No preview URL was returned.</span>;
}
