import Ionicons from '@expo/vector-icons/Ionicons';
import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Banner, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { applySavedTheme, setTheme, type ThemeChoice } from '@/lib/appearance';
import { availableBiometric, type BiometricKind } from '@/lib/biometrics';
import { APP_VARIANT, APP_VERSION } from '@/lib/config';
import { enablePush, pushStatus, type PushStatus } from '@/lib/push';
import { session, useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

const THEMES: { value: ThemeChoice; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'Automatic', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'Light', icon: 'sunny-outline' },
  { value: 'dark', label: 'Dark', icon: 'moon-outline' },
];

const PUSH_HINT: Record<PushStatus, string> = {
  on: 'Shipping, delivery, refund and return updates on this phone.',
  off: 'Get shipping and delivery updates on this phone.',
  blocked: 'Notifications are off for NIXZORA in your phone settings.',
  unsupported: 'Not available on this device.',
};

function SettingRow({
  title,
  body,
  children,
}: {
  title: string;
  body?: string;
  children?: React.ReactNode;
}) {
  return (
    <Row style={{ alignItems: 'center', paddingVertical: space.xs, minHeight: 48 }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text>{title}</Text>
        {body ? (
          <Text variant="small" muted>
            {body}
          </Text>
        ) : null}
      </View>
      {children}
    </Row>
  );
}

/** Appearance, this phone (notifications, unlock), and region. */
export default function SettingsScreen() {
  const p = usePalette();
  const { biometricLock, status } = useSession();
  const [theme, setChoice] = useState<ThemeChoice | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [biometric, setBiometric] = useState<BiometricKind | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void applySavedTheme().then(setChoice);
    void availableBiometric().then(setBiometric);
  }, []);
  // Re-read when coming back from the phone's settings app.
  useFocusEffect(
    useCallback(() => {
      void pushStatus().then(setPush);
    }, []),
  );

  const chooseTheme = (choice: ThemeChoice) => {
    setChoice(choice);
    void setTheme(choice);
  };

  const togglePush = async (on: boolean) => {
    setError(null);
    if (!on || push === 'blocked') {
      // Apps cannot revoke their own permission: the phone's settings own it.
      void Linking.openSettings();
      return;
    }
    try {
      setPush(await enablePush(true));
    } catch {
      setError('Could not turn on notifications. Try again.');
    }
  };

  return (
    <Screen>
      {error ? <Banner tone="error">{error}</Banner> : null}

      {Platform.OS !== 'web' ? (
        <>
          <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
            Appearance
          </Text>
          <Card style={{ flexDirection: 'row', gap: space.sm, padding: space.sm }}>
            {THEMES.map((t) => {
              const selected = theme === t.value;
              return (
                <Pressable
                  key={t.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t.label} appearance`}
                  onPress={() => chooseTheme(t.value)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    gap: 6,
                    paddingVertical: space.md,
                    borderRadius: 10,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? p.fg : p.line,
                  }}
                >
                  <Ionicons name={t.icon} size={22} color={p.fg} />
                  <Text
                    variant="small"
                    style={{ fontFamily: selected ? fonts.bodyMedium : undefined }}
                  >
                    {t.label}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
          <Text variant="small" muted style={{ marginTop: -space.sm }}>
            Automatic follows your phone's light or dark setting.
          </Text>
        </>
      ) : null}

      {Platform.OS !== 'web' ? (
        <>
          <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
            This phone
          </Text>
          <Card>
            <SettingRow title="Order notifications" body={push ? PUSH_HINT[push] : undefined}>
              {push && push !== 'unsupported' ? (
                <Switch
                  value={push === 'on'}
                  onValueChange={(on) => void togglePush(on)}
                  accessibilityLabel="Order notifications"
                />
              ) : null}
            </SettingRow>
            {biometric && status !== 'signedOut' ? (
              <>
                <Divider />
                <SettingRow
                  title={`Unlock with ${biometric}`}
                  body="Ask for it when the app opens, before showing your account."
                >
                  <Switch
                    value={biometricLock}
                    onValueChange={(on) => void session.setBiometricLock(on)}
                    accessibilityLabel={`Unlock with ${biometric}`}
                  />
                </SettingRow>
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
        Region
      </Text>
      <Card>
        <SettingRow title="Language" body="English is the only language for now.">
          <Text muted>English</Text>
        </SettingRow>
        <Divider />
        <SettingRow title="Currency" body="Prices and payments are in US dollars.">
          <Text muted>USD $</Text>
        </SettingRow>
        <Divider />
        <SettingRow title="Ships to" body="We deliver to US addresses only.">
          <Text muted>United States</Text>
        </SettingRow>
      </Card>

      <Text variant="small" muted style={{ textAlign: 'center' }}>
        NIXZORA {APP_VERSION}
        {APP_VARIANT === 'production' ? '' : ` · ${APP_VARIANT}`}
      </Text>
    </Screen>
  );
}
