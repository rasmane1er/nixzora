import Ionicons from '@expo/vector-icons/Ionicons';
import { onlineManager } from '@tanstack/react-query';
import { useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { brand, fonts } from '@/lib/theme';
import { Text } from './ui';

export function useIsOnline(): boolean {
  return useSyncExternalStore(
    (listener) => onlineManager.subscribe(listener),
    () => onlineManager.isOnline(),
    () => true,
  );
}

/** Floats above the tab bar while the phone has no connection. */
export function OfflineToast() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();
  if (online) return null;
  return (
    <View
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        bottom: insets.bottom + 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: brand.ink,
        borderRadius: 999,
        paddingVertical: 8,
        paddingHorizontal: 14,
      }}
    >
      <Ionicons name="cloud-offline-outline" size={16} color={brand.paper} />
      <Text variant="small" style={{ color: brand.paper, fontFamily: fonts.bodyMedium }}>
        Offline — showing saved products
      </Text>
    </View>
  );
}
