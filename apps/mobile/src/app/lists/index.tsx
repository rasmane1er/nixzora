import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { ShoppingListKind } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { listKeys } from '@/components/AddToListButton';
import { Chips } from '@/components/Chips';
import { PressableLink } from '@/components/PressableLink';
import { Banner, Button, Card, EmptyState, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { radius, space, usePalette } from '@/lib/theme';

/** Your lists and registries (p10-08). */
export default function ListsScreen() {
  const p = usePalette();
  const t = useT('lists');
  const { shortDate } = useFormatters();
  const { status } = useSession();
  const client = useQueryClient();
  const lists = useQuery({
    queryKey: listKeys.all,
    queryFn: () => api.account.lists(),
    enabled: status === 'signedIn',
  });
  const [name, setName] = useState('');
  const [kind, setKind] = useState<ShoppingListKind>('LIST');
  const create = useMutation({
    mutationFn: () => api.account.createList({ name: name.trim(), kind }),
    onSuccess: (list) => {
      setName('');
      void client.invalidateQueries({ queryKey: listKeys.all });
      router.push({ pathname: '/lists/[id]', params: { id: list.id } });
    },
  });

  if (status !== 'signedIn') {
    return (
      <Screen>
        <EmptyState
          title={t('title')}
          body={t('lead')}
          action={<Button title={t('signInForLists')} onPress={() => router.push('/sign-in')} />}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text muted>{t('lead')}</Text>
      {lists.error ? <Banner tone="error">{errorMessage(lists.error)}</Banner> : null}
      {lists.data && !lists.data.length ? <Text muted>{t('none')}</Text> : null}
      {(lists.data ?? []).map((list) => (
        <PressableLink
          key={list.id}
          href={{ pathname: '/lists/[id]', params: { id: list.id } }}
          accessibilityRole="link"
          style={{
            borderWidth: 1,
            borderColor: p.line,
            borderRadius: radius,
            padding: space.md,
            gap: space.sm,
            backgroundColor: p.card,
          }}
        >
          <View style={{ flexDirection: 'row', gap: 4 }}>
            {list.previews.slice(0, 4).map((src) => (
              <Image
                key={src}
                source={{ uri: src }}
                style={{ width: 52, height: 40, borderRadius: 6 }}
                contentFit="cover"
              />
            ))}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontWeight: '600' }}>{list.name}</Text>
              <Text variant="small" muted>
                {t(`kind_${list.kind}`)} · {t('itemCount', { count: list.itemCount })} ·{' '}
                {list.isShared ? t('shared') : t('private')}
                {list.eventDate
                  ? ` · ${t('eventOn', { date: shortDate(`${list.eventDate}T12:00:00`) })}`
                  : ''}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={p.muted} />
          </View>
        </PressableLink>
      ))}

      <Card>
        <Text variant="heading">{t('newList')}</Text>
        <Field
          label={t('name')}
          value={name}
          onChangeText={setName}
          placeholder={t('namePlaceholder')}
          maxLength={60}
        />
        <Chips<ShoppingListKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'LIST', label: t('kind_LIST') },
            { value: 'REGISTRY', label: t('kind_REGISTRY') },
          ]}
        />
        {create.error ? <Banner tone="error">{errorMessage(create.error)}</Banner> : null}
        <Button
          title={t('create')}
          loading={create.isPending}
          disabled={!name.trim()}
          onPress={() => create.mutate()}
        />
      </Card>
    </Screen>
  );
}
