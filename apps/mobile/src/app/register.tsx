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

export default function RegisterScreen() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ApiError | string | null>(null);

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
      <Text variant="title">Create your account</Text>
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
      <Text muted>Track orders, save products and check out faster.</Text>
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            label="First name"
            value={firstName}
            onChangeText={setFirstName}
            autoComplete="given-name"
            textContentType="givenName"
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="Last name"
            value={lastName}
            onChangeText={setLastName}
            autoComplete="family-name"
            textContentType="familyName"
          />
        </View>
      </Row>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        error={field('email')}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
      />
      <Field
        label="Password"
        value={password}
        onChangeText={setPassword}
        error={field('password')}
        hint="At least 12 characters. A short phrase works well."
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
      />
      {error ? (
        <Banner tone="error">{typeof error === 'string' ? error : error.message}</Banner>
      ) : null}
      <Button title="Create account" loading={busy} onPress={() => void submit()} />
      <Text muted style={{ textAlign: 'center' }}>
        Already have one?{' '}
        <Link
          href="/sign-in"
          replace
          style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
        >
          Sign in
        </Link>
      </Text>
    </Screen>
  );
}
