import type { ReactNode } from "react";
import type { Pagination as PageInfo } from "../types/models";

export function DataTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded border border-black/10 bg-white">
      <table className="min-w-full text-left text-sm">
        <thead className="bg-black/5">
          <tr>
            {headers.map((header) => (
              <th key={header} className="px-3 py-2 font-medium">{header}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Pagination({ page, onPage, info }: { page: number; onPage: (page: number) => void; info?: PageInfo }) {
  const totalPages = info?.totalPages ?? 1;
  return (
    <div className="mt-4 flex items-center justify-between text-sm">
      <span>{info ? `${info.total} records` : ""}</span>
      <div className="flex gap-2">
        <button type="button" disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded border px-3 py-1 disabled:opacity-40">Previous</button>
        <span className="px-2 py-1">{page} / {Math.max(totalPages, 1)}</span>
        <button type="button" disabled={page >= totalPages} onClick={() => onPage(page + 1)} className="rounded border px-3 py-1 disabled:opacity-40">Next</button>
      </div>
    </div>
  );
}
