import Ionicons from '@expo/vector-icons/Ionicons';
import { REVIEW_SORTS, type ReviewSort } from '@nixzora/validation';
import { keepPreviousData, useInfiniteQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { brand, fonts, space, usePalette } from '@/lib/theme';
import { Button, Card, Row, Text } from './ui';

function ReviewStars({ value }: { value: number }) {
  return (
    <Row style={{ gap: 1 }}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Ionicons
          key={n}
          name={value >= n ? 'star' : 'star-outline'}
          size={14}
          color={brand.signal}
        />
      ))}
    </Row>
  );
}

/** A pill that can be selected, for the sort order and star filter. */
function Choice({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const p = usePalette();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
      style={{
        borderRadius: 999,
        borderWidth: 1,
        borderColor: selected ? brand.signal : p.line,
        paddingHorizontal: 12,
        paddingVertical: 6,
        minHeight: 32,
        justifyContent: 'center',
      }}
    >
      <Text variant="small" style={selected ? { fontFamily: fonts.bodyMedium } : undefined}>
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Customer reviews on the product screen: 10 at a time with "Show more", sorted and filtered
 * like on the website. Nothing is shown until the product has an approved review.
 */
export function ProductReviews({ slug }: { slug: string }) {
  const t = useT('productPage');
  const p = usePalette();
  const { shortDate } = useFormatters();
  const [sort, setSort] = useState<ReviewSort>('relevant');
  const [rating, setRating] = useState<number | null>(null);
  const reviews = useInfiniteQuery({
    queryKey: ['reviews', 'product', slug, sort, rating],
    queryFn: ({ pageParam }) =>
      api.catalog.reviews(slug, { page: pageParam, sort, rating: rating ?? undefined }),
    initialPageParam: 1,
    getNextPageParam: (last) => (last.page < last.totalPages ? last.page + 1 : undefined),
    // Keep the list on screen while another sort or star filter loads.
    placeholderData: keepPreviousData,
  });

  const first = reviews.data?.pages[0];
  if (!first || !first.summary.count) return null;
  const items = (reviews.data?.pages ?? []).flatMap((page) => page.reviews);
  const counts = first.summary.distribution;

  return (
    <Card style={{ gap: space.md }}>
      <Text variant="heading">{t('customerReviews')}</Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}>
        {REVIEW_SORTS.map((value) => (
          <Choice
            key={value}
            label={t(`reviewSort_${value}`)}
            selected={sort === value}
            onPress={() => setSort(value)}
          />
        ))}
      </View>
      <View
        accessibilityLabel={t('filterByStars')}
        style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.xs }}
      >
        <Choice label={t('allStars')} selected={rating === null} onPress={() => setRating(null)} />
        {[5, 4, 3, 2, 1].map((star) =>
          counts[star - 1] ? (
            <Choice
              key={star}
              label={t('starChip', { count: star, total: counts[star - 1] ?? 0 })}
              selected={rating === star}
              onPress={() => setRating(star)}
            />
          ) : null,
        )}
      </View>
      <Text variant="small" muted>
        {t('showingReviews', { shown: items.length, total: first.total })}
      </Text>

      {items.map((review) => (
        <View
          key={review.id}
          style={{ gap: 4, borderTopWidth: 1, borderTopColor: p.line, paddingTop: space.sm }}
        >
          <Row style={{ gap: space.sm, alignItems: 'center' }}>
            <ReviewStars value={review.rating} />
            <Text style={{ fontFamily: fonts.bodyMedium, flex: 1 }}>{review.title}</Text>
          </Row>
          <Text variant="small" muted>
            {review.author} · {shortDate(review.createdAt)}
            {review.verifiedPurchase ? ` · ${t('verifiedPurchase')}` : ''}
          </Text>
          <Text>{review.body}</Text>
        </View>
      ))}

      {reviews.isFetching && !reviews.isFetchingNextPage ? <ActivityIndicator /> : null}
      {reviews.hasNextPage ? (
        <Button
          title={reviews.isFetchingNextPage ? t('loadingReviews') : t('showMoreReviews')}
          tone="secondary"
          loading={reviews.isFetchingNextPage}
          onPress={() => reviews.fetchNextPage()}
        />
      ) : null}
    </Card>
  );
}
