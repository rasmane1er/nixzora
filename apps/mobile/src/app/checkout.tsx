import { ApiError, errorMessage } from '@nixzora/api-client';
import {
  type Address,
  AddressSchema,
  CartIdSchema,
  type SavedAddress,
  US_STATES,
} from '@nixzora/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useIsOnline } from '@/components/OfflineToast';
import { DeliveryPromise } from '@/components/Delivery';
import { PlusShippingNote } from '@/components/PlusNote';
import { Totals } from '@/components/Totals';
import { Banner, Button, Card, EmptyState, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { cardBrand, rich } from '@nixzora/i18n';
import { useFormatters } from '@/lib/format';
import { useCart } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { pay } from '@/lib/payments';
import { keys } from '@/lib/query';
import { session, useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';

type Form = {
  email: string;
  fullName: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  phone: string;
};

const EMPTY: Form = {
  email: '',
  fullName: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  phone: '',
};
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function fromSaved(address: SavedAddress, email: string): Form {
  return {
    email,
    fullName: address.fullName,
    line1: address.line1,
    line2: address.line2 ?? '',
    city: address.city,
    region: address.region,
    postalCode: address.postalCode,
    phone: address.phone ?? '',
  };
}

/** An order that exists but is not paid yet (sheet closed, card declined). */
type Pending = { number: string; token: string; email: string; address: Address };

export default function CheckoutScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tc = useT('checkout');
  const { money } = useFormatters();
  const client = useQueryClient();
  const online = useIsOnline();
  const { status, user } = useSession();
  const signedIn = status === 'signedIn';
  // Buy now (p10-05): a one-item cart of its own, from the product screen.
  const params = useLocalSearchParams<{ buy?: string }>();
  const buy = CartIdSchema.safeParse(params.buy);
  const buyNowId = buy.success ? buy.data : undefined;
  const mainCart = useCart();
  const buyCart = useQuery({
    queryKey: ['buyNow', buyNowId],
    queryFn: () => api.cart.buyNowCart(buyNowId!),
    enabled: !!buyNowId,
  });
  const cart = buyNowId ? buyCart : mainCart;
  const l = useT('lists');
  const w = useT('wallet');
  // Saved cards (p10-09): pay with one now, or keep the new card for next time.
  const cards = useQuery({
    queryKey: ['payment-cards'],
    queryFn: () => api.account.paymentCards(),
    enabled: signedIn,
  });
  const usableCards = (cards.data ?? []).filter((card) => !card.expired);
  const [cardChoice, setCardChoice] = useState<string | null>(null);
  const cardId = cardChoice ?? usableCards.find((c) => c.isDefault)?.id ?? usableCards[0]?.id ?? '';
  const [saveCard, setSaveCard] = useState(false);
  // Gift card balance (p10-10): spent first unless switched off.
  const g = useT('gifts');
  const gift = useQuery({
    queryKey: ['gift-balance'],
    queryFn: () => api.account.giftBalance(),
    enabled: signedIn,
  });
  const giftCents = gift.data?.balanceCents ?? 0;
  const [useGift, setUseGift] = useState(true);
  const addresses = useQuery({
    queryKey: keys.addresses,
    queryFn: () => api.account.addresses(),
    enabled: signedIn,
  });

  const [form, setForm] = useState<Form>({ ...EMPTY, email: user?.email ?? '' });
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string>>>({});
  const [saveAddress, setSaveAddress] = useState(true);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [chosenId, setChosenId] = useState<string | null>(null);

  // Start from the default saved address.
  useEffect(() => {
    const saved = addresses.data;
    if (!saved?.length || chosenId) return;
    const preferred = saved.find((a) => a.isDefaultShipping) ?? saved[0]!;
    setChosenId(preferred.id);
    setForm(fromSaved(preferred, user?.email ?? ''));
  }, [addresses.data, chosenId, user?.email]);

  const region = (US_STATES as readonly string[]).includes(form.region) ? form.region : undefined;
  // Tax depends on the state: show the real total once it is known.
  const priced = useQuery({
    queryKey: [...keys.cart, 'priced', region, buyNowId],
    queryFn: () =>
      buyNowId
        ? api.cart.buyNowCart(buyNowId, region as (typeof US_STATES)[number])
        : api.cart.get(region as (typeof US_STATES)[number]),
    enabled: !!region,
  });
  const totals = (region ? priced.data?.totals : undefined) ?? cart.data?.totals;

  const set = (key: keyof Form) => (value: string) => {
    setForm((current) => ({
      ...current,
      [key]: key === 'region' ? value.toUpperCase().slice(0, 2) : value,
    }));
    setErrors((current) => ({ ...current, [key]: undefined }));
    setChosenId((current) => (key === 'email' ? current : 'new'));
  };

  const validate = useMemo(
    () => (): { email: string; address: Address } | null => {
      const next: Partial<Record<keyof Form, string>> = {};
      if (!EMAIL.test(form.email.trim())) next.email = t('enterReceiptEmail');
      const parsed = AddressSchema.safeParse({
        fullName: form.fullName,
        line1: form.line1,
        line2: form.line2,
        city: form.city,
        region: form.region,
        postalCode: form.postalCode,
        country: 'US',
        phone: form.phone,
      });
      if (!parsed.success) {
        for (const issue of parsed.error.issues) {
          const field = String(issue.path[0]) as keyof Form;
          next[field] ??=
            issue.message.startsWith('Too small') || issue.message.startsWith('Invalid')
              ? t('fillThisIn')
              : issue.message;
        }
      }
      setErrors(next);
      return parsed.success && !next.email
        ? { email: form.email.trim(), address: parsed.data }
        : null;
    },
    [form, t],
  );

  async function collect(order: Pending, session_: Parameters<typeof pay>[0]) {
    const result = await pay(session_, { email: order.email, address: order.address });
    if (result.outcome === 'paid') {
      await client.invalidateQueries({ queryKey: keys.cart });
      await client.invalidateQueries({ queryKey: ['buyNow'] });
      await client.invalidateQueries({ queryKey: ['gift-balance'] });
      await client.invalidateQueries({ queryKey: keys.orders });
      await client.invalidateQueries({ queryKey: ['me'] });
      router.replace({
        pathname: '/orders/[number]',
        params: { number: order.number, token: order.token, placed: '1' },
      });
      return;
    }
    setPending(order);
    setProblem(result.outcome === 'failed' ? result.message : null);
  }

  async function placeOrder() {
    setProblem(null);
    const valid = validate();
    if (!valid) return;
    setBusy(true);
    try {
      const response = await api.checkout.start({
        email: valid.email,
        shippingAddress: valid.address,
        saveAddress: signedIn && chosenId === 'new' ? saveAddress : undefined,
        ...(buyNowId
          ? { buyNowId }
          : { cartId: signedIn ? undefined : (session.cartId() ?? undefined) }),
        ...(signedIn && cardId ? { paymentCardId: cardId } : {}),
        ...(signedIn && !cardId && saveCard ? { saveCard: true } : {}),
        ...(signedIn && giftCents > 0 && useGift ? { useGiftBalance: true } : {}),
      });
      if (!signedIn && !buyNowId) session.setCartId(null);
      const order = { number: response.orderNumber, token: response.accessToken, ...valid };
      if (response.paid) {
        await client.invalidateQueries({ queryKey: keys.cart });
        await client.invalidateQueries({ queryKey: ['buyNow'] });
        await client.invalidateQueries({ queryKey: ['gift-balance'] });
        await client.invalidateQueries({ queryKey: keys.orders });
        router.replace({
          pathname: '/orders/[number]',
          params: { number: order.number, token: order.token, placed: '1' },
        });
        return;
      }
      if (response.paymentProblem) {
        // The saved card did not go through: the order waits, the payment sheet can retry.
        setPending(order);
        setProblem(response.paymentProblem);
        return;
      }
      await collect(order, response.payment);
    } catch (error) {
      setProblem(errorMessage(error));
      if (error instanceof ApiError && error.status === 409) void cart.refetch();
    } finally {
      setBusy(false);
    }
  }

  async function retryPayment() {
    if (!pending) return;
    setProblem(null);
    setBusy(true);
    try {
      await collect(pending, await api.checkout.payment(pending.number, pending.token));
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  if (!pending && !cart.isLoading && !cart.data?.lines.length) {
    return (
      <Screen>
        <EmptyState
          title={t('nothingToCheckOut')}
          action={<Button title={t('backToShop')} onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {buyNowId && !pending ? <Banner>{l('buyNowNote')}</Banner> : null}
      {!signedIn && !pending ? (
        <Banner>
          {rich(t('haveAccount'), {
            link: (chunk) => (
              <Link
                key="sign-in"
                href="/sign-in"
                style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
              >
                {chunk}
              </Link>
            ),
          })}
        </Banner>
      ) : null}

      {pending ? (
        <Card>
          <Text variant="heading">{t('awaitingPaymentTitle', { number: pending.number })}</Text>
          <Text muted>{t('holdingItems')}</Text>
        </Card>
      ) : (
        <>
          <Text variant="heading">{tc('contact')}</Text>
          <Field
            label={t('emailForTheReceipt')}
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text variant="heading">{t('shipTo')}</Text>
          {addresses.data?.length ? (
            <View style={{ gap: space.sm }}>
              {addresses.data.map((address) => {
                const active = chosenId === address.id;
                return (
                  <Pressable
                    key={address.id}
                    accessibilityRole="radio"
                    accessibilityState={{ selected: active }}
                    onPress={() => {
                      setChosenId(address.id);
                      setForm(fromSaved(address, form.email));
                      setErrors({});
                    }}
                    style={{
                      borderWidth: active ? 2 : 1,
                      borderColor: active ? p.fg : p.line,
                      borderRadius: radius,
                      padding: space.md,
                    }}
                  >
                    <Text style={{ fontFamily: fonts.bodyMedium }}>
                      {address.label ? `${address.label} · ` : ''}
                      {address.fullName}
                    </Text>
                    <Text variant="small" muted>
                      {address.line1}, {address.city}, {address.region} {address.postalCode}
                    </Text>
                  </Pressable>
                );
              })}
              <Text variant="small" muted>
                {t('editBelow')}
              </Text>
            </View>
          ) : null}
          <Field
            label={tc('fullName')}
            value={form.fullName}
            onChangeText={set('fullName')}
            error={errors.fullName}
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label={t('streetAddress')}
            value={form.line1}
            onChangeText={set('line1')}
            error={errors.line1}
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <Field
            label={tc('line2')}
            value={form.line2}
            onChangeText={set('line2')}
            error={errors.line2}
            textContentType="streetAddressLine2"
          />
          <Field
            label={tc('city')}
            value={form.city}
            onChangeText={set('city')}
            error={errors.city}
            textContentType="addressCity"
          />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field
                label={tc('state')}
                value={form.region}
                onChangeText={set('region')}
                error={errors.region}
                autoCapitalize="characters"
                maxLength={2}
                placeholder="MD"
                textContentType="addressState"
              />
            </View>
            <View style={{ flex: 1.4 }}>
              <Field
                label={tc('zip')}
                value={form.postalCode}
                onChangeText={set('postalCode')}
                error={errors.postalCode}
                keyboardType="number-pad"
                maxLength={10}
                autoComplete="postal-code"
                textContentType="postalCode"
              />
            </View>
          </Row>
          <Field
            label={t('phoneCourier')}
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          {signedIn ? (
            <>
              <Text variant="heading">{w('payWith')}</Text>
              {giftCents > 0 ? (
                <Row style={{ justifyContent: 'space-between' }}>
                  <Text style={{ flex: 1 }}>{g('useBalance', { amount: money(giftCents) })}</Text>
                  <Switch
                    value={useGift}
                    onValueChange={setUseGift}
                    accessibilityLabel={g('useBalance', { amount: money(giftCents) })}
                  />
                </Row>
              ) : null}
              {usableCards.map((card) => (
                <Pressable
                  key={card.id}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: cardId === card.id }}
                  onPress={() => setCardChoice(card.id)}
                  style={{
                    borderWidth: cardId === card.id ? 2 : 1,
                    borderColor: cardId === card.id ? p.fg : p.line,
                    borderRadius: radius,
                    padding: space.md,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium }}>
                    {w('cardLabel', { brand: cardBrand(card.brand), last4: card.last4 })}
                  </Text>
                </Pressable>
              ))}
              {usableCards.length ? (
                <Pressable
                  accessibilityRole="radio"
                  accessibilityState={{ selected: cardId === '' }}
                  onPress={() => setCardChoice('')}
                  style={{
                    borderWidth: cardId === '' ? 2 : 1,
                    borderColor: cardId === '' ? p.fg : p.line,
                    borderRadius: radius,
                    padding: space.md,
                  }}
                >
                  <Text style={{ fontFamily: fonts.bodyMedium }}>{w('newCard')}</Text>
                </Pressable>
              ) : null}
              {cardId === '' ? (
                <Row style={{ justifyContent: 'space-between' }}>
                  <View style={{ flex: 1, gap: 2 }}>
                    <Text>{w('saveCard')}</Text>
                    <Text variant="small" muted>
                      {w('saveCardHint')}
                    </Text>
                  </View>
                  <Switch
                    value={saveCard}
                    onValueChange={setSaveCard}
                    accessibilityLabel={w('saveCard')}
                  />
                </Row>
              ) : null}
            </>
          ) : null}
          {signedIn && chosenId === 'new' ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text>{t('saveToAddressBook')}</Text>
              <Switch
                value={saveAddress}
                onValueChange={setSaveAddress}
                accessibilityLabel={t('saveToAddressBook')}
              />
            </Row>
          ) : null}
        </>
      )}

      {totals ? (
        <Card>
          <Totals totals={totals} taxKnown={!!region} />
        </Card>
      ) : null}
      {totals ? <PlusShippingNote totals={totals} /> : null}
      <DeliveryPromise window={cart.data?.delivery} twoDay={totals?.shippingSpeed === 'TWO_DAY'} />
      {problem ? <Banner tone="error">{problem}</Banner> : null}
      {!online ? <Banner tone="warn">{t('offlinePlaceOrder')}</Banner> : null}
      <Button
        title={
          pending
            ? t('payNow')
            : totals
              ? t('placeOrderTotal', { amount: money(totals.totalCents, totals.currency) })
              : t('placeOrder')
        }
        loading={busy}
        disabled={!online}
        onPress={() => void (pending ? retryPayment() : placeOrder())}
      />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        {t('paymentNote')}
      </Text>
    </Screen>
  );
}
