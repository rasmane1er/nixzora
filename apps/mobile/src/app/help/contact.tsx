import { errorMessage } from '@nixzora/api-client';
import {
  SUPPORT_TOPICS,
  SUPPORT_TOPIC_LABEL,
  SupportRequestCreateSchema,
  type SupportTopic,
} from '@nixzora/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Banner, Button, Card, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/config';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

/** Writes to customer support; replies arrive by email and in "Your support requests". */
export default function ContactScreen() {
  const p = usePalette();
  const client = useQueryClient();
  const { status, user } = useSession();
  const signedIn = status === 'signedIn';
  const params = useLocalSearchParams<{ topic?: string; order?: string }>();
  const [topic, setTopic] = useState<SupportTopic>(
    (SUPPORT_TOPICS as readonly string[]).includes(params.topic ?? '')
      ? (params.topic as SupportTopic)
      : 'ORDER',
  );
  const [orderNumber, setOrderNumber] = useState(params.order ?? '');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const send = useMutation({
    mutationFn: () => {
      const parsed = SupportRequestCreateSchema.safeParse({
        topic,
        orderNumber,
        subject,
        message,
        ...(signedIn ? {} : { name: name || undefined, email }),
        pageUrl: `app ${Platform.OS} ${APP_VERSION}`,
      });
      if (!parsed.success) {
        const next: Record<string, string> = {};
        for (const issue of parsed.error.issues) next[String(issue.path[0])] ??= issue.message;
        setErrors(next);
        throw new Error('Check the highlighted fields.');
      }
      setErrors({});
      return api.support.create(parsed.data);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.supportRequests }),
  });

  const problem = topic === 'PROBLEM';
  const title = problem ? 'Report a problem' : 'Contact support';

  if (send.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Banner tone="ok">
          {`Thanks, we got it. Your reference is ${send.data.reference}. We reply to ${send.data.email} within one business day.`}
        </Banner>
        {signedIn ? (
          <Button
            title="Your support requests"
            onPress={() => router.replace('/account/support')}
          />
        ) : null}
        <Button title="Back to help" tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Text muted>
        We answer by email within one business day
        {signedIn && user ? `, at ${user.email}` : ''}.
      </Text>
      {send.error && !Object.keys(errors).length ? (
        <Banner tone="error">{errorMessage(send.error)}</Banner>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
          What is it about?
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {SUPPORT_TOPICS.map((t) => {
            const selected = t === topic;
            return (
              <Pressable
                key={t}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setTopic(t)}
                style={{
                  paddingHorizontal: space.sm,
                  paddingVertical: 8,
                  borderRadius: 999,
                  borderWidth: 1,
                  borderColor: selected ? p.fg : p.line,
                  backgroundColor: selected ? p.fg : 'transparent',
                }}
              >
                <Text variant="small" style={{ color: selected ? p.bg : p.fg }}>
                  {SUPPORT_TOPIC_LABEL[t]}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {!signedIn ? (
        <>
          <Field
            label="Your name (optional)"
            value={name}
            onChangeText={setName}
            autoComplete="name"
            error={errors.name}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={
              errors.email ?? (errors.topic && !email ? 'We need an email to reply.' : undefined)
            }
          />
        </>
      ) : null}
      {['ORDER', 'DELIVERY', 'RETURN', 'PAYMENT'].includes(topic) ? (
        <Field
          label="Order number (optional)"
          value={orderNumber}
          onChangeText={setOrderNumber}
          autoCapitalize="characters"
          placeholder="NX-7KQ4M2"
          error={errors.orderNumber}
        />
      ) : null}
      <Field
        label="Subject"
        value={subject}
        onChangeText={setSubject}
        maxLength={150}
        error={errors.subject}
      />
      <Field
        label={problem ? 'What happened?' : 'Message'}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={5000}
        textAlignVertical="top"
        style={{ minHeight: 140 }}
        hint={problem ? 'What you did, what you expected, and what you saw instead.' : undefined}
        error={errors.message}
      />
      <Button title="Send" loading={send.isPending} onPress={() => send.mutate()} />
    </Screen>
  );
}
