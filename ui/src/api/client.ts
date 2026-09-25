import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";
import type { ApiFailure, ApiSuccess } from "../types/api";

const baseURL = import.meta.env.VITE_API_URL ?? "http://localhost:5000";

type RetryConfig = InternalAxiosRequestConfig & { retried?: boolean };

export const api = axios.create({
  baseURL,
  withCredentials: true,
});

let accessToken: string | null = null;
let refreshRequest: Promise<string | null> | null = null;

export function setAccessToken(token: string | null): void {
  accessToken = token;
}

api.interceptors.request.use((config) => {
  if (accessToken) {
    config.headers.Authorization = `Bearer ${accessToken}`;
  }
  return config;
});

async function refreshAccessToken(): Promise<string | null> {
  const response = await axios.post<ApiSuccess<{ accessToken: string }>>(
    `${baseURL}/api/v1/auth/refresh`,
    {},
    { withCredentials: true },
  );
  accessToken = response.data.data.accessToken;
  return accessToken;
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
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
      return Promise.reject(error);
    }
    config.headers.Authorization = `Bearer ${token}`;
    return api(config);
  },
);

export function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiFailure>(error)) {
    return error.response?.data?.message ?? "Request failed";
  }
  return "Request failed";
}

export async function getData<T>(url: string, params?: object): Promise<T> {
  const response = await api.get<ApiSuccess<T>>(url, { params });
  return response.data.data;
}

export async function postData<T>(url: string, body?: object): Promise<T> {
  const response = await api.post<ApiSuccess<T>>(url, body ?? {});
  return response.data.data;
}
