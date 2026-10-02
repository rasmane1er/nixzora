import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { type AssistantChatResponse, type AssistantMessage } from '@nixzora/validation';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
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
import { Price } from '@/components/Price';
import { Banner, Button, Card, Row, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { money } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

type Turn =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; response: AssistantChatResponse };

const EXAMPLES = [
  'A quiet laptop for coding under $1,500',
  'Headphones for long flights, under $250',
  'A gift for someone who runs every morning',
];

/** "$1,500" rather than "$1,500.00" for round budgets. */
const usd = (cents: number) => money(cents, 'USD').replace(/\.00$/, '');

function Chip({ label, onPress }: { label: string; onPress?: () => void }) {
  const p = usePalette();
  const body = (
    <View
      style={{
        borderWidth: 1,
        borderColor: p.line,
        backgroundColor: p.card,
        borderRadius: 999,
        paddingHorizontal: 12,
        paddingVertical: onPress ? 8 : 4,
      }}
    >
      <Text variant="small">{label}</Text>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4}>
      {body}
    </Pressable>
  ) : (
    body
  );
}

function AddPick({ variantId, title }: { variantId: string; title: string }) {
  const add = useCartMutation((id: string) => api.cart.add(id, 1));
  const done = add.isSuccess;
  return (
    <View style={{ gap: 4 }}>
      <Button
        title={done ? 'Added ✓' : 'Add to cart'}
        tone={done ? 'secondary' : 'primary'}
        loading={add.isPending}
        accessibilityLabel={done ? `Added ${title} to cart` : `Add ${title} to cart`}
        onPress={() =>
          add.mutate(variantId, {
            onSuccess: () => {
              if (Platform.OS !== 'web')
                void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
            },
          })
        }
      />
      {add.isError ? (
        <Text variant="small" tone="error">
          {errorMessage(add.error)}
        </Text>
      ) : null}
    </View>
  );
}

function Answer({
  response,
  onAsk,
}: {
  response: AssistantChatResponse;
  onAsk: (text: string) => void;
}) {
  const p = usePalette();
  const need = response.need;
  const understood = [
    need.categoryName,
    need.maxPriceCents !== null ? `Up to ${usd(need.maxPriceCents)}` : null,
    need.minPriceCents !== null && need.maxPriceCents === null
      ? `From ${usd(need.minPriceCents)}`
      : null,
    ...need.mustHave,
  ].filter(Boolean) as string[];

  return (
    <Card style={{ gap: space.md }}>
      {understood.length ? (
        <View
          accessibilityLabel={`Understood: ${understood.join(', ')}`}
          style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}
        >
          <Text variant="label" muted>
            Understood
          </Text>
          {understood.map((chip) => (
            <Chip key={chip} label={chip} />
          ))}
        </View>
      ) : null}
      <Text>{response.reply}</Text>

      {response.picks.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.md, paddingRight: space.md }}
        >
          {response.picks.map((pick, i) => (
            <View
              key={pick.product.id}
              style={{
                width: 236,
                borderWidth: i === 0 ? 2 : 1,
                borderColor: i === 0 ? brand.signal : p.line,
                borderRadius: radius,
                backgroundColor: p.bg,
                padding: space.md,
                gap: 6,
              }}
            >
              {pick.badge ? (
                <View
                  style={{
                    alignSelf: 'flex-start',
                    backgroundColor: p.tile,
                    borderRadius: 6,
                    paddingHorizontal: 8,
                    paddingVertical: 2,
                  }}
                >
                  <Text variant="label" style={{ color: p.tileFg }}>
                    {pick.badge}
                  </Text>
                </View>
              ) : null}
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(`/p/${pick.product.slug}`)}
              >
                <Text variant="small" muted>
                  {pick.product.brand?.name ?? ' '}
                </Text>
                <Text variant="heading" numberOfLines={2}>
                  {pick.product.title}
                </Text>
              </Pressable>
              <Price
                cents={pick.product.priceFromCents}
                compareAtCents={pick.product.compareAtCents}
              />
              <Text variant="small" muted numberOfLines={2}>
                {pick.reason}
              </Text>
              {pick.matched.length ? (
                <Text variant="small" tone="ok" numberOfLines={2}>
                  {pick.matched.map((m) => `✓ ${m}`).join('  ')}
                </Text>
              ) : null}
              {pick.product.inStock && pick.variantId ? (
                <AddPick variantId={pick.variantId} title={pick.product.title} />
              ) : (
                <Text variant="small" tone="error">
                  Sold out
                </Text>
              )}
            </View>
          ))}
        </ScrollView>
      ) : null}

      {response.comparison && response.picks.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View accessibilityLabel="Comparison of the picks">
            <Row style={{ borderBottomWidth: 1, borderBottomColor: p.line, paddingVertical: 6 }}>
              <Text variant="label" muted style={{ width: 96 }}>
                Compare
              </Text>
              {response.picks.map((pick) => (
                <Text
                  key={pick.product.id}
                  variant="small"
                  numberOfLines={2}
                  style={{ width: 128, fontFamily: fonts.bodyMedium }}
                >
                  {pick.product.title}
                </Text>
              ))}
            </Row>
            {response.comparison.rows.map((row) => (
              <Row
                key={row.label}
                style={{ borderBottomWidth: 1, borderBottomColor: p.line, paddingVertical: 6 }}
              >
                <Text variant="small" muted style={{ width: 96 }}>
                  {row.label}
                </Text>
                {row.values.map((value, i) => (
                  <Text key={i} variant="small" style={{ width: 128 }}>
                    {value ?? '—'}
                  </Text>
                ))}
              </Row>
            ))}
          </View>
        </ScrollView>
      ) : null}

      {response.suggestions.length ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
          {response.suggestions.map((s) => (
            <Chip key={s} label={s} onPress={() => onAsk(s)} />
          ))}
        </View>
      ) : null}
      <Text variant="small" muted>
        Products, prices and stock come from the live catalog.
      </Text>
    </Card>
  );
}

