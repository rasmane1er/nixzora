import { errorMessage } from '@nixzora/api-client';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { RefreshControl, View } from 'react-native';
import { PressableLink } from '@/components/PressableLink';
import { Stars } from '@/components/Stars';
import { Banner, Button, Card, EmptyState, Pill, Row, Screen, Text } from '@/components/ui';
import { api } from '@/lib/api';
import { shortDate } from '@/lib/format';
import { keys } from '@/lib/query';
import { fonts, space, usePalette } from '@/lib/theme';

const STATUS = {
  PENDING: { label: 'Being checked', tone: 'warn' },
  APPROVED: { label: 'Published', tone: 'ok' },
  REJECTED: { label: 'Not published', tone: 'error' },
} as const;

/** Products waiting for a review, and the reviews the customer wrote. */
export default function ReviewsScreen() {
  const p = usePalette();
  const reviews = useQuery({ queryKey: keys.reviews, queryFn: () => api.me.reviews() });
  const delivered = useQuery({
    queryKey: keys.orderHistory('delivered-50'),
    queryFn: () => api.me.orderHistory({ filter: 'delivered', pageSize: 50 }),
  });
  const seen = new Set<string>();
  const toReview = (delivered.data?.items ?? [])
    .flatMap((o) => o.lines.filter((l) => l.canReview && l.productSlug))
    .filter((l) => !seen.has(l.productSlug!) && seen.add(l.productSlug!));

  return (
    <Screen
      refreshControl={
        <RefreshControl
          refreshing={reviews.isRefetching}
          onRefresh={() => {
            void reviews.refetch();
            void delivered.refetch();
          }}
        />
      }
    >
      {reviews.error ? <Banner tone="error">{errorMessage(reviews.error)}</Banner> : null}
      {toReview.length ? (
        <View style={{ gap: space.sm }}>
          <Text variant="heading">Waiting for your review</Text>
          {toReview.map((line) => (
            <Card key={line.productSlug}>
              <Row>
                <Image
                  source={{ uri: line.imageUrl ?? undefined }}
                  style={{ width: 56, height: 56, borderRadius: 8, backgroundColor: p.bg }}
                />
                <Text style={{ flex: 1 }} numberOfLines={2}>
                  {line.productTitle}
                </Text>
              </Row>
              <Button
                title="Write a review"
                onPress={() => router.push(`/p/${line.productSlug}`)}
              />
            </Card>
          ))}
        </View>
      ) : null}

      <Text variant="heading">Reviews you wrote</Text>
      {reviews.data && !reviews.data.length ? (
        <EmptyState title="No reviews yet" body="Products you receive show up here to review." />
      ) : null}
      {reviews.data?.map((r) => (
        <Card key={r.id}>
          <Row style={{ justifyContent: 'space-between' }}>
            <Stars average={r.rating} count={1} />
            <Pill label={STATUS[r.status].label} tone={STATUS[r.status].tone} />
          </Row>
          <Text style={{ fontFamily: fonts.bodyMedium }}>{r.title}</Text>
          <Text>{r.body}</Text>
          <PressableLink href={`/p/${r.product.slug}`} accessibilityRole="link">
            <Text variant="small" muted>
              {r.product.title} · {shortDate(r.createdAt)}
              {r.verifiedPurchase ? ' · Verified purchase' : ''}
            </Text>
          </PressableLink>
        </Card>
      ))}
    </Screen>
  );
}
