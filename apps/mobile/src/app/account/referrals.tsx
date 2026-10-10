import { errorMessage } from '@nixzora/api-client';
import type { ReferralView } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, Share, View } from 'react-native';
import { Banner, Button, Card, Divider, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

const referralKey = ['referral'] as const;

/** Refer a friend (p10-23): your link, rewards, invites, and your own welcome gift. */
export default function ReferralsScreen() {
  const t = useT('referrals');
  const p = usePalette();
  const { money, shortDate } = useFormatters();
  const client = useQueryClient();
  const { claim } = useLocalSearchParams<{ claim?: string }>();
  const [code, setCode] = useState(typeof claim === 'string' ? claim : '');
  const view = useQuery({ queryKey: referralKey, queryFn: () => api.account.referral() });
  const apply = useMutation({
    mutationFn: () => api.account.claimReferral(code.trim()),
    onSuccess: (data: ReferralView) => {
      client.setQueryData(referralKey, data);
      void client.invalidateQueries({ queryKey: ['referral-welcome'] });
    },
  });

  const v = view.data;
  if (!v) {
    return (
      <Screen>
        {view.error ? <Banner tone="error">{errorMessage(view.error)}</Banner> : null}
      </Screen>
    );
  }
  const friend = money(v.friendCents);
  const reward = money(v.rewardCents);
  const min = money(v.minOrderCents);
  return (
    <Screen
      refreshControl={
        <RefreshControl refreshing={view.isRefetching} onRefresh={() => void view.refetch()} />
      }
    >
      <View style={{ gap: space.xs }}>
        <Text variant="title">{t('title', { friend, reward })}</Text>
        <Text muted>{t('lead', { friend, reward, min })}</Text>
      </View>

      {apply.isSuccess ? <Banner tone="ok">{t('claimed')}</Banner> : null}
      {apply.error ? <Banner tone="error">{errorMessage(apply.error)}</Banner> : null}

      {v.welcome ? (
        <Card style={{ gap: space.xs, borderColor: p.signalText }}>
          <Text variant="heading">{t('welcomeTitle')}</Text>
          <Text>
            {v.welcome.used
              ? t('welcomeUsed')
              : t('welcomeBody', {
                  code: v.welcome.code,
                  amount: money(v.welcome.amountCents),
                  min,
                  date: shortDate(v.welcome.endsAt),
                })}
          </Text>
        </Card>
      ) : v.canClaim ? (
        <Card style={{ gap: space.sm }}>
          <Text variant="heading">{t('claimTitle')}</Text>
          <Row style={{ alignItems: 'flex-end' }}>
            <View style={{ flex: 1 }}>
              <Field
                label={t('claimLabel')}
                value={code}
                onChangeText={setCode}
                autoCapitalize="characters"
                autoCorrect={false}
                maxLength={12}
              />
            </View>
            <Button
              title={t('claimButton')}
              tone="secondary"
              disabled={!code.trim()}
              loading={apply.isPending}
              onPress={() => apply.mutate()}
            />
          </Row>
        </Card>
      ) : null}

      <Card style={{ gap: space.sm }}>
        <Text variant="heading">{t('yourLink')}</Text>
        <Text selectable style={{ fontFamily: fonts.bodyMedium, color: p.fg }}>
          {v.link}
        </Text>
        <Text variant="small" muted>
          {t('code', { code: v.code })}
        </Text>
        {/* No clipboard module in the app (a native one would break over-the-air updates):
            the link is selectable, and Share covers copying on every platform. */}
        <Button
          title={t('share')}
          onPress={() => void Share.share({ message: t('shareText', { friend, link: v.link }) })}
        />
      </Card>

      <Row style={{ gap: space.sm }}>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
            {t('earned', { amount: money(v.earnedCents) })}
          </Text>
        </Card>
        <Card style={{ flex: 1 }}>
          <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
            {t('progress', { count: v.rewardedThisYear, limit: v.yearlyLimit })}
          </Text>
        </Card>
      </Row>

      <Card style={{ gap: space.xs }}>
        <Text variant="heading">{t('invitesTitle')}</Text>
        {v.invites.length ? (
          v.invites.map((invite, i) => (
            <View key={`${invite.joinedAt}-${i}`}>
              {i ? <Divider /> : null}
              <View style={{ paddingVertical: space.sm, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bodyBold, color: p.fg }}>
                  {invite.name ?? t('aFriend')}
                </Text>
                <Text variant="small" muted>
                  {t('joined', { date: shortDate(invite.joinedAt) })}
                </Text>
                <Text
                  variant="small"
                  style={
                    invite.status === 'REWARDED'
                      ? { color: p.okFg, fontFamily: fonts.bodyBold }
                      : undefined
                  }
                  muted={invite.status !== 'REWARDED'}
                >
                  {invite.status === 'REWARDED'
                    ? t('status_REWARDED', { amount: reward })
                    : invite.status === 'REJECTED'
                      ? `${t('status_REJECTED')}${invite.reason ? `: ${t(`reason_${invite.reason}`)}` : ''}`
                      : t('status_PENDING')}
                </Text>
              </View>
            </View>
          ))
        ) : (
          <Text muted>{t('none')}</Text>
        )}
      </Card>

      <Card style={{ gap: space.xs }}>
        <Text variant="heading">{t('howTitle')}</Text>
        <Text>1. {t('rule1', { friend, min })}</Text>
        <Text>2. {t('rule2', { reward })}</Text>
        <Text>3. {t('rule3', { limit: v.yearlyLimit })}</Text>
      </Card>
    </Screen>
  );
}