/** The AI shopping assistant. Answers are grounded in the live catalog (ADR-0009). */
export default function AssistantScreen() {
  const p = usePalette();
  const { q } = useLocalSearchParams<{ q?: string }>();
  const [turns, setTurns] = useState<Turn[]>([]);
  const [draft, setDraft] = useState('');
  const scroll = useRef<ScrollView>(null);
  const handled = useRef<string | null>(null);

  const chat = useMutation({
    mutationFn: (messages: AssistantMessage[]) => api.assistant.chat(messages),
    onSuccess: (response) =>
      setTurns((current) => [...current, { role: 'assistant', content: response.reply, response }]),
  });

  function ask(text: string) {
    const content = text.trim();
    if (!content || chat.isPending) return;
    const next: Turn[] = [...turns, { role: 'user', content }];
    setTurns(next);
    setDraft('');
    chat.mutate(next.slice(-12).map((t) => ({ role: t.role, content: t.content })));
  }

  // Deep links and the home screen open the assistant with a request: nixzora://assistant?q=…
  useEffect(() => {
    if (typeof q === 'string' && q.trim() && handled.current !== q) {
      handled.current = q;
      ask(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}
      >
        <ScrollView
          ref={scroll}
          onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={{ padding: space.lg, gap: space.lg }}
          keyboardShouldPersistTaps="handled"
        >
          <View style={{ gap: space.xs }}>
            <Text variant="label" tone="ai">
              AI shopping assistant
            </Text>
            <Text variant="title">What do you need today?</Text>
            <Text muted>Describe it in your own words: budget, what it is for, what matters.</Text>
          </View>

          {!turns.length && !chat.isPending ? (
            <View style={{ gap: space.sm }}>
              {EXAMPLES.map((example) => (
                <Chip key={example} label={example} onPress={() => ask(example)} />
              ))}
            </View>
          ) : null}

          {turns.map((turn, i) =>
            turn.role === 'user' ? (
              <View
                key={i}
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
                <Text style={{ color: p.tileFg }}>{turn.content}</Text>
              </View>
            ) : (
              <Answer key={i} response={turn.response} onAsk={ask} />
            ),
          )}

          {chat.isPending ? (
            <Text muted accessibilityLiveRegion="polite">
              Searching the catalog…
            </Text>
          ) : null}
          {chat.isError ? <Banner tone="error">{errorMessage(chat.error)}</Banner> : null}
        </ScrollView>

        <Row
          style={{
            margin: space.md,
            borderWidth: 1.5,
            borderColor: p.fg,
            borderRadius: radius,
            backgroundColor: p.input,
            paddingLeft: space.md,
            paddingRight: 4,
            paddingVertical: 4,
          }}
        >
          <TextInput
            value={draft}
            onChangeText={setDraft}
            onSubmitEditing={() => ask(draft)}
            placeholder={turns.length ? 'Ask a follow-up' : 'Describe what you need'}
            placeholderTextColor={p.muted}
            accessibilityLabel="Message the assistant"
            returnKeyType="send"
            maxLength={1000}
            style={{ flex: 1, color: p.fg, fontFamily: fonts.body, fontSize: 16, minHeight: 44 }}
          />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Send"
            disabled={!draft.trim() || chat.isPending}
            onPress={() => ask(draft)}
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: p.ai,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: !draft.trim() || chat.isPending ? 0.5 : 1,
            }}
          >
            <Ionicons name="arrow-forward" size={20} color="#F6F5F1" />
          </Pressable>
        </Row>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
