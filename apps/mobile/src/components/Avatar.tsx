import { Image } from 'expo-image';
import { View } from 'react-native';
import { brand, fonts } from '@/lib/theme';
import { Text } from './ui';

/** Profile photo, or initials on the brand colour. */
export function Avatar({
  url,
  name,
  email,
  size = 64,
}: {
  url: string | null | undefined;
  name: string;
  email: string;
  size?: number;
}) {
  if (url) {
    return (
      <Image
        source={{ uri: url }}
        style={{ width: size, height: size, borderRadius: size / 2 }}
        contentFit="cover"
        accessibilityIgnoresInvertColors
      />
    );
  }
  const initials =
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((p) => p[0]!.toUpperCase())
      .join('') || (email[0] ?? '?').toUpperCase();
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: brand.signalStrong,
        alignItems: 'center',
        justifyContent: 'center',
      }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Text style={{ color: '#fff', fontFamily: fonts.display, fontSize: size * 0.38 }}>
        {initials}
      </Text>
    </View>
  );
}
