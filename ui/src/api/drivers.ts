import { getData, postData } from "./client";
import type { DriverRecord, Page } from "../types/models";

export type DriverQuery = {
  page: number;
  limit?: number;
  search?: string;
  kycStatus?: string;
  accountStatus?: string;
};

export function listDrivers(query: DriverQuery): Promise<Page<DriverRecord>> {
  return getData<Page<DriverRecord>>("/api/v1/admin/drivers", {
    page: query.page,
    limit: query.limit ?? 20,
    search: query.search || undefined,
    kycStatus: query.kycStatus || undefined,
    accountStatus: query.accountStatus || undefined,
  });
}

export function getDriver(id: string): Promise<DriverRecord> {
  return getData<DriverRecord>(`/api/v1/admin/drivers/${id}`);
}

export function approveDriver(id: string): Promise<DriverRecord> {
  return postData<DriverRecord>(`/api/v1/admin/drivers/${id}/approve`);
}

export function rejectDriver(id: string, reason: string): Promise<DriverRecord> {
  return postData<DriverRecord>(`/api/v1/admin/drivers/${id}/reject`, { reason });
}

export function suspendDriver(id: string, reason: string): Promise<unknown> {
  return postData(`/api/v1/admin/drivers/${id}/suspend`, { reason });
}

export function activateDriver(id: string): Promise<unknown> {
  return postData(`/api/v1/admin/drivers/${id}/activate`);
}

export function createDriver(body: {
  phone: string;
  password: string;
  fullName: string;
  email?: string;
  city?: string;
}): Promise<DriverRecord> {
  return postData<DriverRecord>("/api/v1/admin/drivers", body);
}
