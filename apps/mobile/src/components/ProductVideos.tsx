import Ionicons from '@expo/vector-icons/Ionicons';
import { type ProductVideo } from '@nixzora/validation';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, ScrollView, View } from 'react-native';
import { Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

/**
 * Product videos (p10-28): stills with a play button. A video opens in the provider's
 * privacy-enhanced player in an in-app browser, so the app needs no video player of its own.
 */
export function ProductVideos({ videos }: { videos: ProductVideo[] }) {
  const t = useT('videos');
  const p = usePalette();
  const { width } = useLayout();
  if (!videos.length) return null;
  // One tile fills a phone; on wider screens they sit side by side.
  const tile = Math.min(360, Math.max(240, width - space.lg * 2 - (videos.length > 1 ? 48 : 0)));
  return (
    <View style={{ gap: space.sm }}>
      <Text variant="heading">{t('sectionTitle')}</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.md }}
      >
        {videos.map((video) => (
          <Pressable
            key={video.id}
            accessibilityRole="button"
            accessibilityLabel={t('play', { title: video.title })}
            onPress={() => void WebBrowser.openBrowserAsync(video.embedUrl)}
            style={({ pressed }) => ({ width: tile, gap: space.xs, opacity: pressed ? 0.85 : 1 })}
          >
            <View
              style={{
                width: tile,
                aspectRatio: 16 / 9,
                borderRadius: radius,
                overflow: 'hidden',
                backgroundColor: '#0e1726',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {video.thumbnailUrl ? (
                <Image
                  source={{ uri: video.thumbnailUrl }}
                  style={{ position: 'absolute', width: '100%', height: '100%' }}
                  contentFit="cover"
                  cachePolicy="disk"
                />
              ) : null}
              <View
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: 28,
                  backgroundColor: brand.signalStrong,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Ionicons name="play" size={26} color="#fff" style={{ marginLeft: 3 }} />
              </View>
            </View>
            <Text numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
              {video.title}
            </Text>
            <Text variant="small" muted style={{ color: p.muted }}>
              {t(`playsFrom_${video.provider}`)}
            </Text>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}
