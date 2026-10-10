import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { CartLineRow } from '@/components/CartLineRow';
import { useIsOnline } from '@/components/OfflineToast';
import { DeliveryPromise } from '@/components/Delivery';
import { PlusShippingNote } from '@/components/PlusNote';
import { SavedForLater, useSaved } from '@/components/SavedForLater';
import { CartOffers } from '@/components/MultiBuy';
import { Totals } from '@/components/Totals';
import {
  Banner,
  Button,
  Card,
  Divider,
  EmptyState,
  Field,
  Row,
  Screen,
  Text,
} from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCart, useCartMutation } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { space } from '@/lib/theme';

export default function CartScreen() {
  const online = useIsOnline();
  const t = useT('appShop');
  const tc = useT('common');
  const tcart = useT('cart');
  const cart = useCart();
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
    );
  }

  const blocked = data.lines.some((line) => line.problem);
  const error = update.error ?? applyCoupon.error ?? removeCoupon.error ?? saved.save.error;

  return (
    <Screen refreshControl={refresh}>
      <View>
        {data.lines.map((line, index) => (
          <View key={line.variantId}>
            {index ? <Divider /> : null}
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

      {data.multiBuys?.length ? (
        // Buy X, get Y (p10-27): what applied, and what a few more items would get.
        <Card>
          <CartOffers offers={data.multiBuys} />
        </Card>
      ) : null}
      <Card>
        <Totals totals={data.totals} taxKnown={false} />
      </Card>
      <PlusShippingNote totals={data.totals} />
      <DeliveryPromise window={data.delivery} twoDay={data.totals.shippingSpeed === 'TWO_DAY'} />
      {blocked ? <Banner tone="warn">{t('fixItemsAbove')}</Banner> : null}
      {!online ? <Banner tone="warn">{t('connectToCheckOut')}</Banner> : null}
      <Button
        title={t('checkOut')}
        disabled={blocked || !online}
        onPress={() => router.push('/checkout')}
      />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        {t('securePayment')}
      </Text>
      <SavedForLater saved={saved} />
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
