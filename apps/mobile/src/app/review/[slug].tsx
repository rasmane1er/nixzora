import Ionicons from '@expo/vector-icons/Ionicons';
import { errorMessage } from '@nixzora/api-client';
import { type FitAnswer, FIT_ANSWERS, ReviewCreateSchema } from '@nixzora/validation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable } from 'react-native';
import { type PickedPhoto, ReviewPhotoPicker } from '@/components/ReviewPhotoPicker';
import { Banner, Button, Card, Field, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { useT } from '@/lib/i18n';
import { keys } from '@/lib/query';
import { brand, fonts, space, usePalette } from '@/lib/theme';

/**
 * Write or edit a review, in the app. "Write a review" used to open the product page, which has
 * no review form in the app, so nothing happened. Only for products delivered to the customer.
 */
export default function ReviewScreen() {
  const { slug, title: productTitle } = useLocalSearchParams<{ slug: string; title?: string }>();
  const t = useT('productPage');
  const tc = useT('common');
  const tz = useT('sizeGuide');
  const p = usePalette();
  const client = useQueryClient();
  const mine = useQuery({
    queryKey: ['reviews', 'mine', slug],
    queryFn: () => api.catalog.myReview(slug),
  });
  // Clothing and shoes also ask how it fit (p10-26); the product page has it cached.
  const product = useQuery({
    queryKey: keys.product(slug),
    queryFn: () => api.catalog.product(slug),
    staleTime: 5 * 60_000,
  });
  const sized = Boolean(product.data?.sizeGuide);
  const [fit, setFit] = useState<FitAnswer | null>(null);
  const [rating, setRating] = useState(0);
  const [headline, setHeadline] = useState('');
  const [body, setBody] = useState('');
  const [photos, setPhotos] = useState<PickedPhoto[]>([]);
  const [errors, setErrors] = useState<Partial<Record<'rating' | 'title' | 'body', string>>>({});

  // Editing: start from what the customer wrote last time.
  useEffect(() => {
    const review = mine.data?.review;
    if (!review) return;
    setRating(review.rating);
    setHeadline(review.title);
    setBody(review.body);
    setFit(review.fit ?? null);
  }, [mine.data]);

  const submit = useMutation({
    mutationFn: (input: { rating: number; title: string; body: string }) =>
      api.catalog.submitReview(slug, {
        ...input,
        ...(sized ? { fit } : {}),
        // Only when photos were added here: otherwise an edit keeps the earlier ones.
        ...(photos.length ? { photoKeys: photos.map((photo) => photo.key) } : {}),
      }),
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
        <ReviewPhotoPicker value={photos} onChange={setPhotos} />
      </Card>

      {sized ? (
        <Card>
          <Text>{tz('fitQuestion')}</Text>
          <Row accessibilityRole="radiogroup" style={{ gap: space.sm, flexWrap: 'wrap' }}>
            {[...FIT_ANSWERS, null].map((value) => {
              const active = fit === value;
              const label = value ? tz(`fit_${value}`) : tz('fitSkip');
              return (
                <Pressable
                  key={value ?? 'skip'}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={label}
                  onPress={() => setFit(value)}
                  style={{
                    paddingVertical: space.sm,
                    paddingHorizontal: space.md,
                    borderRadius: 999,
                    borderWidth: 1,
                    borderColor: active ? p.fg : p.line,
                    backgroundColor: active ? p.card : 'transparent',
                  }}
                >
                  <Text
                    variant="small"
                    style={{ fontFamily: active ? fonts.bodyBold : fonts.body }}
                  >
                    {label}
                  </Text>
                </Pressable>
              );
            })}
          </Row>
        </Card>
      ) : null}

      {submit.error ? <Banner tone="error">{errorMessage(submit.error)}</Banner> : null}
      <Button
        title={submit.isPending ? t('sending') : t('submitReview')}
        loading={submit.isPending}
        onPress={send}
      />
    </Screen>
  );
}
