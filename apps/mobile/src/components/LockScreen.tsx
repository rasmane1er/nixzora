import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { signOut } from '@/lib/account-actions';
import { session } from '@/lib/session';
import { space, usePalette } from '@/lib/theme';
import { Logo } from './Logo';
import { Button, Text } from './ui';

/** Shown at launch when "Unlock with Face ID / fingerprint" is on. */
export function LockScreen() {
  const p = usePalette();
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  const unlock = async () => {
    setBusy(true);
    const ok = await session.unlock().catch(() => false);
    setFailed(!ok);
    setBusy(false);
  };

  useEffect(() => {
    void unlock();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: p.bg }}>
      <View style={{ flex: 1, justifyContent: 'center', padding: space.xl, gap: space.xl }}>
        <View style={{ alignItems: 'center', gap: space.md }}>
          <Logo size={44} />
          <Text muted style={{ textAlign: 'center' }}>
            {failed ? 'We could not confirm it’s you.' : 'Confirm it’s you to continue.'}
          </Text>
        </View>
        <Button title="Unlock" loading={busy} onPress={unlock} />
        <Button
          title="Sign out instead"
          tone="ghost"
          disabled={busy}
          onPress={() => void signOut()}
        />
      </View>
    </SafeAreaView>
  );
}
