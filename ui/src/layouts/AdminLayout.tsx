import { NavLink, Outlet } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../lib/auth";

const links = [
  ["Dashboard", "/"],
  ["Users", "/users"],
  ["Drivers", "/drivers"],
  ["Driver KYC", "/kyc"],
  ["Bookings", "/bookings"],
  ["Trips", "/trips"],
  ["Payments", "/payments"],
  ["Platform Fees", "/platform-fees"],
  ["Settlements", "/settlements"],
  ["Complaints", "/complaints"],
  ["Ratings & Reviews", "/ratings"],
  ["Reports", "/reports"],
  ["Coupons", "/coupons"],
  ["Settings", "/settings"],
  ["Audit Logs", "/audit-logs"],
] as const;

export function AdminLayout() {
  const { admin, logout } = useAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className={`${open ? "block" : "hidden"} bg-[#1c1915] text-[#f4f1ea] md:block`}>
        <div className="border-b border-white/10 px-5 py-6">
          <p className="text-xs tracking-[0.2em] text-[#d6a45c]">DRIVER ON DEMAND</p>
          <h1 className="mt-2 text-lg font-semibold">Admin</h1>
        </div>
        <nav className="max-h-[70vh] overflow-auto p-3 md:max-h-none">
          {links.map(([label, to]) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              onClick={() => setOpen(false)}
              className={({ isActive }) => `block rounded px-3 py-2 text-sm ${isActive ? "bg-white/10 text-white" : "text-white/70"}`}
            >
              {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-black/10 bg-white px-4 py-4 md:px-6">
          <button type="button" className="rounded border px-3 py-2 text-sm md:hidden" onClick={() => setOpen((value) => !value)}>
            Menu
          </button>
          <div className="ml-auto text-right">
            <p className="text-sm font-medium">{admin?.fullName}</p>
            <button type="button" onClick={() => void logout()} className="text-sm text-black/60">Sign out</button>
          </div>
        </header>
        <main className="p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
