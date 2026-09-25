import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { loadDashboard } from "../api/dashboard";
import { getBooking, listBookings } from "../api/bookings";
import { activateDriver, approveDriver, createDriver, getDriver, listDrivers, rejectDriver, suspendDriver } from "../api/drivers";
import { getDriverFinancials, getPayment, listPayments, listPlatformFees, listSettlements } from "../api/finance";
import { getData } from "../api/client";
import type { Page } from "../types/models";

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: loadDashboard });
}

export function useDrivers(query: { page: number; search: string; kycStatus: string; accountStatus: string }) {
  return useQuery({
    queryKey: ["drivers", query],
    queryFn: () => listDrivers({ page: query.page, search: query.search, kycStatus: query.kycStatus, accountStatus: query.accountStatus }),
  });
}

export function useDriver(id: string) {
  return useQuery({ queryKey: ["driver", id], queryFn: () => getDriver(id), enabled: Boolean(id) });
}

export function useCreateDriver() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: createDriver,
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["drivers"] });
    },
  });
}

export function useDriverActions(id: string) {
  const client = useQueryClient();
  const refresh = () => {
    void client.invalidateQueries({ queryKey: ["drivers"] });
    void client.invalidateQueries({ queryKey: ["driver", id] });
  };
  return {
    approve: useMutation({ mutationFn: () => approveDriver(id), onSuccess: refresh }),
    reject: useMutation({ mutationFn: (reason: string) => rejectDriver(id, reason), onSuccess: refresh }),
    suspend: useMutation({ mutationFn: (reason: string) => suspendDriver(id, reason), onSuccess: refresh }),
    activate: useMutation({ mutationFn: () => activateDriver(id), onSuccess: refresh }),
  };
}

export function useBookings(page: number) {
  return useQuery({ queryKey: ["bookings", page], queryFn: () => listBookings(page) });
}

export function useBooking(id: string) {
  return useQuery({ queryKey: ["booking", id], queryFn: () => getBooking(id), enabled: Boolean(id) });
}

export function usePayments(page: number) {
  return useQuery({ queryKey: ["payments", page], queryFn: () => listPayments(page) });
}

export function usePayment(id: string) {
  return useQuery({ queryKey: ["payment", id], queryFn: () => getPayment(id), enabled: Boolean(id) });
}

export function usePlatformFees(page: number) {
  return useQuery({ queryKey: ["platform-fees", page], queryFn: () => listPlatformFees(page) });
}

export function useSettlements(page: number) {
  return useQuery({ queryKey: ["settlements", page], queryFn: () => listSettlements(page) });
}

export function useDriverFinancials(driverId: string) {
  return useQuery({
    queryKey: ["driver-financials", driverId],
    queryFn: () => getDriverFinancials(driverId),
    enabled: Boolean(driverId),
  });
}

export function useAdminResource(path: string) {
  return useQuery({
    queryKey: ["admin-resource", path],
    queryFn: () => getData<Page<unknown> | unknown[]>(path),
    retry: false,
  });
}
