import Ionicons from '@expo/vector-icons/Ionicons';
import Tabs from 'expo-router/js-tabs';
import { type ColorValue } from 'react-native';
import { useCart } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { brand, fonts, usePalette } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName, focusedName: IconName) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />
  );

export default function TabsLayout() {
  const p = usePalette();
  const t = useT('appShop');
  const { data: cart } = useCart();
  const count = cart?.itemCount ?? 0;

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: p.signalText,
        tabBarInactiveTintColor: p.muted,
        tabBarStyle: { backgroundColor: p.bg, borderTopColor: p.line },
        tabBarLabelStyle: { fontFamily: fonts.bodyMedium, fontSize: 11 },
        headerStyle: { backgroundColor: p.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.displayMedium, color: p.fg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabShop'),
          headerShown: false,
          tabBarIcon: icon('storefront-outline', 'storefront'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: t('tabSearch'),
          headerShown: false,
          tabBarIcon: icon('search-outline', 'search'),
        }}
      />
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('tabAsk'),
          headerShown: false,
          tabBarIcon: icon('sparkles-outline', 'sparkles'),
          tabBarAccessibilityLabel: t('tabAssistantLabel'),
        }}
      />
      {/* Scanning opens from Search and the home screen; it keeps its route, not a tab. */}
      <Tabs.Screen name="scan" options={{ title: t('tabScan'), href: null }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabCart'),
          tabBarIcon: icon('bag-outline', 'bag'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: brand.signalStrong, fontFamily: fonts.bodyBold },
          tabBarAccessibilityLabel: t('tabCartLabel', { count }),
        }}
      />
      <Tabs.Screen
        name="account"
        options={{
          title: t('tabAccount'),
          tabBarIcon: icon('person-circle-outline', 'person-circle'),
        }}
      />
    </Tabs>
  );
}
