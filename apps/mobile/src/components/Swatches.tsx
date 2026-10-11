import { CARD_SWATCHES, type CardColor } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { fonts, usePalette } from '@/lib/theme';

/** Photos per color (p10-29): a card's colors; each opens the product with that color chosen. */
export function Swatches({ slug, colors }: { slug: string; colors: CardColor[] }) {
  const t = useT('photoColors');
  const p = usePalette();
  const shown = colors.slice(0, CARD_SWATCHES);
  const more = colors.length - shown.length;
  return (
    <View
      accessibilityLabel={t('swatches', { colors: colors.map((c) => c.name).join(', ') })}
      style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}
    >
      {shown.map((color) => (
        <Pressable
          key={color.name}
          accessibilityRole="link"
          accessibilityLabel={t('seeColor', { color: color.name })}
          hitSlop={4}
          onPress={() => router.push(`/p/${slug}?color=${encodeURIComponent(color.name)}`)}
          style={{
            width: 22,
            height: 22,
            borderRadius: 11,
            overflow: 'hidden',
            borderWidth: 1,
            borderColor: p.line,
            backgroundColor: color.swatch ?? p.card,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {color.swatch2 ? (
            // Two-tone: the second color fills the right half.
            <View
              style={{
                position: 'absolute',
                right: 0,
                top: 0,
                bottom: 0,
                width: '50%',
                backgroundColor: color.swatch2,
              }}
            />
          ) : color.swatch ? null : color.imageUrl ? (
            <Image
              source={{ uri: color.imageUrl }}
              style={{ width: '100%', height: '100%' }}
              contentFit="cover"
            />
          ) : (
            <Text style={{ fontSize: 10, fontFamily: fonts.bodyBold }}>{color.name.charAt(0)}</Text>
          )}
        </Pressable>
      ))}
      {more > 0 ? (
        <Text variant="small" muted>
          {t('more', { count: more })}
        </Text>
      ) : null}
    </View>
  );
}
