import { errorMessage } from '@nixzora/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends a reset link. The answer is the same whether or not the email has an account. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    const address = email.trim();
    if (!EMAIL.test(address)) return setError('Enter the email you signed up with.');
    setBusy(true);
    setError(null);
    try {
      await api.auth.forgotPassword(address);
      setSentTo(address);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (sentTo) {
    return (
      <Screen>
        <Text variant="title">Check your email</Text>
        <Text>
          If {sentTo} has a NIXZORA account, a link to choose a new password is on its way. It works
          for 30 minutes.
        </Text>
        <Text muted>
          Nothing after a few minutes? Check spam, or make sure this is the address you used. If you
          signed up with Apple or Google, use that button to sign in instead.
        </Text>
        <Button title="Back to sign in" onPress={() => router.back()} />
        <Button title="Send again" tone="ghost" loading={busy} onPress={() => void send()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">Reset your password</Text>
      <Text muted>Enter your email and we'll send you a link to choose a new password.</Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
        textContentType="username"
        autoFocus
        returnKeyType="send"
        onSubmitEditing={() => void send()}
      />
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button title="Send reset link" loading={busy} onPress={() => void send()} />
      <Button
        title="Open the website instead"
        tone="ghost"
        onPress={() => void Linking.openURL(`${WEB_URL}/account/forgot-password`)}
      />
    </Screen>
  );
}
