import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { Link, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { SocialSignIn } from '@/components/SocialSignIn';
import { Banner, Button, Field, Screen, Text } from '@/components/ui';
import { completeSignIn } from '@/lib/account-actions';
import { api } from '@/lib/api';
import { useBiometricName } from '@/lib/biometrics';
import { deviceSignIn, useDeviceSignInAccount } from '@/lib/device-sign-in';
import { deviceName } from '@/lib/device';
import { useT } from '@/lib/i18n';
import { session } from '@/lib/session';
import { brand, fonts, space } from '@/lib/theme';

export default function SignInScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useT('appAccount');
  const tc = useT('common');

  const biometricName = useBiometricName();
  const deviceAccount = useDeviceSignInAccount();
  const [bioBusy, setBioBusy] = useState(false);

  useEffect(() => {
    void deviceSignIn.load();
  }, []);

  const leave = () => (router.canGoBack() ? router.back() : router.replace('/account'));

  /** After a password, Google / Apple or two-step sign-in: offer Face ID / fingerprint once. */
  const done = async () => {
    const email = session.getState().user?.email;
    if (!biometricName || !email || !(await deviceSignIn.shouldOffer(email))) return leave();
    void deviceSignIn.markOffered(email);
    Alert.alert(
      t('bioSignInOfferTitle'),
      t('bioSignInOfferBody', { method: biometricName }),
      [
        { text: t('bioSignInOfferNo'), style: 'cancel', onPress: leave },
        {
          text: t('bioSignInOfferYes'),
          onPress: () => {
            void deviceSignIn
              .enable(email)
              .catch(() => undefined)
              .finally(leave);
          },
        },
      ],
      { cancelable: false },
    );
  };

  async function signInWithBiometrics() {
    setBioBusy(true);
    setError(null);
    try {
      if (await deviceSignIn.signIn()) return leave();
      setError(t('bioSignInFailed'));
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBioBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      if (mfaToken) {
        await completeSignIn(await api.auth.completeMfa(mfaToken, code));
        return void done();
      }
      const result = await api.auth.login({
        email: email.trim(),
        password,
        deviceName: deviceName(),
      });
      if ('mfaRequired' in result) {
        setMfaToken(result.mfaToken);
        return;
      }
      await completeSignIn(result);
      void done();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen>
      {mfaToken ? (
        <>
          <Text variant="title">{t('twoStepTitle')}</Text>
          <Text muted>{t('signInMfaIntro')}</Text>
          <Field
            label={t('fieldCode')}
            value={code}
            onChangeText={setCode}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            autoFocus
            style={{ fontFamily: fonts.mono, letterSpacing: 4 }}
          />
        </>
      ) : (
        <>
          <Text variant="title">{t('signInWelcome')}</Text>
          {biometricName && deviceAccount ? (
            <View style={{ gap: space.sm }}>
              <Button
                title={t('bioSignInTitle', { method: biometricName })}
                loading={bioBusy}
                icon={<Ionicons name="finger-print" size={20} color={brand.paper} />}
                onPress={() => void signInWithBiometrics()}
              />
              <Text variant="small" muted style={{ textAlign: 'center' }}>
                {t('bioSignInAs', { email: deviceAccount })}
              </Text>
              <Text variant="small" muted style={{ textAlign: 'center' }}>
                {t('orUsePassword')}
              </Text>
            </View>
          ) : null}
          <SocialSignIn
            onResult={async (result) => {
              if ('mfaRequired' in result) return setMfaToken(result.mfaToken);
              await completeSignIn(result);
              void done();
            }}
          />
          <Field
            label={t('fieldEmail')}
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoComplete="email"
            textContentType="username"
          />
          <Field
            label={t('fieldPassword')}
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoComplete="current-password"
            textContentType="password"
            onSubmitEditing={() => void submit()}
          />
        </>
      )}
      {error ? <Banner tone="error">{error}</Banner> : null}
      <Button
        title={mfaToken ? t('verify') : tc('signIn')}
        loading={busy}
        onPress={() => void submit()}
      />
      {!mfaToken ? (
        <>
          <Button
            title={t('forgotPasswordLink')}
            tone="ghost"
            onPress={() =>
              router.push({ pathname: '/forgot-password', params: { email: email.trim() } })
            }
          />
          <Text muted style={{ textAlign: 'center' }}>
            {t('newToNixzora')}{' '}
            <Link
              href="/register"
              replace
              style={{ fontFamily: fonts.bodyBold, textDecorationLine: 'underline' }}
            >
              {tc('createAccount')}
            </Link>
          </Text>
        </>
      ) : null}
    </Screen>
  );
}
