export type PushProvider = {
  requestPermission: () => Promise<boolean>;
  getToken: () => Promise<string | null>;
  onMessage: (handler: (message: { title?: string; body?: string }) => void) => () => void;
};

let provider: PushProvider | null = null;

export function configurePushProvider(next: PushProvider | null): void {
  provider = next;
}

export function getPushProvider(): PushProvider | null {
  return provider;
}
