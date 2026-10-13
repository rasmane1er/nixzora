import { smartRowTitle } from '@nixzora/i18n';
import {
  departmentLookup,
  type ProductCard as Card,
  quadsByCategory,
  rowShapes,
  spotlightDeal,
} from '@nixzora/validation';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import {
  AskCard,
  CategoryCircles,
  DealsRail,
  PlusStrip,
  PromoCarousel,
  SectionHead,
} from '@/components/HomeSections';
import { ProductCard } from '@/components/ProductCard';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductRail } from '@/components/ProductRail';
import { ShopFooter } from '@/components/ShopFooter';
import { ShopHeader } from '@/components/ShopHeader';
import {
  AskPicksCard,
  BuyAgainShape,
  CardWall,
  KeepShopping,
  PriceDropCard,
  PriceTiles,
  QuadCard,
  RowCards,
  SpotlightDeal,
  useDealQuadItems,
} from '@/components/ShapeCards';
import { Banner, Button, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@nixzora/api-client';
import { useFormatters } from '@/lib/format';
import { useCategories, usePlusMember } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';

const NEW_IN = { sort: 'newest', pageSize: 12 } as const;
const PROMPTS = ['prompt1', 'prompt2', 'prompt3', 'prompt4'] as const;

export default function HomeScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tc = useT('common');
  const th = useT('home');
  const ta = useT('ads');
  const tu = useT('shopUi');
  const tk = useT('cards');
  const td = useT('deals');
  const { departmentName } = useFormatters();
  const dealQuadItems = useDealQuadItems();
  const member = usePlusMember();
  const { width, columns } = useLayout();
  const cardWidth = (width - space.lg * 2 - space.md * (columns - 1)) / columns;
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
  const deals = useQuery({
    queryKey: ['deals', 'home'],
    queryFn: () => api.catalog.deals(),
    staleTime: 30_000,
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

  // Card shapes (ADR-0061): the same mix as the website's home page.
  const live = deals.data?.live ?? [];
  const spotlight = spotlightDeal(live, deals.dataUpdatedAt);
  const groupOf = departmentLookup(departments);
  const dealQuads = quadsByCategory(live, 2, groupOf);
  const newQuads = quadsByCategory(newIn, 2, groupOf);
  const shaped = rowShapes(picks.data?.rows ?? []);
  const shape = (kind: string) => shaped.find((s) => s.shape === kind)?.row;
  const keep = shape('quad');
  const ask = shape('ask');
  const drop = shape('priceDrop');
  const again = shape('buyAgain');
  const dropProduct = drop?.products.find((product) => drop.details?.[product.id]?.wasCents);
  const soonest = [...new Map([...featured, ...newIn].map((item) => [item.id, item])).values()]
    .filter((product): product is Card & { delivery: { latest: string } } =>
      Boolean(product.inStock && product.delivery && product.defaultVariantId),
    )
    .sort((x, y) => x.delivery.latest.localeCompare(y.delivery.latest))
    .slice(0, 3);

  const header = (
    <View style={{ gap: space.xl, marginBottom: space.sm, paddingTop: space.lg }}>
      <PromoCarousel width={width} />
      {departments.length ? <CategoryCircles departments={departments} /> : null}
      <AskCard prompts={PROMPTS.map((key) => th(key))} />
      <CardWall>
        {keep ? <KeepShopping row={keep} /> : null}
        {(dealQuads.length
          ? dealQuads
          : live.length >= 2
            ? [{ category: null, products: live.slice(0, 4) }]
            : []
        ).map((quad) => (
          <QuadCard
            key={quad.category?.slug ?? 'deals'}
            title={
              quad.category
                ? tk('dealsIn', {
                    category: departmentName(quad.category.slug, quad.category.name),
                  })
                : td('railTitle')
            }
            items={dealQuadItems(quad.products)}
            link={{ href: '/deals', label: tk('seeAllDeals') }}
          />
        ))}
        {ask ? (
          <AskPicksCard subject={ask.subject ?? ''} source={ask.source} products={ask.products} />
        ) : null}
        {dropProduct ? (
          <PriceDropCard
            product={dropProduct}
            wasCents={drop!.details![dropProduct.id]!.wasCents!}
          />
        ) : null}
        {again ? <BuyAgainShape row={again} /> : null}
        {newQuads.map((quad) => {
          const name = departmentName(quad.category.slug, quad.category.name);
          return (
            <QuadCard
              key={quad.category.slug}
              title={tk('newIn', { category: name })}
              items={quad.products.map((product) => ({
                href: `/p/${product.slug}`,
                product,
                label: product.title,
              }))}
              link={{
                href: `/c/${quad.category.slug}`,
                label: tk('shopCategory', { category: name }),
              }}
            />
          );
        })}
      </CardWall>
      {spotlight ? <SpotlightDeal product={spotlight} /> : null}
      <DealsRail deals={live.filter((product) => product.id !== spotlight?.id).slice(0, 12)} />
      {member ? null : <PlusStrip />}

      {featured.length ? (
        <View style={{ gap: space.sm }} accessibilityRole="list">
          <SectionHead
            title={picks.data?.basis === 'history' ? t('recommendedForYou') : tu('bestSellers')}
            onSeeAll={() => router.push('/search')}
          />
          <View style={styles.featured}>
            {featured.map((product) => (
              <View key={product.id} style={{ width: cardWidth }}>
                <ProductCard product={product} />
              </View>
            ))}
          </View>
        </View>
      ) : null}

      {shaped
        .filter((s) => s.shape === 'rail')
        .map(({ row }, i) => (
          <ProductRail
            key={`${row.kind}-${i}`}
            title={smartRowTitle(row, ta)}
            products={row.products}
          />
        ))}
      <RowCards title={tk('arrivesSoonest')} products={soonest} />
      <PriceTiles title={ta('sponsoredHome')} sponsored={ads.data?.ads ?? []} />
      <PriceTiles title={t('recentlyViewed')} products={picks.data?.recentlyViewed ?? []} />

      {products.error && !products.data ? (
        <Banner tone="error">{errorMessage(products.error)}</Banner>
      ) : null}
      <Text variant="heading">{th('newInStock')}</Text>
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ShopHeader />
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
    </View>
  );
}

const styles = StyleSheet.create({
  featured: { flexDirection: 'row', flexWrap: 'wrap', gap: space.md },
});
