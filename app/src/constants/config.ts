declare const process: { env: { API_URL?: string } };

const configuredApiUrl = process.env.API_URL;
export const apiUrl = configuredApiUrl && configuredApiUrl.length > 0 ? configuredApiUrl : "http://localhost:5000";

export const OPEN_BOOKING_STATUSES = [
  "PENDING",
  "SEARCHING_DRIVER",
  "DRIVER_ASSIGNED",
  "DRIVER_ACCEPTED",
  "DRIVER_ON_THE_WAY",
  "DRIVER_ARRIVED",
  "TRIP_STARTED",
] as const;

export const TRACKABLE_STATUSES = ["DRIVER_ON_THE_WAY", "DRIVER_ARRIVED", "TRIP_STARTED"] as const;
