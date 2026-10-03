import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import type { OrderView } from '@nixzora/validation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { keys } from '@/lib/query';
import { brand, space } from '@/lib/theme';
import { Button, Field, Text } from './ui';

type Shipment = OrderView['shipments'][number];

/**
 * Rate a delivered seller parcel 1–5, as on the website's order page. The comment goes to the
 * seller and NIXZORA only; the average shows on the seller's products.
 */
export function RateSeller({
  number,
  token,
  shipment,
}: {
  number: string;
  token?: string;
  shipment: Shipment;
}) {
  const queryClient = useQueryClient();
  const current = shipment.rating;
  const [open, setOpen] = useState(false);
  const [stars, setStars] = useState(current?.value ?? 0);
  const [comment, setComment] = useState(current?.comment ?? '');
  const seller = shipment.seller!;
  const save = useMutation({
    mutationFn: () =>
      api.orders.rateSeller(
        number,
        { seller: seller.handle, rating: stars, comment: comment.trim() || undefined },
        token,
      ),
    onSuccess: (order) => {
      queryClient.setQueryData(keys.order(number), order);
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setOpen(false);
    },
  });

  if (!open) {
    return (
      <Button
        tone="ghost"
        title={
          current ? `Your rating: ${current.value} of 5 · Change` : `Rate ${seller.displayName}`
        }
        icon={<Ionicons name={current ? 'star' : 'star-outline'} size={18} color={brand.signal} />}
        onPress={() => setOpen(true)}
      />
    );
  }

  return (
    <View style={{ gap: space.sm }}>
      <Text variant="small" muted>
        How was this seller? Packing, speed and the item matching its listing.
      </Text>
      <View style={{ flexDirection: 'row', gap: space.xs }} accessibilityRole="radiogroup">
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => setStars(n)}
            accessibilityRole="radio"
            accessibilityState={{ checked: stars === n }}
            accessibilityLabel={`${n} ${n === 1 ? 'star' : 'stars'}`}
            hitSlop={6}
          >
            <Ionicons name={n <= stars ? 'star' : 'star-outline'} size={32} color={brand.signal} />
          </Pressable>
        ))}
      </View>
      <Field
        label="Comment for the seller (optional)"
        hint="Not shown publicly."
        value={comment}
        onChangeText={setComment}
        maxLength={1000}
        multiline
      />
      {save.error ? (
        <Text variant="small" tone="error">
          {errorMessage(save.error)}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        <Button
          title={current ? 'Update rating' : 'Send rating'}
          disabled={!stars || save.isPending}
          loading={save.isPending}
          onPress={() => save.mutate()}
        />
        <Button title="Cancel" tone="ghost" onPress={() => setOpen(false)} />
      </View>
    </View>
  );
}
