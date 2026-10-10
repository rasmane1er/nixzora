import { type Locale, LOCALE_LABEL, LOCALES } from '@nixzora/i18n';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, StyleSheet, View } from 'react-native';
import { chooseLanguage } from '@/lib/choose-language';
import { WEB_URL } from '@/lib/config';
import { useLocale, useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';
import { Logo } from './Logo';
import { Text } from './ui';

/**
 * The end of the Shop screen: the same footer as the website (its words come from the
 * storefront's `layout` messages), with the help and policy links and the language switch.
 */
export function ShopFooter() {
  const t = useT('layout');
  const p = usePalette();
  const locale = useLocale();
  const { status } = useSession();
  const web = (path: string) => () => void WebBrowser.openBrowserAsync(`${WEB_URL}${path}`);
  const links: [string, () => void][] = [
    [t('help'), () => router.push('/help')],
    [t('shipping'), web('/policies/shipping')],
    [t('returns'), web('/policies/returns')],
    [t('about'), web('/about')],
    [t('sellOnNixzora'), web('/sell')],
    [t('privacy'), web('/privacy')],
    [t('terms'), web('/terms')],
  ];
  return (
    <View
      style={[styles.footer, { borderTopColor: p.line }]}
      accessibilityRole="summary"
      accessibilityLabel={t('footerNav')}
    >
      <Logo size={24} />
      <Text muted variant="small">
        {t('tagline')}
      </Text>
      <View style={styles.links}>
        {links.map(([label, open]) => (
          <Pressable key={label} accessibilityRole="link" onPress={open} hitSlop={6}>
            <Text variant="small" style={styles.link}>
              {label}
            </Text>
          </Pressable>
        ))}
      </View>
      <View
        style={styles.links}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('chooseLanguage')}
      >
        {LOCALES.map((code: Locale) => {
          const active = code === locale;
          return (
            <Pressable
              key={code}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              onPress={() => chooseLanguage(code, status === 'signedIn')}
              style={[styles.lang, { borderColor: active ? p.fg : p.line }]}
            >
              <Text variant="small" style={{ fontFamily: active ? fonts.bodyBold : fonts.body }}>
                {LOCALE_LABEL[code]}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: space.lg,
    paddingTop: space.lg,
    gap: space.md,
  },
  links: { flexDirection: 'row', flexWrap: 'wrap', columnGap: space.lg, rowGap: space.sm },
  link: { textDecorationLine: 'underline' },
  lang: { borderWidth: 1, borderRadius: 999, paddingHorizontal: space.md, paddingVertical: 6 },
});
