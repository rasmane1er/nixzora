/** Web preview: no push notifications (the storefront sends email instead). */
export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';

export async function pushStatus(): Promise<PushStatus> {
  return 'unsupported';
}

export async function enablePush(_ask: boolean): Promise<PushStatus> {
  return 'unsupported';
}

export async function forgetDevice(_accessToken: string): Promise<void> {}

export function useNotificationNavigation(_ready: boolean): void {}
