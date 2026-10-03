import { router, Stack } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';
import { useT } from '@/lib/i18n';

export default function NotFound() {
  const t = useT('appShop');
  return (
    <>
      <Stack.Screen options={{ title: t('titleNotFound') }} />
      <Screen>
        <EmptyState
          title={t('notFoundTitle')}
          body={t('notFoundBody')}
          action={<Button title={t('goToShop')} onPress={() => router.replace('/')} />}
        />
      </Screen>
    </>
  );
}
