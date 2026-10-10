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
import { useT } from '@/lib/i18n';
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
  const t = useT('appAccount');
  const tc = useT('common');
  const tl = useT('lists');
  const tg = useT('gifts');
  const ts = useT('subscribe');
  const tpl = useT('plus');
  const tcl = useT('clips');
  const thi = useT('history');
  const tha = useT('helpAgent');
  const trf = useT('referrals');
  const tfl = useT('follows');
  const ti = useT('inbox');

  if (status !== 'signedIn' || !user) {
    return (
      <Screen>
        {deleted ? <Banner tone="ok">{t('hubDeleted')}</Banner> : null}
        <View style={{ alignItems: 'center', gap: space.md, paddingVertical: space.xl }}>
          <Logo size={40} wordmark={false} />
          <Text variant="title" style={{ textAlign: 'center' }}>
            {t('hubGuestTitle')}
          </Text>
          <Text muted style={{ textAlign: 'center' }}>
            {t('hubGuestIntro')}
          </Text>
        </View>
        <Button title={tc('signIn')} onPress={() => router.push('/sign-in')} />
        <Button title={tc('createAccount')} tone="ghost" onPress={() => router.push('/register')} />
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
          {name || t('hubYourAccount')}
        </Text>
        <Text muted style={{ textAlign: 'center' }}>
          {user.email}
          {profile?.phone ? `\n${profile.phone}` : ''}
        </Text>
        <Button
          title={t('hubEditProfile')}
          tone="ghost"
          onPress={() => router.push('/account/profile')}
          style={{ alignSelf: 'center', paddingHorizontal: space.xl }}
        />
      </Card>

      {profile && !profile.emailVerified ? (
        <Banner tone="warn">{t('hubConfirmEmail')}</Banner>
      ) : null}

      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Stat href="/orders?filter=open" value={c?.openOrders} label={t('statOnTheWay')} />
        <Stat href="/account/reviews" value={c?.toReview} label={t('statToReview')} />
        <Stat href="/wishlist" value={c?.wishlist} label={t('statSaved')} />
      </View>

      <MenuList
        title={t('groupOrders')}
        items={[
          {
            icon: 'receipt-outline',
            label: t('menuOrders'),
            href: '/orders',
            badge: c?.openOrders ? t('badgeOnTheWay', { count: c.openOrders }) : undefined,
          },
          { icon: 'heart-outline', label: t('menuWishlist'), href: '/wishlist' },
          { icon: 'list-outline', label: tl('title'), href: '/lists' },
          { icon: 'chatbubbles-outline', label: ti('title'), href: '/messages' },
          { icon: 'repeat-outline', label: ts('title'), href: '/account/subscriptions' },
          { icon: 'star-outline', label: tpl('title'), href: '/plus' },
          { icon: 'pricetags-outline', label: tcl('pageTitle'), href: '/coupons' },
          { icon: 'gift-outline', label: tg('balanceTitle'), href: '/account/gift-cards' },
          { icon: 'refresh-outline', label: t('menuBuyAgain'), href: '/account/buy-again' },
          { icon: 'time-outline', label: thi('navHistory'), href: '/account/history' },
          {
            icon: 'return-down-back-outline',
            label: t('menuReturns'),
            href: '/account/returns',
            badge: c?.openReturns ? t('badgeOpen', { count: c.openReturns }) : undefined,
          },
          {
            icon: 'star-outline',
            label: t('menuReviews'),
            href: '/account/reviews',
            badge: c?.toReview ? t('badgeToReview', { count: c.toReview }) : undefined,
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
        title={t('groupShopping')}
        items={[
          {
            icon: 'location-outline',
            label: t('menuAddresses'),
            href: '/account/addresses',
            hint: c ? t('hintAddressesSaved', { count: c.addresses }) : undefined,
          },
          { icon: 'card-outline', label: t('menuPayments'), href: '/account/payments' },
          { icon: 'pricetag-outline', label: t('menuCoupons'), href: '/account/coupons' },
          overview.data?.seller
            ? { icon: 'storefront-outline', label: tc('sellerDashboard'), url: `${WEB_URL}/sell` }
            : {
                icon: 'storefront-outline',
                label: t('menuSellOn'),
                hint: t('hintOpenStore'),
                url: `${WEB_URL}/sell`,
              },
        ]}
      />

      <MenuList
        title={tc('account')}
        items={[
          {
            icon: 'notifications-outline',
            label: t('menuNotifications'),
            href: '/account/preferences',
          },
          {
            icon: 'shield-checkmark-outline',
            label: t('menuSecurity'),
            href: '/account/security',
          },
          {
            icon: 'settings-outline',
            label: t('menuSettings'),
            href: '/account/settings',
            hint: t('hintSettings'),
          },
        ]}
      />

      <MenuList
        title={t('groupHelp')}
        items={[
          { icon: 'storefront-outline', label: tfl('navTitle'), href: '/following' },
          { icon: 'gift-outline', label: trf('navTitle'), href: '/account/referrals' },
          { icon: 'chatbubbles-outline', label: tha('hubLabel'), href: '/help/chat' },
          { icon: 'chatbubble-ellipses-outline', label: t('menuHelp'), href: '/help' },
          { icon: 'document-text-outline', label: t('menuPolicies'), href: '/account/policies' },
        ]}
      />

      <MenuList
        items={[
          {
            icon: 'log-out-outline',
            label: busy ? t('signingOut') : tc('signOut'),
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
