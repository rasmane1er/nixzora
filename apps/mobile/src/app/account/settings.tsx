import { errorMessage } from '@nixzora/api-client';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type Locale, LOCALE_LABEL, LOCALES, type MessageKey } from '@nixzora/i18n';
import { useFocusEffect } from 'expo-router';
import * as Linking from 'expo-linking';
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, Switch, View } from 'react-native';
import { Banner, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { applySavedTheme, setTheme, type ThemeChoice } from '@/lib/appearance';
import { availableBiometric, type BiometricKind } from '@/lib/biometrics';
import { deviceSignIn, useDeviceSignInAccount } from '@/lib/device-sign-in';
import { APP_VARIANT, APP_VERSION } from '@/lib/config';
import { sendTestReport } from '@/lib/sentry';
import { chooseLanguage as chooseLanguageEverywhere } from '@/lib/choose-language';
import { useLocale, useT } from '@/lib/i18n';
import { enablePush, pushStatus, type PushStatus } from '@/lib/push';
import { session, useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

type Key = MessageKey<'appAccount'>;

const THEMES: { value: ThemeChoice; label: Key; icon: keyof typeof Ionicons.glyphMap }[] = [
  { value: 'system', label: 'themeAutomatic', icon: 'phone-portrait-outline' },
  { value: 'light', label: 'themeLight', icon: 'sunny-outline' },
  { value: 'dark', label: 'themeDark', icon: 'moon-outline' },
];

const PUSH_HINT: Record<PushStatus, Key> = {
  on: 'pushOn',
  off: 'pushOff',
  blocked: 'pushBlocked',
  unsupported: 'pushUnsupported',
};

/** Face ID and Touch ID are names; the others are words to translate. */
const BIOMETRIC_WORD: Partial<Record<BiometricKind, Key>> = {
  fingerprint: 'bioFingerprint',
  biometrics: 'bioBiometrics',
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
  const { biometricLock, status, user } = useSession();
  const deviceAccount = useDeviceSignInAccount();
  const [bioBusy, setBioBusy] = useState(false);
  const [theme, setChoice] = useState<ThemeChoice | null>(null);
  const [push, setPush] = useState<PushStatus | null>(null);
  const [biometric, setBiometric] = useState<BiometricKind | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT('appAccount');
  const tc = useT('common');
  const locale = useLocale();
  const biometricWord = biometric ? BIOMETRIC_WORD[biometric] : undefined;
  const biometricName = biometricWord ? t(biometricWord) : biometric;

  useEffect(() => {
    void applySavedTheme().then(setChoice);
    void availableBiometric().then(setBiometric);
    void deviceSignIn.load();
  }, []);

  const toggleDeviceSignIn = async (on: boolean) => {
    if (!user) return;
    setError(null);
    setBioBusy(true);
    try {
      if (on) await deviceSignIn.enable(user.email);
      else await deviceSignIn.disable();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBioBusy(false);
    }
  };
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

  const chooseLanguage = (next: Locale) => chooseLanguageEverywhere(next, status === 'signedIn');

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
      setError(t('pushError'));
    }
  };

  return (
    <Screen>
      {error ? <Banner tone="error">{error}</Banner> : null}

      {Platform.OS !== 'web' ? (
        <>
          <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
            {t('appearance')}
          </Text>
          <Card style={{ flexDirection: 'row', gap: space.sm, padding: space.sm }}>
            {THEMES.map((option) => {
              const selected = theme === option.value;
              return (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={t('themeA11y', { theme: t(option.label) })}
                  onPress={() => chooseTheme(option.value)}
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
                  <Ionicons name={option.icon} size={22} color={p.fg} />
                  <Text
                    variant="small"
                    style={{ fontFamily: selected ? fonts.bodyMedium : undefined }}
                  >
                    {t(option.label)}
                  </Text>
                </Pressable>
              );
            })}
          </Card>
          <Text variant="small" muted style={{ marginTop: -space.sm }}>
            {t('appearanceHint')}
          </Text>
        </>
      ) : null}

      {Platform.OS !== 'web' ? (
        <>
          <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
            {t('thisPhone')}
          </Text>
          <Card>
            <SettingRow
              title={t('orderNotifications')}
              body={push ? t(PUSH_HINT[push]) : undefined}
            >
              {push && push !== 'unsupported' ? (
                <Switch
                  value={push === 'on'}
                  onValueChange={(on) => void togglePush(on)}
                  accessibilityLabel={t('orderNotifications')}
                />
              ) : null}
            </SettingRow>
            {biometricName && status !== 'signedOut' ? (
              <>
                <Divider />
                <SettingRow
                  title={t('unlockWith', { method: biometricName })}
                  body={t('unlockWithBody')}
                >
                  <Switch
                    value={biometricLock}
                    onValueChange={(on) => void session.setBiometricLock(on)}
                    accessibilityLabel={t('unlockWith', { method: biometricName })}
                  />
                </SettingRow>
                {user ? (
                  <>
                    <Divider />
                    <SettingRow
                      title={t('bioSignInTitle', { method: biometricName })}
                      body={t('bioSignInBody')}
                    >
                      <Switch
                        value={deviceAccount === user.email}
                        disabled={bioBusy}
                        onValueChange={(on) => void toggleDeviceSignIn(on)}
                        accessibilityLabel={t('bioSignInTitle', { method: biometricName })}
                      />
                    </SettingRow>
                  </>
                ) : null}
              </>
            ) : null}
          </Card>
        </>
      ) : null}

      <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
        {t('region')}
      </Text>
      <Card>
        <View style={{ gap: space.sm, paddingVertical: space.xs }}>
          <View style={{ gap: 2 }}>
            <Text>{tc('language')}</Text>
            <Text variant="small" muted>
              {t('languageHint')}
            </Text>
          </View>
          <View
            accessibilityRole="radiogroup"
            accessibilityLabel={tc('language')}
            style={{ flexDirection: 'row', gap: space.sm }}
          >
            {LOCALES.map((code) => {
              const selected = locale === code;
              return (
                <Pressable
                  key={code}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={LOCALE_LABEL[code]}
                  onPress={() => chooseLanguage(code)}
                  style={{
                    flex: 1,
                    alignItems: 'center',
                    paddingVertical: space.sm,
                    borderRadius: 10,
                    borderWidth: selected ? 2 : 1,
                    borderColor: selected ? p.fg : p.line,
                  }}
                >
                  <Text
                    variant="small"
                    style={{ fontFamily: selected ? fonts.bodyMedium : undefined }}
                  >
                    {LOCALE_LABEL[code]}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
        <Divider />
        <SettingRow title={t('currency')} body={t('currencyBody')}>
          <Text muted>USD $</Text>
        </SettingRow>
        <Divider />
        <SettingRow title={t('shipsTo')} body={t('shipsToBody')}>
          <Text muted>{t('unitedStates')}</Text>
        </SettingRow>
      </Card>

      {APP_VARIANT === 'production' ? null : <TestReport />}
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        NIXZORA {APP_VERSION}
        {APP_VARIANT === 'production' ? '' : ` · ${APP_VARIANT}`}
      </Text>
    </Screen>
  );
}

/** Preview builds: send a test crash report (checks the Sentry set-up end to end). */
function TestReport() {
  const [result, setResult] = useState<string | null>(null);
  const send = async () => {
    setResult('Sending…');
    try {
      const id = await sendTestReport();
      setResult(id ? `Sent. Report id ${id.slice(0, 8)}` : 'Crash reports are off in this build.');
    } catch (error) {
      setResult(`Failed: ${String(error)}`);
    }
  };
  return (
    <Pressable accessibilityRole="button" onPress={send} hitSlop={8}>
      <Text variant="small" muted style={{ textAlign: 'center', textDecorationLine: 'underline' }}>
        {result ?? 'Send a test crash report'}
      </Text>
    </Pressable>
  );
}
