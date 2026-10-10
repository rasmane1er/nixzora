import { errorMessage } from '@nixzora/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { CartLineRow } from '@/components/CartLineRow';
import { useIsOnline } from '@/components/OfflineToast';
import { DeliveryPromise } from '@/components/Delivery';
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

  const data = cart.data;
  const refresh = (
    <RefreshControl refreshing={cart.isRefetching} onRefresh={() => void cart.refetch()} />
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
      </Screen>
    );
  }

  const blocked = data.lines.some((line) => line.problem);
  const error = update.error ?? applyCoupon.error ?? removeCoupon.error;

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
            />
          </View>
        ))}
      </View>
      {error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}

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

      <Card>
        <Totals totals={data.totals} taxKnown={false} />
      </Card>
      <DeliveryPromise window={data.delivery} />
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
      <View style={{ height: space.lg }} />
    </Screen>
  );
}
