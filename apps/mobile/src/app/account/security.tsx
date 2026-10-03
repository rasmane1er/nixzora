import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Banner, Button, Card, Divider, Field, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { useFormat, useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { useSession } from '@/lib/session';
import { fonts, space } from '@/lib/theme';

/** Login & security: name and phone, password, two-step verification and signed-in devices. */
export default function SecurityScreen() {
  const client = useQueryClient();
  const { user } = useSession();
  const profile = useQuery({ queryKey: keys.profile, queryFn: () => api.me.profile() });
  const sessions = useQuery({ queryKey: keys.sessions, queryFn: () => api.me.sessions() });
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const t = useT('appAccount');
  const tc = useT('common');
  const f = useFormat();

  const changePassword = useMutation({
    mutationFn: () => api.me.changePassword({ currentPassword: current, newPassword: next }),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      void client.invalidateQueries({ queryKey: keys.sessions });
    },
  });
  const revoke = useMutation({
    mutationFn: (id: string | 'others') =>
      id === 'others' ? api.me.revokeOtherSessions() : api.me.revokeSession(id),
    onSuccess: () => void client.invalidateQueries({ queryKey: keys.sessions }),
  });

  return (
    <Screen>
      <Card>
        <Text variant="heading">{t('fieldEmail')}</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>{profile.data?.email ?? user?.email}</Text>
          {profile.data ? (
            <Pill
              label={profile.data.emailVerified ? t('confirmed') : t('notConfirmed')}
              tone={profile.data.emailVerified ? 'ok' : 'warn'}
            />
          ) : null}
        </Row>
      </Card>

      {user?.hasPassword !== false ? (
        <Card>
          <Text variant="heading">{t('fieldPassword')}</Text>
          <Field
            label={t('currentPassword')}
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
          />
          <Field
            label={t('newPassword')}
            hint={t('newPasswordHint')}
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoComplete="new-password"
          />
          {changePassword.error ? (
            <Banner tone="error">{errorMessage(changePassword.error)}</Banner>
          ) : null}
          {changePassword.isSuccess ? <Banner tone="ok">{t('passwordChanged')}</Banner> : null}
          <Button
            title={t('changePassword')}
            tone="secondary"
            disabled={!current || next.length < 12}
            loading={changePassword.isPending}
            onPress={() => changePassword.mutate()}
          />
        </Card>
      ) : null}

      <Card>
        <Text variant="heading">{t('twoStepTitle')}</Text>
        <Row>
          <Text style={{ flex: 1 }} muted>
            {t('twoStepBody')}
          </Text>
          <Pill
            label={user?.mfaEnabled ? t('on') : t('off')}
            tone={user?.mfaEnabled ? 'ok' : 'neutral'}
          />
        </Row>
        <Button
          title={user?.mfaEnabled ? t('manageOnWebsite') : t('turnOnOnWebsite')}
          tone="ghost"
          onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/account/security#two-step`)}
        />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">{t('signedInTitle')}</Text>
        </Row>
        {sessions.data?.map((s, i) => (
          <View key={s.id} style={{ gap: space.xs }}>
            {i ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: space.xs }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bodyMedium }}>
                  {s.deviceName ?? t('unknownDevice')}
                  {s.current ? ` · ${t('thisDevice')}` : ''}
                </Text>
                <Text variant="small" muted>
                  {t('lastActive', { date: f.date(s.lastUsedAt) })}
                </Text>
              </View>
              {!s.current ? (
                <Button
                  title={tc('signOut')}
                  tone="ghost"
                  loading={revoke.isPending && revoke.variables === s.id}
                  onPress={() => revoke.mutate(s.id)}
                />
              ) : null}
            </Row>
          </View>
        ))}
        {(sessions.data?.filter((s) => !s.current).length ?? 0) > 1 ? (
          <Button
            title={t('signOutOthers')}
            tone="danger"
            onPress={() =>
              Alert.alert(t('signOutOthersTitle'), t('signOutOthersBody'), [
                { text: tc('cancel'), style: 'cancel' },
                {
                  text: tc('signOut'),
                  style: 'destructive',
                  onPress: () => revoke.mutate('others'),
                },
              ])
            }
          />
        ) : null}
      </Card>

      <MenuList
        title={t('privacyTitle')}
        items={[
          { icon: 'mail-outline', label: t('emailPreferences'), href: '/account/preferences' },
          {
            icon: 'download-outline',
            label: t('downloadData'),
            hint: t('downloadDataHint'),
            url: `${WEB_URL}/account/privacy`,
          },
          { icon: 'lock-closed-outline', label: t('privacyPolicy'), url: `${WEB_URL}/privacy` },
          {
            icon: 'trash-outline',
            label: t('deleteAccount'),
            tone: 'danger',
            href: '/delete-account',
          },
        ]}
      />
    </Screen>
  );
}
