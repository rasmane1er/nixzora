import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { fonts, space, usePalette } from '@/lib/theme';
import { fileSize, uploadFile } from '@/lib/upload';
import { Text } from './ui';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const MAX = 4;

export type PickedPhoto = { key: string; uri: string };

/** Up to four photos for a review (p10-05), uploaded as soon as they are picked. */
export function ReviewPhotoPicker({
  value,
  onChange,
}: {
  value: PickedPhoto[];
  onChange: (next: PickedPhoto[]) => void;
}) {
  const p = usePalette();
  const c = useT('community');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pick = async () => {
    setError(null);
    const picked = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsMultipleSelection: true,
      selectionLimit: MAX - value.length,
      quality: 0.8,
    });
    if (picked.canceled) return;
    setBusy(true);
    const added: PickedPhoto[] = [];
    for (const asset of picked.assets.slice(0, MAX - value.length)) {
      try {
        const type =
          asset.mimeType && TYPES.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
        const size = await fileSize(asset.uri, asset.fileSize);
        if (!size || size > 8 * 1024 * 1024) throw new Error('size');
        const ticket = await api.catalog.reviewPhotoUpload({
          contentType: type as 'image/jpeg',
          sizeBytes: size,
        });
        const status = await uploadFile(asset.uri, ticket);
        if (status < 200 || status >= 300) throw new Error('upload');
        added.push({ key: ticket.storageKey, uri: asset.uri });
      } catch {
        setError(c('photoFailed'));
      }
    }
    setBusy(false);
    onChange([...value, ...added].slice(0, MAX));
  };

  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {value.map((photo, i) => (
          <View key={photo.key}>
            <Image source={{ uri: photo.uri }} style={{ width: 72, height: 72, borderRadius: 8 }} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={c('removePhoto', { n: i + 1 })}
              onPress={() => onChange(value.filter((x) => x.key !== photo.key))}
              hitSlop={8}
              style={{
                position: 'absolute',
                top: -6,
                right: -6,
                backgroundColor: p.fg,
                borderRadius: 11,
                width: 22,
                height: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Ionicons name="close" size={14} color={p.bg} />
            </Pressable>
          </View>
        ))}
      </View>
      {value.length < MAX ? (
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => void pick()}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}
        >
          <Ionicons name="camera-outline" size={18} color={p.fg} />
          <Text style={{ fontFamily: fonts.bodyMedium }}>
            {busy ? c('photoUploading') : c('addPhotos')}
          </Text>
        </Pressable>
      ) : null}
      {error ? (
        <Text variant="small" tone="error">
          {error}
        </Text>
      ) : null}
    </View>
  );
}
