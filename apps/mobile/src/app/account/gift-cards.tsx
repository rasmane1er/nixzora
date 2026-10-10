import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Card, Divider, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';

const giftKeys = { balance: ['gift-balance'] as const };

/** Gift card balance (p10-10): add a code, see what was added and spent, buy one on the web. */
export default function GiftCardsScreen() {
  const t = useT('gifts');
  const { money, shortDate } = useFormatters();
  const client = useQueryClient();
  const [code, setCode] = useState('');
  const [added, setAdded] = useState<string | null>(null);
  const view = useQuery({ queryKey: giftKeys.balance, queryFn: () => api.account.giftBalance() });
  const redeem = useMutation({
    mutationFn: () => api.account.redeemGiftCard(code),
    onSuccess: (next) => {
      const before = view.data?.balanceCents ?? 0;
      client.setQueryData(giftKeys.balance, next);
      setAdded(t('redeemed', { amount: money(next.balanceCents - before) }));
      setCode('');
    },
  });

  return (
    <Screen>
      <Card style={{ gap: space.xs }}>
        <Text muted>{t('balanceTitle')}</Text>
        <Text variant="title">{money(view.data?.balanceCents ?? 0)}</Text>
        <Text variant="small" muted>
          {t('balanceHint')}
        </Text>
      </Card>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">{t('redeemTitle')}</Text>
        {added ? <Banner tone="ok">{added}</Banner> : null}
        {redeem.error ? <Banner tone="error">{errorMessage(redeem.error)}</Banner> : null}
        <Field
          label={t('code')}
          value={code}
          onChangeText={(next) => {
            setCode(next);
            setAdded(null);
          }}
          placeholder={t('codePlaceholder')}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
        />
        <Button
          title={t('redeem')}
          loading={redeem.isPending}
          disabled={code.replace(/[^a-z0-9]/gi, '').length < 16}
          onPress={() => redeem.mutate()}
        />
      </Card>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">{t('history')}</Text>
        {view.error ? <Banner tone="error">{errorMessage(view.error)}</Banner> : null}
        {view.data && !view.data.entries.length ? <Text muted>{t('noHistory')}</Text> : null}
        {(view.data?.entries ?? []).map((entry, i) => (
          <View key={entry.id} style={{ gap: 2 }}>
            {i ? <Divider /> : null}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: space.sm }}>
              <Text style={{ flex: 1 }}>
                {t(`kind_${entry.kind}`, { number: entry.orderNumber ?? '' })}
              </Text>
              <Text
                style={{ fontFamily: fonts.bodyBold }}
                tone={entry.amountCents < 0 ? undefined : 'ok'}
              >
                {entry.amountCents < 0 ? '−' : '+'}
                {money(Math.abs(entry.amountCents))}
              </Text>
            </View>
            <Text variant="small" muted>
              {shortDate(entry.createdAt)}
              {entry.note ? ` · ${entry.note}` : ''}
            </Text>
          </View>
        ))}
      </Card>
      <Button
        title={t('buyOne')}
        tone="ghost"
        onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/gift-cards`)}
      />
    </Screen>
  );
}
