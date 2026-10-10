import Ionicons from '@expo/vector-icons/Ionicons';
import { type Translate } from '@nixzora/i18n';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Button, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { useT } from '@/lib/i18n';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

type Faq = { q: string; a: string; link?: { label: string; href: Href } };

type AccountT = Translate<'appAccount'>;
type HelpT = Translate<'help'>;

/** Same questions as the website's help center. */
function sections(t: AccountT, th: HelpT): { title: string; faqs: Faq[] }[] {
  return [
    {
      title: th('sectionOrders'),
      faqs: [
        {
          q: th('faqWhereQ'),
          a: t('faqWhereA'),
          link: { label: t('faqWhereLink'), href: '/orders?filter=open' },
        },
        { q: th('faqDeliveryTimeQ'), a: t('faqDeliveryTimeA') },
        {
          q: th('faqCancelQ'),
          a: t('faqCancelA'),
          link: { label: t('faqCancelLink'), href: '/help/contact?topic=ORDER' },
        },
        { q: th('faqAbroadQ'), a: th('faqAbroadA') },
      ],
    },
    {
      title: th('sectionReturns'),
      faqs: [
        {
          q: th('faqReturnQ'),
          a: t('faqReturnA'),
          link: { label: t('menuReturns'), href: '/account/returns' },
        },
        { q: th('faqRefundQ'), a: th('faqRefundA') },
        { q: th('faqSellersQ'), a: th('faqSellersA') },
      ],
    },
    {
      title: th('sectionPayments'),
      faqs: [
        {
          q: th('faqPaymentQ'),
          a: t('faqPaymentA'),
          link: { label: t('menuPayments'), href: '/account/payments' },
        },
        {
          q: th('faqCouponQ'),
          a: t('faqCouponA'),
          link: { label: t('menuCoupons'), href: '/account/coupons' },
        },
        { q: th('faqTaxQ'), a: th('faqTaxA') },
      ],
    },
    {
      title: th('sectionAccount'),
      faqs: [
        {
          q: th('faqPasswordQ'),
          a: t('faqPasswordA'),
          link: { label: t('faqPasswordLink'), href: '/forgot-password' },
        },
        {
          q: th('faqSafeQ'),
          a: t('faqSafeA'),
          link: { label: t('faqSafeLink'), href: '/account/security' },
        },
        { q: t('faqCloseQ'), a: t('faqCloseA') },
      ],
    },
  ];
}

function Question({ faq }: { faq: Faq }) {
  const p = usePalette();
  const [open, setOpen] = useState(false);
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((o) => !o)}
      >
        <Row style={{ minHeight: 48 }}>
          <Text style={{ flex: 1, fontFamily: fonts.bodyMedium }}>{faq.q}</Text>
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={18} color={p.muted} />
        </Row>
      </Pressable>
      {open ? (
        <View style={{ gap: space.xs, paddingBottom: space.sm }}>
          <Text muted>{faq.a}</Text>
          {faq.link ? (
            <Text
              accessibilityRole="link"
              tone="signal"
              onPress={() => router.push(faq.link!.href)}
              style={{ fontFamily: fonts.bodyMedium }}
            >
              {faq.link.label} →
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export default function HelpScreen() {
  const { status } = useSession();
  const t = useT('appAccount');
  const th = useT('help');
  const tha = useT('helpAgent');
  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text variant="title">{th('heading')}</Text>
        <Text muted>{th('intro')}</Text>
      </View>
      <Button
        title={tha('entry')}
        icon={<Ionicons name="chatbubbles-outline" size={18} color="#FFFFFF" />}
        onPress={() => router.push('/help/chat')}
      />
      <Button
        tone="secondary"
        title={th('contactSupport')}
        onPress={() => router.push('/help/contact')}
      />
      <MenuList
        items={[
          { icon: 'cube-outline', label: th('trackPackage'), href: '/orders?filter=open' },
          {
            icon: 'bug-outline',
            label: th('reportProblem'),
            href: '/help/contact?topic=PROBLEM',
          },
          ...(status === 'signedIn'
            ? [
                {
                  icon: 'chatbubbles-outline' as const,
                  label: t('yourSupportRequests'),
                  href: '/account/support' as Href,
                },
              ]
            : []),
        ]}
      />
      {sections(t, th).map((section) => (
        <View key={section.title} style={{ gap: space.xs }}>
          <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
            {section.title}
          </Text>
          <Card style={{ paddingVertical: space.xs }}>
            {section.faqs.map((faq, i) => (
              <View key={faq.q}>
                {i > 0 ? <Divider /> : null}
                <Question faq={faq} />
              </View>
            ))}
          </Card>
        </View>
      ))}
    </Screen>
  );
}
