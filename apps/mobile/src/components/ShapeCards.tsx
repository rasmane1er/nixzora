import type {
  ClipCouponView,
  ProductCard as Card,
  SmartRow,
  SponsoredProduct,
} from '@nixzora/validation';
import { Image } from 'expo-image';
import { Children, type ReactNode } from 'react';
import {
  type DimensionValue,
  ScrollView,
  type StyleProp,
  View,
  type ViewStyle,
} from 'react-native';
import { ClipCouponButton } from './ClipCoupon';
import { DEAL_RED, DealTimer } from './DealTimer';
import { SectionHead } from './HomeSections';
import { PressableLink } from './PressableLink';
import { CardAdd } from './ProductCard';
import { Text } from './ui';
import { api } from '@/lib/api';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { useLayout } from '@/lib/layout';
import { brand, cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';
import { visitorId } from '@/lib/visitor';

/**
 * Card shapes (ADR-0061), the same set as the website: quads, a spotlight deal, deal tiles,
 * an Ask card, a price-drop card, buy-again cards, row cards, price tiles and coupon cards.
 */

const PLUS_PURPLE = '#3D2DB8';

function Shape({
  children,
  style,
  width,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  width?: DimensionValue;
}) {
  const p = usePalette();
  return (
    <View
      style={[
        {
          width,
          backgroundColor: p.card,
          borderRadius: radius + 4,
          borderWidth: 1,
          borderColor: p.line,
          padding: space.lg,
          gap: space.md,
        },
        cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
}

function Photo({
  product,
  size,
  background,
}: {
  product: Card;
  size: DimensionValue;
  background?: string;
}) {
  const p = usePalette();
  return (
    <View
      style={{
        width: size,
        aspectRatio: 1,
        borderRadius: 10,
        backgroundColor: background ?? p.photo,
        padding: 6,
      }}
    >
      {product.image ? (
        <Image
          source={{ uri: product.image.url }}
          style={{ flex: 1 }}
          contentFit="contain"
          cachePolicy="disk"
          accessible={false}
        />
      ) : null}
    </View>
  );
}

function Badge({ text, plus }: { text: string; plus?: boolean }) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        backgroundColor: plus ? PLUS_PURPLE : DEAL_RED,
        borderRadius: 6,
        paddingHorizontal: 7,
        paddingVertical: 2,
      }}
    >
      <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodyBold }}>{text}</Text>
    </View>
  );
}

function CardLink({ href, label }: { href: string; label: string }) {
  return (
    <PressableLink href={href as never} accessibilityRole="link" hitSlop={8}>
      <Text tone="signal" style={{ fontFamily: fonts.bodyBold, fontSize: 14 }}>
        {label}
      </Text>
    </PressableLink>
  );
}

/** Cards side by side that swipe, each most of the screen wide. */
export function CardWall({ children }: { children: ReactNode }) {
  const { width } = useLayout();
  const items = Children.toArray(children).filter(Boolean);
  if (!items.length) return null;
  const cardWidth = Math.min(360, Math.round((width - space.lg * 2) * 0.86));
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      snapToInterval={cardWidth + space.md}
      decelerationRate="fast"
      style={{ marginHorizontal: -space.lg }}
      contentContainerStyle={{
        paddingHorizontal: space.lg,
        paddingVertical: 4,
        gap: space.md,
        alignItems: 'stretch',
      }}
    >
      {items.map((child, i) => (
        <View key={i} style={{ width: cardWidth }}>
          {child}
        </View>
      ))}
    </ScrollView>
  );
}

export type QuadItem = {
  href: string;
  product: Card;
  label: string;
  sub?: string;
  badge?: string;
};

/** Four products under one title ("Deals in Kitchen"). */
export function QuadCard({
  title,
  items,
  link,
}: {
  title: string;
  items: QuadItem[];
  link?: { href: string; label: string };
}) {
  if (!items.length) return null;
  return (
    <Shape style={{ flex: 1 }}>
      <Text variant="heading" style={{ fontSize: 19 }}>
        {title}
      </Text>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {items.slice(0, 4).map((item) => (
          <PressableLink
            key={item.product.id}
            href={item.href as never}
            accessibilityRole="link"
            accessibilityLabel={[item.label, item.sub, item.badge].filter(Boolean).join(', ')}
            style={{ width: '48%', gap: 4 }}
          >
            <View>
              <Photo product={item.product} size="100%" />
              {item.badge ? (
                <View style={{ position: 'absolute', left: 6, bottom: 6 }}>
                  <Badge text={item.badge} />
                </View>
              ) : null}
            </View>
            <Text variant="small" numberOfLines={2} style={{ fontSize: 13 }}>
              {item.label}
            </Text>
            {item.sub ? (
              <Text variant="small" muted style={{ fontSize: 12 }}>
                {item.sub}
              </Text>
            ) : null}
          </PressableLink>
        ))}
      </View>
      {link ? <CardLink href={link.href} label={link.label} /> : null}
    </Shape>
  );
}

