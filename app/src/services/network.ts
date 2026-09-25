import { useEffect, useState } from "react";

let offline = false;
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((listener) => listener());
}

export function markOffline(): void {
  if (!offline) {
    offline = true;
    emit();
  }
}

export function markOnline(): void {
  if (offline) {
    offline = false;
    emit();
  }
}

export function useOffline(): boolean {
  const [value, setValue] = useState(offline);
  useEffect(() => {
    const listener = () => setValue(offline);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);
  return value;
}
