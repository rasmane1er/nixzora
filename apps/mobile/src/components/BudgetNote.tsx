import { budgetCheck } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { View } from 'react-native';
import { Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

/**
 * Monthly budget (p10-35): in the cart and at checkout, what this order leaves of the shopper's
 * budget, or a heads-up that it goes over. Only for signed-in shoppers with a budget; never blocks.
 */
export function BudgetNote({ orderCents }: { orderCents: number }) {
  const t = useT('budget');
  const p = usePalette();
  const { money } = useFormatters();
  const { status } = useSession();
  const budget = useQuery({
    queryKey: keys.budget,
    queryFn: () => api.me.budget(),
    enabled: status === 'signedIn',
  });
  if (status !== 'signedIn') return null;
  const check = budgetCheck(budget.data, orderCents);
  if (check.kind === 'none') return null;
  const over = check.kind === 'over';
  const cap = money(budget.data!.monthlyCents!);
  return (
    <View
      accessibilityRole="summary"
      style={{
        backgroundColor: over ? p.warnBg : p.okBg,
        borderRadius: 10,
        padding: space.sm,
        gap: 2,
      }}
    >
      <Text variant="small" style={{ color: over ? p.warnFg : p.okFg }}>
        {over
          ? t('cartOver', { amount: money(check.overCents), budget: cap })
          : t('cartAfter', { amount: money(check.leftAfterCents), budget: cap })}
      </Text>
      <Text
        variant="small"
        accessibilityRole="link"
        onPress={() => router.push('/account/budget')}
        style={{
          color: over ? p.warnFg : p.okFg,
          fontFamily: fonts.bodyBold,
          textDecorationLine: 'underline',
        }}
      >
        {t('manage')}
      </Text>
    </View>
  );
}
