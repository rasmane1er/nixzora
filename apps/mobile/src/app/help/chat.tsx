import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { deliveryRange } from '@nixzora/i18n';
import {
  type HelpAction,
  type HelpButton,
  type HelpConversation,
  type HelpOrderCard,
} from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Banner, Button, EmptyState, Row, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useLocale, useT } from '@/lib/i18n';
import { READABLE_WIDTH, useLayout } from '@/lib/layout';
import { useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';

const helpKey = ['help-chat'] as const;

function OrderCard({ order }: { order: HelpOrderCard }) {
  const t = useT('helpAgent');
  const o = useT('order');
  const p = usePalette();
  const locale = useLocale();
  const { money, shortDate } = useFormatters();
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(`/orders/${order.number}`)}
      style={{
        borderWidth: 1,
        borderColor: p.line,
        borderRadius: 12,
        backgroundColor: p.card,
        padding: space.md,
        gap: 2,
      }}
    >
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>{order.number}</Text>
        <Text variant="small" muted>
          {o(`status_${order.status}`)}
        </Text>
      </Row>
      <Text numberOfLines={1}>
        {order.items.join(', ')}
        {order.itemCount > order.items.length ? ` · ${t('items', { count: order.itemCount })}` : ''}
      </Text>
      <Text variant="small" muted>
        {money(order.totalCents, order.currency)}
        {order.placedAt ? ` · ${t('placed', { date: shortDate(order.placedAt) })}` : ''}
      </Text>
      {order.estimatedDelivery ? (
        <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
          {t('arrives', { window: deliveryRange(order.estimatedDelivery, locale) })}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Buttons({
  buttons,
  busy,
  onAction,
}: {
  buttons: HelpButton[];
  busy: boolean;
  onAction: (action: HelpAction) => void;
}) {
  const t = useT('helpAgent');
  const p = usePalette();
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!buttons.length) return null;
  const small = (label: string, onPress: () => void, primary = false) => (
    <Pressable
      key={label}
      accessibilityRole="button"
      disabled={busy}
      onPress={onPress}
      style={{
        borderWidth: 1,
        borderColor: primary ? p.signalText : p.line,
        backgroundColor: primary ? p.signalText : p.card,
        borderRadius: 999,
        paddingHorizontal: space.md,
        paddingVertical: 8,
        opacity: busy ? 0.6 : 1,
      }}
    >
      <Text
        variant="small"
        style={{ fontFamily: fonts.bodyBold, color: primary ? '#FFFFFF' : p.fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
      {buttons.map((button) => {
        switch (button.kind) {
          case 'order':
            return small(t('btn_order'), () => router.push(`/orders/${button.orderNumber}`));
          case 'return':
            return small(t('btn_return'), () => router.push(`/return/${button.orderNumber}`), true);
          case 'track':
            return button.url
              ? small(t('btn_track'), () => void WebBrowser.openBrowserAsync(button.url!), true)
              : null;
          case 'orders':
            return small(t('btn_orders'), () => router.push('/orders'));
          case 'contact':
            return small(t('btn_contact'), () => router.push('/help/contact'));
          case 'handoff':
            return small(t('btn_handoff'), () => onAction({ kind: 'handoff' }));
          case 'choose':
            return small(button.orderNumber, () =>
              onAction({ kind: 'choose', intent: button.intent, orderNumber: button.orderNumber }),
            );
          case 'cancel':
            return confirming === button.orderNumber ? (
              <View
                key="confirm"
                style={{
                  gap: space.sm,
                  borderWidth: 1,
                  borderColor: p.errFg,
                  borderRadius: 12,
                  padding: space.md,
                  width: '100%',
                }}
              >
                <Text>{t('confirmCancel', { number: button.orderNumber })}</Text>
                <Row style={{ gap: space.sm }}>
                  <Button
                    tone="danger"
                    title={t('confirmYes')}
                    onPress={() => {
                      setConfirming(null);
                      onAction({ kind: 'cancel', orderNumber: button.orderNumber });
                    }}
                  />
                  <Button tone="ghost" title={t('confirmNo')} onPress={() => setConfirming(null)} />
                </Row>
              </View>
            ) : (
              small(t('btn_cancel'), () => setConfirming(button.orderNumber))
            );
        }
      })}
    </View>
  );
}

/**
 * The help agent (p10-20): a support chat answered from the shopper's orders. Cancelling and
 * handing off only happen from the buttons.
 */
export default function HelpChatScreen() {
  const t = useT('helpAgent');
  const p = usePalette();
  const { status } = useSession();
  const { width } = useLayout();
  const signedIn = status === 'signedIn';
  const client = useQueryClient();
  const { order } = useLocalSearchParams<{ order?: string }>();
  const prefill =
    typeof order === 'string' && /^NX-[A-Z0-9]{6}$/i.test(order)
      ? t('orderPrefill', { number: order.toUpperCase() })
      : '';
  const [draft, setDraft] = useState(prefill);
  const [sent, setSent] = useState<string | null>(null);
  const scroll = useRef<ScrollView>(null);
  const chat = useQuery({
    queryKey: helpKey,
    queryFn: () => api.help.current(),
    enabled: signedIn,
  });
  const done = (data: HelpConversation) => {
    client.setQueryData(helpKey, data);
    setSent(null);
  };
  const send = useMutation({
    mutationFn: (text: string) => api.help.send(text),
    onSuccess: done,
    onError: () => setSent(null),
  });
  const act = useMutation({
    mutationFn: (action: HelpAction) => api.help.act(action),
    onSuccess: (data) => {
      done(data);
      // A cancelled order changes the order lists.
      void client.invalidateQueries({ queryKey: ['orders'] });
    },
  });
  const restart = useMutation({
    mutationFn: async () => {
      await api.help.startOver();
      return api.help.current();
    },
    onSuccess: done,
  });
  const busy = send.isPending || act.isPending || restart.isPending;

  useEffect(() => {
    if (prefill) setDraft(prefill);
  }, [prefill]);

  const ask = (text: string) => {
    const content = text.trim();
    if (!content || busy) return;
    setDraft('');
    setSent(content);
    send.mutate(content);
  };

  if (!signedIn) {
    return (
      <View style={{ flex: 1, backgroundColor: p.bg, padding: space.lg }}>
        <EmptyState
          title={t('signIn')}
          body={t('signInLead')}
          action={
            <View style={{ gap: space.sm, alignSelf: 'stretch' }}>
              <Button title={t('signIn')} onPress={() => router.push('/sign-in')} />
              <Button
                tone="ghost"
                title={t('contactInstead')}
                onPress={() => router.push('/help/contact')}
              />
            </View>
          }
        />
      </View>
    );
  }

  const data = chat.data;
  const problem = chat.error ?? send.error ?? act.error ?? restart.error;
  const suggestions = [t('s_track'), t('s_cancel'), t('s_return'), t('s_refund'), t('s_human')];
  return (
    <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 100 : 0}
      >
        <ScrollView
          ref={scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            padding: space.lg,
            gap: space.md,
            width: '100%',
            maxWidth: READABLE_WIDTH,
            alignSelf: 'center',
          }}
        >
          <Row style={{ justifyContent: 'space-between', gap: space.sm }}>
            <Text muted style={{ flex: 1 }}>
              {t('lead')}
            </Text>
            {data?.id ? (
              <Pressable
                accessibilityRole="button"
                disabled={busy}
                onPress={() => restart.mutate()}
              >
                <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                  {t('startOver')}
                </Text>
              </Pressable>
            ) : null}
          </Row>
          {data?.status === 'HANDED_OFF' && data.supportReference ? (
            <Banner tone="ok">{t('handedOff', { reference: data.supportReference })}</Banner>
          ) : null}

          {data?.turns.map((turn) =>
            turn.role === 'USER' ? (
              <View
                key={turn.id}
                accessibilityLabel={`${t('you')}: ${turn.text}`}
                style={{
                  alignSelf: 'flex-end',
                  maxWidth: '85%',
                  backgroundColor: p.tile,
                  borderRadius: 18,
                  borderBottomRightRadius: 4,
                  paddingHorizontal: 14,
                  paddingVertical: 10,
                }}
              >
                <Text style={{ color: p.tileFg }}>{turn.text}</Text>
              </View>
            ) : (
              <View key={turn.id} style={{ gap: space.sm, alignSelf: 'stretch' }}>
                <View
                  style={{
                    alignSelf: 'flex-start',
                    maxWidth: '92%',
                    backgroundColor: p.card,
                    borderColor: p.line,
                    borderWidth: 1,
                    borderRadius: 18,
                    borderBottomLeftRadius: 4,
                    paddingHorizontal: 14,
                    paddingVertical: 10,
                    gap: 2,
                  }}
                >
                  <Text variant="small" muted style={{ fontFamily: fonts.bodyBold }}>
                    {t('agent')}
                  </Text>
                  <Text style={{ color: p.fg }}>{turn.text}</Text>
                </View>
                {turn.orders.map((o) => (
                  <OrderCard key={o.number} order={o} />
                ))}
                <Buttons
                  buttons={turn.buttons}
                  busy={busy}
                  onAction={(action) => act.mutate(action)}
                />
              </View>
            ),
          )}

          {data && data.turns.length === 1 && !sent ? (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
              {suggestions.map((s) => (
                <Pressable
                  key={s}
                  accessibilityRole="button"
                  onPress={() => ask(s)}
                  style={{
                    borderWidth: 1,
                    borderColor: p.line,
                    borderRadius: 999,
                    paddingHorizontal: space.md,
                    paddingVertical: 8,
                    backgroundColor: p.card,
                  }}
                >
                  <Text>{s}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}
          {sent ? (
            <View
              style={{
                alignSelf: 'flex-end',
                maxWidth: '85%',
                backgroundColor: p.tile,
                borderRadius: 18,
                paddingHorizontal: 14,
                paddingVertical: 10,
                opacity: 0.8,
              }}
            >
              <Text style={{ color: p.tileFg }}>{sent}</Text>
            </View>
          ) : null}
          {busy ? (
            <Text muted accessibilityLiveRegion="polite">
              {t('sending')}
            </Text>
          ) : null}
          {problem ? <Banner tone="error">{errorMessage(problem)}</Banner> : null}
        </ScrollView>

        <Row
          style={{
            borderWidth: 1.5,
            borderColor: p.fg,
            borderRadius: radius,
            backgroundColor: p.input,
            paddingLeft: space.md,
            paddingRight: 4,
            paddingVertical: 4,
            margin: space.md,
            width: Math.min(width - space.md * 2, READABLE_WIDTH - space.md * 2),
            alignSelf: 'center',
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => ask(draft)}
            placeholder={t('placeholder')}
            placeholderTextColor={p.muted}
            accessibilityLabel={t('placeholder')}
            returnKeyType="send"
            maxLength={1000}
            style={{ flex: 1, color: p.fg, fontFamily: fonts.body, fontSize: 16, minHeight: 44 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('send')}
            disabled={!draft.trim() || busy}
            onPress={() => ask(draft)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: p.signalText,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !draft.trim() || busy ? 0.5 : 1,
            }}
          >
            <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
