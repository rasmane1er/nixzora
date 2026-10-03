import { type ComponentProps, type ReactNode, forwardRef } from 'react';
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  ScrollView,
  type ScrollViewProps,
  type StyleProp,
  StyleSheet,
  Text as RNText,
  type TextProps,
  TextInput,
  type TextInputProps,
  type TextStyle,
  View,
  type ViewStyle,
} from 'react-native';
import { READABLE_WIDTH } from '@/lib/layout';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

type Variant = 'display' | 'title' | 'heading' | 'body' | 'small' | 'label' | 'mono';

const variants: Record<Variant, TextStyle> = {
  display: { fontFamily: fonts.display, fontSize: 30, lineHeight: 34, letterSpacing: -0.6 },
  title: { fontFamily: fonts.display, fontSize: 22, lineHeight: 28, letterSpacing: -0.3 },
  heading: { fontFamily: fonts.displayMedium, fontSize: 17, lineHeight: 22 },
  body: { fontFamily: fonts.body, fontSize: 16, lineHeight: 23 },
  small: { fontFamily: fonts.body, fontSize: 13, lineHeight: 18 },
  label: {
    fontFamily: fonts.mono,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  mono: { fontFamily: fonts.mono, fontSize: 13, lineHeight: 18 },
};

export function Text({
  variant = 'body',
  muted,
  tone,
  style,
  ...props
}: TextProps & { variant?: Variant; muted?: boolean; tone?: 'signal' | 'ai' | 'error' | 'ok' }) {
  const p = usePalette();
  const color =
    tone === 'signal'
      ? p.signalText
      : tone === 'ai'
        ? p.ai
        : tone === 'error'
          ? p.errFg
          : tone === 'ok'
            ? p.okFg
            : muted
              ? p.muted
              : p.fg;
  return <RNText {...props} style={[variants[variant], { color }, style]} />;
}

type ButtonProps = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  tone?: 'primary' | 'secondary' | 'ghost' | 'danger';
  loading?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  title,
  tone = 'primary',
  loading,
  disabled,
  icon,
  style,
  ...props
}: ButtonProps) {
  const p = usePalette();
  const off = disabled || loading;
  const background =
    tone === 'primary' ? brand.signal : tone === 'secondary' ? p.tile : 'transparent';
  const color =
    tone === 'primary'
      ? '#FFFFFF'
      : tone === 'secondary'
        ? p.tileFg
        : tone === 'danger'
          ? p.errFg
          : p.fg;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!off, busy: !!loading }}
      disabled={off}
      {...props}
      style={({ pressed }) => [
        styles.button,
        {
          backgroundColor: pressed && tone === 'primary' ? brand.signalPressed : background,
          borderColor: tone === 'ghost' || tone === 'danger' ? p.line : 'transparent',
          opacity: off ? 0.55 : pressed && tone !== 'primary' ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={color} /> : icon}
      <RNText style={[styles.buttonText, { color }]}>{title}</RNText>
    </Pressable>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const p = usePalette();
  return (
    <View style={[styles.card, { backgroundColor: p.card, borderColor: p.line }, style]}>
      {children}
    </View>
  );
}

export const Field = forwardRef<
  TextInput,
  TextInputProps & { label: string; error?: string; hint?: string }
>(function Field({ label, error, hint, style, ...props }, ref) {
  const p = usePalette();
  return (
    <View style={styles.field}>
      <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
        {label}
      </Text>
      <TextInput
        ref={ref}
        placeholderTextColor={p.muted}
        accessibilityLabel={label}
        {...props}
        style={[
          styles.input,
          { backgroundColor: p.input, borderColor: error ? p.errFg : p.line, color: p.fg },
          style,
        ]}
      />
      {error ? (
        <Text variant="small" tone="error">
          {error}
        </Text>
      ) : hint ? (
        <Text variant="small" muted>
          {hint}
        </Text>
      ) : null}
    </View>
  );
});

export function Banner({
  tone = 'info',
  children,
}: {
  tone?: 'info' | 'ok' | 'error' | 'warn';
  children: ReactNode;
}) {
  const p = usePalette();
  const [bg, fg] =
    tone === 'ok'
      ? [p.okBg, p.okFg]
      : tone === 'error'
        ? [p.errBg, p.errFg]
        : tone === 'warn'
          ? [p.warnBg, p.warnFg]
          : [p.card, p.fg];
  return (
    <View
      accessibilityRole={tone === 'error' ? 'alert' : undefined}
      style={[styles.banner, { backgroundColor: bg, borderColor: tone === 'info' ? p.line : bg }]}
    >
      <RNText style={[variants.small, { color: fg }]}>{children}</RNText>
    </View>
  );
}

/**
 * A scrolling page. On tablets its content is centred at a readable width; pass `wide` for
 * pages that lay out their own columns (the product page).
 */
export function Screen({
  children,
  contentContainerStyle,
  wide,
  ...props
}: ScrollViewProps & { wide?: boolean }) {
  const p = usePalette();
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      contentInsetAdjustmentBehavior="automatic"
      {...props}
      style={[{ flex: 1, backgroundColor: p.bg }, props.style]}
      contentContainerStyle={[styles.screen, !wide && styles.readable, contentContainerStyle]}
    >
      {children}
    </ScrollView>
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <View style={styles.empty}>
      <Text variant="title" style={{ textAlign: 'center' }}>
        {title}
      </Text>
      {body ? (
        <Text muted style={{ textAlign: 'center' }}>
          {body}
        </Text>
      ) : null}
      {action}
    </View>
  );
}

export function Pill({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: 'neutral' | 'ok' | 'warn' | 'error';
}) {
  const p = usePalette();
  const [bg, fg] =
    tone === 'ok'
      ? [p.okBg, p.okFg]
      : tone === 'warn'
        ? [p.warnBg, p.warnFg]
        : tone === 'error'
          ? [p.errBg, p.errFg]
          : [p.line, p.fg];
  return (
    <View style={[styles.pill, { backgroundColor: bg }]}>
      <RNText style={[variants.label, { color: fg }]}>{label}</RNText>
    </View>
  );
}

export function Divider() {
  const p = usePalette();
  return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: p.line }} />;
}

export function Row({ style, ...props }: ComponentProps<typeof View>) {
  return <View {...props} style={[styles.row, style]} />;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius,
    borderWidth: 1,
    paddingHorizontal: space.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  buttonText: { fontFamily: fonts.bodyBold, fontSize: 16 },
  card: { borderRadius: radius, borderWidth: 1, padding: space.lg, gap: space.sm },
  field: { gap: 6 },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: space.md,
    fontFamily: fonts.body,
    fontSize: 16,
  },
  banner: { borderRadius: 10, borderWidth: 1, padding: space.md },
  screen: { padding: space.lg, gap: space.lg, paddingBottom: space.xxl * 2 },
  readable: { width: '100%', maxWidth: READABLE_WIDTH, alignSelf: 'center' },
  empty: {
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.xxl,
    paddingHorizontal: space.lg,
  },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4, alignSelf: 'flex-start' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