/** Quad items for deals: the photo, the department and the discount. */
export function useDealQuadItems() {
  const { percent, departmentName } = useFormatters();
  return (products: Card[]): QuadItem[] =>
    products.map((product) => ({
      href: `/p/${product.slug}`,
      product,
      label: departmentName(product.category.slug, product.category.name),
      badge: product.deal ? `−${percent(product.deal.percentOff / 100)}` : undefined,
    }));
}

/** "Keep shopping for": products opened again and again, with how many times. */
export function KeepShopping({ row }: { row: SmartRow }) {
  const t = useT('cards');
  return (
    <QuadCard
      title={t('keepShopping')}
      items={row.products.map((product) => {
        const views = row.details?.[product.id]?.views;
        return {
          href: `/p/${product.slug}`,
          product,
          label: product.title,
          sub: views ? t('viewedTimes', { count: views }) : undefined,
        };
      })}
    />
  );
}

/** One big deal, the one ending soonest, on the dark band. */
export function SpotlightDeal({ product }: { product: Card }) {
  const t = useT('cards');
  const d = useT('deals');
  const { money, percent } = useFormatters();
  const deal = product.deal!;
  return (
    <View
      style={[
        {
          backgroundColor: brand.ink,
          borderRadius: radius + 6,
          padding: space.lg,
          gap: space.md,
        },
        cardShadow,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <Badge text={d(deal.kind === 'LIGHTNING' ? 'badgeLightning' : 'badgeDay')} />
        <Text style={{ color: '#F08A5D', fontFamily: fonts.bodyBold, fontSize: 13 }}>
          {t('endsSoonest')}
        </Text>
      </View>
      <PressableLink
        href={`/p/${product.slug}`}
        accessibilityRole="link"
        accessibilityLabel={product.title}
        style={{ flexDirection: 'row', gap: space.md, alignItems: 'center' }}
      >
        <Photo product={product} size={128} background="#1A2433" />
        <View style={{ flex: 1, gap: 6 }}>
          <Text
            numberOfLines={3}
            style={{ color: '#F6F5F1', fontFamily: fonts.displayMedium, fontSize: 18 }}
          >
            {product.title}
          </Text>
          <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <Text style={{ color: '#F6F5F1', fontFamily: fonts.display, fontSize: 26 }}>
              {money(product.priceFromCents, product.currency)}
            </Text>
            {product.compareAtCents ? (
              <Text style={{ color: '#9BA6B6', textDecorationLine: 'line-through', fontSize: 13 }}>
                {money(product.compareAtCents, product.currency)}
              </Text>
            ) : null}
            <Text style={{ color: '#F08A5D', fontFamily: fonts.bodyBold, fontSize: 13 }}>
              −{percent(deal.percentOff / 100)}
            </Text>
          </View>
          <DealTimer deal={deal} dark />
        </View>
      </PressableLink>
      {product.storeAway ? null : <CardAdd product={product} />}
    </View>
  );
}

/** A compact deal: badge, price, title, countdown and claimed bar. */
export function DealTile({ product, width }: { product: Card; width?: DimensionValue }) {
  const t = useT('cards');
  const { money, percent } = useFormatters();
  const deal = product.deal;
  const plus = deal?.plusOnly === true;
  return (
    <Shape width={width} style={{ padding: space.sm + 2, gap: 6, flex: width ? undefined : 1 }}>
      <PressableLink
        href={`/p/${product.slug}`}
        accessibilityRole="link"
        accessibilityLabel={product.title}
        style={{ gap: 6 }}
      >
        <Photo product={product} size="100%" />
        {deal ? (
          <Badge
            plus={plus}
            text={`−${percent(deal.percentOff / 100)}${plus ? ` · ${t('plusDeal')}` : ''}`}
          />
        ) : null}
        <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
            {money(product.priceFromCents, product.currency)}
          </Text>
          {product.compareAtCents ? (
            <Text
              variant="small"
              muted
              style={{ textDecorationLine: 'line-through', fontSize: 12 }}
            >
              {money(product.compareAtCents, product.currency)}
            </Text>
          ) : null}
        </View>
        <Text variant="small" numberOfLines={2} style={{ fontSize: 13, minHeight: 34 }}>
          {product.title}
        </Text>
      </PressableLink>
      {deal ? <DealTimer deal={deal} /> : null}
    </Shape>
  );
}

/** A question the assistant answers, from what the shopper searched or asked, with its picks. */
export function AskPicksCard({
  subject,
  source,
  products = [],
}: {
  subject: string;
  source: SmartRow['source'];
  products?: Card[];
}) {
  const t = useT('cards');
  const p = usePalette();
  return (
    <View
      style={[
        { flex: 1, backgroundColor: p.ai, borderRadius: radius + 4, padding: space.lg, gap: 12 },
        cardShadow,
      ]}
    >
      <Text
        style={{
          color: '#E6F5F3',
          fontSize: 12,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          fontFamily: fonts.bodyBold,
        }}
      >
        {source === 'assistant'
          ? t('askAssistant')
          : source === 'search'
            ? t('askSearched')
            : t('askTry')}
      </Text>
      <Text style={{ color: '#FFFFFF', fontFamily: fonts.displayMedium, fontSize: 21 }}>
        “{subject}”
      </Text>
      {products.length ? (
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          {products.slice(0, 3).map((product) => (
            <View key={product.id} style={{ width: '31%' }}>
              <Photo product={product} size="100%" background="#E9F4F2" />
            </View>
          ))}
        </View>
      ) : null}
      <View style={{ flex: 1 }} />
      <PressableLink
        href={{ pathname: '/assistant', params: { q: subject } }}
        accessibilityRole="button"
        style={{
          alignSelf: 'flex-start',
          minHeight: 44,
          justifyContent: 'center',
          paddingHorizontal: space.lg,
          borderRadius: 999,
          backgroundColor: '#FFFFFF',
        }}
      >
        <Text style={{ color: '#0F5A56', fontFamily: fonts.bodyBold }}>{t('askCta')}</Text>
      </PressableLink>
    </View>
  );
}

/** A saved product that got cheaper, with the saving in money. */
export function PriceDropCard({ product, wasCents }: { product: Card; wasCents: number }) {
  const t = useT('cards');
  const p = usePalette();
  const { money } = useFormatters();
  return (
    <PressableLink
      href={`/p/${product.slug}`}
      accessibilityRole="link"
      style={{
        flexDirection: 'row',
        gap: space.md,
        alignItems: 'center',
        backgroundColor: p.okBg,
        borderRadius: radius + 4,
        padding: space.md,
      }}
    >
      <Photo product={product} size={88} background={p.card} />
      <View style={{ flex: 1, gap: 3 }}>
        <Text
          style={{
            color: p.okFg,
            fontSize: 11,
            letterSpacing: 1.2,
            textTransform: 'uppercase',
            fontFamily: fonts.bodyBold,
          }}
        >
          {t('priceDropped')}
        </Text>
        <Text variant="small" numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
          {product.title}
        </Text>
        <View style={{ flexDirection: 'row', gap: 8, alignItems: 'baseline' }}>
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 17 }}>
            {money(product.priceFromCents, product.currency)}
          </Text>
          <Text variant="small" muted style={{ textDecorationLine: 'line-through' }}>
            {money(wasCents, product.currency)}
          </Text>
        </View>
        <Text variant="small" tone="ok" style={{ fontFamily: fonts.bodyBold }}>
          {t('youSave', { amount: money(wasCents - product.priceFromCents, product.currency) })}
        </Text>
      </View>
    </PressableLink>
  );
}

