import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { errorMessage } from '@nixzora/api-client';
import { useLocalSearchParams, router } from 'expo-router';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { ShopHeader } from '@/components/ShopHeader';
import { FilterButton } from '@/components/FilterSheet';
import { ProductGrid } from '@/components/ProductGrid';
import { ProductRail } from '@/components/ProductRail';
import { type Sort, SortChips } from '@/components/SortChips';
import { Banner, EmptyState, Text } from '@/components/ui';
import { useFormatters } from '@/lib/format';
import { api } from '@/lib/api';
import { useCategories, useProductList } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { brand, fonts, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';

export default function SearchScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tph = useT('photo');
  const tc = useT('common');
  const ta = useT('ads');
  const ts = useT('search');
  const { departmentName } = useFormatters();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [sort, setSort] = useState<Sort>('relevance');
  const [filters, setFilters] = useState<string[]>([]);
  const categories = useCategories();

  // A link like /search?q=monitor replaces the current query.
  useEffect(() => {
    if (params.q !== undefined) {
      setText(params.q);
      setQ(params.q);
    }
  }, [params.q]);

  // Search as you type, after a short pause.
  useEffect(() => {
    const timer = setTimeout(() => setQ(text.trim()), 350);
    return () => clearTimeout(timer);
  }, [text]);
  // A new search starts without the previous search's filters.
  useEffect(() => setFilters([]), [q]);

  const suggestions = useQuery({
    queryKey: ['suggest', text.trim().toLowerCase()],
    queryFn: () => api.catalog.suggest(text.trim()),
    enabled: text.trim().length > 0,
    staleTime: 60_000,
  });
  const query = useMemo(() => ({ q, sort, f: filters }), [q, sort, filters]);
  const facets = useQuery({
    queryKey: ['facets', q, filters],
    queryFn: () => api.catalog.facets({ q, f: filters }),
    enabled: q.length > 0,
    staleTime: 60_000,
  });
  const results = useProductList(query);
  const products = results.data?.pages.flatMap((page) => page.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;
  const corrected = results.data?.pages[0]?.correctedQuery;
  const pick = (next: string) => {
    setText(next);
    setQ(next);
  };
  const s = suggestions.data;
  const searching = q.length > 0;
  const ads = useQuery({
    queryKey: ['ads', 'search', q],
    queryFn: async () => api.ads.forPage({ placement: 'search', q }, await visitorId()),
    enabled: searching,
    staleTime: 60_000,
  });

  // A search the shopper settled on (not every keystroke) shapes their picks (p10-02).
  useEffect(() => {
    if (q.length < 2) return;
    const timer = setTimeout(
      () => void visitorId().then((id) => api.recommendations.search(q, id).catch(() => undefined)),
      1500,
    );
    return () => clearTimeout(timer);
  }, [q]);

  // The search field lives in the ink band (ADR-0053), white like the home screen's.
  const field = (
    <View style={styles.field}>
      <Ionicons name="search" size={18} color="#5F6673" />
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('searchPlaceholder')}
        placeholderTextColor="#5F6673"
        accessibilityLabel={tc('searchLabel')}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        onSubmitEditing={() => setQ(text.trim())}
        style={styles.input}
      />
      <Pressable
        accessibilityLabel={tph('searchByPhoto')}
        onPress={() => router.push('/photo-search')}
        hitSlop={4}
        style={styles.fieldIcon}
      >
        <Ionicons name="camera-outline" size={20} color={brand.ink} />
      </Pressable>
      <Pressable
        accessibilityLabel={t('scanBarcode')}
        onPress={() => router.push('/scan')}
        hitSlop={4}
        style={styles.fieldIcon}
      >
        <Ionicons name="barcode-outline" size={20} color={brand.ink} />
      </Pressable>
    </View>
  );

  const header = (
    <View style={{ gap: space.md, marginBottom: space.sm }}>
      {s && text.trim() && text.trim() !== q ? (
        <View style={{ gap: space.sm }} accessibilityLabel={ts('suggestionsLabel')}>
          {s.correction ? (
            <Pressable accessibilityRole="button" onPress={() => pick(s.correction!)}>
              <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                {ts('didYouMean', { q: s.correction })}
              </Text>
            </Pressable>
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {s.completions.map((completion) => (
              <Pressable
                key={completion}
                accessibilityRole="button"
                onPress={() => pick(completion)}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 4,
                  borderWidth: 1,
                  borderColor: p.line,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Ionicons name="search" size={13} color={p.muted} />
                <Text variant="small">{completion}</Text>
              </Pressable>
            ))}
            {s.categories.map((category) => (
              <PressableLink
                key={category.slug}
                href={`/c/${category.slug}`}
                accessibilityRole="link"
                style={{
                  borderWidth: 1,
                  borderColor: p.line,
                  borderRadius: 999,
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                }}
              >
                <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
                  {category.name} →
                </Text>
              </PressableLink>
            ))}
          </View>
        </View>
      ) : null}
      <SortChips value={sort} onChange={setSort} />
      {searching ? (
        <FilterButton facets={facets.data ?? []} value={filters} onChange={setFilters} />
      ) : null}
      {corrected ? (
        <Text variant="small" accessibilityLiveRegion="polite">
          {ts('showingResultsFor', { corrected, q })}
        </Text>
      ) : null}
      {results.error && !results.data ? (
        <Banner tone="error">{errorMessage(results.error)}</Banner>
      ) : null}
      {searching && results.data ? (
        <Text variant="small" muted>
          {t('resultsFor', { count: total, q })}
        </Text>
      ) : null}
      {searching && total > 0 ? (
        <ProductRail title={ta('sponsoredResults')} sponsored={ads.data?.ads ?? []} />
      ) : null}
      {!searching && categories.data?.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="label" muted>
            {t('departmentsLabel')}
          </Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
            {categories.data
              .flatMap((top) => [top, ...top.children])
              .map((category) => (
                <PressableLink
                  key={category.id}
                  href={`/c/${category.slug}`}
                  accessibilityRole="link"
                  style={{
                    borderWidth: 1,
                    borderColor: p.line,
                    borderRadius: 999,
                    paddingHorizontal: 14,
                    paddingVertical: 7,
                  }}
                >
                  <Text variant="small">{departmentName(category.slug, category.name)}</Text>
                </PressableLink>
              ))}
          </View>
          <Text variant="heading" style={{ marginTop: space.md }}>
            {t('popularNow')}
          </Text>
        </View>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ShopHeader
        search={field}
        showLogo={false}
        showDeliverTo={false}
        onBack={() => (router.canGoBack() ? router.back() : router.navigate('/'))}
      />
      <ProductGrid
        layout="list"
        products={products}
        header={header}
        loadingMore={results.isFetchingNextPage}
        onEndReached={() => {
          if (results.hasNextPage && !results.isFetchingNextPage) void results.fetchNextPage();
        }}
        empty={
          results.isLoading || !results.data ? undefined : (
            <EmptyState title={t('noMatches')} body={t('noMatchesBody')} />
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    flex: 1,
    minWidth: 0,
    minHeight: 46,
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingLeft: space.lg,
    paddingRight: 4,
  },
  input: {
    flex: 1,
    minWidth: 0,
    width: '100%',
    color: brand.ink,
    fontFamily: fonts.body,
    fontSize: 16,
    minHeight: 44,
  },
  fieldIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
});
