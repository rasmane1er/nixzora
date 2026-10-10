import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { ShoppingListSummary } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { fonts, radius, space, usePalette } from '@/lib/theme';
import { Banner, Button, Divider, Text } from './ui';

export const listKeys = {
  all: ['lists'] as const,
  one: (id: string) => ['lists', id] as const,
  containing: (productId: string) => ['lists', 'containing', productId] as const,
};

/** "Add to list" (p10-08): a sheet to tick the lists this product belongs on, or start one. */
export function AddToListButton({ productId }: { productId: string }) {
  const p = usePalette();
  const t = useT('lists');
  const tc = useT('common');
  const { status } = useSession();
  const client = useQueryClient();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null);
  const signedIn = status === 'signedIn';
  const lists = useQuery({
    queryKey: listKeys.all,
    queryFn: () => api.account.lists(),
    enabled: signedIn && open,
  });
  const containing = useQuery({
    queryKey: listKeys.containing(productId),
    queryFn: () => api.account.listsContaining(productId),
    enabled: signedIn,
  });
  const on = new Set(containing.data ?? []);
  const refresh = () => void client.invalidateQueries({ queryKey: listKeys.all });

  const toggle = useMutation({
    mutationFn: (list: ShoppingListSummary) =>
      on.has(list.id)
        ? api.account.removeFromList(list.id, productId)
        : api.account.addToList(list.id, { productId }),
    onSuccess: (_, list) => {
      setMessage({
        tone: 'ok',
        text: t(on.has(list.id) ? 'removedFrom' : 'addedTo', { name: list.name }),
      });
      refresh();
    },
    onError: (error) => setMessage({ tone: 'error', text: errorMessage(error) }),
  });
  const create = useMutation({
    mutationFn: async () => {
      const list = await api.account.createList({ name: name.trim() });
      await api.account.addToList(list.id, { productId });
      return list;
    },
    onSuccess: (list) => {
      setName('');
      setMessage({ tone: 'ok', text: t('addedTo', { name: list.name }) });
      refresh();
    },
    onError: (error) => setMessage({ tone: 'error', text: errorMessage(error) }),
  });

  const first = (lists.data ?? []).find((l) => on.has(l.id));
  return (
    <>
      <Button
        title={on.size === 1 && first ? t('onList', { name: first.name }) : t('addToList')}
        tone="ghost"
        icon={<Ionicons name="list-outline" size={18} color={p.fg} />}
        onPress={() => {
          if (!signedIn) return router.push('/sign-in');
          setMessage(null);
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
            <Text variant="heading">{t('addTo')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc('close')}
              onPress={() => setOpen(false)}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={p.fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.sm }}>
            {(lists.data ?? []).map((list) => {
              const checked = on.has(list.id);
              return (
                <Pressable
                  key={list.id}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked, busy: toggle.isPending }}
                  disabled={toggle.isPending}
                  onPress={() => toggle.mutate(list)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: space.sm,
                    paddingVertical: 10,
                  }}
                >
                  <Ionicons
                    name={checked ? 'checkbox' : 'square-outline'}
                    size={22}
                    color={checked ? p.fg : p.muted}
                  />
                  <Text style={{ flex: 1 }} numberOfLines={1}>
                    {list.name}
                  </Text>
                  <Text variant="small" muted>
                    {t(`kind_${list.kind}`)}
                  </Text>
                </Pressable>
              );
            })}
            {lists.data?.length ? <Divider /> : null}
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder={t('newList')}
                placeholderTextColor={p.muted}
                accessibilityLabel={t('name')}
                maxLength={60}
                returnKeyType="done"
                onSubmitEditing={() => name.trim() && create.mutate()}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: p.line,
                  borderRadius: radius,
                  paddingHorizontal: space.md,
                  paddingVertical: 10,
                  color: p.fg,
                  fontFamily: fonts.body,
                }}
              />
              <Button
                title={t('newListNamed')}
                tone="secondary"
                loading={create.isPending}
                disabled={!name.trim()}
                onPress={() => create.mutate()}
              />
            </View>
            {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
          </ScrollView>
          <View style={{ padding: space.lg }}>
            <Button
              title={t('backToLists')}
              tone="ghost"
              onPress={() => {
                setOpen(false);
                router.push('/lists');
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
