import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../lib/auth";

export function ProtectedRoute() {
  const { admin, ready } = useAuth();
  if (!ready) {
    return <p className="p-8 text-sm">Checking session…</p>;
  }
  if (!admin) {
    return <Navigate to="/login" replace />;
  }
  return <Outlet />;
}
