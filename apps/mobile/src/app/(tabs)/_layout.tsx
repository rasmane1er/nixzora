import Ionicons from '@expo/vector-icons/Ionicons';
import Tabs from 'expo-router/js-tabs';
import { type ColorValue, Pressable, View } from 'react-native';
import { Text } from '@/components/ui';
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
  const tu = useT('shopUi');
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
          title: tu('tabHome'),
          headerShown: false,
          tabBarIcon: icon('home-outline', 'home'),
        }}
      />
      <Tabs.Screen
        name="categories"
        options={{
          title: tu('tabCategories'),
          headerShown: false,
          tabBarIcon: icon('grid-outline', 'grid'),
        }}
      />
      {/* Ask (ADR-0053): the raised button in the middle of the bar. */}
      <Tabs.Screen
        name="assistant"
        options={{
          title: t('tabAsk'),
          headerShown: false,
          tabBarAccessibilityLabel: t('tabAssistantLabel'),
          tabBarButton: (props) => (
            <Pressable
              onPress={props.onPress}
              onLongPress={props.onLongPress}
              accessibilityRole="button"
              accessibilityLabel={t('tabAssistantLabel')}
              accessibilityState={props.accessibilityState}
              style={{
                flex: 1,
                alignItems: 'center',
                justifyContent: 'flex-end',
                paddingBottom: 4,
              }}
            >
              <View
                style={{
                  width: 54,
                  height: 54,
                  borderRadius: 27,
                  marginTop: -22,
                  backgroundColor: brand.signalStrong,
                  borderWidth: 4,
                  borderColor: p.bg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: brand.signalStrong,
                  shadowOpacity: 0.35,
                  shadowRadius: 10,
                  shadowOffset: { width: 0, height: 4 },
                  elevation: 6,
                }}
              >
                <Ionicons name="sparkles" size={24} color="#FFFFFF" />
              </View>
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.bodyMedium,
                  color: props.accessibilityState?.selected ? p.signalText : p.fg,
                }}
              >
                {t('tabAsk')}
              </Text>
            </Pressable>
          ),
        }}
      />
      {/* Search opens from the header on every shopping screen; it keeps its route, not a tab. */}
      <Tabs.Screen
        name="search"
        options={{ title: t('tabSearch'), headerShown: false, href: null }}
      />
      {/* Scanning opens from Search and the home screen; it keeps its route, not a tab. */}
      <Tabs.Screen name="scan" options={{ title: t('tabScan'), href: null }} />
      <Tabs.Screen
        name="cart"
        options={{
          title: t('tabCart'),
          headerShown: false,
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
          headerShown: false,
          tabBarIcon: icon('person-circle-outline', 'person-circle'),
        }}
      />
    </Tabs>
  );
}
