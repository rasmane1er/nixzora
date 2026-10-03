import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Alert, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Banner, Button, Card, Divider, Field, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { WEB_URL } from '@/lib/config';
import { shortDate } from '@/lib/format';
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
        <Text variant="heading">Email</Text>
        <Row style={{ flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>{profile.data?.email ?? user?.email}</Text>
          {profile.data ? (
            <Pill
              label={profile.data.emailVerified ? 'Confirmed' : 'Not confirmed'}
              tone={profile.data.emailVerified ? 'ok' : 'warn'}
            />
          ) : null}
        </Row>
      </Card>

      {user?.hasPassword !== false ? (
        <Card>
          <Text variant="heading">Password</Text>
          <Field
            label="Current password"
            value={current}
            onChangeText={setCurrent}
            secureTextEntry
            autoComplete="current-password"
          />
          <Field
            label="New password"
            hint="At least 12 characters. Other devices are signed out."
            value={next}
            onChangeText={setNext}
            secureTextEntry
            autoComplete="new-password"
          />
          {changePassword.error ? (
            <Banner tone="error">{errorMessage(changePassword.error)}</Banner>
          ) : null}
          {changePassword.isSuccess ? <Banner tone="ok">Password changed.</Banner> : null}
          <Button
            title="Change password"
            tone="secondary"
            disabled={!current || next.length < 12}
            loading={changePassword.isPending}
            onPress={() => changePassword.mutate()}
          />
        </Card>
      ) : null}

      <Card>
        <Text variant="heading">Two-step verification</Text>
        <Row>
          <Text style={{ flex: 1 }} muted>
            A code from an authenticator app at sign-in.
          </Text>
          <Pill
            label={user?.mfaEnabled ? 'On' : 'Off'}
            tone={user?.mfaEnabled ? 'ok' : 'neutral'}
          />
        </Row>
        <Button
          title={user?.mfaEnabled ? 'Manage on the website' : 'Turn on (on the website)'}
          tone="ghost"
          onPress={() => void WebBrowser.openBrowserAsync(`${WEB_URL}/account/security#two-step`)}
        />
      </Card>

      <Card>
        <Row style={{ justifyContent: 'space-between' }}>
          <Text variant="heading">Where you are signed in</Text>
        </Row>
        {sessions.data?.map((s, i) => (
          <View key={s.id} style={{ gap: space.xs }}>
            {i ? <Divider /> : null}
            <Row style={{ justifyContent: 'space-between', paddingVertical: space.xs }}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={{ fontFamily: fonts.bodyMedium }}>
                  {s.deviceName ?? 'Unknown device'}
                  {s.current ? ' · this device' : ''}
                </Text>
                <Text variant="small" muted>
                  Last active {shortDate(s.lastUsedAt)}
                </Text>
              </View>
              {!s.current ? (
                <Button
                  title="Sign out"
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
            title="Sign out everywhere else"
            tone="danger"
            onPress={() =>
              Alert.alert(
                'Sign out everywhere else?',
                'Your other devices will need to sign in again.',
                [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Sign out',
                    style: 'destructive',
                    onPress: () => revoke.mutate('others'),
                  },
                ],
              )
            }
          />
        ) : null}
      </Card>

      <MenuList
        title="Privacy & your data"
        items={[
          { icon: 'mail-outline', label: 'Email preferences', href: '/account/preferences' },
          {
            icon: 'download-outline',
            label: 'Download your data',
            hint: 'A copy of your account, orders and reviews',
            url: `${WEB_URL}/account/privacy`,
          },
          { icon: 'lock-closed-outline', label: 'Privacy policy', url: `${WEB_URL}/privacy` },
          {
            icon: 'trash-outline',
            label: 'Delete account',
            tone: 'danger',
            href: '/delete-account',
          },
        ]}
      />
    </Screen>
  );
}
