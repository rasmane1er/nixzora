import Ionicons from '@expo/vector-icons/Ionicons';
import { PressableLink } from '@/components/PressableLink';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { ProductGrid } from '@/components/ProductGrid';
import { Banner, Button, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { errorMessage } from '@nixzora/api-client';
import { useCategories } from '@/lib/hooks';
import { keys } from '@/lib/query';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

const NEW_IN = { sort: 'newest', pageSize: 12 } as const;

export default function HomeScreen() {
  const p = usePalette();
  const categories = useCategories();
  const products = useQuery({
    queryKey: keys.products(NEW_IN),
    queryFn: () => api.catalog.products(NEW_IN),
  });
  const departments = categories.data ?? [];

  const header = (
    <View style={{ gap: space.lg, marginBottom: space.sm }}>
      <Logo size={30} />
      <Pressable
        accessibilityRole="search"
        accessibilityLabel="Search products"
        onPress={() => router.push('/search')}
        style={[styles.search, { backgroundColor: p.input, borderColor: p.line }]}
      >
        <Ionicons name="search" size={18} color={p.muted} />
        <Text muted>Laptops, monitors, audio…</Text>
      </Pressable>

      <View style={[styles.hero, { backgroundColor: brand.ink }]}>
        <Text variant="label" style={{ color: '#6FD1C7' }}>
          AI shopping assistant
        </Text>
        <Text variant="title" style={{ color: brand.paper }}>
          What do you need today?
        </Text>
        <PressableLink
          href="/assistant"
          accessibilityRole="button"
          accessibilityLabel="Ask the shopping assistant"
          style={styles.askBox}
        >
          <Text variant="small" style={{ color: '#B8C2D3' }}>
            “Headphones for flights under $250”
          </Text>
        </PressableLink>
        <Text variant="small" style={{ color: '#C9CED6' }}>
          Free shipping over $99 · 30-day returns
        </Text>
        <PressableLink href="/scan" accessibilityRole="button" style={styles.heroAction}>
          <Ionicons name="barcode-outline" size={18} color={brand.ink} />
          <Text style={{ color: brand.ink, fontFamily: fonts.bodyBold }}>Scan a barcode</Text>
        </PressableLink>
      </View>

      {departments.length ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: space.sm }}
        >
          {departments.map((department) => (
            <PressableLink
              key={department.id}
              href={`/c/${department.slug}`}
              accessibilityRole="link"
              style={({ pressed }) => [
                styles.chip,
                { borderColor: p.line, backgroundColor: pressed ? p.line : p.card },
              ]}
            >
              <Text variant="small" style={{ fontFamily: fonts.bodyMedium }}>
                {department.name}
              </Text>
            </PressableLink>
          ))}
        </ScrollView>
      ) : null}

      {products.error && !products.data ? (
        <Banner tone="error">{errorMessage(products.error)}</Banner>
      ) : null}
      <Text variant="heading">New in</Text>
    </View>
  );

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: p.bg }}>
      <ProductGrid
        products={products.data?.items ?? []}
        header={header}
        refreshing={products.isRefetching}
        onRefresh={() => {
          void products.refetch();
          void categories.refetch();
        }}
        empty={
          products.isLoading ? undefined : (
            <EmptyState
              title="Nothing to show yet"
              body="Pull down to try again."
              action={
                <Button title="Try again" tone="ghost" onPress={() => void products.refetch()} />
              }
            />
          )
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  askBox: {
    backgroundColor: '#18243A',
    borderWidth: 1,
    borderColor: '#2C3B57',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderWidth: 1,
    borderRadius: 999,
    paddingHorizontal: space.lg,
    minHeight: 46,
  },
  hero: { borderRadius: radius + 4, padding: space.xl, gap: space.sm },
  heroAction: {
    marginTop: space.sm,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: brand.paper,
    borderRadius: 999,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
  },
  chip: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space.lg, paddingVertical: 8 },
});
