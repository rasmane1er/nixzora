import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { smartRowTitle } from '@nixzora/i18n';
import { departmentArtPath, type CategoryNode } from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductRail } from '@/components/ProductRail';
import { ShopFooter } from '@/components/ShopFooter';
import { Banner, Button, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { errorMessage } from '@nixzora/api-client';
import { useFormatters } from '@/lib/format';
import { useCategories } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';

const NEW_IN = { sort: 'newest', pageSize: 12 } as const;
const PROMPTS = ['prompt1', 'prompt2', 'prompt3', 'prompt4'] as const;

function countProducts(node: CategoryNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countProducts(child), 0);
}

export default function HomeScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tc = useT('common');
  const th = useT('home');
  const tp = useT('product');
  const ta = useT('ads');
  const { width, columns } = useLayout();
  const cardWidth = (width - space.lg * 2 - space.md * (columns - 1)) / columns;
  const { departmentName } = useFormatters();
  const categories = useCategories();
  const products = useQuery({
    queryKey: keys.products(NEW_IN),
    queryFn: () => api.catalog.products(NEW_IN),
  });
  const { status } = useSession();
  // Re-fetched when the shopper signs in or out, so history follows the account.
  const picks = useQuery({
    queryKey: ['recommendations', status],
    queryFn: async () => api.recommendations.forYou(await visitorId()),
    staleTime: 60_000,
  });
  const ads = useQuery({
    queryKey: ['ads', 'home', status],
    queryFn: async () => api.ads.forPage({ placement: 'home' }, await visitorId()),
    staleTime: 60_000,
  });
  const departments = categories.data ?? [];
  const newIn = products.data?.items ?? [];
  // Featured: the shopper's picks (history or popular), else the newest products.
  const featured = (picks.data?.products.length ? picks.data.products : newIn).slice(
    0,
    2 * columns,
  );
  const featuredIds = new Set(featured.map((product) => product.id));

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <Logo size={30} />
      <Pressable
        accessibilityRole="search"
        accessibilityLabel={tc('searchLabel')}
        onPress={() => router.push('/search')}
        style={[styles.search, { backgroundColor: p.input, borderColor: p.line }]}
      >
        <Ionicons name="search" size={18} color={p.muted} />
        <Text muted>{t('homeSearchHint')}</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: brand.ink }]}>
        <View style={styles.heroText}>
          <Text variant="label" style={{ color: '#FF9B6A' }}>
            {th('eyebrow')}
          </Text>
          <Text variant="title" style={{ color: brand.paper }}>
            {th('title')}
          </Text>
          <PressableLink
            href="/assistant"
            accessibilityRole="button"
            accessibilityLabel={t('homeAskLabel')}
            style={styles.askBox}
          >
            <Ionicons name="sparkles-outline" size={16} color={brand.signal} />
            <Text variant="small" style={{ color: '#5F6673', flex: 1 }} numberOfLines={1}>
              {th('askPlaceholder')}
            </Text>
            <View style={styles.askGo}>
              <Text variant="small" style={{ color: '#fff', fontFamily: fonts.bodyBold }}>
                {th('findIt')}
              </Text>
            </View>
          </PressableLink>
          <View style={styles.prompts}>
            {PROMPTS.map((key) => (
              <PressableLink
                key={key}
                href={{ pathname: '/assistant', params: { q: th(key) } }}
                accessibilityRole="button"
                style={styles.prompt}
              >
                <Text variant="small" style={{ color: '#E7EAF0' }}>
                  {th(key)}
                </Text>
              </PressableLink>
            ))}
          </View>
          <PressableLink href="/scan" accessibilityRole="button" style={styles.heroAction}>
            <Ionicons name="barcode-outline" size={18} color={brand.ink} />
            <Text style={{ color: brand.ink, fontFamily: fonts.bodyBold }}>{t('scanBarcode')}</Text>
          </PressableLink>
        </View>
        <View>
          <Image
            source={require('../../../assets/home/hero-desk.webp')}
            alt={th('heroImageAlt')}
            style={styles.heroImage}
            contentFit="cover"
          />
          <View style={styles.delivery}>
            <Ionicons name="car-outline" size={20} color={brand.signal} />
            <View style={{ flexShrink: 1 }}>
              <Text variant="small" style={{ color: '#fff', fontFamily: fonts.bodyBold }}>
                {th('deliveryTitle')}
              </Text>
              <Text variant="small" style={{ color: '#C9CED6', fontSize: 12 }}>
                {th('deliveryBody')}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {departments.length ? (
        <View style={{ gap: space.sm }}>
          <View style={styles.sectionHead}>
            <Text variant="heading">{th('shopByDepartment')}</Text>
            <PressableLink href="/search" accessibilityRole="link">
              <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                {th('viewAll')} →
              </Text>
            </PressableLink>
          </View>
          <View style={styles.tiles}>
            {departments.map((department) => {
              const art = departmentArtPath(department.slug);
              return (
                <PressableLink
                  key={department.id}
                  href={`/c/${department.slug}`}
                  accessibilityRole="link"
                  style={({ pressed }) => [
                    styles.tile,
                    {
                      width: (width - space.lg * 2 - space.sm * (columns - 1)) / columns,
                      borderColor: p.line,
                      backgroundColor: pressed ? p.line : p.card,
                    },
                  ]}
                >
                  {art ? (
                    <Image
                      source={{ uri: `${WEB_URL}${art}` }}
                      style={styles.tileImage}
                      contentFit="cover"
                      cachePolicy="disk"
                      accessible={false}
                    />
                  ) : (
                    <View style={[styles.tileImage, { backgroundColor: p.bg }]} />
                  )}
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text variant="small" style={{ fontFamily: fonts.bodyBold }} numberOfLines={2}>
                      {departmentName(department.slug, department.name)}
                    </Text>
                    <Text variant="small" muted style={{ fontSize: 12 }}>
                      {tp('products', { count: countProducts(department) })}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={16} color={p.muted} />
                </PressableLink>
              );
            })}
          </View>
        </View>
      ) : null}

      {(picks.data?.rows ?? []).map((row, i) => (
        <ProductRail
          key={`${row.kind}-${i}`}
          title={smartRowTitle(row, ta)}
          products={row.products}
        />
      ))}

      {featured.length ? (
        <View style={{ gap: space.sm }} accessibilityRole="list">
          <View style={styles.sectionHead}>
            <Text variant="heading" style={{ flexShrink: 1 }}>
              {picks.data?.basis === 'history' ? t('recommendedForYou') : th('featured')}
            </Text>
            <PressableLink href="/search" accessibilityRole="link">
              <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                {th('viewAll')} →
              </Text>
            </PressableLink>
          </View>
          <View style={styles.featured}>
            {featured.map((product) => (
              <View key={product.id} style={{ width: cardWidth }}>
                <ProductCard product={product} />
              </View>
            ))}
          </View>
        </View>
      ) : null}
      <ProductRail title={ta('sponsoredHome')} sponsored={ads.data?.ads ?? []} />
      <ProductRail title={t('recentlyViewed')} products={picks.data?.recentlyViewed ?? []} />

      {products.error && !products.data ? (
        <Banner tone="error">{errorMessage(products.error)}</Banner>
      ) : null}
      <Text variant="heading">{th('newInStock')}</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ProductGrid
        products={newIn.filter((product) => !featuredIds.has(product.id))}
        header={header}
        footer={<ShopFooter />}
        refreshing={products.isRefetching}
        onRefresh={() => {
          void products.refetch();
          void categories.refetch();
          void picks.refetch();
          void ads.refetch();
        }}
        empty={
          products.isLoading ? undefined : (
            <EmptyState
              title={t('nothingToShow')}
              body={t('pullToRetry')}
              action={
                <Button
                  title={tc('tryAgain')}
                  tone="ghost"
                  onPress={() => void products.refetch()}
                />
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space.lg,
    minHeight: 46,
  },
  hero: { borderRadius: radius + 4, overflow: 'hidden' },
  heroText: { padding: space.xl, gap: space.md },
  askBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingLeft: 14,
    padding: 5,
    minHeight: 50,
  },
  askGo: {
    backgroundColor: brand.signalStrong,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  prompts: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  prompt: {
    borderWidth: 1,
    borderColor: '#33415C',
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  heroAction: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brand.paper,
    borderRadius: 999,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  heroImage: { width: '100%', aspectRatio: 16 / 10 },
  delivery: {
    position: 'absolute',
    left: space.md,
    bottom: space.md,
    right: space.md,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    backgroundColor: 'rgba(14, 23, 38, 0.86)',
    borderWidth: 1,
    borderColor: '#33415C',
    borderRadius: 999,
    paddingHorizontal: space.md,
    paddingVertical: 8,
  },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    marginTop: space.sm,
  },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 14,
    padding: space.sm,
  },
  tileImage: { width: 44, height: 40, borderRadius: 8, backgroundColor: '#ECE8DF' },
  featured: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
