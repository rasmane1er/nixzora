import { errorMessage } from '@nixzora/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { signOut } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';

/** In-app account deletion, as the App Store and Google Play require. */
export default function DeleteAccountScreen() {
  const { user } = useSession();
  // Accounts that only sign in with Google or Apple have no password: they type DELETE.
  const usesPassword = user?.hasPassword ?? true;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT('appAccount');

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      await api.account.delete(usesPassword ? { password } : { confirm: 'DELETE' });
      // The API already ended every session and removed this phone's push registration.
      await signOut({ serverEnded: true });
      router.dismissAll();
      router.replace({ pathname: '/account', params: { deleted: '1' } });
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <Screen>
      <Text variant="title">{t('deleteTitle')}</Text>
      <Text>{t('deleteIntro')}</Text>
      <Text muted>{t('deleteList')}</Text>
      <Text muted>{t('deleteKept')}</Text>
      {usesPassword ? (
        <Field
          label={t('deletePasswordLabel')}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
      ) : (
        <Field
          label={t('deleteTypeLabel')}
          value={password}
          onChangeText={setPassword}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title={t('deleteButton')}
        tone="danger"
        loading={busy}
        disabled={usesPassword ? !password : password.trim() !== 'DELETE'}
        onPress={() => void confirm()}
      />
      <Button title={t('deleteKeep')} tone="ghost" disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
