import type { ReviewInsights } from '@nixzora/validation';
import { View } from 'react-native';
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
  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">What customers say</Text>
      <Text variant="small" muted>
        {insights.aiWritten ? 'AI summary' : 'Summary'} of {insights.reviewCount} reviews
      </Text>
      <Text>{insights.summary}</Text>
      {insights.pros.length || insights.cons.length ? (
        <View
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}
          accessibilityLabel={`Liked: ${insights.pros.map((t) => t.label).join(', ') || 'none'}. Mentioned: ${insights.cons.map((t) => t.label).join(', ') || 'none'}.`}
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
