import { errorMessage } from '@nixzora/api-client';
import type { FollowStatus } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Pressable, Switch, View } from 'react-native';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';
import { Banner, Row, Text } from './ui';

export const followKey = (handle: string) => ['follow', handle] as const;

/** Follow a store (p10-24): the button, its follower count, and deal alerts once following. */
export function FollowButton({ handle, store }: { handle: string; store: string }) {
  const t = useT('follows');
  const p = usePalette();
  const { status } = useSession();
  const signedIn = status === 'signedIn';
  const client = useQueryClient();
  const follow = useQuery({
    queryKey: [...followKey(handle), signedIn],
    queryFn: () => api.account.followStatus(handle),
  });
  const done = (data: FollowStatus) => {
    client.setQueryData([...followKey(handle), signedIn], data);
    void client.invalidateQueries({ queryKey: ['following'] });
  };
  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? api.account.follow(handle) : api.account.unfollow(handle)),
    onSuccess: done,
  });
  const alerts = useMutation({
    mutationFn: (notify: boolean) => api.account.setFollowNotify(handle, notify),
    onSuccess: done,
  });
  const data = follow.data;
  const following = data?.following ?? false;
  const error = toggle.error ?? alerts.error;
  return (
    <View style={{ gap: space.sm }}>
      <Row style={{ gap: space.md, flexWrap: 'wrap' }}>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ selected: following }}
          accessibilityLabel={
            following ? t('unfollowStore', { store }) : t('followStore', { store })
          }
          disabled={toggle.isPending}
          onPress={() => (signedIn ? toggle.mutate(!following) : router.push('/sign-in'))}
          style={{
            paddingHorizontal: space.lg,
            paddingVertical: 8,
            borderRadius: 999,
            borderWidth: 1,
            borderColor: following ? p.line : p.signalText,
            backgroundColor: following ? p.card : p.signalText,
            opacity: toggle.isPending ? 0.6 : 1,
          }}
        >
          <Text style={{ fontFamily: fonts.bodyBold, color: following ? p.fg : '#FFFFFF' }}>
            {following ? `✓ ${t('following')}` : t('follow')}
          </Text>
        </Pressable>
        {data ? (
          <Text muted variant="small">
            {t('followers', { count: data.followers })}
          </Text>
        ) : null}
      </Row>
      {following ? (
        <Row style={{ justifyContent: 'space-between', gap: space.md }}>
          <View style={{ flex: 1, gap: 2 }}>
            <Text>{t('dealAlerts')}</Text>
            <Text variant="small" muted>
              {t('dealAlertsHint')}
            </Text>
          </View>
          <Switch
            value={data?.notify ?? false}
            disabled={alerts.isPending}
            onValueChange={(v) => alerts.mutate(v)}
            accessibilityLabel={t('dealAlerts')}
          />
        </Row>
      ) : null}
      {error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
    </View>
  );
}
