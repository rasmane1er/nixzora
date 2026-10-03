import Ionicons from '@expo/vector-icons/Ionicons';
import { ApiError, errorMessage } from '@nixzora/api-client';
import { type BarcodeScanningResult, CameraView, useCameraPermissions } from 'expo-camera';
import * as Haptics from 'expo-haptics';
import { router, useIsFocused } from 'expo-router';
import { useRef, useState } from 'react';
import { Linking, Platform, StyleSheet, View } from 'react-native';
import { Banner, Button, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { scanTarget } from '@/lib/scan';
import { brand, radius, space, usePalette } from '@/lib/theme';

export default function ScanScreen() {
  const p = usePalette();
  const t = useT('appShop');
  const focused = useIsFocused();
  const [permission, requestPermission] = useCameraPermissions();
  const [manual, setManual] = useState('');
  const [message, setMessage] = useState<{ tone: 'error' | 'info'; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 });

  async function open(raw: string) {
    const target = scanTarget(raw);
    if (!target) {
      setMessage({ tone: 'error', text: t('notABarcode') });
      return;
    }
    if (target.kind === 'product') {
      router.push(`/p/${target.slug}`);
      return;
    }
    setBusy(true);
    setMessage({ tone: 'info', text: t('lookingUp', { code: target.code }) });
    try {
      const found = await api.catalog.lookup(target.code);
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setMessage(null);
      router.push(
        found.variantId ? `/p/${found.slug}?variant=${found.variantId}` : `/p/${found.slug}`,
      );
    } catch (error) {
      if (Platform.OS !== 'web')
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      setMessage({
        tone: 'error',
        text:
          error instanceof ApiError && error.status === 404
            ? t('notSoldYet', { code: target.code })
            : errorMessage(error),
      });
    } finally {
      setBusy(false);
    }
  }

  function onScanned(result: BarcodeScanningResult) {
    const now = Date.now();
    // The camera reports the same code many times a second: act once.
    if (busy || (result.data === last.current.code && now - last.current.at < 3000)) return;
    last.current = { code: result.data, at: now };
    void open(result.data);
  }

  const camera =
    Platform.OS === 'web' ? null : !permission ? null : permission.granted ? (
      <View style={[styles.cameraWrap, { borderColor: p.line }]}>
        {focused ? (
          <CameraView
            style={StyleSheet.absoluteFill}
            facing="back"
            barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'qr'] }}
            onBarcodeScanned={onScanned}
          />
        ) : null}
        <View pointerEvents="none" style={styles.frame} />
      </View>
    ) : (
      <View
        style={[styles.cameraWrap, styles.center, { borderColor: p.line, backgroundColor: p.card }]}
      >
        <Ionicons name="camera-outline" size={36} color={p.muted} />
        <Text muted style={{ textAlign: 'center' }}>
          {t('allowCameraHelp')}
        </Text>
        {permission.canAskAgain ? (
          <Button title={t('allowCamera')} onPress={() => void requestPermission()} />
        ) : (
          <Button
            title={t('openSettings')}
            tone="ghost"
            onPress={() => void Linking.openSettings()}
          />
        )}
      </View>
    );

  return (
    <Screen>
      <Text muted>{t('scanIntro')}</Text>
      {camera}
      {message ? <Banner tone={message.tone}>{message.text}</Banner> : null}
      <Row style={{ alignItems: 'flex-end' }}>
        <View style={{ flex: 1 }}>
          <Field
            label={t('typeCode')}
            value={manual}
            onChangeText={setManual}
            placeholder={t('codePlaceholder')}
            autoCapitalize="characters"
            autoCorrect={false}
            keyboardType={Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default'}
            returnKeyType="search"
            onSubmitEditing={() => void open(manual)}
          />
        </View>
        <Button
          title={t('find')}
          tone="secondary"
          loading={busy}
          disabled={!manual.trim()}
          onPress={() => void open(manual)}
        />
      </Row>
    </Screen>
  );
}

const styles = StyleSheet.create({
  cameraWrap: {
    aspectRatio: 3 / 4,
    maxHeight: 460,
    borderRadius: radius + 4,
    borderWidth: 1,
    overflow: 'hidden',
    backgroundColor: '#000',
  },
  center: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  frame: {
    position: 'absolute',
    left: '12%',
    right: '12%',
    top: '35%',
    bottom: '35%',
    borderWidth: 3,
    borderColor: brand.signal,
    borderRadius: radius,
  },
});
