import Ionicons from '@expo/vector-icons/Ionicons';
import { filterValueLabel, optionLabel, specLabel } from '@nixzora/i18n';
import type { Facet } from '@nixzora/validation';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocale, useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Button, Divider, Text } from './ui';

/**
 * Spec and option filters (p10-03): a "Filters" chip that opens a sheet of checkboxes, with how
 * many products have each value. `value` is the chosen "key:value" filters.
 */
export function FilterButton({
  facets,
  value,
  onChange,
}: {
  facets: Facet[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  const p = usePalette();
  const t = useT('search');
  const locale = useLocale();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(value);
  if (!facets.length && !value.length) return null;

  const name = (facet: Facet) =>
    facet.kind === 'option' ? optionLabel(facet.key, locale) : specLabel(facet.key, locale);
  const toggle = (filter: string) =>
    setDraft((current) =>
      current.includes(filter) ? current.filter((f) => f !== filter) : [...current, filter],
    );

  return (
    <>
      <Pressable
        accessibilityRole="button"
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          alignSelf: 'flex-start',
          gap: 6,
          borderWidth: 1,
          borderRadius: 999,
          paddingHorizontal: 14,
          paddingVertical: 7,
          borderColor: value.length ? p.fg : p.line,
        }}
      >
        <Ionicons name="options-outline" size={16} color={p.fg} />
        <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
          {t('filtersTitle')}
          {value.length ? ` · ${value.length}` : ''}
        </Text>
      </Pressable>
      <Modal visible={open} animationType="slide" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.lg,
            }}
          >
            <Text variant="heading">{t('filtersTitle')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('clearAll')}
              onPress={() => setDraft([])}
              hitSlop={8}
            >
              <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                {t('clearAll')}
              </Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}>
            {facets.map((facet) => (
              <View key={facet.key} style={{ gap: space.xs }} accessibilityRole="list">
                <Text variant="label" muted>
                  {name(facet)}
                </Text>
                {facet.values.map((v) => {
                  const filter = `${facet.key}:${v.value}`;
                  const checked = draft.includes(filter);
                  return (
                    <Pressable
                      key={v.value}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked }}
                      onPress={() => toggle(filter)}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: space.sm,
                        paddingVertical: 8,
                      }}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={22}
                        color={checked ? p.fg : p.muted}
                      />
                      <Text style={{ flex: 1 }}>{filterValueLabel(v.value, locale)}</Text>
                      <Text variant="small" muted>
                        {v.count}
                      </Text>
                    </Pressable>
                  );
                })}
                <Divider />
              </View>
            ))}
          </ScrollView>
          <View style={{ padding: space.lg }}>
            <Button
              title={t('showResults')}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </>
  );
}
