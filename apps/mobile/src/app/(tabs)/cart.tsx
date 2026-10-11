import { errorMessage } from '@nixzora/api-client';
import { calendarDay } from '@nixzora/i18n';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { Pressable, RefreshControl, type ScrollView, StyleSheet, View } from 'react-native';
import { CartLineRow } from '@/components/CartLineRow';
import { useIsOnline } from '@/components/OfflineToast';
import { DeliveryPromise } from '@/components/Delivery';
import { PlusShippingNote } from '@/components/PlusNote';
import { SavedForLater, useSaved } from '@/components/SavedForLater';
import { CartOffers } from '@/components/MultiBuy';
import { CartSpend } from '@/components/SpendSave';
import { InkBand } from '@/components/ShopHeader';
import { Totals } from '@/components/Totals';
import { Banner, Button, Card, EmptyState, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCart, useCartMutation } from '@/lib/hooks';
import { useLocale, useT } from '@/lib/i18n';
import { brand, cardShadow, fonts, space, usePalette } from '@/lib/theme';

export default function CartScreen() {
  const online = useIsOnline();
  const t = useT('appShop');
  const tpo = useT('preorders');
  const locale = useLocale();
  const tc = useT('common');
  const tcart = useT('cart');
  const cart = useCart();
  const tu = useT('shopUi');
  const ts = useT('saved');
  const p = usePalette();
  const scroll = useRef<ScrollView>(null);
  const [code, setCode] = useState('');
  const update = useCartMutation(
    ({ variantId, quantity }: { variantId: string; quantity: number }) =>
      quantity > 0 ? api.cart.update(variantId, quantity) : api.cart.remove(variantId),
  );
  const applyCoupon = useCartMutation((value: string) => api.cart.applyCoupon(value));
  const removeCoupon = useCartMutation(() => api.cart.removeCoupon());
  const saved = useSaved();
  // Refer a friend (p10-23): a welcome code not used yet, offered while no code is applied.
  const tr = useT('referrals');
  const { money } = useFormatters();
  const welcome = useQuery({
    queryKey: ['referral-welcome'],
    queryFn: () => api.account.referralWelcome().then((r) => r.welcome),
    enabled: saved.signedIn,
  });

  const data = cart.data;
  const refresh = (
    <RefreshControl
      refreshing={cart.isRefetching}
      onRefresh={() => {
        void cart.refetch();
        if (saved.signedIn) void saved.list.refetch();
      }}
    />
  );

  if (!data?.lines.length) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg }}>
        <InkBand>
          <Text variant="title" style={{ color: '#FFFFFF' }}>
            {tu('cartTitle')}
          </Text>
        </InkBand>
        <Screen refreshControl={refresh}>
          {cart.error ? <Banner tone="error">{errorMessage(cart.error)}</Banner> : null}
          {cart.isLoading ? null : (
            <EmptyState
              title={t('cartEmpty')}
              body={t('cartEmptyBody')}
              action={<Button title={t('startShopping')} onPress={() => router.navigate('/')} />}
            />
          )}
          <SavedForLater saved={saved} />
        </Screen>
      </View>
    );
  }

  const blocked = data.lines.some((line) => line.problem);
  const error = update.error ?? applyCoupon.error ?? removeCoupon.error ?? saved.save.error;

  // Pre-orders (p10-30): one order ships once, so a pre-order holds up the rest.
  const releases = data.lines.map((l) => l.releaseDate).filter((d): d is string => !!d);
  const mixedRelease =
    releases.length && releases.length < data.lines.length ? releases.sort().at(-1)! : null;

  // What the shopper keeps (ADR-0053): list-price markdowns, member prices and every discount.
  const saving =
    data.lines.reduce(
      (sum, l) =>
        sum +
        Math.max(0, Math.max(l.compareAtCents ?? 0, l.regularPriceCents ?? 0) - l.unitPriceCents) *
          l.quantity,
      0,
    ) + data.totals.discountCents;
  const remaining = data.totals.freeShippingRemainingCents;
  const subtotal = data.totals.subtotalCents;
  const progress = remaining > 0 ? subtotal / (subtotal + remaining) : 1;
  const savedCount = saved.list.data?.length ?? 0;

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <InkBand>
        <View style={styles.bandRow}>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: space.sm }}>
            <Text variant="title" style={{ color: '#FFFFFF' }}>
              {tu('cartTitle')}
            </Text>
            <Text style={{ color: p.headerMuted }}>
              {tu('cartItems', { count: data.itemCount })}
            </Text>
          </View>
          {savedCount ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => scroll.current?.scrollToEnd({ animated: true })}
              hitSlop={8}
              style={{ minHeight: 44, justifyContent: 'center' }}
            >
              <Text style={{ color: '#F08A5D', fontFamily: fonts.bodyBold }}>
                {ts('title', { count: savedCount })}
              </Text>
            </Pressable>
          ) : null}
        </View>
        <View
          style={styles.ship}
          accessible
          accessibilityRole="progressbar"
          accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }}
        >
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <Ionicons
              name={remaining > 0 ? 'cube-outline' : 'checkmark'}
              size={18}
              color={remaining > 0 ? brand.signal : '#7FD6A3'}
            />
            <Text style={{ color: '#FFFFFF', flex: 1 }}>
              {remaining > 0
                ? tu('freeShipMore', { amount: money(remaining) })
                : tu('freeShipUnlocked')}
            </Text>
          </View>
          <View style={styles.track}>
            <View
              style={[
                styles.fill,
                {
                  width: `${Math.max(4, Math.round(progress * 100))}%`,
                  backgroundColor: remaining > 0 ? brand.signal : '#7FD6A3',
                },
              ]}
            />
          </View>
        </View>
      </InkBand>
      <Screen ref={scroll} refreshControl={refresh}>
        {mixedRelease ? (
          <Banner>{tpo('cartMixed', { date: calendarDay(mixedRelease, locale) })}</Banner>
        ) : null}
        <View style={{ gap: space.md }}>
          {data.lines.map((line) => (
            <View key={line.variantId}>
              <CartLineRow
                line={line}
                busy={update.isPending && update.variables?.variantId === line.variantId}
                onQuantity={(quantity) => update.mutate({ variantId: line.variantId, quantity })}
                onSave={() =>
                  saved.signedIn ? saved.save.mutate(line.variantId) : router.push('/sign-in')
                }
              />
            </View>
          ))}
        </View>
        {error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
        {welcome.data && !welcome.data.used && !data.coupon ? (
          <Card style={{ gap: space.sm }}>
            <Text>
              {tr('cartBanner', {
                amount: money(welcome.data.amountCents),
                code: welcome.data.code,
              })}
            </Text>
            <Button
              title={tr('apply')}
              tone="secondary"
              loading={applyCoupon.isPending}
              onPress={() => applyCoupon.mutate(welcome.data!.code)}
            />
          </Card>
        ) : null}

        <Card>
          {data.coupon ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text variant="mono">{data.coupon.code}</Text>
                <Text variant="small" tone={data.coupon.problem ? 'error' : 'ok'}>
                  {data.coupon.problem ?? data.coupon.description ?? t('couponApplied')}
                </Text>
              </View>
              <Button
                title={tc('remove')}
                tone="ghost"
                loading={removeCoupon.isPending}
                onPress={() => removeCoupon.mutate(undefined)}
              />
            </Row>
          ) : (
            <Row style={{ alignItems: 'flex-end' }}>
              <View style={{ flex: 1 }}>
                <Field
                  label={t('promoCode')}
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="characters"
                  autoCorrect={false}
                  placeholder="WELCOME10"
                  returnKeyType="done"
                />
              </View>
              <Button
                title={tcart('apply')}
                tone="secondary"
                disabled={!code.trim()}
                loading={applyCoupon.isPending}
                onPress={() => applyCoupon.mutate(code.trim(), { onSuccess: () => setCode('') })}
              />
            </Row>
          )}
        </Card>

        {data.spendOffers?.length ? (
          // Spend more, save more (p10-31): each store's tiers, reached or how far.
          <Card>
            <CartSpend offers={data.spendOffers} />
          </Card>
        ) : null}
        {data.multiBuys?.length ? (
          // Buy X, get Y (p10-27): what applied, and what a few more items would get.
          <Card>
            <CartOffers offers={data.multiBuys} />
          </Card>
        ) : null}
        <View style={[styles.summary, { backgroundColor: p.card }, cardShadow]}>
          <Totals totals={data.totals} taxKnown={false} />
          {saving > 0 ? (
            <View style={[styles.savePill, { backgroundColor: p.okBg }]}>
              <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
                {tu('youSave', { amount: money(saving) })}
              </Text>
            </View>
          ) : null}
        </View>
        <PlusShippingNote totals={data.totals} />
        <DeliveryPromise window={data.delivery} twoDay={data.totals.shippingSpeed === 'TWO_DAY'} />
        {blocked ? <Banner tone="warn">{t('fixItemsAbove')}</Banner> : null}
        {!online ? <Banner tone="warn">{t('connectToCheckOut')}</Banner> : null}
        <Text variant="small" muted style={{ textAlign: 'center' }}>
          {t('securePayment')}
        </Text>
        <SavedForLater saved={saved} />
        <View style={{ height: space.lg }} />
      </Screen>
      {/* The sticky checkout bar (ADR-0053): the total and the one next step, always in reach. */}
      <View style={[styles.bar, { backgroundColor: p.card, borderTopColor: p.line }]}>
        <View>
          <Text variant="small" muted>
            {tu('total')}
          </Text>
          <Text style={{ fontFamily: fonts.display, fontSize: 22 }}>
            {money(data.totals.totalCents)}
          </Text>
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title={t('checkOut')}
            disabled={blocked || !online}
            onPress={() => router.push('/checkout')}
            style={{ borderRadius: 999, minHeight: 52 }}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bandRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  ship: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    padding: space.md,
    gap: space.sm,
  },
  track: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.15)' },
  fill: { height: 6, borderRadius: 3 },
  summary: { borderRadius: 18, padding: space.lg, gap: space.md },
  savePill: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.lg,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
    // Clears the raised Ask button in the tab bar below.
    paddingBottom: space.md + 18,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
