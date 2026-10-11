import Ionicons from '@expo/vector-icons/Ionicons';
import { departmentArtPath, type CategoryNode } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { Pressable, RefreshControl, ScrollView, View } from 'react-native';
import { ShopHeader } from '@/components/ShopHeader';
import { Text } from '@/components/ui';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { useCategories } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { READABLE_WIDTH } from '@/lib/layout';
import { cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';

function countProducts(node: CategoryNode): number {
  return node.productCount + node.children.reduce((sum, child) => sum + countProducts(child), 0);
}

/** Categories (ADR-0053): every department with its photo, and its sections as chips. */
export default function CategoriesScreen() {
  const p = usePalette();
  const t = useT('shopUi');
  const tp = useT('product');
  const { departmentName } = useFormatters();
  const categories = useCategories();
  const departments = categories.data ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ShopHeader showDeliverTo={false} />
      <ScrollView
        contentContainerStyle={{
          padding: space.lg,
          gap: space.md,
          width: '100%',
          maxWidth: READABLE_WIDTH,
          alignSelf: 'center',
        }}
        refreshControl={
          <RefreshControl
            refreshing={categories.isRefetching}
            onRefresh={() => void categories.refetch()}
          />
        }
      >
        <Text variant="heading">{t('categoriesTitle')}</Text>
        {departments.map((department) => {
          const art = departmentArtPath(department.slug);
          return (
            <View
              key={department.id}
              style={[
                {
                  backgroundColor: p.card,
                  borderRadius: radius + 6,
                  overflow: 'hidden',
                },
                cardShadow,
              ]}
            >
              <Pressable
                accessibilityRole="link"
                onPress={() => router.push(`/c/${department.slug}`)}
                style={({ pressed }) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  padding: space.md,
                  opacity: pressed ? 0.8 : 1,
                })}
              >
                <View
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: radius,
                    backgroundColor: p.photo,
                    overflow: 'hidden',
                  }}
                >
                  {art ? (
                    <Image
                      source={{ uri: `${WEB_URL}${art}` }}
                      style={{ width: '100%', height: '100%' }}
                      contentFit="cover"
                      cachePolicy="disk"
                      accessible={false}
                    />
                  ) : null}
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={{ fontFamily: fonts.display, fontSize: 17 }}>
                    {departmentName(department.slug, department.name)}
                  </Text>
                  <Text variant="small" muted>
                    {tp('products', { count: countProducts(department) })}
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={p.muted} />
              </Pressable>
              {department.children.length ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={{
                    gap: space.sm,
                    paddingHorizontal: space.md,
                    paddingBottom: space.md,
                  }}
                >
                  {department.children.map((child) => (
                    <Pressable
                      key={child.id}
                      accessibilityRole="link"
                      onPress={() => router.push(`/c/${child.slug}`)}
                      style={{
                        minHeight: 36,
                        paddingHorizontal: space.md,
                        borderRadius: 18,
                        borderWidth: 1,
                        borderColor: p.line,
                        justifyContent: 'center',
                      }}
                    >
                      <Text variant="small">{child.name}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}
