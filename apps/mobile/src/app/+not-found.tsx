import { router, Stack } from 'expo-router';
import { Button, EmptyState, Screen } from '@/components/ui';

export default function NotFound() {
  return (
    <>
      <Stack.Screen options={{ title: 'Not found' }} />
      <Screen>
        <EmptyState
          title="This page isn’t in the app"
          body="The link may be old, or the page only exists on the website."
          action={<Button title="Go to the shop" onPress={() => router.replace('/')} />}
        />
      </Screen>
    </>
  );
}
