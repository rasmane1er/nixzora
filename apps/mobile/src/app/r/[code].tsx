import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Button, Card, EmptyState, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { space } from '@/lib/theme';

/** An invite link opened in the app (p10-23): who sent it, and sign-up with the code. */
export default function InviteScreen() {
  const t = useT('referrals');
  const { money } = useFormatters();
  const { status } = useSession();
  const { code: raw } = useLocalSearchParams<{ code: string }>();
  const code =
    typeof raw === 'string' && /^[A-Za-z0-9]{6,12}$/.test(raw) ? raw.toUpperCase() : null;
  const invite = useQuery({
    queryKey: ['referral-invite', code],
    queryFn: () => api.account.referralPreview(code!),
    enabled: !!code,
    retry: false,
  });
  if (invite.isLoading) return <ActivityIndicator style={{ flex: 1 }} />;
  if (!code || !invite.data) {
    return (
      <Screen>
        <EmptyState
          title={t('inviteInvalid')}
          action={<Button title="NIXZORA" onPress={() => router.replace('/')} />}
        />
      </Screen>
    );
  }
  const amount = money(invite.data.friendCents);
  return (
    <Screen>
      <Card style={{ gap: space.md, alignItems: 'center' }}>
        <Text variant="label" tone="signal">
          NIXZORA
        </Text>
        <Text variant="title" style={{ textAlign: 'center' }}>
          {invite.data.firstName
            ? t('inviteTitle', { name: invite.data.firstName, amount })
            : t('inviteTitleAnon', { amount })}
        </Text>
        <Text muted style={{ textAlign: 'center' }}>
          {t('inviteLead', { amount, min: money(invite.data.minOrderCents) })}
        </Text>
        <View style={{ alignSelf: 'stretch' }}>
          {status === 'signedIn' ? (
            <Button
              title={t('claimButton')}
              onPress={() =>
                router.replace({ pathname: '/account/referrals', params: { claim: code } })
              }
            />
          ) : (
            <Button
              title={t('inviteCta')}
              onPress={() => router.replace({ pathname: '/register', params: { ref: code } })}
            />
          )}
        </View>
        <Text variant="small" muted style={{ textAlign: 'center' }}>
          {t('inviteSignIn', { code })}
        </Text>
      </Card>
    </Screen>
  );
}
