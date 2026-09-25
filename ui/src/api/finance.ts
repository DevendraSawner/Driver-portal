import { getData } from "./client";
import type { DriverFinancials, Page, PaymentRecord, PlatformFeeRecord, SettlementRecord } from "../types/models";

export function listPayments(page: number, limit = 20): Promise<Page<PaymentRecord>> {
  return getData("/api/v1/admin/payments", { page, limit });
}

export function getPayment(id: string): Promise<PaymentRecord> {
  return getData(`/api/v1/payments/${id}`);
}

export function listPlatformFees(page: number, limit = 20): Promise<Page<PlatformFeeRecord>> {
  return getData("/api/v1/admin/platform-fees", { page, limit });
}

export function listOutstandingFees(page: number, limit = 20): Promise<Page<PlatformFeeRecord>> {
  return getData("/api/v1/admin/platform-fees/outstanding", { page, limit });
}

export function listSettlements(page: number, limit = 20): Promise<Page<SettlementRecord>> {
  return getData("/api/v1/admin/settlements", { page, limit });
}

export function getDriverFinancials(driverId: string): Promise<DriverFinancials> {
  return getData(`/api/v1/admin/driver-financials/${driverId}`);
}
