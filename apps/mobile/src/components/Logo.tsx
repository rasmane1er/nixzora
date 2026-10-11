import { Image } from 'expo-image';
import { useColorScheme, View } from 'react-native';
import { fonts } from '@/lib/theme';
import { Text } from './ui';

/** The NIXZORA mark (the N climbing to the orange node) with the wordmark. */
export function Logo({
  size = 28,
  wordmark = true,
  onDark = false,
}: {
  size?: number;
  wordmark?: boolean;
  /** On the dark header band (ADR-0053): the paper tile and a white wordmark. */
  onDark?: boolean;
}) {
  // Like the web logo: ink tile on light backgrounds, paper tile on dark ones.
  const dark = useColorScheme() === 'dark' || onDark;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel="NIXZORA"
      style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}
    >
      <Image
        source={
          dark ? require('../../assets/mark-light.png') : require('../../assets/splash-icon.png')
        }
        style={{ width: size, height: size }}
      />
      {wordmark ? (
        <Text
          style={{
            fontFamily: fonts.display,
            fontSize: size * 0.68,
            letterSpacing: 1.2,
            ...(onDark ? { color: '#FFFFFF' } : {}),
          }}
        >
          NIXZORA
        </Text>
      ) : null}
    </View>
  );
}
