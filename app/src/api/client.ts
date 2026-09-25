import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import { apiUrl } from "../constants/config";
import { markOffline, markOnline } from "../services/network";
import type { ApiFailure, ApiSuccess } from "../types/models";

type RetryConfig = InternalAxiosRequestConfig & { retried?: boolean };

export const api = axios.create({
  baseURL: apiUrl,
  headers: { "X-Client-Type": "mobile" },
  timeout: 15000,
});

let accessToken: string | null = null;
let refreshToken: string | null = null;
let onUnauthorized: (() => void) | null = null;
let refreshRequest: Promise<string | null> | null = null;

export function setSession(tokens: { accessToken: string | null; refreshToken: string | null }): void {
  accessToken = tokens.accessToken;
  refreshToken = tokens.refreshToken;
}

export function setUnauthorizedHandler(handler: () => void): void {
  onUnauthorized = handler;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  if (!refreshToken) {
    return null;
  }
  const response = await axios.post<ApiSuccess<{ accessToken: string; refreshToken: string }>>(
    `${apiUrl}/api/v1/auth/refresh`,
    { refreshToken },
    { headers: { "X-Client-Type": "mobile" } },
  );
  accessToken = response.data.data.accessToken;
  refreshToken = response.data.data.refreshToken;
  return accessToken;
}

api.interceptors.response.use(
  (response) => {
    markOnline();
    return response;
  },
  async (error: AxiosError) => {
    if (!error.response) {
      markOffline();
    }
    const config = error.config as RetryConfig | undefined;
    const url = config?.url ?? "";
    if (error.response?.status !== 401 || !config || config.retried || url.includes("/api/v1/auth/")) {
      return Promise.reject(error);
    }
    config.retried = true;
    refreshRequest ??= refreshAccessToken().finally(() => {
      refreshRequest = null;
    });
    const token = await refreshRequest;
    if (!token) {
      onUnauthorized?.();
      return Promise.reject(error);
    }
    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiFailure>(error)) {
    if (!error.response) {
      return "The network is unavailable.";
    }
    return error.response.data?.message ?? "Request failed";
  }
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return "Request failed";
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const response = await api.get<ApiSuccess<T>>(url, { params });
  return response.data.data;
}

export async function postData<T>(url: string, body?: object, headers?: object): Promise<T> {
  const response = await api.post<ApiSuccess<T>>(url, body ?? {}, { headers });
  return response.data.data;
}

export async function patchData<T>(url: string, body: object): Promise<T> {
  const response = await api.patch<ApiSuccess<T>>(url, body);
  return response.data.data;
}
