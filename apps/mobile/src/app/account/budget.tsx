import { errorMessage } from '@nixzora/api-client';
import { formatters } from '@nixzora/i18n';
import { BUDGET_MAX_CENTS, BUDGET_MIN_CENTS, dollarsToCents } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Banner, Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { fonts, space, usePalette } from '@/lib/theme';

/** Monthly budget (p10-35): set a private cap and see this month's spending against it. */
export default function BudgetScreen() {
  const t = useT('budget');
  const p = usePalette();
  const { money, locale } = useFormatters();
  const client = useQueryClient();
  const budget = useQuery({ queryKey: keys.budget, queryFn: () => api.me.budget() });
  const [amount, setAmount] = useState('');
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const cap = budget.data?.monthlyCents ?? null;

  useEffect(() => {
    if (cap) setAmount(String(cap / 100));
  }, [cap]);

  const save = useMutation({
    mutationFn: (cents: number | null) => api.me.setBudget(cents),
    onSuccess: (data, cents) => {
      client.setQueryData(keys.budget, data);
      setError(null);
      setNotice(cents === null ? t('removed') : t('saved'));
      if (cents === null) setAmount('');
    },
    onError: (e) => setError(errorMessage(e)),
  });

  const submit = () => {
    const cents = dollarsToCents(amount);
    if (!(cents >= BUDGET_MIN_CENTS && cents <= BUDGET_MAX_CENTS)) {
      setNotice(null);
      setError(t('invalid'));
      return;
    }
    save.mutate(cents);
  };

  const data = budget.data;
  const share = data && cap ? Math.min(1, data.spentCents / cap) : 0;
  const over = !!data && !!cap && data.leftCents < 0;

  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={budget.isRefetching} onRefresh={() => void budget.refetch()} />
      }
    >
      <Text muted>{t('lead')}</Text>
      {budget.error ? <Banner tone="error">{errorMessage(budget.error)}</Banner> : null}
      {data ? (
        <Card>
          {cap ? (
            <>
              <Text variant="heading" style={{ fontFamily: fonts.bodyBold }}>
                {over
                  ? t('over', { amount: money(-data.leftCents) })
                  : t('left', { amount: money(data.leftCents) })}
              </Text>
              <View
                accessibilityRole="progressbar"
                accessibilityValue={{ min: 0, max: 100, now: Math.round(share * 100) }}
                style={{
                  height: 10,
                  borderRadius: 999,
                  backgroundColor: p.line,
                  overflow: 'hidden',
                }}
              >
                <View
                  style={{
                    width: `${share * 100}%`,
                    height: '100%',
                    borderRadius: 999,
                    backgroundColor: over ? p.warnFg : p.okFg,
                  }}
                />
              </View>
              <Text variant="small" muted>
                {t('spentOf', {
                  spent: money(data.spentCents),
                  budget: money(cap),
                  month: formatters(locale).monthYear(`${data.month}-15T12:00:00Z`),
                })}
              </Text>
            </>
          ) : (
            <Text>{t('notSet')}</Text>
          )}
        </Card>
      ) : null}
      <Card>
        <Field
          label={t('amountLabel')}
          hint={t('amountHint')}
          value={amount}
          onChangeText={setAmount}
          keyboardType="decimal-pad"
          placeholder="$500"
          returnKeyType="done"
          onSubmitEditing={submit}
        />
        {notice ? <Banner tone="ok">{notice}</Banner> : null}
        {error ? <Banner tone="error">{error}</Banner> : null}
        <Row style={{ gap: space.sm }}>
          <Button
            title={t('save')}
            loading={save.isPending && save.variables !== null}
            onPress={submit}
            style={{ flex: 1 }}
          />
          {cap ? (
            <Button
              title={t('turnOff')}
              tone="secondary"
              loading={save.isPending && save.variables === null}
              onPress={() => save.mutate(null)}
              style={{ flex: 1 }}
            />
          ) : null}
        </Row>
      </Card>
    </Screen>
  );
}
