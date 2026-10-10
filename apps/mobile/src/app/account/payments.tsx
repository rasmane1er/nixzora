import { errorMessage } from '@nixzora/api-client';
import { cardBrand } from '@nixzora/i18n';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Alert, View } from 'react-native';
import { Banner, Button, Card, Divider, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';

const cardKeys = { all: ['payment-cards'] as const };

/**
 * Saved cards (p10-09) and the ways to pay. Card numbers stay with the payment provider; the
 * app shows brand, last four digits and expiry, like the website's Payment methods page.
 */
export default function PaymentsScreen() {
  const t = useT('appAccount');
  const w = useT('wallet');
  const tc = useT('common');
  const client = useQueryClient();
  const cards = useQuery({ queryKey: cardKeys.all, queryFn: () => api.account.paymentCards() });
  const update = (data: Awaited<ReturnType<typeof api.account.paymentCards>>) =>
    client.setQueryData(cardKeys.all, data);
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.account.setDefaultCard(id),
    onSuccess: update,
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.account.removeCard(id),
    onSuccess: update,
  });
  const problem = cards.error ?? makeDefault.error ?? remove.error;

  return (
    <Screen>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">{w('savedCardsTitle')}</Text>
        {problem ? <Banner tone="error">{errorMessage(problem)}</Banner> : null}
        {cards.data && !cards.data.length ? <Text>{w('noCards')}</Text> : null}
        {(cards.data ?? []).map((card, i) => (
          <View key={card.id} style={{ gap: space.xs }}>
            {i ? <Divider /> : null}
            <Text style={{ fontFamily: fonts.bodyMedium }}>
              {w('cardLabel', { brand: cardBrand(card.brand), last4: card.last4 })}
            </Text>
            <Text variant="small" muted>
              {w('expires', {
                month: String(card.expMonth).padStart(2, '0'),
                year: String(card.expYear),
              })}
              {card.expired ? ` · ${w('expiredTag')}` : ''}
            </Text>
            {card.isDefault ? <Pill tone="ok" label={w('defaultTag')} /> : null}
            <Row style={{ gap: space.sm }}>
              {!card.isDefault && !card.expired ? (
                <Button
                  title={w('makeDefault')}
                  tone="secondary"
                  loading={makeDefault.isPending && makeDefault.variables === card.id}
                  onPress={() => makeDefault.mutate(card.id)}
                />
              ) : null}
              <Button
                title={w('removeCard')}
                tone="ghost"
                loading={remove.isPending && remove.variables === card.id}
                onPress={() =>
                  Alert.alert(
                    w('cardLabel', { brand: cardBrand(card.brand), last4: card.last4 }),
                    undefined,
                    [
                      { text: tc('cancel'), style: 'cancel' },
                      {
                        text: w('removeCard'),
                        style: 'destructive',
                        onPress: () => remove.mutate(card.id),
                      },
                    ],
                  )
                }
              />
            </Row>
          </View>
        ))}
        <Text variant="small" muted>
          {w('cardsNote')}
        </Text>
      </Card>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">{t('payWaysTitle')}</Text>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>{t('payCards')}</Text>
          <Text variant="small" muted>
            {t('payCardsBody')}
          </Text>
        </View>
        <Divider />
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>{t('payWallets')}</Text>
          <Text variant="small" muted>
            {t('payWalletsBody')}
          </Text>
        </View>
      </Card>
      <Card style={{ gap: space.sm }}>
        <Text variant="small" muted>
          {t('payRefunds')}
        </Text>
        <Button
          title={t('menuReturns')}
          tone="ghost"
          onPress={() => router.push('/account/returns')}
        />
      </Card>
    </Screen>
  );
}
