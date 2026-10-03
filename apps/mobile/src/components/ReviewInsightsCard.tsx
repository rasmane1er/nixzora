import type { ReviewInsights } from '@nixzora/validation';
import { View } from 'react-native';
import { useT } from '@/lib/i18n';
import { space, usePalette } from '@/lib/theme';
import { Card, Text } from './ui';

function Chip({ text, tone }: { text: string; tone: 'ok' | 'warn' }) {
  const p = usePalette();
  return (
    <View
      style={{
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: 4,
        backgroundColor: tone === 'ok' ? p.okBg : p.warnBg,
      }}
    >
      <Text variant="small" style={{ color: tone === 'ok' ? p.okFg : p.warnFg }}>
        {text}
      </Text>
    </View>
  );
}

/** "What customers say": a summary and the themes reviewers mention, counted from reviews. */
export function ReviewInsightsCard({ insights }: { insights: ReviewInsights }) {
  const t = useT('appShop');
  const tp = useT('productPage');
  const none = t('insightsNone');
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">{tp('whatCustomersSay')}</Text>
      <Text variant="small" muted>
        {tp(insights.aiWritten ? 'aiSummaryOf' : 'summaryOf', { count: insights.reviewCount })}
      </Text>
      <Text>{insights.summary}</Text>
      {insights.pros.length || insights.cons.length ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          accessibilityLabel={t('insightsLabel', {
            pros: insights.pros.map((theme) => theme.label).join(', ') || none,
            cons: insights.cons.map((theme) => theme.label).join(', ') || none,
          })}
        >
          {insights.pros.map((theme) => (
            <Chip key={`+${theme.label}`} tone="ok" text={`+ ${theme.label} · ${theme.mentions}`} />
          ))}
          {insights.cons.map((theme) => (
            <Chip
              key={`-${theme.label}`}
              tone="warn"
              text={`− ${theme.label} · ${theme.mentions}`}
            />
          ))}
        </View>
      ) : null}
    </Card>
  );
}
