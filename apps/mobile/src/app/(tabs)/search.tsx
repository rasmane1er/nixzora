import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { errorMessage } from '@nixzora/api-client';
import { useLocalSearchParams, router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ProductGrid } from '@/components/ProductGrid';
import { type Sort, SortChips } from '@/components/SortChips';
import { Banner, EmptyState, Text } from '@/components/ui';
import { useFormatters } from '@/lib/format';
import { useCategories, useProductList } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

export default function SearchScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const tc = useT('common');
  const { departmentName } = useFormatters();
  const params = useLocalSearchParams<{ q?: string }>();
  const [text, setText] = useState(params.q ?? '');
  const [q, setQ] = useState(params.q ?? '');
  const [sort, setSort] = useState<Sort>('relevance');
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

  const query = useMemo(() => ({ q, sort }), [q, sort]);
  const results = useProductList(query);
  const products = results.data?.pages.flatMap((page) => page.items) ?? [];
  const total = results.data?.pages[0]?.total ?? 0;
  const searching = q.length > 0;

  const header = (
    <View style={{ gap: space.md, marginBottom: space.sm }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.sm,
          borderWidth: 1,
          borderColor: p.line,
          backgroundColor: p.input,
          borderRadius: 999,
          paddingHorizontal: space.lg,
          minHeight: 46,
        }}
      >
        <Ionicons name="search" size={18} color={p.muted} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder={t('searchPlaceholder')}
          placeholderTextColor={p.muted}
          accessibilityLabel={tc('searchLabel')}
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
          clearButtonMode="while-editing"
          onSubmitEditing={() => setQ(text.trim())}
          style={{ flex: 1, color: p.fg, fontFamily: fonts.body, fontSize: 16, minHeight: 44 }}
        />
        <Pressable
          accessibilityLabel={t('scanBarcode')}
          onPress={() => router.push('/scan')}
          hitSlop={8}
        >
          <Ionicons name="barcode-outline" size={22} color={p.fg} />
        </Pressable>
      </View>
      <SortChips value={sort} onChange={setSort} />
      {results.error && !results.data ? (
        <Banner tone="error">{errorMessage(results.error)}</Banner>
      ) : null}
      {searching && results.data ? (
        <Text variant="small" muted>
          {t('resultsFor', { count: total, q })}
        </Text>
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
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ProductGrid
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
    </SafeAreaView>
  );
}