/** Things that run out, bought before: when, the price, and one tap to buy again. */
export function BuyAgainShape({ row }: { row: SmartRow }) {
  const t = useT('cards');
  const { money, shortDate } = useFormatters();
  return (
    <Shape style={{ flex: 1 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
        <Text variant="heading" style={{ fontSize: 19 }}>
          {t('buyAgain')}
        </Text>
        <CardLink href="/account/buy-again" label={t('yourOrders')} />
      </View>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: space.sm }}>
        {row.products.slice(0, 2).map((product) => {
          const last = row.details?.[product.id]?.lastBoughtAt;
          return (
            <View key={product.id} style={{ width: '48%', gap: 4 }}>
              <PressableLink
                href={`/p/${product.slug}`}
                accessibilityRole="link"
                accessibilityLabel={product.title}
                style={{ gap: 4 }}
              >
                <Photo product={product} size="100%" />
                <Text variant="small" numberOfLines={1} style={{ fontSize: 13 }}>
                  {product.title}
                </Text>
                {last ? (
                  <Text variant="small" muted style={{ fontSize: 11 }}>
                    {t('lastBought', { date: shortDate(last) })}
                  </Text>
                ) : null}
                <Text style={{ fontFamily: fonts.bodyBold, fontSize: 15 }}>
                  {money(product.priceFromCents, product.currency)}
                </Text>
              </PressableLink>
              <CardAdd product={product} compact label={t('buyAgain')} />
            </View>
          );
        })}
      </View>
    </Shape>
  );
}

