import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { messageKeys } from '@/lib/message-keys';

/** First message to a store: ?store=<handle>&name=<display>&product=<id>&order=<number>. */
export default function NewMessageScreen() {
  const t = useT('inbox');
  const client = useQueryClient();
  const { store, name, product, order } = useLocalSearchParams<{
    store: string;
    name?: string;
    product?: string;
    order?: string;
  }>();
  const [text, setText] = useState('');
  const send = useMutation({
    mutationFn: () =>
      api.account.messageStore({
        sellerHandle: store,
        ...(product ? { productId: product } : {}),
        ...(order ? { orderNumber: order } : {}),
        body: text,
      }),
    onSuccess: (view) => {
      void client.invalidateQueries({ queryKey: messageKeys.all });
      router.replace({ pathname: '/messages/[id]', params: { id: view.id } });
    },
  });
  return (
    <Screen>
      <Stack.Screen options={{ title: t('contactStore', { store: name ?? store }) }} />
      <Text muted>{t('askStoreHint', { store: name ?? store })}</Text>
      <Field
        label={t('placeholder')}
        value={text}
        onChangeText={setText}
        multiline
        maxLength={2000}
        style={{ minHeight: 120, textAlignVertical: 'top' }}
      />
      {send.error ? <Banner tone="error">{errorMessage(send.error)}</Banner> : null}
      <Button
        title={t('send')}
        loading={send.isPending}
        disabled={!text.trim()}
        onPress={() => send.mutate()}
      />
      <Text variant="small" muted>
        {t('safety')}
      </Text>
    </Screen>
  );
}
