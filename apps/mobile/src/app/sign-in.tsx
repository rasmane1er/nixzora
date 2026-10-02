import { errorMessage } from '@nixzora/api-client';
import { Link, router } from 'expo-router';
import { useState } from 'react';
import { SocialSignIn } from '@/components/SocialSignIn';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { deviceName } from '@/lib/device';
import { fonts } from '@/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

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

  async function forgot() {
    setError(null);
    if (!email.trim()) return setError('Enter your email first.');
    try {
      await api.auth.forgotPassword(email.trim());
      setNotice('If that email has an account, a reset link is on its way.');
    } catch (e) {
      setError(errorMessage(e));
    }
  }

  return (
    <Screen>
      {mfaToken ? (
        <>
          <Text variant="title">Two-step verification</Text>
          <Text muted>Enter the 6-digit code from your authenticator app, or a recovery code.</Text>
          <Field
            label="Code"
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
          <Text variant="title">Welcome back</Text>
          <SocialSignIn
            onResult={async (result) => {
              if ('mfaRequired' in result) return setMfaToken(result.mfaToken);
              await completeSignIn(result);
              done();
            }}
          />
          <Field
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
          />
          <Field
            label="Password"
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
      {notice ? <Banner tone="ok">{notice}</Banner> : null}
      <Button
        title={mfaToken ? 'Verify' : 'Sign in'}
        loading={busy}
        onPress={() => void submit()}
      />
      {!mfaToken ? (
        <>
          <Button title="Forgot password?" tone="ghost" onPress={() => void forgot()} />
          <Text muted style={{ textAlign: 'center' }}>
            New to NIXZORA?{' '}
            <Link
              href="/register"
              replace
              style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
            >
              Create an account
            </Link>
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
