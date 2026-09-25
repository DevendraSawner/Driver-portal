import { TRACKABLE_STATUSES } from "../constants/config";
import { postData } from "../api/client";

export type LocationFix = { lat: number; lng: number; accuracyMeters: number; recordedAt: string };

export type LocationSource = {
  watch: (onFix: (fix: LocationFix) => void) => () => void;
};

let source: LocationSource | null = null;
let stopWatch: (() => void) | null = null;

export function setLocationSource(next: LocationSource | null): void {
  source = next;
}

export function canTrackLocation(online: boolean, bookingStatus: string | null): boolean {
  return online && bookingStatus !== null && (TRACKABLE_STATUSES as readonly string[]).includes(bookingStatus);
}

export function startLocationTracking(input: { online: boolean; bookingStatus: string | null }): void {
  stopLocationTracking();
  if (!canTrackLocation(input.online, input.bookingStatus) || !source) {
    return;
  }
  stopWatch = source.watch((fix) => {
    void postData("/api/v1/driver/location", fix).catch(() => {
      stopLocationTracking();
    });
  });
}

export function stopLocationTracking(): void {
  stopWatch?.();
  stopWatch = null;
}
