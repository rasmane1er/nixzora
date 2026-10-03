import { errorMessage } from '@nixzora/api-client';
import { SUPPORT_TOPICS, SupportRequestCreateSchema, type SupportTopic } from '@nixzora/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { Banner, Button, Card, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { APP_VERSION } from '@/lib/config';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

/** Writes to customer support; replies arrive by email and in "Your support requests". */
export default function ContactScreen() {
  const p = usePalette();
  const client = useQueryClient();
  const { status, user } = useSession();
  const signedIn = status === 'signedIn';
  const t = useT('appAccount');
  const th = useT('help');
  const tc = useT('common');
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
        throw new Error(t('contactCheckFields'));
      }
      setErrors({});
      return api.support.create(parsed.data);
    },
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.supportRequests }),
  });

  const problem = topic === 'PROBLEM';
  const title = problem ? th('reportProblem') : th('contactSupport');

  if (send.data) {
    return (
      <Screen>
        <Stack.Screen options={{ title }} />
        <Banner tone="ok">
          {t('contactThanks', { reference: send.data.reference, email: send.data.email })}
        </Banner>
        {signedIn ? (
          <Button
            title={t('yourSupportRequests')}
            onPress={() => router.replace('/account/support')}
          />
        ) : null}
        <Button title={t('backToHelp')} tone="ghost" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title }} />
      <Text muted>
        {signedIn && user ? t('contactIntroAt', { email: user.email }) : t('contactIntro')}
      </Text>
      {send.error && !Object.keys(errors).length ? (
        <Banner tone="error">{errorMessage(send.error)}</Banner>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
          {th('topicLabel')}
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
          {SUPPORT_TOPICS.map((value) => {
            const selected = value === topic;
            return (
              <Pressable
                key={value}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                onPress={() => setTopic(value)}
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
                  {th(`topic_${value}`)}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Card>

      {!signedIn ? (
        <>
          <Field
            label={t('contactName')}
            value={name}
            onChangeText={setName}
            autoComplete="name"
            error={errors.name}
          />
          <Field
            label={t('fieldEmail')}
            value={email}
            onChangeText={setEmail}
            autoComplete="email"
            keyboardType="email-address"
            autoCapitalize="none"
            error={errors.email ?? (errors.topic && !email ? t('contactNeedEmail') : undefined)}
          />
        </>
      ) : null}
      {['ORDER', 'DELIVERY', 'RETURN', 'PAYMENT'].includes(topic) ? (
        <Field
          label={t('contactOrder')}
          value={orderNumber}
          onChangeText={setOrderNumber}
          autoCapitalize="characters"
          placeholder="NX-7KQ4M2"
          error={errors.orderNumber}
        />
      ) : null}
      <Field
        label={th('subject')}
        value={subject}
        onChangeText={setSubject}
        maxLength={150}
        error={errors.subject}
      />
      <Field
        label={problem ? t('contactWhatHappened') : t('contactMessage')}
        value={message}
        onChangeText={setMessage}
        multiline
        maxLength={5000}
        textAlignVertical="top"
        style={{ minHeight: 140 }}
        hint={problem ? t('contactProblemHint') : undefined}
        error={errors.message}
      />
      <Button title={tc('send')} loading={send.isPending} onPress={() => send.mutate()} />
    </Screen>
  );
}
