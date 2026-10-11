import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { calendarDay } from '@nixzora/i18n';
import { addDays, buyReminderChoices, easternToday } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';
import { Banner, Button, Divider, Text } from './ui';

/** Days offered under "Pick a date": the next four weeks. */
const PICK_DAYS = 28;

/** "Remind me to buy" (p10-36): pick a day; that morning we send today's price. */
export function BuyReminderButton({ productId }: { productId: string }) {
  const t = useT('buyReminders');
  const tc = useT('common');
  const p = usePalette();
  const { locale } = useFormatters();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState(false);
  const reminders = useQuery({
    queryKey: keys.buyReminders,
    queryFn: () => api.me.buyReminders(),
    enabled: signedIn,
  });
  const current = reminders.data?.find((r) => r.productId === productId)?.date ?? null;
  const save = useMutation({
    mutationFn: async (date: string | null): Promise<void> => {
      if (date) await api.me.setBuyReminder(productId, date);
      else await api.me.removeBuyReminder(productId);
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: keys.buyReminders });
      setOpen(false);
      setPicking(false);
    },
  });
  const day = (date: string) => calendarDay(date, locale);
  const today = easternToday();

  const row = (label: string, date: string, key: string) => {
    const on = current === date;
    return (
      <Pressable
        key={key}
        accessibilityRole="radio"
        accessibilityState={{ checked: on, busy: save.isPending }}
        disabled={save.isPending}
        onPress={() => save.mutate(date)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 12 }}
      >
        <Ionicons
          name={on ? 'radio-button-on' : 'radio-button-off'}
          size={22}
          color={on ? p.fg : p.muted}
        />
        <Text style={{ flex: 1, fontFamily: fonts.bodyMedium }}>{label}</Text>
        <Text muted>{day(date)}</Text>
      </Pressable>
    );
  };

  return (
    <>
      <Button
        title={current ? t('remindOn', { date: day(current) }) : t('button')}
        tone="ghost"
        icon={
          <Ionicons
            name={current ? 'notifications' : 'notifications-outline'}
            size={18}
            color={p.fg}
          />
        }
        onPress={() => {
          if (!signedIn) return router.push('/sign-in');
          save.reset();
          setOpen(true);
        }}
      />
      <Modal
        visible={open}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setOpen(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.lg,
            }}
          >
            <Text variant="heading">{t('pick')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc('close')}
              onPress={() => setOpen(false)}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={p.fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.xs }}>
            <Text variant="small" muted>
              {t('hint')}
            </Text>
            {buyReminderChoices().map((choice) => row(t(choice.key), choice.date, choice.key))}
            <Divider />
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ expanded: picking }}
              onPress={() => setPicking(!picking)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.sm,
                paddingVertical: 12,
              }}
            >
              <Ionicons name="calendar-outline" size={22} color={p.fg} />
              <Text style={{ flex: 1, fontFamily: fonts.bodyMedium }}>{t('pickDate')}</Text>
              <Ionicons name={picking ? 'chevron-up' : 'chevron-down'} size={18} color={p.muted} />
            </Pressable>
            {picking ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
                {Array.from({ length: PICK_DAYS }, (_, i) => addDays(today, i + 1)).map((date) => {
                  const on = current === date;
                  return (
                    <Pressable
                      key={date}
                      accessibilityRole="radio"
                      accessibilityState={{ checked: on }}
                      disabled={save.isPending}
                      onPress={() => save.mutate(date)}
                      style={{
                        borderWidth: 1,
                        borderColor: on ? p.fg : p.line,
                        borderRadius: radius,
                        paddingHorizontal: 10,
                        paddingVertical: 8,
                        backgroundColor: p.card,
                      }}
                    >
                      <Text variant="small">{day(date)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}
            {save.error ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
          </ScrollView>
          {current ? (
            <View style={{ padding: space.lg }}>
              <Button
                title={t('cancel')}
                tone="ghost"
                loading={save.isPending && save.variables === null}
                onPress={() => save.mutate(null)}
              />
            </View>
          ) : null}
        </SafeAreaView>
      </Modal>
    </>
  );
}
