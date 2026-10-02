import Ionicons from '@expo/vector-icons/Ionicons';
import Tabs from 'expo-router/js-tabs';
import { type ColorValue } from 'react-native';
import { useCart } from '@/lib/hooks';
import { brand, fonts, usePalette } from '@/lib/theme';

type IconName = keyof typeof Ionicons.glyphMap;

const icon =
  (name: IconName, focusedName: IconName) =>
  ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? focusedName : name} size={size} color={color as string} />
  );

export default function TabsLayout() {
  const p = usePalette();
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
          title: 'Shop',
          headerShown: false,
          tabBarIcon: icon('storefront-outline', 'storefront'),
        }}
      />
      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          headerShown: false,
          tabBarIcon: icon('search-outline', 'search'),
        }}
      />
      <Tabs.Screen
        name="scan"
        options={{ title: 'Scan', tabBarIcon: icon('barcode-outline', 'barcode') }}
      />
      <Tabs.Screen
        name="cart"
        options={{
          title: 'Cart',
          tabBarIcon: icon('bag-outline', 'bag'),
          tabBarBadge: count > 0 ? count : undefined,
          tabBarBadgeStyle: { backgroundColor: brand.signal, fontFamily: fonts.bodyBold },
          tabBarAccessibilityLabel: count ? `Cart, ${count} item${count === 1 ? '' : 's'}` : 'Cart',
        }}
      />
      <Tabs.Screen
        name="account"
        options={{ title: 'Account', tabBarIcon: icon('person-circle-outline', 'person-circle') }}
      />
    </Tabs>
  );
}
