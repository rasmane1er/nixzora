import Ionicons from '@expo/vector-icons/Ionicons';
import { departmentArtPath, type CategoryNode, type ProductCard } from '@nixzora/validation';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { remaining, DEAL_RED } from '@/components/DealTimer';
import { PressableLink } from '@/components/PressableLink';
import { Text } from '@/components/ui';
import { WEB_URL } from '@/lib/config';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { brand, cardShadow, fonts, radius, space, usePalette } from '@/lib/theme';

/** The home screen's sections in the redesign (ADR-0053). */

type Slide = {
  key: string;
  eyebrow: string;
  title: string;
  cta: string;
  href: string;
  image: number;
};

/** Three promotions that page by swipe, and advance on their own unless motion is reduced. */
export function PromoCarousel({ width }: { width: number }) {
  const t = useT('shopUi');
  const pager = useRef<ScrollView>(null);
  const [index, setIndex] = useState(0);
  const slides: Slide[] = [
    {
      key: 'deals',
      eyebrow: t('slideDealsEyebrow'),
      title: t('slideDealsTitle'),
      cta: t('slideDealsCta'),
      href: '/deals',
      image: require('../../assets/home/hero-home.webp'),
    },
    {
      key: 'plus',
      eyebrow: t('slidePlusEyebrow'),
      title: t('slidePlusTitle'),
      cta: t('slidePlusCta'),
      href: '/plus',
      image: require('../../assets/home/hero-desk.webp'),
    },
    {
      key: 'ask',
      eyebrow: t('slideAskEyebrow'),
      title: t('slideAskTitle'),
      cta: t('slideAskCta'),
      href: '/assistant',
      image: require('../../assets/home/hero-home.webp'),
    },
  ];
  const slideWidth = width - space.lg * 2;

  useEffect(() => {
    let reduce = false;
    void AccessibilityInfo.isReduceMotionEnabled().then((value) => {
      reduce = value;
    });
    const id = setInterval(() => {
      if (reduce) return;
      setIndex((at) => {
        const next = (at + 1) % slides.length;
        pager.current?.scrollTo({ x: next * (slideWidth + space.md), animated: true });
        return next;
      });
    }, 6000);
    return () => clearInterval(id);
  }, [slideWidth, slides.length]);

  const onScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    const at = Math.round(event.nativeEvent.contentOffset.x / (slideWidth + space.md));
    if (at !== index && at >= 0 && at < slides.length) setIndex(at);
  };

  return (
    <View style={{ gap: space.sm }}>
      <ScrollView
        ref={pager}
        horizontal
        showsHorizontalScrollIndicator={false}
        snapToInterval={slideWidth + space.md}
        decelerationRate="fast"
        onMomentumScrollEnd={onScroll}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
      >
        {slides.map((slide, i) => (
          <PressableLink
            key={slide.key}
            href={slide.href as never}
            accessibilityRole="link"
            accessibilityLabel={`${slide.title}. ${slide.cta}. ${t('slideOf', { n: i + 1, count: slides.length })}`}
            style={{
              width: slideWidth,
              height: 188,
              borderRadius: radius + 8,
              overflow: 'hidden',
              backgroundColor: brand.ink,
            }}
          >
            <Image
              source={slide.image}
              style={{
                position: 'absolute',
                right: -30,
                top: 0,
                bottom: 0,
                width: slideWidth * 0.7,
              }}
              contentFit="cover"
              accessible={false}
            />
            <View
              style={{
                position: 'absolute',
                left: 0,
                top: 0,
                bottom: 0,
                width: slideWidth * 0.62,
                backgroundColor: brand.ink,
                opacity: 0.92,
              }}
            />
            <View style={{ padding: space.lg, gap: 6, width: slideWidth * 0.6 }}>
              <Text
                style={{
                  color: '#F08A5D',
                  fontSize: 11,
                  fontFamily: fonts.bodyBold,
                  letterSpacing: 1.4,
                }}
              >
                {slide.eyebrow}
              </Text>
              <Text
                style={{
                  color: '#FFFFFF',
                  fontFamily: fonts.display,
                  fontSize: 22,
                  lineHeight: 26,
                }}
              >
                {slide.title}
              </Text>
              <View
                style={{
                  alignSelf: 'flex-start',
                  marginTop: 4,
                  minHeight: 38,
                  paddingHorizontal: space.lg,
                  borderRadius: 19,
                  backgroundColor: brand.signalStrong,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <Text style={{ color: '#FFFFFF', fontFamily: fonts.bodyBold, fontSize: 14 }}>
                  {slide.cta}
                </Text>
                <Ionicons name="arrow-forward" size={15} color="#FFFFFF" />
              </View>
            </View>
          </PressableLink>
        ))}
      </ScrollView>
      <View accessible={false} style={{ flexDirection: 'row', gap: 6, justifyContent: 'center' }}>
        {slides.map((slide, i) => (
          <View
            key={slide.key}
            style={{
              width: i === index ? 18 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? brand.signalStrong : '#B8B4AA',
            }}
          />
        ))}
      </View>
    </View>
  );
}

/** Round department tiles, Deals first. */
export function CategoryCircles({ departments }: { departments: CategoryNode[] }) {
  const p = usePalette();
  const td = useT('deals');
  const { departmentName } = useFormatters();
  const items = [
    { key: 'deals', label: td('title'), href: '/deals', art: null as string | null, icon: true },
    ...departments.map((d) => ({
      key: d.id,
      label: departmentName(d.slug, d.name),
      href: `/c/${d.slug}`,
      art: departmentArtPath(d.slug),
      icon: false,
    })),
  ];
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={{ marginHorizontal: -space.lg }}
      contentContainerStyle={{ paddingHorizontal: space.lg, gap: space.md }}
    >
      {items.map((item) => (
        <PressableLink
          key={item.key}
          href={item.href as never}
          accessibilityRole="link"
          style={{ width: 72, alignItems: 'center', gap: 6 }}
        >
          <View
            style={{
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: item.icon ? DEAL_RED : p.card,
              borderWidth: item.icon ? 0 : 1,
              borderColor: p.line,
              overflow: 'hidden',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {item.icon ? (
              <Ionicons name="flash" size={28} color="#FFFFFF" />
            ) : item.art ? (
              <Image
                source={{ uri: `${WEB_URL}${item.art}` }}
                style={{ width: 64, height: 64 }}
                contentFit="cover"
                cachePolicy="disk"
                accessible={false}
              />
            ) : null}
          </View>
          <Text
            variant="small"
            numberOfLines={2}
            style={{ textAlign: 'center', fontSize: 12, fontFamily: fonts.bodyMedium }}
          >
            {item.label}
          </Text>
        </PressableLink>
      ))}
    </ScrollView>
  );
}

/** Ask NIXZORA in a compact card: one line to type in, and a few ideas. */
export function AskCard({ prompts }: { prompts: string[] }) {
  const p = usePalette();
  const t = useT('shopUi');
  const th = useT('home');
  return (
    <View
      style={[
        { backgroundColor: p.card, borderRadius: radius + 6, padding: space.md, gap: space.sm },
        cardShadow,
      ]}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
        <View
          style={{
            width: 30,
            height: 30,
            borderRadius: 15,
            backgroundColor: p.errBg,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="sparkles" size={16} color={p.signalText} />
        </View>
        <Text style={{ fontFamily: fonts.display, fontSize: 17 }}>{t('askTitle')}</Text>
        <Text variant="small" muted>
          · {t('askSub')}
        </Text>
      </View>
      <PressableLink
        href="/assistant"
        accessibilityRole="button"
        accessibilityLabel={t('askTitle')}
        style={{
          minHeight: 46,
          borderRadius: 12,
          backgroundColor: p.bg,
          flexDirection: 'row',
          alignItems: 'center',
          paddingLeft: space.md,
          paddingRight: 5,
          gap: space.sm,
        }}
      >
        <Text muted numberOfLines={1} style={{ flex: 1 }}>
          {th('askPlaceholder')}
        </Text>
        <View
          style={{
            width: 36,
            height: 36,
            borderRadius: 18,
            backgroundColor: brand.signalStrong,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
        </View>
      </PressableLink>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
      >
        {prompts.map((prompt) => (
          <PressableLink
            key={prompt}
            href={{ pathname: '/assistant', params: { q: prompt } }}
            accessibilityRole="button"
            style={{
              minHeight: 34,
              justifyContent: 'center',
              paddingHorizontal: space.md,
              borderRadius: 17,
              borderWidth: 1,
              borderColor: p.line,
            }}
          >
            <Text variant="small">{prompt}</Text>
          </PressableLink>
        ))}
      </ScrollView>
    </View>
  );
}

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

/** Today's deals as a rail of compact cards, with the soonest end as a countdown. */
export function DealsRail({ deals }: { deals: ProductCard[] }) {
  const p = usePalette();
  const t = useT('shopUi');
  const td = useT('deals');
  const { money, percent } = useFormatters();
  const now = useNow();
  if (!deals.length) return null;
  const soonest = Math.min(...deals.map((d) => (d.deal ? Date.parse(d.deal.endsAt) : Infinity)));
  const left = soonest - now;
  return (
    <View style={{ gap: space.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 }}>
          <Text variant="heading">{td('railTitle')}</Text>
          {Number.isFinite(left) && left > 0 && left < 48 * 3_600_000 ? (
            <View
              style={{
                backgroundColor: DEAL_RED,
                borderRadius: 6,
                paddingHorizontal: 7,
                paddingVertical: 2,
              }}
            >
              <Text
                style={{
                  color: '#FFFFFF',
                  fontSize: 12,
                  fontFamily: fonts.bodyBold,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {t('endsIn', { time: remaining(left) })}
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable accessibilityRole="link" onPress={() => router.push('/deals')} hitSlop={8}>
          <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
            {t('seeAll')}
          </Text>
        </Pressable>
      </View>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={{ marginHorizontal: -space.lg }}
        contentContainerStyle={{ paddingHorizontal: space.lg, paddingVertical: 4, gap: space.md }}
      >
        {deals.map((product) => {
          const claimed = product.deal?.kind === 'LIGHTNING' ? product.deal.claimedPercent : null;
          return (
            <PressableLink
              key={product.id}
              href={`/p/${product.slug}`}
              accessibilityRole="link"
              accessibilityLabel={product.title}
              style={[
                {
                  width: 152,
                  borderRadius: radius + 4,
                  backgroundColor: p.card,
                  overflow: 'hidden',
                },
                cardShadow,
              ]}
            >
              <View
                style={{
                  height: 124,
                  backgroundColor: p.photo,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {product.image ? (
                  <Image
                    source={{ uri: product.image.url }}
                    style={{ width: 108, height: 108 }}
                    contentFit="contain"
                    cachePolicy="disk"
                    accessible={false}
                  />
                ) : null}
                {product.deal ? (
                  <View
                    style={{
                      position: 'absolute',
                      top: 8,
                      left: 8,
                      backgroundColor: DEAL_RED,
                      borderRadius: 6,
                      paddingHorizontal: 6,
                      paddingVertical: 2,
                    }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodyBold }}>
                      −{percent(product.deal.percentOff / 100)}
                    </Text>
                  </View>
                ) : null}
              </View>
              <View style={{ padding: space.sm + 2, gap: 4 }}>
                <Text
                  variant="small"
                  numberOfLines={2}
                  style={{ minHeight: 34, fontFamily: fonts.bodyMedium }}
                >
                  {product.title}
                </Text>
                <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
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
                {claimed != null ? (
                  <View style={{ gap: 3 }}>
                    <View
                      style={{
                        height: 6,
                        borderRadius: 3,
                        backgroundColor: p.photo,
                        overflow: 'hidden',
                      }}
                    >
                      <View
                        style={{ width: `${claimed}%`, height: 6, backgroundColor: brand.signal }}
                      />
                    </View>
                    <Text variant="small" muted style={{ fontSize: 11 }}>
                      {t('claimed', { percent: percent(claimed / 100) })}
                    </Text>
                  </View>
                ) : null}
              </View>
            </PressableLink>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** The NIXZORA Plus strip, for shoppers who aren't members. */
export function PlusStrip() {
  const t = useT('shopUi');
  const tpl = useT('plus');
  return (
    <PressableLink
      href="/plus"
      accessibilityRole="link"
      style={{
        borderRadius: radius + 6,
        backgroundColor: '#ECEBFF',
        padding: space.md,
        flexDirection: 'row',
        alignItems: 'center',
        gap: space.md,
      }}
    >
      <View
        style={{
          backgroundColor: '#3D2DB8',
          borderRadius: 999,
          paddingHorizontal: 10,
          paddingVertical: 3,
        }}
      >
        <Text style={{ color: '#FFFFFF', fontSize: 12, fontFamily: fonts.bodyBold }}>
          {tpl('badge')}
        </Text>
      </View>
      <Text variant="small" style={{ flex: 1, color: '#24204A' }}>
        {t('plusStrip')}
      </Text>
      <Ionicons name="chevron-forward" size={18} color="#3D2DB8" />
    </PressableLink>
  );
}

/** A section title with "See all". */
export function SectionHead({ title, onSeeAll }: { title: string; onSeeAll?: () => void }) {
  const t = useT('shopUi');
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: space.sm,
      }}
    >
      <Text variant="heading" style={{ flexShrink: 1 }}>
        {title}
      </Text>
      {onSeeAll ? (
        <Pressable accessibilityRole="link" onPress={onSeeAll} hitSlop={8}>
          <Text tone="signal" style={{ fontFamily: fonts.bodyBold }}>
            {t('seeAll')}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
