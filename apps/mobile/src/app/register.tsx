import { ApiError, errorMessage } from '@nixzora/api-client';
import { rich } from '@nixzora/i18n';
import {
  flagOf,
  internationalNumber,
  PHONE_COUNTRIES,
  passwordChecks,
  type SignUpProblem,
  signUpProblems,
  type SignUpValues,
} from '@nixzora/validation';
import { Ionicons } from '@expo/vector-icons';
import { Link, router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Linking, Modal, Pressable, StyleSheet, View } from 'react-native';
import { Banner, Button, Field, Row, Screen, Text } from '@/components/ui';
import { SocialSignIn } from '@/components/SocialSignIn';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { deviceName } from '@/lib/device';
import { language, useT } from '@/lib/i18n';
import { brand, fonts, usePalette } from '@/lib/theme';

const DEFAULT_COUNTRY = { en: 'US', fr: 'FR', es: 'ES' } as const;

function countryName(iso: string, locale: string): string {
  try {
    return new Intl.DisplayNames([locale], { type: 'region' }).of(iso) ?? iso;
  } catch {
    return iso;
  }
}

/** The same sign-up as the website: names, email, optional mobile, password twice, consent. */
export default function RegisterScreen() {
  const locale = language.get();
  const [values, setValues] = useState<SignUpValues>({
    firstName: '',
    lastName: '',
    email: '',
    phoneCountry: DEFAULT_COUNTRY[locale] ?? 'US',
    phone: '',
    password: '',
    confirmPassword: '',
    acceptTerms: false,
  });
  const [marketing, setMarketing] = useState(false);
  const [problems, setProblems] = useState<Partial<Record<keyof SignUpValues, SignUpProblem>>>({});
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const t = useT('auth');
  const ta = useT('appAccount');
  const tc = useT('common');
  const p = usePalette();
  const checks = passwordChecks(values);
  const set = (field: keyof SignUpValues) => (value: string | boolean) =>
    setValues((v) => ({ ...v, [field]: value }));

  const countries = useMemo(
    () =>
      PHONE_COUNTRIES.map((c) => ({ ...c, name: countryName(c.iso, locale) })).sort((a, b) =>
        a.name.localeCompare(b.name, locale),
      ),
    [locale],
  );
  const dial = PHONE_COUNTRIES.find((c) => c.iso === values.phoneCountry)?.dial ?? '1';

  const message = (field: keyof SignUpValues): string | undefined => {
    const code = problems[field];
    if (code) return t(`problem_${code}`);
    return error instanceof ApiError ? error.field(field) : undefined;
  };

  async function submit() {
    const found = signUpProblems(values);
    setProblems(found);
    if (Object.keys(found).length) {
      setError(t('fixHighlighted'));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.auth.register({
        email: values.email.trim(),
        password: values.password,
        firstName: values.firstName.trim(),
        lastName: values.lastName.trim(),
        phone: internationalNumber(values.phoneCountry, values.phone) ?? undefined,
        acceptTerms: true,
        marketingEmails: marketing,
        deviceName: deviceName(),
        language: locale,
      });
      await completeSignIn(tokens);
      if (router.canGoBack()) router.back();
      else router.replace('/account');
    } catch (e) {
      setError(e instanceof ApiError ? e : errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  const link = (path: string) => (chunk: string) => (
    <Text
      key={path}
      accessibilityRole="link"
      onPress={() => void Linking.openURL(`${WEB_URL}${path}`)}
      style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
    >
      {chunk}
    </Text>
  );

  return (
    <Screen>
      <Text variant="title">{t('registerHeading')}</Text>
      <Text muted>{t('registerIntro')}</Text>
      <SocialSignIn
        intent="signup"
        onResult={async (result) => {
          // An existing account with two-step verification: finish on the sign-in screen.
          if ('mfaRequired' in result) return router.replace('/sign-in');
          await completeSignIn(result);
          if (router.canGoBack()) router.back();
          else router.replace('/account');
        }}
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            label={`${t('firstName')} *`}
            value={values.firstName}
            onChangeText={set('firstName')}
            error={message('firstName')}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={`${t('lastName')} *`}
            value={values.lastName}
            onChangeText={set('lastName')}
            error={message('lastName')}
            autoComplete="family-name"
            textContentType="familyName"
          />
        </View>
      </Row>
      <Field
        label={`${t('emailAddress')} *`}
        value={values.email}
        onChangeText={set('email')}
        error={message('email')}
        placeholder={t('emailPlaceholder')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${t('countryCode')}: ${countryName(values.phoneCountry, locale)} +${dial}`}
          onPress={() => setPicking(true)}
          style={[styles.country, { borderColor: p.line, backgroundColor: p.input }]}
        >
          <Text>
            {flagOf(values.phoneCountry)} +{dial}
          </Text>
          <Ionicons name="chevron-down" size={16} color={p.fg} />
        </Pressable>
        <View style={{ flex: 1 }}>
          <Field
            label={`${t('mobilePhone')} (${t('optional')})`}
            value={values.phone}
            onChangeText={set('phone')}
            error={message('phone')}
            hint={t('mobileHint')}
            placeholder={t('mobilePlaceholder')}
            keyboardType="phone-pad"
            autoComplete="tel"
            textContentType="telephoneNumber"
          />
        </View>
      </Row>
      <Field
        label={`${t('password')} *`}
        value={values.password}
        onChangeText={set('password')}
        error={message('password')}
        placeholder={t('passwordPlaceholder')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <Field
        label={`${t('confirmPassword')} *`}
        value={values.confirmPassword}
        onChangeText={set('confirmPassword')}
        error={message('confirmPassword')}
        placeholder={t('confirmPlaceholder')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      <View accessibilityLabel={t('passwordRules')} style={{ gap: 4 }}>
        {(['length', 'notPersonal', 'matches'] as const).map((key) => (
          <Row key={key} style={{ gap: 8 }}>
            <Ionicons
              name={checks[key] ? 'checkmark-circle' : 'ellipse-outline'}
              size={16}
              color={checks[key] ? p.okFg : p.muted}
            />
            <Text variant="small" style={{ color: checks[key] ? p.okFg : p.muted, flex: 1 }}>
              {t(`check_${key}`)}
            </Text>
          </Row>
        ))}
      </View>
      <CheckRow
        checked={values.acceptTerms}
        onChange={set('acceptTerms')}
        label={t('acceptTerms').replace(/<\/?\w+>/g, '')}
      >
        {rich(t('acceptTerms'), { terms: link('/terms'), privacy: link('/privacy') })}
      </CheckRow>
      {message('acceptTerms') ? (
        <Text variant="small" tone="error">
          {message('acceptTerms')}
        </Text>
      ) : null}
      <CheckRow checked={marketing} onChange={setMarketing} label={t('marketingOptIn')}>
        {t('marketingOptIn')}
      </CheckRow>
      {error ? (
        <Banner tone="error">{typeof error === 'string' ? error : errorMessage(error)}</Banner>
      ) : null}
      <Button title={t('createAccountButton')} loading={busy} onPress={() => void submit()} />
      <Text muted style={{ textAlign: 'center' }}>
        {ta('alreadyHaveOne')}{' '}
        <Link
          href="/sign-in"
          replace
          style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
        >
          {tc('signIn')}
        </Link>
      </Text>
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        {t('neverSell')}
      </Text>

      <Modal visible={picking} animationType="slide" onRequestClose={() => setPicking(false)}>
        <View style={{ flex: 1, backgroundColor: p.bg, paddingTop: 56 }}>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 16, marginBottom: 8 }}>
            <Text variant="heading">{t('countryCode')}</Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={tc('close')}
              onPress={() => setPicking(false)}
            >
              <Ionicons name="close" size={26} color={p.fg} />
            </Pressable>
          </Row>
          <FlatList
            data={countries}
            keyExtractor={(c) => c.iso}
            renderItem={({ item }) => (
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ selected: item.iso === values.phoneCountry }}
                onPress={() => {
                  set('phoneCountry')(item.iso);
                  setPicking(false);
                }}
                style={[styles.option, { borderColor: p.line }]}
              >
                <Text>
                  {flagOf(item.iso)} {item.name}
                </Text>
                <Text muted>+{item.dial}</Text>
              </Pressable>
            )}
          />
        </View>
      </Modal>
    </Screen>
  );
}

function CheckRow({
  checked,
  onChange,
  label,
  children,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
  label: string;
  children: React.ReactNode;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}
    >
      <Ionicons
        name={checked ? 'checkbox' : 'square-outline'}
        size={22}
        color={checked ? brand.signal : p.muted}
      />
      <Text style={{ flex: 1 }}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  country: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
    // Lines up with the number field under its label.
    marginTop: 26,
  },
  option: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
});
