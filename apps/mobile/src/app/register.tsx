import { ApiError, errorMessage } from '@nixzora/api-client';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Banner, Button, Field, Row, Screen, Text } from '@/components/ui';
import { SocialSignIn } from '@/components/SocialSignIn';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { fonts } from '@/lib/theme';
import { deviceName } from '@/lib/device';
import { language, useT } from '@/lib/i18n';

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);
  const t = useT('appAccount');
  const tc = useT('common');

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const tokens = await api.auth.register({
        email: email.trim(),
        password,
        firstName: firstName.trim() || undefined,
        lastName: lastName.trim() || undefined,
        deviceName: deviceName(),
        language: language.get(),
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

  const field = (name: string) => (error instanceof ApiError ? error.field(name) : undefined);

  return (
    <Screen>
      <Text variant="title">{t('registerTitle')}</Text>
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
      <Text muted>{t('registerIntro')}</Text>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('fieldFirstName')}
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label={t('fieldLastName')}
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
          />
        </View>
      </Row>
      <Field
        label={t('fieldEmail')}
        value={email}
        onChangeText={setEmail}
        error={field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <Field
        label={t('fieldPassword')}
        value={password}
        onChangeText={setPassword}
        error={field('password')}
        hint={t('registerPasswordHint')}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? (
        <Banner tone="error">{typeof error === 'string' ? error : errorMessage(error)}</Banner>
      ) : null}
      <Button title={t('registerButton')} loading={busy} onPress={() => void submit()} />
      <Text muted style={{ textAlign: 'center' }}>
        {t('alreadyHaveOne')}{' '}
        <Link
          href="/sign-in"
          replace
          style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
        >
          {tc('signIn')}
        </Link>
      </Text>
    </Screen>
  );
}
