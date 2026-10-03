import { PressableLink } from '@/components/PressableLink';
import { Avatar } from '@/components/Avatar';
import { BuyAgainCard } from '@/components/BuyAgainCard';
import { MenuList } from '@/components/MenuList';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, View } from 'react-native';
import { Logo } from '@/components/Logo';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { signOut } from '@/lib/account-actions';
import { API_URL, APP_VARIANT, APP_VERSION, WEB_URL } from '@/lib/config';
import { useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';

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

export default function AccountScreen() {
  const { status, user } = useSession();
  const overview = useQuery({
    queryKey: keys.overview,
    queryFn: () => api.me.overview(),
    enabled: status === 'signedIn',
  });
  const { deleted } = useLocalSearchParams<{ deleted?: string }>();
  const [busy, setBusy] = useState(false);

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
  const profile = overview.data?.profile;

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => void overview.refetch()}
        />
      }
    >
      <Card style={{ alignItems: 'center', gap: space.sm, paddingVertical: space.lg }}>
        <Avatar url={profile?.avatarUrl} name={name} email={user.email} size={76} />
        <Text variant="title" style={{ textAlign: 'center' }}>
          {name || 'Your account'}
        </Text>
        <Text muted style={{ textAlign: 'center' }}>
          {user.email}
          {profile?.phone ? `\n${profile.phone}` : ''}
        </Text>
        <Button
          title="Edit profile"
          tone="ghost"
          onPress={() => router.push('/account/profile')}
          style={{ alignSelf: 'center', paddingHorizontal: space.xl }}
        />
      </Card>

      {profile && !profile.emailVerified ? (
        <Banner tone="warn">Confirm your email address: check your inbox for our link.</Banner>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat href="/orders?filter=open" value={c?.openOrders} label="On the way" />
        <Stat href="/account/reviews" value={c?.toReview} label="To review" />
        <Stat href="/wishlist" value={c?.wishlist} label="Saved" />
      </View>

      <MenuList
        title="Orders"
        items={[
          {
            icon: 'receipt-outline',
            label: 'Orders',
            href: '/orders',
            badge: c?.openOrders ? `${c.openOrders} on the way` : undefined,
          },
          { icon: 'heart-outline', label: 'Wishlist', href: '/wishlist' },
          { icon: 'refresh-outline', label: 'Buy again', href: '/account/buy-again' },
          {
            icon: 'return-down-back-outline',
            label: 'Returns & refunds',
            href: '/account/returns',
            badge: c?.openReturns ? `${c.openReturns} open` : undefined,
          },
          {
            icon: 'star-outline',
            label: 'Your reviews',
            href: '/account/reviews',
            badge: c?.toReview ? `${c.toReview} to review` : undefined,
          },
        ]}
      />

      {overview.data?.buyAgain.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          {overview.data.buyAgain.map((item) => (
            <BuyAgainCard key={item.productId} item={item} />
          ))}
        </ScrollView>
      ) : null}

      <MenuList
        title="Shopping & payments"
        items={[
          {
            icon: 'location-outline',
            label: 'Addresses',
            href: '/account/addresses',
            hint: c ? `${c.addresses} saved` : undefined,
          },
          { icon: 'card-outline', label: 'Payment methods', href: '/account/payments' },
          { icon: 'pricetag-outline', label: 'Coupons & rewards', href: '/account/coupons' },
          overview.data?.seller
            ? { icon: 'storefront-outline', label: 'Seller dashboard', url: `${WEB_URL}/sell` }
            : {
                icon: 'storefront-outline',
                label: 'Sell on NIXZORA',
                hint: 'Open your store',
                url: `${WEB_URL}/sell`,
              },
        ]}
      />

      <MenuList
        title="Account"
        items={[
          { icon: 'notifications-outline', label: 'Notifications', href: '/account/preferences' },
          {
            icon: 'shield-checkmark-outline',
            label: 'Security & privacy',
            href: '/account/security',
          },
          {
            icon: 'settings-outline',
            label: 'Settings',
            href: '/account/settings',
            hint: 'Appearance, this phone',
          },
        ]}
      />

      <MenuList
        title="Help"
        items={[
          { icon: 'chatbubble-ellipses-outline', label: 'Help & support', href: '/help' },
          { icon: 'document-text-outline', label: 'Terms & policies', href: '/account/policies' },
        ]}
      />

      <MenuList
        items={[
          {
            icon: 'log-out-outline',
            label: busy ? 'Signing out…' : 'Sign out',
            tone: 'danger',
            onPress: () => {
              if (busy) return;
              setBusy(true);
              void signOut().finally(() => setBusy(false));
            },
          },
        ]}
      />
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
