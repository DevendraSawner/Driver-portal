import type { ReactNode } from "react";

export function LoadingState({ label = "Loading…" }: { label?: string }) {
  return <p className="py-10 text-sm text-black/60">{label}</p>;
}

export function ErrorState({ message }: { message: string }) {
  return <p className="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{message}</p>;
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded border border-dashed border-black/15 px-4 py-10 text-center">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-sm text-black/60">{body}</p>
    </div>
  );
}

export function SearchField({ value, onChange, placeholder }: { value: string; onChange: (value: string) => void; placeholder: string }) {
  return (
    <input
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="w-full rounded border border-black/15 px-3 py-2 text-sm md:w-64"
    />
  );
}

export function DateFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm">
      <span className="mb-1 block text-black/60">{label}</span>
      <input type="date" value={value} onChange={(event) => onChange(event.target.value)} className="rounded border border-black/15 px-3 py-2" />
    </label>
  );
}

export function StatusBadge({ value }: { value: string }) {
  const tone = value.includes("CANCEL") || value === "REJECTED" || value === "FAILED" || value === "SUSPENDED" || value === "BLOCKED" || value === "DUE"
    ? "bg-red-100 text-red-800"
    : value === "APPROVED" || value === "SUCCESS" || value === "PAID" || value === "COMPLETED" || value === "ACTIVE" || value === "TRIP_COMPLETED"
      ? "bg-green-100 text-green-800"
      : "bg-amber-100 text-amber-900";
  return <span className={`inline-block rounded px-2 py-1 text-xs font-medium ${tone}`}>{value.replaceAll("_", " ")}</span>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-20 grid place-items-center bg-black/40 p-4">
      <div className="w-full max-w-lg rounded bg-white p-5 shadow">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">{title}</h3>
          <button type="button" onClick={onClose} className="text-sm">Close</button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  pending,
  onConfirm,
  onClose,
}: {
  title: string;
  body: string;
  confirmLabel: string;
  pending?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal title={title} onClose={onClose}>
      <p className="text-sm">{body}</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="rounded border px-3 py-2 text-sm">Cancel</button>
        <button type="button" disabled={pending} onClick={onConfirm} className="rounded bg-[#1c1915] px-3 py-2 text-sm text-white disabled:opacity-60">
          {pending ? "Working…" : confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function TextForm({
  label,
  submitLabel,
  pending,
  onSubmit,
}: {
  label: string;
  submitLabel: string;
  pending?: boolean;
  onSubmit: (value: string) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        onSubmit(String(data.get("value") ?? ""));
      }}
      className="space-y-3"
    >
      <label className="block text-sm">
        {label}
        <textarea name="value" required minLength={3} className="mt-1 w-full rounded border px-3 py-2" />
      </label>
      <button type="submit" disabled={pending} className="rounded bg-[#1c1915] px-3 py-2 text-sm text-white disabled:opacity-60">
        {pending ? "Saving…" : submitLabel}
      </button>
    </form>
  );
}
