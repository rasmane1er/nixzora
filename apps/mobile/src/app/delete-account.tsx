import { errorMessage } from '@nixzora/api-client';
import { router } from 'expo-router';
import { useState } from 'react';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { signOut } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { useSession } from '@/lib/session';

/** In-app account deletion, as the App Store and Google Play require. */
export default function DeleteAccountScreen() {
  const { user } = useSession();
  // Accounts that only sign in with Google or Apple have no password: they type DELETE.
  const usesPassword = user?.hasPassword ?? true;
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
      <Text variant="title">Delete your account</Text>
      <Text>
        This permanently removes your account and signs you out on every device. We delete:
      </Text>
      <Text muted>
        • your name, email, password and two-step settings{'\n'}• saved addresses and saved products
        {'\n'}• this phone’s notification registration
      </Text>
      <Text muted>
        Past orders are kept without your sign-in for tax and refund records, as the law requires.
        This cannot be undone.
      </Text>
      {usesPassword ? (
        <Field
          label="Enter your password to confirm"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="current-password"
          textContentType="password"
        />
      ) : (
        <Field
          label="Type DELETE to confirm"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="characters"
          autoCorrect={false}
        />
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title="Delete my account"
        tone="danger"
        loading={busy}
        disabled={usesPassword ? !password : password.trim() !== 'DELETE'}
        onPress={() => void confirm()}
      />
      <Button title="Keep my account" tone="ghost" disabled={busy} onPress={() => router.back()} />
    </Screen>
  );
}
