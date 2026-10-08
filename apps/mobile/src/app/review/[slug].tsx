import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { ReviewCreateSchema } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { Banner, Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { brand, space, usePalette } from '@/lib/theme';

/**
 * Write or edit a review, in the app. "Write a review" used to open the product page, which has
 * no review form in the app, so nothing happened. Only for products delivered to the customer.
 */
export default function ReviewScreen() {
  const { slug, title: productTitle } = useLocalSearchParams<{ slug: string; title?: string }>();
  const t = useT('productPage');
  const tc = useT('common');
  const p = usePalette();
  const client = useQueryClient();
  const mine = useQuery({
    queryKey: ['reviews', 'mine', slug],
    queryFn: () => api.catalog.myReview(slug),
  });
  const [rating, setRating] = useState(0);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<Partial<Record<'rating' | 'title' | 'body', string>>>({});

  // Editing: start from what the customer wrote last time.
  useEffect(() => {
    const review = mine.data?.review;
    if (!review) return;
    setRating(review.rating);
    setHeadline(review.title);
    setBody(review.body);
  }, [mine.data]);

  const submit = useMutation({
    mutationFn: (input: { rating: number; title: string; body: string }) =>
      api.catalog.submitReview(slug, input),
    onSuccess: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: keys.reviews }),
        client.invalidateQueries({ queryKey: ['reviews', 'mine', slug] }),
        client.invalidateQueries({ queryKey: keys.orders }),
      ]);
    },
  });

  const send = () => {
    const parsed = ReviewCreateSchema.safeParse({ rating, title: headline, body });
    if (!parsed.success) {
      const next: typeof errors = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0] as keyof typeof errors;
        next[field] ??= field === 'rating' ? t('rating') : issue.message;
      }
      setErrors(next);
      return;
    }
    setErrors({});
    submit.mutate(parsed.data);
  };

  const existing = mine.data?.review ?? null;
  const heading = existing ? t('editReview') : t('writeReview');
  if (mine.isPending) {
    return (
      <Screen>
        <Stack.Screen options={{ title: heading }} />
        <ActivityIndicator style={{ marginTop: space.xl }} />
      </Screen>
    );
  }
  if (mine.data && !mine.data.canReview) {
    return (
      <Screen>
        <Stack.Screen options={{ title: heading }} />
        {productTitle ? <Text variant="heading">{productTitle}</Text> : null}
        <Banner>{t('reviewAfterDelivery')}</Banner>
        <Button title={tc('back')} onPress={() => router.back()} />
      </Screen>
    );
  }
  if (submit.isSuccess) {
    return (
      <Screen>
        <Stack.Screen options={{ title: heading }} />
        <Banner tone="ok">{t('reviewThanks')}</Banner>
        <Button title={tc('back')} onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: heading }} />
      {productTitle ? <Text variant="heading">{productTitle}</Text> : null}
      {existing?.status === 'PENDING' ? <Banner>{t('reviewPending')}</Banner> : null}
      {existing?.status === 'REJECTED' ? <Banner tone="warn">{t('reviewRejected')}</Banner> : null}

      <Card>
        <Text>{t('rating')}</Text>
        <Row accessibilityRole="radiogroup" style={{ gap: space.sm }}>
          {[1, 2, 3, 4, 5].map((value) => (
            <Pressable
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: rating === value }}
              accessibilityLabel={t('starsLabel', { value })}
              onPress={() => {
                setRating(value);
                setErrors((e) => ({ ...e, rating: undefined }));
              }}
              hitSlop={6}
            >
              <Ionicons
                name={value <= rating ? 'star' : 'star-outline'}
                size={34}
                color={value <= rating ? brand.signal : p.muted}
              />
            </Pressable>
          ))}
        </Row>
        {errors.rating ? (
          <Text variant="small" tone="error">
            {errors.rating}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Field
          label={t('headline')}
          value={headline}
          onChangeText={setHeadline}
          maxLength={120}
          error={errors.title}
        />
        <Field
          label={t('yourReview')}
          hint={t('reviewHint')}
          value={body}
          onChangeText={setBody}
          multiline
          maxLength={5000}
          error={errors.body}
          style={{ minHeight: 140, textAlignVertical: 'top' }}
        />
      </Card>

      {submit.error ? <Banner tone="error">{errorMessage(submit.error)}</Banner> : null}
      <Button
        title={submit.isPending ? t('sending') : t('submitReview')}
        loading={submit.isPending}
        onPress={send}
      />
    </Screen>
  );
}
