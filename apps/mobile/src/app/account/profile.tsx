import { errorMessage } from '@nixzora/api-client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Avatar } from '@/components/Avatar';
import { Banner, Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { session } from '@/lib/session';
import { space } from '@/lib/theme';

const TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/** Edit profile: photo, name and phone. */
export default function ProfileScreen() {
  const client = useQueryClient();
  const profile = useQuery({ queryKey: keys.profile, queryFn: () => api.me.profile() });
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [phone, setPhone] = useState('');

  useEffect(() => {
    if (!profile.data) return;
    setFirst(profile.data.firstName ?? '');
    setLast(profile.data.lastName ?? '');
    setPhone(profile.data.phone ?? '');
  }, [profile.data]);

  const saved = async (next: Awaited<ReturnType<typeof api.me.profile>>) => {
    client.setQueryData(keys.profile, next);
    await client.invalidateQueries({ queryKey: keys.overview });
    await session.refreshUser();
  };

  const save = useMutation({
    mutationFn: () =>
      api.me.updateProfile({
        firstName: first.trim() || null,
        lastName: last.trim() || null,
        phone: phone.trim() || null,
      }),
    onSuccess: saved,
  });

  const photo = useMutation({
    mutationFn: async () => {
      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });
      const asset = picked.canceled ? null : picked.assets[0];
      if (!asset) return null;
      const type = asset.mimeType && TYPES.includes(asset.mimeType) ? asset.mimeType : 'image/jpeg';
      const blob = await (await fetch(asset.uri)).blob();
      if (blob.size > 5 * 1024 * 1024) throw new Error('Photos can be up to 5 MB.');
      const ticket = await api.me.avatarUpload({
        contentType: type as 'image/jpeg',
        sizeBytes: blob.size,
      });
      const put = await fetch(ticket.uploadUrl, {
        method: 'PUT',
        headers: ticket.headers,
        body: blob,
      });
      if (!put.ok) throw new Error('The upload failed. Try again.');
      return api.me.setAvatar(ticket.storageKey);
    },
    onSuccess: (next) => next && saved(next),
  });
  const removePhoto = useMutation({ mutationFn: () => api.me.removeAvatar(), onSuccess: saved });

  const name = [profile.data?.firstName, profile.data?.lastName].filter(Boolean).join(' ');
  return (
    <Screen>
      <Card style={{ alignItems: 'center', gap: space.sm }}>
        <Avatar
          url={profile.data?.avatarUrl}
          name={name}
          email={profile.data?.email ?? ''}
          size={96}
        />
        <Row>
          <Button
            title={profile.data?.avatarUrl ? 'Change photo' : 'Add a photo'}
            tone="ghost"
            loading={photo.isPending}
            onPress={() => photo.mutate()}
          />
          {profile.data?.avatarUrl ? (
            <Button
              title="Remove"
              tone="ghost"
              loading={removePhoto.isPending}
              onPress={() => removePhoto.mutate()}
            />
          ) : null}
        </Row>
        {photo.error ? <Banner tone="error">{errorMessage(photo.error)}</Banner> : null}
      </Card>

      <Card>
        <Text variant="heading">Name and phone</Text>
        <Row style={{ alignItems: 'flex-start' }}>
          <View style={{ flex: 1 }}>
            <Field
              label="First name"
              value={first}
              onChangeText={setFirst}
              autoComplete="given-name"
              maxLength={60}
            />
          </View>
          <View style={{ flex: 1 }}>
            <Field
              label="Last name"
              value={last}
              onChangeText={setLast}
              autoComplete="family-name"
              maxLength={60}
            />
          </View>
        </Row>
        <Field
          label="Mobile number"
          hint="For delivery questions only."
          value={phone}
          onChangeText={setPhone}
          keyboardType="phone-pad"
          autoComplete="tel"
          maxLength={20}
        />
        {save.error ? <Banner tone="error">{errorMessage(save.error)}</Banner> : null}
        {save.isSuccess ? <Banner tone="ok">Saved.</Banner> : null}
        <Button title="Save" loading={save.isPending} onPress={() => save.mutate()} />
      </Card>

      <Card>
        <Text variant="heading">Email</Text>
        <Text>{profile.data?.email}</Text>
        <Text variant="small" muted>
          {profile.data?.emailVerified ? 'Confirmed' : 'Not confirmed yet: check your inbox.'}
        </Text>
      </Card>
    </Screen>
  );
}
