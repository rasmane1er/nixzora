import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Logo } from '@/components/Logo';
import { Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useCart } from '@/lib/hooks';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { brand, fonts, space, usePalette } from '@/lib/theme';

/** "Deliver to Alex · Washington 20001", from the default address (ADR-0053). */
export function DeliverTo() {
  const t = useT('shopUi');
  const p = usePalette();
  const { status } = useSession();
  const addresses = useQuery({
    queryKey: ['addresses'],
    queryFn: () => api.account.addresses(),
    enabled: status === 'signedIn',
    staleTime: 5 * 60_000,
  });
  const address = addresses.data?.find((a) => a.isDefaultShipping) ?? addresses.data?.[0];
  const signedIn = status === 'signedIn';
  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => router.push(signedIn ? '/account/addresses' : '/sign-in')}
      hitSlop={6}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 28 }}
    >
      <Ionicons name="location-outline" size={16} color={p.headerMuted} />
      <Text variant="small" numberOfLines={1} style={{ color: p.headerMuted, flexShrink: 1 }}>
        {address
          ? t('deliverTo', {
              name: address.fullName.split(' ')[0] ?? address.fullName,
              place: `${address.city} ${address.postalCode}`,
            })
          : t('deliverGuest')}
      </Text>
      <Ionicons name="chevron-down" size={14} color={p.headerMuted} />
    </Pressable>
  );
}

/**
 * The dark band at the top of the shopping screens (ADR-0053): the logo and cart, a search
 * field that is always there (with photo and barcode search), and where things will be delivered.
 * `search` replaces the field (the search screen's own input); `onBack` swaps the logo row.
 */
export function ShopHeader({
  search,
  onBack,
  showLogo = true,
  showDeliverTo = true,
  children,
}: {
  search?: ReactNode;
  onBack?: () => void;
  showLogo?: boolean;
  showDeliverTo?: boolean;
  /** Extra rows inside the band (filter chips). */
  children?: ReactNode;
}) {
  const p = usePalette();
  const t = useT('shopUi');
  const insets = useSafeAreaInsets();
  const { data: cart } = useCart();
  const count = cart?.itemCount ?? 0;

  const field = search ?? (
    <Pressable
      accessibilityRole="search"
      accessibilityLabel={t('searchHint')}
      onPress={() => router.push('/search')}
      style={{
        flex: 1,
        minHeight: 46,
        borderRadius: 23,
        backgroundColor: '#FFFFFF',
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.sm,
        paddingLeft: space.lg,
        paddingRight: 4,
      }}
    >
      <Ionicons name="search" size={19} color="#5F6673" />
      <Text numberOfLines={1} style={{ flex: 1, color: '#5F6673' }}>
        {t('searchHint')}
      </Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('searchByPhoto')}
        onPress={() => router.push('/photo-search')}
        hitSlop={4}
        style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="camera-outline" size={20} color={brand.ink} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('scanBarcode')}
        onPress={() => router.push('/scan')}
        hitSlop={4}
        style={{ width: 38, height: 38, alignItems: 'center', justifyContent: 'center' }}
      >
        <Ionicons name="barcode-outline" size={20} color={brand.ink} />
      </Pressable>
    </Pressable>
  );

  return (
    <View
      style={{
        backgroundColor: p.header,
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: space.md,
        gap: space.md,
      }}
    >
      {showLogo && !onBack ? (
        <View
          style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Logo size={30} onDark />
          <Pressable
            accessibilityRole="link"
            accessibilityLabel={t('cartLabel', { count })}
            onPress={() => router.push('/cart')}
            style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
          >
            <Ionicons name="cart-outline" size={26} color="#FFFFFF" />
            {count > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 2,
                  right: 0,
                  minWidth: 18,
                  height: 18,
                  borderRadius: 9,
                  backgroundColor: brand.signal,
                  alignItems: 'center',
                  justifyContent: 'center',
                  paddingHorizontal: 4,
                }}
              >
                <Text style={{ color: brand.ink, fontSize: 11, fontFamily: fonts.bodyBold }}>
                  {count > 99 ? '99+' : count}
                </Text>
              </View>
            ) : null}
          </Pressable>
        </View>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
        {onBack ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            onPress={onBack}
            hitSlop={6}
            style={{ width: 36, height: 44, justifyContent: 'center' }}
          >
            <Ionicons name="chevron-back" size={24} color="#FFFFFF" />
          </Pressable>
        ) : null}
        {field}
      </View>
      {showDeliverTo ? <DeliverTo /> : null}
      {children}
    </View>
  );
}

/** The same ink band for screens with a title instead of search (cart, account). */
export function InkBand({ children, bottom = space.lg }: { children: ReactNode; bottom?: number }) {
  const p = usePalette();
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: p.header,
        paddingTop: insets.top + space.md,
        paddingHorizontal: space.lg,
        paddingBottom: bottom,
        gap: space.md,
      }}
    >
      {children}
    </View>
  );
}
