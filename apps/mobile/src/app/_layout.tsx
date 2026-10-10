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
// First app import: starts crash reporting before anything else can fail.
import { Sentry } from '@/lib/sentry';
import { LockScreen } from '@/components/LockScreen';
import { OfflineToast } from '@/components/OfflineToast';
import { applySavedTheme } from '@/lib/appearance';
import { language, useT } from '@/lib/i18n';
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

function RootLayout() {
  const dark = useColorScheme() === 'dark';
  const { status } = useSession();
  const t = useT('appShop');
  const to = useT('order');
  const tl = useT('lists');
  const td = useT('deals');
  const tg = useT('gifts');
  const ts = useT('subscribe');
  const ti = useT('inbox');
  const tcmp = useT('compare');
  const tph = useT('photo');
  const tpl = useT('plus');
  const tcl = useT('clips');
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
    void applySavedTheme();
    void language.load();
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
                <Stack.Screen name="checkout" options={{ title: t('titleCheckout') }} />
                <Stack.Screen name="orders/index" options={{ title: t('titleOrders') }} />
                <Stack.Screen name="orders/[number]" options={{ title: t('titleOrder') }} />
                <Stack.Screen name="return/[number]" options={{ title: to('startReturn') }} />
                <Stack.Screen name="wishlist" options={{ title: t('titleWishlist') }} />
                <Stack.Screen name="deals" options={{ title: td('title') }} />
                <Stack.Screen name="lists/index" options={{ title: tl('title') }} />
                <Stack.Screen name="account/gift-cards" options={{ title: tg('balanceTitle') }} />
                <Stack.Screen name="account/subscriptions" options={{ title: ts('title') }} />
                <Stack.Screen name="messages/index" options={{ title: ti('title') }} />
                <Stack.Screen name="messages/[id]" options={{ title: '' }} />
                <Stack.Screen name="messages/new" options={{ title: '' }} />
                <Stack.Screen name="compare" options={{ title: tcmp('title') }} />
                <Stack.Screen name="photo-search" options={{ title: tph('title') }} />
                <Stack.Screen name="plus" options={{ title: tpl('title') }} />
                <Stack.Screen name="coupons" options={{ title: tcl('pageTitle') }} />
                <Stack.Screen name="lists/[id]" options={{ title: '' }} />
                <Stack.Screen name="account/security" options={{ title: t('titleSecurity') }} />
                <Stack.Screen name="account/addresses" options={{ title: t('titleAddresses') }} />
                <Stack.Screen name="account/returns" options={{ title: t('titleReturns') }} />
                <Stack.Screen name="account/reviews" options={{ title: t('titleReviews') }} />
                <Stack.Screen
                  name="account/preferences"
                  options={{ title: t('titlePreferences') }}
                />
                <Stack.Screen name="account/profile" options={{ title: t('titleProfile') }} />
                <Stack.Screen name="account/buy-again" options={{ title: t('titleBuyAgain') }} />
                <Stack.Screen name="account/payments" options={{ title: t('titlePayments') }} />
                <Stack.Screen name="account/coupons" options={{ title: t('titleCoupons') }} />
                <Stack.Screen name="account/settings" options={{ title: t('titleSettings') }} />
                <Stack.Screen name="account/policies" options={{ title: t('titlePolicies') }} />
                <Stack.Screen name="account/support" options={{ title: t('titleSupport') }} />
                <Stack.Screen name="help/index" options={{ title: t('titleHelp') }} />
                <Stack.Screen name="help/contact" options={{ title: t('titleContact') }} />
                <Stack.Screen
                  name="sign-in"
                  options={{ title: t('titleSignIn'), presentation: 'modal' }}
                />
                <Stack.Screen
                  name="register"
                  options={{ title: t('titleRegister'), presentation: 'modal' }}
                />
                <Stack.Screen
                  name="forgot-password"
                  options={{ title: t('titleForgotPassword'), presentation: 'modal' }}
                />
                <Stack.Screen name="delete-account" options={{ title: t('titleDeleteAccount') }} />
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

export default Sentry.wrap(RootLayout);
