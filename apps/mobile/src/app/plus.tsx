import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { cardBrand } from '@nixzora/i18n';
import type { MyPlus, PlusPlan, PlusUpdate } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { Chips } from '@/components/Chips';
import { PLUS_ACCENT } from '@/components/PlusNote';
import { Banner, Button, Card, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { pay } from '@/lib/payments';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

const plusKey = ['plus'] as const;
const BENEFITS = [
  ['twoDay', 'rocket-outline'],
  ['shipping', 'cube-outline'],
  ['deals', 'pricetag-outline'],
  ['early', 'flash-outline'],
] as const;

/**
 * NIXZORA Plus (p10-15): what members get and joining, or, for a member, their renewals, card,
 * plan and leaving. One screen for both, reached from the account tab, the cart and products.
 */
export default function PlusScreen() {
  const t = useT('plus');
  const p = usePalette();
  const { money, shortDate, percent } = useFormatters();
  const { status, user } = useSession();
  const signedIn = status === 'signedIn';
  const client = useQueryClient();
  const offer = useQuery({ queryKey: ['plus-offer'], queryFn: () => api.account.plusOffer() });
  const mine = useQuery({
    queryKey: plusKey,
    queryFn: () => api.account.plus(),
    enabled: signedIn,
  });
  const cards = useQuery({
    queryKey: ['payment-cards'],
    queryFn: () => api.account.paymentCards(),
    enabled: signedIn,
  });
  const [plan, setPlan] = useState<PlusPlan>('MONTHLY');
  const [cardId, setCardId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [problem, setProblem] = useState<string | null>(null);

  const usable = (cards.data ?? []).filter((c) => !c.expired);
  const chosenCard = cardId ?? usable.find((c) => c.isDefault)?.id ?? usable[0]?.id ?? null;
  const trial = (mine.data?.offer.trialAvailable ?? offer.data?.trialAvailable) !== false;
  const membership = mine.data?.membership ?? null;

  const join = useMutation({
    mutationFn: () => api.account.joinPlus({ plan, paymentCardId: chosenCard }),
    onSuccess: async (result) => {
      setProblem(null);
      const checkout = result.checkout;
      if (checkout && !checkout.paid) {
        const paid = await pay(checkout.payment, { email: user?.email ?? '' });
        if (paid.outcome === 'failed') setProblem(paid.message);
        if (paid.outcome !== 'paid') {
          await client.invalidateQueries({ queryKey: plusKey });
          return;
        }
      }
      setNotice(t(checkout ? 'joinedPaid' : 'joinedTrial'));
      await client.invalidateQueries({ queryKey: plusKey });
      await client.invalidateQueries({ queryKey: ['cart'] });
    },
    onError: (error) => setProblem(errorMessage(error)),
  });
  /** A renewal that couldn't be charged: pay it here, with any card. */
  const payUnpaid = useMutation({
    mutationFn: async (number: string) => {
      const session = await api.checkout.payment(number);
      return pay(session, { email: user?.email ?? '' });
    },
    onSuccess: async (paid) => {
      if (paid.outcome === 'failed') setProblem(paid.message);
      await client.invalidateQueries({ queryKey: plusKey });
    },
    onError: (error) => setProblem(errorMessage(error)),
  });
  const update = useMutation({
    mutationFn: (body: PlusUpdate) => api.account.updatePlus(body),
    onSuccess: (data) => {
      client.setQueryData<MyPlus>(plusKey, data);
      setNotice(t('updated'));
      setProblem(null);
    },
    onError: (error) => setProblem(errorMessage(error)),
  });

  const plans = offer.data?.plans ?? [];
  const priceOf = (key: PlusPlan) => plans.find((x) => x.plan === key)?.priceCents ?? 0;
  const yearlySaves = plans.length ? 1 - priceOf('YEARLY') / (priceOf('MONTHLY') * 12) : 0;

  return (
    <Screen>
      <View
        style={{
          backgroundColor: '#1D1650',
          borderRadius: 16,
          padding: space.xl,
          gap: space.sm,
        }}
      >
        <Text style={{ color: '#C9C0FF', fontFamily: fonts.bodyBold, letterSpacing: 2 }}>
          NIXZORA PLUS
        </Text>
        <Text variant="title" style={{ color: '#FFFFFF' }}>
          {t('tagline')}
        </Text>
        <Text style={{ color: '#D9DCF2' }}>{t('lead')}</Text>
      </View>

      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      {problem ? <Banner tone="error">{problem}</Banner> : null}

      {membership ? (
        <View style={{ gap: space.md }}>
          <Card style={{ gap: space.xs }}>
            <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
              {t(`status_${membership.status}`)} · {t(`plan_${membership.plan}`)}
            </Text>
            <Text>
              {membership.trial
                ? t('trialUntil', { date: shortDate(membership.currentPeriodEnd) })
                : t('activeUntil', { date: shortDate(membership.currentPeriodEnd) })}
            </Text>
            {membership.cancelAtPeriodEnd ? (
              <Text>{t('leavingNote', { date: shortDate(membership.currentPeriodEnd) })}</Text>
            ) : membership.nextCharge ? (
              <Text>
                {t('nextCharge', {
                  amount: money(membership.nextCharge.amountCents),
                  date: shortDate(membership.nextCharge.at),
                })}
              </Text>
            ) : null}
            <Text muted variant="small">
              {t('memberSince', { date: shortDate(membership.memberSince) })}
            </Text>
            {membership.savedCents ? (
              <Text style={{ color: PLUS_ACCENT, fontFamily: fonts.bodyBold }}>
                {t('saved', { amount: money(membership.savedCents) })}
              </Text>
            ) : null}
          </Card>

          {membership.unpaidOrderNumber ? (
            <View style={{ gap: space.sm }}>
              <Banner tone="error">{t('pastDue')}</Banner>
              <Button
                title={t('payNow')}
                loading={payUnpaid.isPending}
                onPress={() => payUnpaid.mutate(membership.unpaidOrderNumber!)}
              />
            </View>
          ) : null}

          {membership.cancelAtPeriodEnd ? (
            <Button
              title={t('keep')}
              loading={update.isPending}
              onPress={() => update.mutate({ cancelAtPeriodEnd: false })}
            />
          ) : (
            <>
              <Card style={{ gap: space.sm }}>
                <Text variant="heading">{t('changeCard')}</Text>
                {usable.length ? (
                  <Chips<string>
                    value={membership.card?.id ?? ''}
                    onChange={(id) => update.mutate({ paymentCardId: id })}
                    options={usable.map((c) => ({
                      value: c.id,
                      label: `${cardBrand(c.brand)} •••• ${c.last4}`,
                    }))}
                  />
                ) : (
                  <Text muted>{t('noCard')}</Text>
                )}
              </Card>
              <Card style={{ gap: space.sm }}>
                <Text variant="heading">{t('plan')}</Text>
                <Button
                  tone="secondary"
                  title={t('switchPlan', {
                    plan: t(
                      `plan_${membership.plan === 'MONTHLY' ? 'YEARLY' : 'MONTHLY'}`,
                    ).toLowerCase(),
                  })}
                  disabled={update.isPending}
                  onPress={() =>
                    update.mutate({ plan: membership.plan === 'MONTHLY' ? 'YEARLY' : 'MONTHLY' })
                  }
                />
                <Text muted variant="small">
                  {t('planChanges')}
                </Text>
              </Card>
              <Button
                tone="danger"
                title={t('cancel')}
                disabled={update.isPending}
                onPress={() =>
                  Alert.alert(
                    t('cancel'),
                    t('cancelConfirm', { date: shortDate(membership.currentPeriodEnd) }),
                    [
                      { text: t('keep'), style: 'cancel' },
                      {
                        text: t('cancelYes'),
                        style: 'destructive',
                        onPress: () => update.mutate({ cancelAtPeriodEnd: true }),
                      },
                    ],
                  )
                }
              />
            </>
          )}
        </View>
      ) : (
        <View style={{ gap: space.md }}>
          {BENEFITS.map(([key, icon]) => (
            <Card key={key} style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
              <Ionicons name={icon} size={26} color={PLUS_ACCENT} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
                  {t(`benefit_${key}_title`)}
                </Text>
                <Text muted variant="small">
                  {t(`benefit_${key}_body`)}
                </Text>
              </View>
            </Card>
          ))}

          {plans.length ? (
            <Chips<PlusPlan>
              value={plan}
              onChange={setPlan}
              options={plans.map((x) => ({
                value: x.plan,
                label: `${t(`plan_${x.plan}`)} · ${t(
                  x.plan === 'MONTHLY' ? 'perMonth' : 'perYear',
                  {
                    price: money(x.priceCents),
                  },
                )}`,
              }))}
            />
          ) : null}
          {plan === 'YEARLY' && yearlySaves > 0 ? (
            <Text style={{ color: PLUS_ACCENT, fontFamily: fonts.bodyBold }}>
              {t('yearlySaves', { percent: percent(Math.round(yearlySaves * 100) / 100) })}
            </Text>
          ) : null}

          {signedIn ? (
            <>
              {usable.length ? (
                <View style={{ gap: space.xs }}>
                  <Text muted>{trial ? t('renewalCard') : t('payWithCard')}</Text>
                  <Chips<string>
                    value={chosenCard ?? ''}
                    onChange={setCardId}
                    options={usable.map((c) => ({
                      value: c.id,
                      label: `${cardBrand(c.brand)} •••• ${c.last4}`,
                    }))}
                  />
                </View>
              ) : (
                <Text muted variant="small">
                  {trial ? t('noCardTrial') : t('newCardNote')}
                </Text>
              )}
              <Text muted variant="small">
                {t(trial ? 'trialTerms' : 'paidTerms', {
                  price: money(priceOf(plan)),
                  per: t(`per_${plan}`),
                })}
              </Text>
              <Button
                title={trial ? t('startTrial') : t('joinFor', { price: money(priceOf(plan)) })}
                loading={join.isPending}
                disabled={!plans.length}
                onPress={() => join.mutate()}
              />
            </>
          ) : (
            <Button title={t('signInToJoin')} onPress={() => router.push('/sign-in')} />
          )}
        </View>
      )}
    </Screen>
  );
}
