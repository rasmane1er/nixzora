import { PressableLink } from '@/components/PressableLink';
import { Avatar } from '@/components/Avatar';
import { BuyAgainCard } from '@/components/BuyAgainCard';
import { MenuList } from '@/components/MenuList';
import { type Href, router, useLocalSearchParams } from 'expo-router';
import Ionicons from '@expo/vector-icons/Ionicons';
import { type ComponentProps, type ReactElement, type ReactNode, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  RefreshControl,
  type RefreshControlProps,
  ScrollView,
  StyleSheet,
  useColorScheme,
  View,
} from 'react-native';
import { SectionHead } from '@/components/HomeSections';
import { InkBand } from '@/components/ShopHeader';
import { usePlusMember } from '@/lib/hooks';
import { Logo } from '@/components/Logo';
import { Banner, Button, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { signOut } from '@/lib/account-actions';
import { API_URL, APP_VARIANT, APP_VERSION, WEB_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, cardShadow, fonts, space, usePalette } from '@/lib/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

/** A count on the account hub's stats card that opens the matching list. */
function Stat({ href, value, label }: { href: Href; value?: number; label: string }) {
  return (
    <PressableLink
      href={href}
      accessibilityRole="link"
      accessibilityLabel={`${value ?? 0} ${label}`}
      style={({ pressed }) => [styles.stat, { opacity: pressed ? 0.7 : 1 }]}
    >
      <Text variant="title">{value ?? '–'}</Text>
      <Text variant="small" muted numberOfLines={1}>
        {label}
      </Text>
    </PressableLink>
  );
}

/** One of the four shortcuts under the stats card. */
function Tile({ href, icon, label }: { href: Href; icon: IconName; label: string }) {
  const p = usePalette();
  const dark = useColorScheme() === 'dark';
  return (
    <PressableLink
      href={href}
      accessibilityRole="link"
      style={({ pressed }) => [
        styles.tile,
        cardShadow,
        { backgroundColor: p.card, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <View style={[styles.tileIcon, { backgroundColor: p.tint }]}>
        <Ionicons name={icon} size={18} color={dark ? brand.signal : brand.signalStrong} />
      </View>
      <Text numberOfLines={2} style={{ flex: 1, fontFamily: fonts.bodyBold }}>
        {label}
      </Text>
    </PressableLink>
  );
}

/** The ink band and the card that overlaps it (ADR-0053), around the rest of the hub. */
function Hub({
  band,
  children,
  refreshControl,
}: {
  band: ReactNode;
  children: ReactNode;
  refreshControl?: ReactElement<RefreshControlProps>;
}) {
  const p = usePalette();
  const t = useT('appAccount');
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: p.bg }}
      contentContainerStyle={{ paddingBottom: space.xxl * 2 }}
      refreshControl={refreshControl}
      keyboardShouldPersistTaps="handled"
    >
      <InkBand bottom={56}>
        <View style={styles.bandInner}>
          <View style={styles.bandTop}>
            <Text variant="title" style={{ color: '#FFFFFF' }}>
              {t('hubYourAccount')}
            </Text>
            <PressableLink
              href="/account/settings"
              accessibilityRole="link"
              accessibilityLabel={t('menuSettings')}
              style={styles.gear}
            >
              <Ionicons name="settings-outline" size={22} color="#FFFFFF" />
            </PressableLink>
          </View>
          {band}
        </View>
      </InkBand>
      <View style={styles.body}>{children}</View>
    </ScrollView>
  );
}

export default function AccountScreen() {
  const { status, user } = useSession();
  const overview = useQuery({
    queryKey: keys.overview,
    queryFn: () => api.me.overview(),
    enabled: status === 'signedIn',
  });
  // Store analytics (p10-25): the store's team sees its dashboard here.
  const myStore = useQuery({
    queryKey: ['seller-me'],
    queryFn: () => api.seller.me(),
    enabled: status === 'signedIn',
    staleTime: 10 * 60_000,
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
  const tss = useT('storeStats');
  const ti = useT('inbox');
  const tu = useT('shopUi');
  const p = usePalette();
  const plus = usePlusMember();

  if (status !== 'signedIn' || !user) {
    return (
      <Hub
        band={
          <Text variant="heading" style={{ color: '#FFFFFF' }}>
            {tu('hiGuest')}
          </Text>
        }
      >
        <View style={[styles.lift, cardShadow, { backgroundColor: p.card, gap: space.md }]}>
          <View style={{ alignItems: 'center', gap: space.sm }}>
            <Logo size={36} wordmark={false} />
            <Text variant="heading" style={{ textAlign: 'center' }}>
              {t('hubGuestTitle')}
            </Text>
            <Text muted style={{ textAlign: 'center' }}>
              {t('hubGuestIntro')}
            </Text>
          </View>
          <Button
            title={tc('signIn')}
            onPress={() => router.push('/sign-in')}
            style={{ borderRadius: 999 }}
          />
          <Button
            title={tc('createAccount')}
            tone="ghost"
            onPress={() => router.push('/register')}
          />
        </View>
        {deleted ? <Banner tone="ok">{t('hubDeleted')}</Banner> : null}
        <Footer />
      </Hub>
    );
  }

  const name = [user.firstName, user.lastName].filter(Boolean).join(' ');
  const c = overview.data?.counts;
  const profile = overview.data?.profile;

  return (
    <Hub
      refreshControl={
        <RefreshControl
          refreshing={overview.isRefetching}
          onRefresh={() => void overview.refetch()}
        />
      }
      band={
        <PressableLink
          href="/account/profile"
          accessibilityRole="link"
          accessibilityHint={t('hubEditProfile')}
          style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}
        >
          <Avatar url={profile?.avatarUrl} name={name} email={user.email} size={60} />
          <View style={{ flex: 1, gap: 4 }}>
            <Text variant="heading" numberOfLines={1} style={{ color: '#FFFFFF' }}>
              {user.firstName ? tu('hi', { name: user.firstName }) : tu('hiGuest')}
            </Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              {plus ? (
                <View style={styles.plus}>
                  <Text variant="small" style={styles.plusText}>
                    Plus
                  </Text>
                </View>
              ) : null}
              <Text variant="small" numberOfLines={1} style={{ color: p.headerMuted, flex: 1 }}>
                {user.email}
              </Text>
            </View>
          </View>
          <Ionicons name="chevron-forward" size={20} color={p.headerMuted} />
        </PressableLink>
      }
    >
      <View style={[styles.lift, styles.stats, cardShadow, { backgroundColor: p.card }]}>
        <Stat href="/orders?filter=open" value={c?.openOrders} label={t('statOnTheWay')} />
        <Stat href="/account/reviews" value={c?.toReview} label={t('statToReview')} />
        <Stat href="/wishlist" value={c?.wishlist} label={t('statSaved')} />
      </View>

      {profile && !profile.emailVerified ? (
        <Banner tone="warn">{t('hubConfirmEmail')}</Banner>
      ) : null}

      <View style={styles.tiles}>
        <Tile href="/orders" icon="cube-outline" label={t('menuOrders')} />
        <Tile href="/lists" icon="list-outline" label={tl('title')} />
        <Tile href="/account/returns" icon="return-down-back-outline" label={t('menuReturns')} />
        <Tile href="/following" icon="storefront-outline" label={tfl('navTitle')} />
      </View>

      {overview.data?.buyAgain.length ? (
        <View style={{ gap: space.sm }}>
          <SectionHead
            title={t('menuBuyAgain')}
            onSeeAll={() => router.push('/account/buy-again')}
          />
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

      {myStore.data?.seller?.status === 'ACTIVE' ? (
        <MenuList
          title={myStore.data.seller.displayName}
          items={[
            {
              icon: 'stats-chart-outline',
              label: tss('appTitle'),
              href: '/store-dashboard',
              hint: tss('appMore'),
            },
          ]}
        />
      ) : null}

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
    </Hub>
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

const styles = StyleSheet.create({
  bandInner: { width: '100%', maxWidth: 720, alignSelf: 'center', gap: space.md },
  bandTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  gear: { width: 44, height: 44, alignItems: 'flex-end', justifyContent: 'center' },
  body: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: space.lg,
    gap: space.lg,
    marginTop: -40,
  },
  lift: { borderRadius: 18, padding: space.lg },
  stats: { flexDirection: 'row', paddingHorizontal: space.sm, paddingVertical: space.md },
  stat: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: 4 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    minHeight: 64,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
  },
  tileIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  plus: { backgroundColor: '#3D2DB8', borderRadius: 999, paddingHorizontal: 8, paddingVertical: 1 },
  plusText: { color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 11 },
});
