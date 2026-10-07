import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { ReturnCreate } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { Banner, Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { brand, fonts, space, usePalette } from '@/lib/theme';

const REASONS = [
  'DAMAGED',
  'NOT_AS_DESCRIBED',
  'WRONG_ITEM',
  'NO_LONGER_NEEDED',
  'OTHER',
] as const satisfies readonly ReturnCreate['reason'][];

/** One choice row: a checkbox or a radio button with a label. */
function Choice({
  label,
  detail,
  selected,
  radio,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  radio?: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  const icon = radio
    ? selected
      ? 'radio-button-on'
      : 'radio-button-off'
    : selected
      ? 'checkbox'
      : 'square-outline';
  return (
    <Pressable
      accessibilityRole={radio ? 'radio' : 'checkbox'}
      accessibilityState={radio ? { selected } : { checked: selected }}
      accessibilityLabel={detail ? `${label}, ${detail}` : label}
      onPress={onPress}
      style={{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: space.md }}
    >
      <Ionicons name={icon} size={24} color={selected ? brand.signal : p.muted} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontFamily: fonts.bodyMedium }}>{label}</Text>
        {detail ? (
          <Text variant="small" muted>
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

/** Quantity stepper for items bought more than once. */
function Stepper({
  value,
  max,
  label,
  onChange,
}: {
  value: number;
  max: number;
  label: string;
  onChange: (next: number) => void;
}) {
  const p = usePalette();
  const step = (delta: number) => onChange(Math.min(max, Math.max(1, value + delta)));
  return (
    <Row style={{ gap: space.sm, alignItems: 'center' }} accessibilityLabel={label}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="−"
        disabled={value <= 1}
        onPress={() => step(-1)}
        hitSlop={8}
      >
        <Ionicons name="remove-circle-outline" size={26} color={value <= 1 ? p.line : p.fg} />
      </Pressable>
      <Text style={{ minWidth: 20, textAlign: 'center' }}>{value}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="+"
        disabled={value >= max}
        onPress={() => step(1)}
        hitSlop={8}
      >
        <Ionicons name="add-circle-outline" size={26} color={value >= max ? p.line : p.fg} />
      </Pressable>
    </Row>
  );
}

/**
 * Start a return, in the app. The order page used to open the website for this, which only
 * works for guest links: a signed-in customer has no web session there and got "not found".
 */
export default function ReturnScreen() {
  const { number, token } = useLocalSearchParams<{ number: string; token?: string }>();
  const t = useT('order');
  const tc = useT('common');
  const { status } = useSession();
  const client = useQueryClient();
  const order = useQuery({
    queryKey: keys.order(number),
    queryFn: () => api.orders.get(number, token),
    enabled: !!token || status === 'signedIn',
  });
  const [picked, setPicked] = useState<Record<string, number>>({});
  const [reason, setReason] = useState<ReturnCreate['reason']>('DAMAGED');
  const [note, setNote] = useState('');
  const [missingItem, setMissingItem] = useState(false);

  const submit = useMutation({
    mutationFn: () =>
      api.orders.requestReturn(
        number,
        {
          reason,
          note: note.trim() || undefined,
          items: Object.entries(picked).map(([orderItemId, quantity]) => ({
            orderItemId,
            quantity,
          })),
        },
        token,
      ),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.order(number) }),
        client.invalidateQueries({ queryKey: keys.returns }),
      ]);
    },
  });

  if (order.isPending) {
    return (
      <Screen>
        <ActivityIndicator style={{ marginTop: space.xl }} />
      </Screen>
    );
  }
  if (order.error || !order.data) {
    return (
      <Screen>
        <Banner tone="error">{errorMessage(order.error)}</Banner>
      </Screen>
    );
  }

  if (submit.isSuccess) {
    return (
      <Screen>
        <Banner tone="ok">{t('returnRequested')}</Banner>
        <Button title={tc('back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  const toggle = (id: string) => {
    setMissingItem(false);
    setPicked((current) => {
      const next = { ...current };
      if (next[id]) delete next[id];
      else next[id] = 1;
      return next;
    });
  };
  const send = () => {
    if (Object.keys(picked).length === 0) {
      setMissingItem(true);
      return;
    }
    submit.mutate();
  };

  return (
    <Screen>
      <Card>
        <Text variant="heading">{t('whichItems')}</Text>
        {order.data.items.map((item) => (
          <Row key={item.id} style={{ alignItems: 'center', gap: space.md }}>
            <View style={{ flex: 1 }}>
              <Choice
                label={item.productTitle}
                detail={item.variantTitle}
                selected={!!picked[item.id]}
                onPress={() => toggle(item.id)}
              />
            </View>
            {picked[item.id] && item.quantity > 1 ? (
              <Stepper
                value={picked[item.id]!}
                max={item.quantity}
                label={t('howMany', { title: item.productTitle })}
                onChange={(quantity) =>
                  setPicked((current) => ({ ...current, [item.id]: quantity }))
                }
              />
            ) : null}
          </Row>
        ))}
        {missingItem ? <Banner tone="error">{t('chooseReturnItem')}</Banner> : null}
      </Card>

      <Card>
        <Text variant="heading">{t('reason')}</Text>
        <View accessibilityRole="radiogroup" style={{ gap: space.xs }}>
          {REASONS.map((value) => (
            <Choice
              key={value}
              radio
              label={t(`reason_${value}`)}
              selected={reason === value}
              onPress={() => setReason(value)}
            />
          ))}
        </View>
      </Card>

      <Card>
        <Field
          label={`${t('anythingToKnow')} (${t('optional')})`}
          value={note}
          onChangeText={setNote}
          multiline
          maxLength={1000}
          style={{ minHeight: 96, textAlignVertical: 'top' }}
        />
      </Card>

      {submit.error ? <Banner tone="error">{errorMessage(submit.error)}</Banner> : null}
      <Button
        title={submit.isPending ? t('sending') : t('requestReturn')}
        loading={submit.isPending}
        onPress={send}
      />
    </Screen>
  );
}
