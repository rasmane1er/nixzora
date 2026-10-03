import { errorMessage } from '@nixzora/api-client';
import type { AccountPreferences } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Platform, Switch, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Banner, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { space } from '@/lib/theme';

/** Which emails NIXZORA sends (push lives in Settings). Order and security emails are always on. */
export default function PreferencesScreen() {
  const client = useQueryClient();
  const t = useT('appAccount');
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
          t('prefsOrdersTitle'),
          t('prefsOrdersBody'),
          <Switch value disabled accessibilityLabel={t('prefsOrdersA11y')} />,
        )}
        <Divider />
        {row(
          t('prefsReviewsTitle'),
          t('prefsReviewsBody'),
          <Switch
            value={current?.reviewRequests ?? false}
            disabled={!current}
            onValueChange={toggle('reviewRequests')}
            accessibilityLabel={t('prefsReviewsA11y')}
          />,
        )}
        <Divider />
        {row(
          t('prefsDealsTitle'),
          t('prefsDealsBody'),
          <Switch
            value={current?.marketingEmails ?? false}
            disabled={!current}
            onValueChange={toggle('marketingEmails')}
            accessibilityLabel={t('prefsDealsA11y')}
          />,
        )}
      </Card>
      {Platform.OS !== 'web' ? (
        <MenuList
          title={t('prefsPushTitle')}
          items={[
            {
              icon: 'notifications-outline',
              label: t('prefsPushLabel'),
              hint: t('prefsPushHint'),
              href: '/account/settings',
            },
          ]}
        />
      ) : null}
    </Screen>
  );
}
