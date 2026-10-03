import { IBMPlexSans_400Regular } from '@expo-google-fonts/ibm-plex-sans/400Regular';
import { IBMPlexSans_500Medium } from '@expo-google-fonts/ibm-plex-sans/500Medium';
import { IBMPlexSans_600SemiBold } from '@expo-google-fonts/ibm-plex-sans/600SemiBold';
import { JetBrainsMono_500Medium } from '@expo-google-fonts/jetbrains-mono/500Medium';
import { SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk/600SemiBold';
import { SpaceGrotesk_700Bold } from '@expo-google-fonts/space-grotesk/700Bold';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { useFonts } from 'expo-font';
import {
  DarkTheme,
  DefaultTheme,
  SplashScreen,
  Stack,
  ThemeProvider,
  type Theme,
} from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { LockScreen } from '@/components/LockScreen';
import { OfflineToast } from '@/components/OfflineToast';
import { applyOrientationPolicy } from '@/lib/orientation';
import { enablePush, useNotificationNavigation } from '@/lib/push';
import { connectQueryToDevice, persistOptions, queryClient } from '@/lib/query';
import { session, useSession } from '@/lib/session';
import { brand, fonts, palettes } from '@/lib/theme';

void SplashScreen.preventAutoHideAsync();

function navigationTheme(dark: boolean): Theme {
  const base = dark ? DarkTheme : DefaultTheme;
  const p = dark ? palettes.dark : palettes.light;
  return {
    ...base,
    colors: {
      ...base.colors,
      primary: brand.signal,
      background: p.bg,
      card: p.bg,
      text: p.fg,
      border: p.line,
      notification: brand.signal,
    },
  };
}

export default function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const { status } = useSession();
  const [fontsLoaded, fontError] = useFonts({
    SpaceGrotesk_600SemiBold,
    SpaceGrotesk_700Bold,
    IBMPlexSans_400Regular,
    IBMPlexSans_500Medium,
    IBMPlexSans_600SemiBold,
    JetBrainsMono_500Medium,
  });

  useEffect(() => {
    void applyOrientationPolicy();
    void session.boot();
    return connectQueryToDevice();
  }, []);

  const ready = (fontsLoaded || !!fontError) && status !== 'loading';
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);
  useEffect(() => {
    // Keep this phone's push token current for the signed-in account (no prompt here).
    if (status === 'signedIn') void enablePush(false).catch(() => undefined);
  }, [status]);
  useNotificationNavigation(ready && status !== 'locked');

  if (!ready) return null;
  const p = dark ? palettes.dark : palettes.light;

  return (
    <SafeAreaProvider>
      <PersistQueryClientProvider client={queryClient} persistOptions={persistOptions}>
        <ThemeProvider value={navigationTheme(dark)}>
          <StatusBar style={dark ? 'light' : 'dark'} />
          {status === 'locked' ? (
            <LockScreen />
          ) : (
            <View style={{ flex: 1, backgroundColor: p.bg }}>
              <Stack
                screenOptions={{
                  headerShadowVisible: false,
                  headerBackButtonDisplayMode: 'minimal',
                  headerTitleStyle: { fontFamily: fonts.displayMedium },
                  headerTintColor: p.fg,
                  contentStyle: { backgroundColor: p.bg },
                }}
              >
                <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
                <Stack.Screen name="p/[slug]" options={{ title: '' }} />
                <Stack.Screen name="c/[slug]" options={{ title: '' }} />
                <Stack.Screen name="checkout" options={{ title: 'Checkout' }} />
                <Stack.Screen name="orders/index" options={{ title: 'Your orders' }} />
                <Stack.Screen name="orders/[number]" options={{ title: 'Order' }} />
                <Stack.Screen name="wishlist" options={{ title: 'Saved for later' }} />
                <Stack.Screen
                  name="sign-in"
                  options={{ title: 'Sign in', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="register"
                  options={{ title: 'Create account', presentation: 'modal' }}
                />
                <Stack.Screen
                  name="forgot-password"
                  options={{ title: 'Forgot password', presentation: 'modal' }}
                />
                <Stack.Screen name="delete-account" options={{ title: 'Delete account' }} />
                <Stack.Screen name="stripe-redirect" options={{ headerShown: false }} />
              </Stack>
              <OfflineToast />
            </View>
          )}
        </ThemeProvider>
      </PersistQueryClientProvider>
    </SafeAreaProvider>
  );
}
