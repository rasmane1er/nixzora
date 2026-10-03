import { errorMessage } from '@nixzora/api-client';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Linking } from 'react-native';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Sends a reset link. The answer is the same whether or not the email has an account. */
export default function ForgotPasswordScreen() {
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const t = useT('appAccount');

  async function send() {
    const address = email.trim();
    if (!EMAIL.test(address)) return setError(t('forgotInvalidEmail'));
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
        <Text variant="title">{t('forgotSentTitle')}</Text>
        <Text>{t('forgotSentBody', { email: sentTo })}</Text>
        <Text muted>{t('forgotSentHelp')}</Text>
        <Button title={t('forgotBackToSignIn')} onPress={() => router.back()} />
        <Button
          title={t('forgotSendAgain')}
          tone="ghost"
          loading={busy}
          onPress={() => void send()}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Text variant="title">{t('forgotTitle')}</Text>
      <Text muted>{t('forgotIntro')}</Text>
      <Field
        label={t('fieldEmail')}
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
      <Button title={t('forgotSendButton')} loading={busy} onPress={() => void send()} />
      <Button
        title={t('forgotOpenWebsite')}
        tone="ghost"
        onPress={() => void Linking.openURL(`${WEB_URL}/account/forgot-password`)}
      />
    </Screen>
  );
}
