import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, View } from 'react-native';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { brand, radius, space, usePalette } from '@/lib/theme';
import { messageKeys } from '@/lib/message-keys';

/** One conversation with a store: messages, reply, report (p10-12). */
export default function ConversationScreen() {
  const p = usePalette();
  const t = useT('inbox');
  const tc = useT('common');
  const { dateTime } = useFormatters();
  const { id } = useLocalSearchParams<{ id: string }>();
  const client = useQueryClient();
  const [text, setText] = useState('');
  const thread = useQuery({
    queryKey: messageKeys.one(id),
    queryFn: () => api.account.conversation(id),
    refetchInterval: 30_000,
  });
  const send = useMutation({
    mutationFn: () => api.account.replyToStore(id, text),
    onSuccess: (view) => {
      client.setQueryData(messageKeys.one(id), view);
      void client.invalidateQueries({ queryKey: messageKeys.all });
      setText('');
    },
  });
  const report = useMutation({
    mutationFn: (reason: string) => api.account.reportConversation(id, reason),
    onSuccess: (view) => client.setQueryData(messageKeys.one(id), view),
  });

  if (thread.isLoading) return <ActivityIndicator style={{ flex: 1, backgroundColor: p.bg }} />;
  if (!thread.data) {
    return (
      <Screen>
        <Banner tone="error">{thread.error ? errorMessage(thread.error) : t('back')}</Banner>
      </Screen>
    );
  }
  const data = thread.data;
  return (
    <Screen>
      <Stack.Screen options={{ title: data.with }} />
      <Text muted>{data.subject}</Text>
      <Banner>{t('safety')}</Banner>
      {data.messages.map((m) => {
        const mine = m.author === 'CUSTOMER';
        return (
          <View
            key={m.id}
            style={{
              alignSelf: mine ? 'flex-end' : 'flex-start',
              maxWidth: '88%',
              gap: 4,
              padding: space.md,
              borderRadius: radius,
              borderWidth: 1,
              borderColor: p.line,
              backgroundColor: mine ? `${brand.signal}1A` : p.card,
            }}
          >
            <Text variant="small" muted>
              {mine ? t('you') : m.author === 'STAFF' ? t('staff') : data.with} · {dateTime(m.at)}
            </Text>
            <Text>{m.body}</Text>
            {m.redacted ? (
              <Text variant="small" muted style={{ fontStyle: 'italic' }}>
                {t('redacted')}
              </Text>
            ) : null}
          </View>
        );
      })}
      <Field
        label={t('placeholder')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        style={{ minHeight: 80, textAlignVertical: 'top' }}
      />
      {send.error ? <Banner tone="error">{errorMessage(send.error)}</Banner> : null}
      <Button
        title={t('send')}
        loading={send.isPending}
        disabled={!text.trim()}
        onPress={() => send.mutate()}
      />
      {data.reported ? (
        <Text variant="small" muted>
          {t('reported')}
        </Text>
      ) : (
        <Button
          title={t('report')}
          tone="ghost"
          onPress={() =>
            Alert.prompt
              ? Alert.prompt(t('report'), t('reportReason'), [
                  { text: tc('cancel'), style: 'cancel' },
                  {
                    text: t('report'),
                    style: 'destructive',
                    onPress: (reason?: string) => report.mutate(reason?.trim() || 'Reported'),
                  },
                ])
              : report.mutate('Reported')
          }
        />
      )}
    </Screen>
  );
}