/** Photo left, facts right, a round add button: for short lists. */
export function RowCard({ product }: { product: Card }) {
  const tp = useT('product');
  const { money, shortDate } = useFormatters();
  const p = usePalette();
  const rating = product.rating;
  return (
    <Shape style={{ flexDirection: 'row', alignItems: 'center', padding: space.md }}>
      <PressableLink
        href={`/p/${product.slug}`}
        accessibilityRole="link"
        accessibilityLabel={product.title}
        style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.md }}
      >
        <Photo product={product} size={84} />
        <View style={{ flex: 1, gap: 3 }}>
          <Text variant="small" numberOfLines={2} style={{ fontFamily: fonts.bodyMedium }}>
            {product.title}
          </Text>
          {rating && rating.count > 0 && rating.average != null ? (
            <Text style={{ color: '#C77A12', fontSize: 12 }}>
              {'★'.repeat(Math.round(rating.average))}
              {'☆'.repeat(5 - Math.round(rating.average))}{' '}
              <Text variant="small" muted style={{ fontSize: 12 }}>
                ({rating.count})
              </Text>
            </Text>
          ) : null}
          <Text style={{ fontFamily: fonts.bodyBold, fontSize: 16 }}>
            {money(product.priceFromCents, product.currency)}
          </Text>
          {product.delivery && product.inStock ? (
            <Text variant="small" style={{ color: p.okFg, fontFamily: fonts.bodyBold }}>
              {tp('deliveryBy', { date: shortDate(`${product.delivery.latest}T12:00:00Z`) })}
            </Text>
          ) : null}
        </View>
      </PressableLink>
      {product.storeAway ? null : <CardAdd product={product} icon />}
    </Shape>
  );
}

/** A titled list of row cards. */
export function RowCards({ title, products }: { title: string; products: Card[] }) {
  if (!products.length) return null;
  return (
    <View style={{ gap: space.sm }}>
      <SectionHead title={title} />
      {products.map((product) => (
        <RowCard key={product.id} product={product} />
      ))}
    </View>
  );
}

/** Small photo-and-price tiles that swipe; sponsored ones are labelled and record the click. */
export function PriceTiles({
  title,
  products = [],
  sponsored,
}: {
  title: string;
  products?: Card[];
  sponsored?: SponsoredProduct[];
}) {
  const ta = useT('ads');
  const { money } = useFormatters();
  const items: { product: Card; token?: string }[] =
    sponsored ?? products.map((product) => ({ product }));
  if (!items.length) return null;
  return (
    <View style={{ gap: space.sm }} accessibilityRole="list" accessibilityLabel={title}>
      <SectionHead title={title} />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
      >
        {items.map(({ product, token }) => (
          <PressableLink
            key={product.id}
            href={`/p/${product.slug}`}
            accessibilityRole="link"
            accessibilityLabel={
              token ? ta('sponsoredItem', { title: product.title }) : product.title
            }
            onPress={
              token
                ? () =>
                    void visitorId().then((id) => api.ads.click(token, id).catch(() => undefined))
                : undefined
            }
            style={{ width: 104, gap: 4 }}
          >
            <Photo product={product} size={104} />
            <Text style={{ fontFamily: fonts.bodyBold, fontSize: 14 }}>
              {money(product.priceFromCents, product.currency)}
            </Text>
            {token ? (
              <Text variant="small" muted style={{ fontSize: 11 }}>
                {ta('sponsored')}
              </Text>
            ) : null}
          </PressableLink>
        ))}
      </ScrollView>
    </View>
  );
}

/** A dashed coupon: the product and the clip button. */
export function CouponShape({ coupon, width }: { coupon: ClipCouponView; width?: number }) {
  const p = usePalette();
  return (
    <View
      style={{
        width,
        flexDirection: 'row',
        gap: space.sm,
        alignItems: 'center',
        backgroundColor: p.card,
        borderWidth: 2,
        borderStyle: 'dashed',
        borderColor: p.okFg,
        borderRadius: radius + 2,
        padding: space.sm + 2,
      }}
    >
      <PressableLink
        href={`/p/${coupon.product.slug}`}
        accessibilityRole="link"
        accessibilityLabel={coupon.product.title}
      >
        <Photo product={coupon.product} size={60} />
      </PressableLink>
      <View style={{ flex: 1, gap: 4 }}>
        <Text variant="small" numberOfLines={1} style={{ fontSize: 13 }}>
          {coupon.product.title}
        </Text>
        <ClipCouponButton coupon={coupon} />
      </View>
    </View>
  );
}
