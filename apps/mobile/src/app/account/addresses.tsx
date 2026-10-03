import { errorMessage } from '@nixzora/api-client';
import { type AddressCreate, type SavedAddress, US_STATES } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Alert, Switch, View } from 'react-native';
import { Banner, Button, Card, EmptyState, Field, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { fonts, space } from '@/lib/theme';

type Draft = Omit<AddressCreate, 'country' | 'region'> & { region: string };
const EMPTY: Draft = { fullName: '', line1: '', line2: '', city: '', region: '', postalCode: '' };

function toDraft(a: SavedAddress): Draft {
  return {
    label: a.label ?? '',
    fullName: a.fullName,
    line1: a.line1,
    line2: a.line2 ?? '',
    city: a.city,
    region: a.region,
    postalCode: a.postalCode,
    phone: a.phone ?? '',
    isDefaultShipping: a.isDefaultShipping,
  };
}

function AddressForm({
  initial,
  onSave,
  onCancel,
  saving,
  error,
}: {
  initial: Draft;
  onSave: (draft: Draft) => void;
  onCancel: () => void;
  saving: boolean;
  error: unknown;
}) {
  const [d, setD] = useState<Draft>(initial);
  const set = (key: keyof Draft) => (value: string) => setD((prev) => ({ ...prev, [key]: value }));
  const stateOk = (US_STATES as readonly string[]).includes(d.region.toUpperCase());
  return (
    <View style={{ gap: space.sm }}>
      <Field
        label="Label (optional)"
        value={d.label ?? ''}
        onChangeText={set('label')}
        placeholder="Home, Work…"
        maxLength={40}
      />
      <Field
        label="Full name"
        value={d.fullName}
        onChangeText={set('fullName')}
        autoComplete="name"
      />
      <Field
        label="Street address"
        value={d.line1}
        onChangeText={set('line1')}
        autoComplete="street-address"
      />
      <Field
        label="Apartment, suite (optional)"
        value={d.line2 ?? ''}
        onChangeText={set('line2')}
      />
      <Field
        label="City"
        value={d.city}
        onChangeText={set('city')}
        autoComplete="postal-address-locality"
      />
      <Row style={{ alignItems: 'flex-start' }}>
        <View style={{ flex: 1 }}>
          <Field
            label="State"
            value={d.region}
            onChangeText={(v) => set('region')(v.toUpperCase())}
            autoCapitalize="characters"
            maxLength={2}
            placeholder="MD"
            error={d.region.length === 2 && !stateOk ? 'Use a US state code.' : undefined}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Field
            label="ZIP code"
            value={d.postalCode}
            onChangeText={set('postalCode')}
            keyboardType="number-pad"
            maxLength={10}
            autoComplete="postal-code"
          />
        </View>
      </Row>
      <Field
        label="Phone (optional)"
        value={d.phone ?? ''}
        onChangeText={set('phone')}
        keyboardType="phone-pad"
      />
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ flex: 1 }}>Default delivery address</Text>
        <Switch
          value={d.isDefaultShipping ?? false}
          onValueChange={(v) => setD((prev) => ({ ...prev, isDefaultShipping: v }))}
          accessibilityLabel="Default delivery address"
        />
      </Row>
      {error ? <Banner tone="error">{errorMessage(error)}</Banner> : null}
      <Row>
        <Button
          title="Save address"
          loading={saving}
          disabled={!stateOk}
          onPress={() => onSave(d)}
          style={{ flex: 1 }}
        />
        <Button title="Cancel" tone="ghost" onPress={onCancel} />
      </Row>
    </View>
  );
}

/** The address book: add, edit, remove, choose the default. */
export default function AddressesScreen() {
  const client = useQueryClient();
  const addresses = useQuery({ queryKey: keys.addresses, queryFn: () => api.account.addresses() });
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const refresh = () => {
    void client.invalidateQueries({ queryKey: keys.addresses });
    void client.invalidateQueries({ queryKey: keys.overview });
  };
  const save = useMutation({
    mutationFn: ({ id, draft }: { id: string | 'new'; draft: Draft }) => {
      const body = {
        ...draft,
        region: draft.region.toUpperCase() as AddressCreate['region'],
        country: 'US' as const,
        label: draft.label || undefined,
        line2: draft.line2 || undefined,
        phone: draft.phone || undefined,
      };
      return id === 'new' ? api.me.createAddress(body) : api.me.updateAddress(id, body);
    },
    onSuccess: () => {
      setEditing(null);
      refresh();
    },
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.me.deleteAddress(id),
    onSuccess: refresh,
  });
  const makeDefault = useMutation({
    mutationFn: (id: string) => api.me.updateAddress(id, { isDefaultShipping: true }),
    onSuccess: refresh,
  });

  return (
    <Screen>
      {editing === 'new' ? (
        <Card>
          <Text variant="heading">New address</Text>
          <AddressForm
            initial={EMPTY}
            saving={save.isPending}
            error={save.error}
            onCancel={() => setEditing(null)}
            onSave={(draft) => save.mutate({ id: 'new', draft })}
          />
        </Card>
      ) : (
        <Button
          title="Add an address"
          onPress={() => {
            save.reset();
            setEditing('new');
          }}
        />
      )}
      {addresses.data && !addresses.data.length && editing !== 'new' ? (
        <EmptyState title="No saved addresses" body="Add one and checkout fills it in for you." />
      ) : null}
      {addresses.data?.map((a) => (
        <Card key={a.id}>
          {editing === a.id ? (
            <AddressForm
              initial={toDraft(a)}
              saving={save.isPending}
              error={save.error}
              onCancel={() => setEditing(null)}
              onSave={(draft) => save.mutate({ id: a.id, draft })}
            />
          ) : (
            <>
              <Row style={{ justifyContent: 'space-between' }}>
                <Text style={{ fontFamily: fonts.bodyMedium, flex: 1 }}>
                  {a.label || a.fullName}
                </Text>
                {a.isDefaultShipping ? <Pill label="Default" tone="ok" /> : null}
              </Row>
              <Text muted>
                {a.fullName}
                {'\n'}
                {a.line1}
                {a.line2 ? `\n${a.line2}` : ''}
                {'\n'}
                {a.city}, {a.region} {a.postalCode}
              </Text>
              <Row style={{ flexWrap: 'wrap' }}>
                <Button
                  title="Edit"
                  tone="ghost"
                  onPress={() => {
                    save.reset();
                    setEditing(a.id);
                  }}
                />
                {!a.isDefaultShipping ? (
                  <Button
                    title="Make default"
                    tone="ghost"
                    loading={makeDefault.isPending && makeDefault.variables === a.id}
                    onPress={() => makeDefault.mutate(a.id)}
                  />
                ) : null}
                <Button
                  title="Remove"
                  tone="danger"
                  onPress={() =>
                    Alert.alert('Remove this address?', undefined, [
                      { text: 'Cancel', style: 'cancel' },
                      { text: 'Remove', style: 'destructive', onPress: () => remove.mutate(a.id) },
                    ])
                  }
                />
              </Row>
            </>
          )}
        </Card>
      ))}
    </Screen>
  );
}
