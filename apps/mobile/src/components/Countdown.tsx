import { type MessageKey } from '@nixzora/i18n';
import {
  countdownPhase,
  type CountdownPhase,
  durationText,
  orderCutoff,
} from '@nixzora/validation';
import { type StyleProp, type TextStyle } from 'react-native';
import { useNow } from '@/lib/clock';
import { useT } from '@/lib/i18n';
import { fonts, usePalette } from '@/lib/theme';
import { Text } from './ui';

/**
 * A deadline's text (p10-38): `later` ("Ends Fri, Oct 16") until the last 24 hours, then
 * "Ends in 5 h 42 min" (or the `soon` message), with its phase for colouring.
 */
export function useDeadline(
  until: string | null | undefined,
  later: string,
  soon: MessageKey<'countdown'> = 'endsIn',
): { text: string; phase: CountdownPhase } {
  const t = useT('countdown');
  const now = useNow(60_000);
  if (!until) return { text: later, phase: 'later' };
  const end = Date.parse(until);
  const phase = countdownPhase(end, now);
  if (phase === 'later') return { text: later, phase };
  if (phase === 'ended') return { text: t('ended'), phase };
  return { text: t(soon, { time: durationText(end - now) }), phase };
}

/** The colour for a phase: amber in the last day, red in the last hour. */
export function useDeadlineStyle(phase: CountdownPhase): StyleProp<TextStyle> {
  const p = usePalette();
  if (phase === 'counting') return { color: p.warnFg, fontFamily: fonts.bodyBold };
  if (phase === 'soon') return { color: p.errFg, fontFamily: fonts.bodyBold };
  return null;
}

/** A small deadline line (`variant="small"`), muted until its last day; nothing when `later` is empty and it's days away. */
export function Deadline({
  until,
  later,
  soon,
}: {
  until: string;
  later: string;
  soon?: MessageKey<'countdown'>;
}) {
  const { text, phase } = useDeadline(until, later, soon);
  const style = useDeadlineStyle(phase);
  if (!text) return null;
  return (
    <Text
      variant="small"
      muted={phase === 'later' || phase === 'ended'}
      accessibilityRole={phase === 'later' ? undefined : 'timer'}
      style={style}
    >
      {text}
    </Text>
  );
}

/**
 * "Order within 2 h 15 min" (p10-38) under the delivery date, while today's cutoff is under 24
 * hours away; null otherwise (the usual hint shows instead).
 */
export function useOrderWithin(twoDay: boolean): { lead: string; hint: string } | null {
  const t = useT('countdown');
  const now = useNow(60_000);
  const left = orderCutoff(new Date(now)).getTime() - now;
  if (countdownPhase(now + left, now) === 'later') return null;
  return {
    lead: t('orderWithin', { time: durationText(left) }),
    hint: t(twoDay ? 'orderWithinHintTwoDay' : 'orderWithinHint'),
  };
}

/** The same, inside a line of text (nested, so it flows with the sentence). */
export function InlineDeadline({
  until,
  later,
  soon,
}: {
  until: string;
  later: string;
  soon?: MessageKey<'countdown'>;
}) {
  const { text, phase } = useDeadline(until, later, soon);
  const style = useDeadlineStyle(phase);
  return (
    <Text variant="small" muted={!style} style={style}>
      {text}
    </Text>
  );
}
