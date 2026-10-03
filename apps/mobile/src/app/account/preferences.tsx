import { errorMessage } from '@nixzora/api-client';
import type { AccountPreferences } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform, Switch, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Banner, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { space } from '@/lib/theme';

/** Which emails NIXZORA sends (push lives in Settings). Order and security emails are always on. */
export default function PreferencesScreen() {
  const client = useQueryClient();
  const prefs = useQuery({ queryKey: keys.preferences, queryFn: () => api.me.preferences() });
  const save = useMutation({
    mutationFn: (next: AccountPreferences) => api.me.setPreferences(next),
    onMutate: (next) => client.setQueryData(keys.preferences, next),
    onError: () => void client.invalidateQueries({ queryKey: keys.preferences }),
  });
  const current = prefs.data;
  const toggle = (key: keyof AccountPreferences) => (value: boolean) =>
    current && save.mutate({ ...current, [key]: value });

  const row = (title: string, body: string, control: React.ReactNode) => (
    <Row style={{ alignItems: 'flex-start', paddingVertical: space.sm }}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text>{title}</Text>
        <Text variant="small" muted>
          {body}
        </Text>
      </View>
      {control}
    </Row>
  );

  return (
    <Screen>
      {save.error ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
      <Card>
        {row(
          'Orders and account',
          'Confirmations, shipping, refunds and security alerts. Always on.',
          <Switch value disabled accessibilityLabel="Orders and account emails, always on" />,
        )}
        <Divider />
        {row(
          'Review requests',
          'One email after delivery asking how the product is.',
          <Switch
            value={current?.reviewRequests ?? false}
            disabled={!current}
            onValueChange={toggle('reviewRequests')}
            accessibilityLabel="Review request emails"
          />,
        )}
        <Divider />
        {row(
          'Deals and new arrivals',
          'Occasional offers and new products. Unsubscribe any time.',
          <Switch
            value={current?.marketingEmails ?? false}
            disabled={!current}
            onValueChange={toggle('marketingEmails')}
            accessibilityLabel="Deals and new arrivals emails"
          />,
        )}
      </Card>
      {Platform.OS !== 'web' ? (
        <MenuList
          title="Push notifications"
          items={[
            {
              icon: 'notifications-outline',
              label: 'Order updates on this phone',
              hint: 'Settings → This phone',
              href: '/account/settings',
            },
          ]}
        />
      ) : null}
    </Screen>
  );
}
