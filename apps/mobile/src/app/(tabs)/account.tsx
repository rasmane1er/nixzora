import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { Linking, Pressable, Switch, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Banner, Button, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { signOut } from '@/lib/account-actions';
import { availableBiometric, type BiometricKind } from '@/lib/biometrics';
import { API_URL, APP_VARIANT, APP_VERSION, WEB_URL } from '@/lib/config';
import { enablePush, pushStatus, type PushStatus } from '@/lib/push';
import { session, useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

function NavRow({
  href,
  icon,
  label,
}: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
}) {
  const p = usePalette();
  return (
    <PressableLink
      href={href}
      accessibilityRole="link"
      style={({ pressed }) => ({ paddingVertical: space.md, opacity: pressed ? 0.6 : 1 })}
    >
      <Row>
        <Ionicons name={icon} size={20} color={p.fg} />
        <Text style={{ flex: 1 }}>{label}</Text>
        <Ionicons name="chevron-forward" size={18} color={p.muted} />
      </Row>
    </PressableLink>
  );
}

export default function AccountScreen() {
  const p = usePalette();
  const { status, user, biometricLock } = useSession();
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [biometric, setBiometric] = useState<BiometricKind | null>(null);
  const [push, setPush] = useState<PushStatus>('unsupported');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void availableBiometric().then(setBiometric);
      void pushStatus().then(setPush);
    }, []),
  );

  if (status !== 'signedIn' || !user) {
    return (
      <Screen>
        {deleted ? (
          <Banner tone="ok">Your account was deleted. Thanks for shopping with us.</Banner>
        ) : null}
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Logo size={40} wordmark={false} />
          <Text variant="title" style={{ textAlign: 'center' }}>
            Your NIXZORA account
          </Text>
          <Text muted style={{ textAlign: 'center' }}>
            Sign in to track orders, get delivery updates and save products for later.
          </Text>
        </View>
        <Button title="Sign in" onPress={() => router.push('/sign-in')} />
        <Button title="Create an account" tone="ghost" onPress={() => router.push('/register')} />
        <Footer />
      </Screen>
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');

  return (
    <Screen>
      <View style={{ gap: 4 }}>
        <Text variant="title">{name ? `Hi, ${user.firstName ?? name}` : 'Your account'}</Text>
        <Text muted>{user.email}</Text>
      </View>

      <Card style={{ paddingVertical: space.xs }}>
        <NavRow href="/orders" icon="receipt-outline" label="Your orders" />
        <Divider />
        <NavRow href="/wishlist" icon="heart-outline" label="Saved for later" />
      </Card>

      <Card>
        <Text variant="heading">This phone</Text>
        <Row style={{ justifyContent: 'space-between' }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text>Order updates</Text>
            <Text variant="small" muted>
              {push === 'on'
                ? 'On — shipping, delivery and refunds'
                : push === 'blocked'
                  ? 'Blocked in your phone’s Settings'
                  : push === 'unsupported'
                    ? 'Not available on this device'
                    : 'Off'}
            </Text>
          </View>
          {push === 'off' ? (
            <Button
              title="Turn on"
              tone="ghost"
              onPress={() => void enablePush(true).then(setPush)}
            />
          ) : push === 'blocked' ? (
            <Button title="Settings" tone="ghost" onPress={() => void Linking.openSettings()} />
          ) : null}
        </Row>
        {biometric ? (
          <>
            <Divider />
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text>Unlock with {biometric}</Text>
                <Text variant="small" muted>
                  Ask for {biometric} when NIXZORA opens.
                </Text>
              </View>
              <Switch
                value={biometricLock}
                accessibilityLabel={`Unlock with ${biometric}`}
                onValueChange={(next) => void session.setBiometricLock(next)}
              />
            </Row>
          </>
        ) : null}
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`${WEB_URL}/account`)}
          style={{ paddingVertical: space.md }}
        >
          <Row>
            <Ionicons name="shield-checkmark-outline" size={20} color={p.fg} />
            <Text style={{ flex: 1 }}>Password, devices and two-step verification</Text>
            <Ionicons name="open-outline" size={18} color={p.muted} />
          </Row>
        </Pressable>
      </Card>

      <Button
        title="Sign out"
        tone="danger"
        loading={busy}
        onPress={() => {
          setBusy(true);
          void signOut().finally(() => setBusy(false));
        }}
      />
      <Button title="Delete account" tone="ghost" onPress={() => router.push('/delete-account')} />
      <Footer />
    </Screen>
  );
}

function Footer() {
  return (
    <Text
      variant="mono"
      muted
      style={{ textAlign: 'center', fontSize: 11, fontFamily: fonts.mono }}
    >
      NIXZORA {APP_VERSION} · {APP_VARIANT}
      {APP_VARIANT === 'production' ? '' : `\n${API_URL}`}
    </Text>
  );
}
