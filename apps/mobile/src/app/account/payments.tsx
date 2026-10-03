import { router } from 'expo-router';
import { Button, Card, Divider, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fonts, space } from '@/lib/theme';
import { View } from 'react-native';

/**
 * NIXZORA does not keep cards: they go into the payment provider's secure sheet at checkout.
 * Same message as the website's Payment methods page.
 */
export default function PaymentsScreen() {
  const t = useT('appAccount');
  return (
    <Screen>
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
        <Text variant="heading">{t('payNoSavedTitle')}</Text>
        <Text>{t('payNoSavedBody')}</Text>
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
