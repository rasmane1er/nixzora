import Ionicons from '@expo/vector-icons/Ionicons';
import type { VisualSearchResult } from '@nixzora/validation';
import * as FileSystem from 'expo-file-system/legacy';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { ProductGrid } from '@/components/ProductGrid';
import { Banner, Button, EmptyState, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { language, useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';

const TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/avif'];

type Problem = 'tooLarge' | 'unreadable' | 'failed' | 'permission';

/** Posts the picked file's bytes to the API (no decoding in JavaScript); the API shrinks it. */
async function send(uri: string, mimeType: string | undefined): Promise<VisualSearchResult> {
  const type = mimeType && TYPES.includes(mimeType) ? mimeType : 'image/jpeg';
  const headers = { 'Content-Type': type, 'Accept-Language': language.get() };
  let status: number;
  let body: string;
  if (Platform.OS === 'web') {
    const blob = await (await fetch(uri)).blob();
    const res = await fetch(api.catalog.visualSearchUploadUrl, {
      method: 'POST',
      headers,
      body: blob,
    });
    status = res.status;
    body = await res.text();
  } else {
    const res = await FileSystem.uploadAsync(api.catalog.visualSearchUploadUrl, uri, {
      httpMethod: 'POST',
      headers,
      uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
    });
    status = res.status;
    body = res.body;
  }
  if (status === 200) return JSON.parse(body) as VisualSearchResult;
  const message = (() => {
    try {
      return String((JSON.parse(body) as { message?: unknown }).message ?? '');
    } catch {
      return '';
    }
  })();
  throw new Error(
    status === 413 || /large/i.test(message)
      ? 'tooLarge'
      : status === 400
        ? 'unreadable'
        : 'failed',
  );
}

/**
 * Search by photo (p10-14): take a picture or pick one, and see products that look like it.
 * The photo is sent once and not kept.
 */
export default function PhotoSearchScreen() {
  const t = useT('photo');
  const p = usePalette();
  const [photo, setPhoto] = useState<string | null>(null);
  const [result, setResult] = useState<VisualSearchResult | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [busy, setBusy] = useState(false);

  const pick = async (from: 'camera' | 'library') => {
    setProblem(null);
    if (from === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setProblem('permission');
        return;
      }
    }
    const options: ImagePicker.ImagePickerOptions = {
      mediaTypes: ['images'],
      quality: 0.6,
      exif: false,
    };
    const picked =
      from === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
    if (picked.canceled || !picked.assets[0]) return;
    const asset = picked.assets[0];
    setPhoto(asset.uri);
    setBusy(true);
    try {
      setResult(await send(asset.uri, asset.mimeType ?? undefined));
    } catch (error) {
      const code = (error as Error).message;
      setProblem(code === 'tooLarge' || code === 'unreadable' ? code : 'failed');
    } finally {
      setBusy(false);
    }
  };

  const header = (
    <View style={{ gap: space.md }}>
      {result ? null : <Text muted>{t('lead')}</Text>}
      <View style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}>
        {photo ? (
          <Image
            source={{ uri: photo }}
            alt={t('yourPhoto')}
            style={{ width: 88, height: 88, borderRadius: 12, backgroundColor: p.tile }}
            contentFit="cover"
          />
        ) : null}
        <View style={{ flex: 1, gap: space.sm }}>
          {Platform.OS === 'web' ? null : (
            <Button
              title={t('takePhoto')}
              icon={<Ionicons name="camera-outline" size={18} color="#FFFFFF" />}
              loading={busy}
              onPress={() => void pick('camera')}
            />
          )}
          <Button
            title={t('library')}
            tone="secondary"
            disabled={busy}
            onPress={() => void pick('library')}
          />
        </View>
      </View>
      {busy ? <Text muted>{t('searching')}</Text> : null}
      {problem ? <Banner tone="error">{t(problem)}</Banner> : null}
      <Text variant="small" muted>
        {result ? t('privacy') : `${t('tips')} ${t('privacy')}`}
      </Text>
      {result ? (
        <View style={{ gap: space.xs }}>
          <Text variant="heading">{t('resultsTitle')}</Text>
          <Text muted>{t('resultsCount', { count: result.products.length })}</Text>
          {result.query ? (
            <Pressable
              accessibilityRole="link"
              onPress={() => router.push({ pathname: '/search', params: { q: result.query! } })}
            >
              <Text>
                {t('looksLike', { query: result.query })}{' '}
                <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
                  {t('searchWords', { query: result.query })}
                </Text>
              </Text>
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <ProductGrid
      products={result?.products ?? []}
      header={header}
      empty={result && !busy ? <EmptyState title={t('none')} /> : undefined}
    />
  );
}
