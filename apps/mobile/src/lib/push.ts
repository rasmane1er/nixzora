import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { type Href, router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { api } from './api';
import { EAS_PROJECT_ID } from './config';
import { t } from './i18n';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

let registeredToken: string | null = null;

export type PushStatus = 'on' | 'off' | 'blocked' | 'unsupported';

export async function pushStatus(): Promise<PushStatus> {
  if (!Device.isDevice || !EAS_PROJECT_ID) return 'unsupported';
  const { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status === 'granted') return 'on';
  return canAskAgain ? 'off' : 'blocked';
}

/**
 * Registers this phone for order updates. With `ask`, shows the system prompt when the customer
 * has not decided yet; without it, only refreshes an existing permission (app start, sign-in).
 */
export async function enablePush(ask: boolean): Promise<PushStatus> {
  if (!Device.isDevice || !EAS_PROJECT_ID) return 'unsupported';

  if (Platform.OS === 'android') {
    const text = t('appShop');
    await Notifications.setNotificationChannelAsync('orders', {
      name: text('pushChannelName'),
      description: text('pushChannelDescription'),
      importance: Notifications.AndroidImportance.HIGH,
      lightColor: '#E8622C',
    });
  }

  let { status, canAskAgain } = await Notifications.getPermissionsAsync();
  if (status !== 'granted' && ask && canAskAgain) {
    ({ status, canAskAgain } = await Notifications.requestPermissionsAsync());
  }
  if (status !== 'granted') return canAskAgain ? 'off' : 'blocked';

  const { data: token } = await Notifications.getExpoPushTokenAsync({
    projectId: EAS_PROJECT_ID,
  });
  await api.devices.register({ token, platform: Platform.OS === 'ios' ? 'ios' : 'android' });
  registeredToken = token;
  return 'on';
}

/** Called just before sign-out, with the still-valid access token. */
export async function forgetDevice(accessToken: string): Promise<void> {
  if (!registeredToken) return;
  await api.devices.remove(registeredToken, accessToken);
  registeredToken = null;
}

/** Opens the order screen when a notification is tapped (also on a cold start). */
export function useNotificationNavigation(ready: boolean): void {
  useEffect(() => {
    if (!ready) return;
    const open = (response: Notifications.NotificationResponse | null) => {
      const path = response?.notification.request.content.data?.path;
      if (typeof path === 'string' && path.startsWith('/')) router.push(path as Href);
    };
    open(Notifications.getLastNotificationResponse());
    const subscription = Notifications.addNotificationResponseReceivedListener(open);
    return () => subscription.remove();
  }, [ready]);
}
