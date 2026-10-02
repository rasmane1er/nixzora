import { ApiError, errorMessage } from '@nixzora/api-client';
import { type Address, AddressSchema, type SavedAddress, US_STATES } from '@nixzora/validation';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useIsOnline } from '@/components/OfflineToast';
import { Totals } from '@/components/Totals';
import { Banner, Button, Card, EmptyState, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useCart } from '@/lib/hooks';
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
  const client = useQueryClient();
  const online = useIsOnline();
  const { status, user } = useSession();
  const signedIn = status === 'signedIn';
  const cart = useCart();
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
    queryKey: [...keys.cart, 'priced', region],
    queryFn: () => api.cart.get(region as (typeof US_STATES)[number]),
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
      if (!EMAIL.test(form.email.trim())) next.email = 'Enter the email for your receipt.';
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
              ? 'Please fill this in.'
              : issue.message;
        }
      }
      setErrors(next);
      return parsed.success && !next.email
        ? { email: form.email.trim(), address: parsed.data }
        : null;
    },
    [form],
  );

  async function collect(order: Pending, session_: Parameters<typeof pay>[0]) {
    const result = await pay(session_, { email: order.email, address: order.address });
    if (result.outcome === 'paid') {
      await client.invalidateQueries({ queryKey: keys.cart });
      await client.invalidateQueries({ queryKey: keys.orders });
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
        cartId: signedIn ? undefined : (session.cartId() ?? undefined),
      });
      if (!signedIn) session.setCartId(null);
      await collect(
        { number: response.orderNumber, token: response.accessToken, ...valid },
        response.payment,
      );
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
          title="Nothing to check out"
          action={<Button title="Back to the shop" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      {!signedIn && !pending ? (
        <Banner>
          Have an account?{' '}
          <Link
            href="/sign-in"
            style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
          >
            Sign in
          </Link>{' '}
          for saved addresses and order updates on this phone.
        </Banner>
      ) : null}

      {pending ? (
        <Card>
          <Text variant="heading">Order {pending.number} is waiting for payment</Text>
          <Text muted>We are holding your items for 15 minutes. Pay now to confirm the order.</Text>
        </Card>
      ) : (
        <>
          <Text variant="heading">Contact</Text>
          <Field
            label="Email for the receipt"
            value={form.email}
            onChangeText={set('email')}
            error={errors.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="emailAddress"
          />

          <Text variant="heading">Ship to</Text>
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
                Or edit the address below to ship somewhere new.
              </Text>
            </View>
          ) : null}
          <Field
            label="Full name"
            value={form.fullName}
            onChangeText={set('fullName')}
            error={errors.fullName}
            autoComplete="name"
            textContentType="name"
          />
          <Field
            label="Street address"
            value={form.line1}
            onChangeText={set('line1')}
            error={errors.line1}
            autoComplete="street-address"
            textContentType="streetAddressLine1"
          />
          <Field
            label="Apartment, suite (optional)"
            value={form.line2}
            onChangeText={set('line2')}
            error={errors.line2}
            textContentType="streetAddressLine2"
          />
          <Field
            label="City"
            value={form.city}
            onChangeText={set('city')}
            error={errors.city}
            textContentType="addressCity"
          />
          <Row style={{ alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <Field
                label="State"
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
                label="ZIP code"
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
            label="Phone (optional, for the courier)"
            value={form.phone}
            onChangeText={set('phone')}
            error={errors.phone}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
          {signedIn && chosenId === 'new' ? (
            <Row style={{ justifyContent: 'space-between' }}>
              <Text>Save to my address book</Text>
              <Switch
                value={saveAddress}
                onValueChange={setSaveAddress}
                accessibilityLabel="Save to my address book"
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
      {problem ? <Banner tone="error">{problem}</Banner> : null}
      {!online ? <Banner tone="warn">You are offline. Connect to place the order.</Banner> : null}
      <Button
        title={
          pending
            ? 'Pay now'
            : totals
              ? `Place order · ${money(totals.totalCents, totals.currency)}`
              : 'Place order'
        }
        loading={busy}
        disabled={!online}
        onPress={() => void (pending ? retryPayment() : placeOrder())}
      />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        You will choose a card, Apple Pay or Google Pay next. Payments are processed by Stripe;
        NIXZORA never sees your card number.
      </Text>
    </Screen>
  );
}
