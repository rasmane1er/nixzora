import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Divider, EmptyState, Pill, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { messageKeys } from '@/lib/message-keys';
import { useSession } from '@/lib/session';
import { fonts, radius, space } from '@/lib/theme';

/** Conversations with stores (p10-12). */
export default function MessagesScreen() {
  const t = useT('inbox');
  const tc = useT('common');
  const { shortDate } = useFormatters();
  const { status } = useSession();
  const list = useQuery({
    queryKey: messageKeys.all,
    queryFn: () => api.account.conversations(),
    enabled: status === 'signedIn',
  });

  if (status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          title={t('title')}
          action={<Button title={tc('signIn')} onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={list.isRefetching} onRefresh={() => void list.refetch()} />
      }
    >
      <Text muted>{t('lead')}</Text>
      {list.error ? <Banner tone="error">{errorMessage(list.error)}</Banner> : null}
      {list.data && !list.data.length ? <Text muted>{t('none')}</Text> : null}
      {(list.data ?? []).map((c, i) => (
        <View key={c.id}>
          {i ? <Divider /> : null}
          <PressableLink
            href={{ pathname: '/messages/[id]', params: { id: c.id } }}
            accessibilityRole="link"
            style={{ flexDirection: 'row', gap: space.md, paddingVertical: space.sm }}
          >
            {c.product?.imageUrl ? (
              <Image
                source={{ uri: c.product.imageUrl }}
                style={{ width: 48, height: 48, borderRadius: radius }}
                contentFit="cover"
              />
            ) : null}
            <View style={{ flex: 1, gap: 2 }}>
              <Text
                numberOfLines={1}
                style={{ fontFamily: c.unread ? fonts.bodyBold : fonts.bodyMedium }}
              >
                {c.with} · {c.subject}
              </Text>
              <Text variant="small" muted numberOfLines={1}>
                {c.lastMessage?.body}
              </Text>
            </View>
            <View style={{ alignItems: 'flex-end', gap: 4 }}>
              <Text variant="small" muted>
                {c.lastMessage ? shortDate(c.lastMessage.at) : ''}
              </Text>
              {c.unread ? <Pill label={t('unread')} tone="ok" /> : null}
            </View>
          </PressableLink>
        </View>
      ))}
    </Screen>
  );
}
