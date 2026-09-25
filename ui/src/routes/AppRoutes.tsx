import { Navigate, Route, Routes } from "react-router-dom";
import { ProtectedRoute } from "../components/ProtectedRoute";
import { AdminLayout } from "../layouts/AdminLayout";
import { BookingDetailPage, BookingsPage } from "../pages/BookingsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { DriverDetailPage, DriversPage } from "../pages/DriversPage";
import { DriverFinancialPage, PaymentDetailPage, PaymentsPage, PlatformFeesPage, SettlementsPage } from "../pages/FinancePages";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ResourcePage } from "../pages/ResourcePage";

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="users" element={<ResourcePage title="Users" resource="users" />} />
          <Route path="drivers" element={<DriversPage />} />
          <Route path="drivers/:id" element={<DriverDetailPage />} />
          <Route path="kyc" element={<DriversPage mode="kyc" />} />
          <Route path="kyc/:id" element={<DriverDetailPage />} />
          <Route path="bookings" element={<BookingsPage />} />
          <Route path="bookings/:id" element={<BookingDetailPage />} />
          <Route path="trips" element={<BookingsPage tripsOnly />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="payments/:id" element={<PaymentDetailPage />} />
          <Route path="platform-fees" element={<PlatformFeesPage />} />
          <Route path="platform-fees/:driverId" element={<DriverFinancialPage />} />
          <Route path="settlements" element={<SettlementsPage />} />
          <Route path="complaints" element={<ResourcePage title="Complaints" resource="complaints" />} />
          <Route path="ratings" element={<ResourcePage title="Ratings & Reviews" resource="ratings" />} />
          <Route path="reports" element={<ResourcePage title="Reports" resource="reports" />} />
          <Route path="coupons" element={<ResourcePage title="Coupons" resource="coupons" />} />
          <Route path="settings" element={<ResourcePage title="Settings" resource="settings" />} />
          <Route path="audit-logs" element={<ResourcePage title="Audit Logs" resource="audit-logs" />} />
        </Route>
      </Route>
      <Route path="/home" element={<Navigate to="/" replace />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
