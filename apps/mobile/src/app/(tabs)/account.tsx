import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { type Href, router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import type { BuyAgainItem } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Linking, Pressable, RefreshControl, ScrollView, Switch, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Banner, Button, Card, Divider, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { keys } from '@/lib/query';
import { signOut } from '@/lib/account-actions';
import { availableBiometric, type BiometricKind } from '@/lib/biometrics';
import { API_URL, APP_VARIANT, APP_VERSION, WEB_URL } from '@/lib/config';
import { enablePush, pushStatus, type PushStatus } from '@/lib/push';
import { session, useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';

function NavRow({
  href,
  icon,
  label,
  hint,
  badge,
}: {
  href: Href;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  badge?: string;
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
        <View style={{ flex: 1, gap: 2 }}>
          <Text>{label}</Text>
          {hint ? (
            <Text variant="small" muted>
              {hint}
            </Text>
          ) : null}
        </View>
        {badge ? <Pill label={badge} tone="warn" /> : null}
        <Ionicons name="chevron-forward" size={18} color={p.muted} />
      </Row>
    </PressableLink>
  );
}

/** A count on the account hub that opens the matching list. */
function Stat({ href, value, label }: { href: Href; value?: number; label: string }) {
  const p = usePalette();
  return (
    <PressableLink
      href={href}
      accessibilityRole="link"
      accessibilityLabel={`${value ?? 0} ${label}`}
      style={({ pressed }) => ({
        flex: 1,
        padding: space.sm,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: p.line,
        backgroundColor: p.card,
        opacity: pressed ? 0.7 : 1,
      })}
    >
      <Text variant="title">{value ?? '–'}</Text>
      <Text variant="small" muted numberOfLines={1}>
        {label}
      </Text>
    </PressableLink>
  );
}

function BuyAgainCard({ item }: { item: BuyAgainItem }) {
  const p = usePalette();
  const add = useCartMutation(() => api.cart.add(item.variantId, 1));
  return (
    <View
      style={{
        width: 160,
        gap: 6,
        padding: space.sm,
        borderRadius: radius,
        borderWidth: 1,
        borderColor: p.line,
        backgroundColor: p.card,
      }}
    >
      <PressableLink href={`/p/${item.slug}`} accessibilityRole="link">
        <Image
          source={{ uri: item.imageUrl ?? undefined }}
          style={{ width: '100%', aspectRatio: 4 / 3, borderRadius: 8, backgroundColor: p.bg }}
          contentFit="cover"
        />
        <Text
          variant="small"
          numberOfLines={2}
          style={{ fontFamily: fonts.bodyMedium, marginTop: 6 }}
        >
          {item.title}
        </Text>
      </PressableLink>
      <Text variant="small" muted>
        {money(item.priceCents, item.currency)}
      </Text>
      <Button
        title={add.isSuccess ? 'Added' : item.inStock ? 'Add to cart' : 'Out of stock'}
        tone="secondary"
        disabled={!item.inStock || add.isSuccess}
        loading={add.isPending}
        onPress={() => add.mutate(undefined)}
      />
    </View>
  );
}

export default function AccountScreen() {
  const p = usePalette();
  const { status, user, biometricLock } = useSession();
  const overview = useQuery({
    queryKey: keys.overview,
    queryFn: () => api.me.overview(),
    enabled: status === 'signedIn',
  });
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
  const c = overview.data?.counts;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => void overview.refetch()}
        />
      }
    >
      <View style={{ gap: 4 }}>
        <Text variant="title">{user.firstName ? `Hello, ${user.firstName}` : 'Your account'}</Text>
        <Text muted>{name ? `${name} · ${user.email}` : user.email}</Text>
      </View>

      {overview.data && !overview.data.profile.emailVerified ? (
        <Banner tone="warn">Confirm your email address: check your inbox for our link.</Banner>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat href="/orders?filter=open" value={c?.openOrders} label="On the way" />
        <Stat href="/orders" value={c?.orders} label="Orders" />
        <Stat href="/account/reviews" value={c?.toReview} label="To review" />
        <Stat href="/wishlist" value={c?.wishlist} label="Saved" />
      </View>

      <Card style={{ paddingVertical: space.xs }}>
        <NavRow
          href="/orders"
          icon="receipt-outline"
          label="Your orders"
          hint="Track, return, buy again"
          badge={c?.openOrders ? `${c.openOrders} on the way` : undefined}
        />
        <Divider />
        <NavRow
          href="/account/returns"
          icon="return-down-back-outline"
          label="Returns & refunds"
          badge={c?.openReturns ? `${c.openReturns} in progress` : undefined}
        />
        <Divider />
        <NavRow
          href="/account/reviews"
          icon="star-outline"
          label="Your reviews"
          badge={c?.toReview ? `${c.toReview} to review` : undefined}
        />
        <Divider />
        <NavRow href="/wishlist" icon="heart-outline" label="Saved for later" />
      </Card>

      <Card style={{ paddingVertical: space.xs }}>
        <NavRow
          href="/account/security"
          icon="shield-checkmark-outline"
          label="Login & security"
          hint="Name, phone, password, devices"
        />
        <Divider />
        <NavRow
          href="/account/addresses"
          icon="location-outline"
          label="Your addresses"
          hint={c ? `${c.addresses} saved` : undefined}
        />
        <Divider />
        <NavRow href="/account/preferences" icon="mail-outline" label="Communication" />
        <Divider />
        <Pressable
          accessibilityRole="link"
          onPress={() => void Linking.openURL(`${WEB_URL}/account/privacy`)}
          style={{ paddingVertical: space.md }}
        >
          <Row>
            <Ionicons name="lock-closed-outline" size={20} color={p.fg} />
            <Text style={{ flex: 1 }}>Your data & privacy</Text>
            <Ionicons name="open-outline" size={18} color={p.muted} />
          </Row>
        </Pressable>
      </Card>

      {overview.data?.buyAgain.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="heading">Buy it again</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ gap: space.sm }}
          >
            {overview.data.buyAgain.map((item) => (
              <BuyAgainCard key={item.productId} item={item} />
            ))}
          </ScrollView>
        </View>
      ) : null}

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
