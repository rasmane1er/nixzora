import Ionicons from '@expo/vector-icons/Ionicons';
import type { ProductCard } from '@nixzora/validation';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useCartMutation } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { Banner, Button, Card, Row, Text } from './ui';

type Item = { variantId: string; title: string; priceCents: number; image: string | null };

/** Frequently bought together, with one "Add all to cart" (p10-06), like on the website. */
export function BoughtTogether({
  title,
  current,
  others,
}: {
  title: string;
  current: Item | null;
  others: ProductCard[];
}) {
  const p = usePalette();
  const c = useT('community');
  const { money } = useFormatters();
  const items: Item[] = [
    ...(current ? [current] : []),
    ...others
      .filter((o) => o.inStock && o.defaultVariantId)
      .slice(0, 3)
      .map((o) => ({
        variantId: o.defaultVariantId!,
        title: o.title,
        priceCents: o.priceFromCents,
        image: o.image?.url ?? null,
      })),
  ];
  const [chosen, setChosen] = useState<Set<string>>(() => new Set(items.map((i) => i.variantId)));
  const [added, setAdded] = useState(false);
  const add = useCartMutation(async (ids: string[]) => {
    let cart = null;
    for (const id of ids) cart = await api.cart.add(id, 1);
    return cart!;
  });
  if (items.length < 2) return null;
  const picked = items.filter((i) => chosen.has(i.variantId));
  const total = picked.reduce((sum, i) => sum + i.priceCents, 0);

  return (
    <Card style={{ gap: space.sm }}>
      <Text variant="heading">{title}</Text>
      {items.map((item, i) => {
        const on = chosen.has(item.variantId);
        return (
          <Pressable
            key={item.variantId}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={c('bundleChoose', { title: item.title })}
            onPress={() =>
              setChosen((current) => {
                const next = new Set(current);
                if (next.has(item.variantId)) next.delete(item.variantId);
                else next.add(item.variantId);
                return next;
              })
            }
          >
            <Row style={{ gap: space.sm, alignItems: 'center' }}>
              <Ionicons
                name={on ? 'checkbox' : 'square-outline'}
                size={22}
                color={on ? p.fg : p.muted}
              />
              {item.image ? (
                <Image
                  source={{ uri: item.image }}
                  style={{ width: 48, height: 36, borderRadius: 4 }}
                  contentFit="cover"
                />
              ) : null}
              <View style={{ flex: 1 }}>
                <Text variant="small" numberOfLines={2}>
                  {current && i === 0 ? `${c('bundleThisItem')}: ` : ''}
                  {item.title}
                </Text>
                <Text variant="small" muted>
                  {money(item.priceCents)}
                </Text>
              </View>
            </Row>
          </Pressable>
        );
      })}
      <Text style={{ fontFamily: fonts.bodyBold }}>
        {c('bundleTotal', { count: picked.length, price: money(total) })}
      </Text>
      {added ? <Banner tone="ok">{c('bundleAdded', { count: picked.length })}</Banner> : null}
      <Button
        title={c('bundleAdd', { count: picked.length })}
        disabled={!picked.length}
        loading={add.isPending}
        onPress={() =>
          add.mutate(
            picked.map((i) => i.variantId),
            { onSuccess: () => setAdded(true) },
          )
        }
      />
    </Card>
  );
}
