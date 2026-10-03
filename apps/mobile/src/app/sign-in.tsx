import { errorMessage } from '@nixzora/api-client';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { SocialSignIn } from '@/components/SocialSignIn';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { deviceName } from '@/lib/device';
import { useT } from '@/lib/i18n';
import { fonts } from '@/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT('appAccount');
  const tc = useT('common');

  const done = () => (router.canGoBack() ? router.back() : router.replace('/account'));

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) {
        await completeSignIn(await api.auth.completeMfa(mfaToken, code));
        return done();
      }
      const result = await api.auth.login({
        email: email.trim(),
        password,
        deviceName: deviceName(),
      });
      if ('mfaRequired' in result) {
        setMfaToken(result.mfaToken);
        return;
      }
      await completeSignIn(result);
      done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {mfaToken ? (
        <>
          <Text variant="title">{t('twoStepTitle')}</Text>
          <Text muted>{t('signInMfaIntro')}</Text>
          <Field
            label={t('fieldCode')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={{ fontFamily: fonts.mono, letterSpacing: 4 }}
          />
        </>
      ) : (
        <>
          <Text variant="title">{t('signInWelcome')}</Text>
          <SocialSignIn
            onResult={async (result) => {
              if ('mfaRequired' in result) return setMfaToken(result.mfaToken);
              await completeSignIn(result);
              done();
            }}
          />
          <Field
            label={t('fieldEmail')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
          />
          <Field
            label={t('fieldPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => void submit()}
          />
        </>
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title={mfaToken ? t('verify') : tc('signIn')}
        loading={busy}
        onPress={() => void submit()}
      />
      {!mfaToken ? (
        <>
          <Button
            title={t('forgotPasswordLink')}
            tone="ghost"
            onPress={() =>
              router.push({ pathname: '/forgot-password', params: { email: email.trim() } })
            }
          />
          <Text muted style={{ textAlign: 'center' }}>
            {t('newToNixzora')}{' '}
            <Link
              href="/register"
              replace
              style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
            >
              {tc('createAccount')}
            </Link>
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
