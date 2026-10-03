import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { MenuList } from '@/components/MenuList';
import { Button, Card, Divider, Row, Screen, Text } from '@/components/ui';
import { useSession } from '@/lib/session';
import { fonts, space, usePalette } from '@/lib/theme';

type Faq = { q: string; a: string; link?: { label: string; href: Href } };

/** Same questions as the website's help center. */
const SECTIONS: { title: string; faqs: Faq[] }[] = [
  {
    title: 'Orders and delivery',
    faqs: [
      {
        q: 'Where is my order?',
        a: 'Open Your orders and choose the order to see tracking. Orders with items from marketplace sellers arrive in more than one parcel, each with its own tracking.',
        link: { label: 'Orders on the way', href: '/orders?filter=open' },
      },
      {
        q: 'How long does delivery take?',
        a: 'Most orders ship within 1–2 business days. Delivery dates from the carrier are estimates.',
      },
      {
        q: 'Can I change or cancel an order?',
        a: 'Until it ships, contact us with the order number and we will cancel it and refund you. Once it has shipped, return it instead.',
        link: { label: 'Contact us', href: '/help/contact?topic=ORDER' },
      },
      {
        q: 'Do you ship outside the United States?',
        a: 'Not yet: we deliver to US addresses only.',
      },
    ],
  },
  {
    title: 'Returns and refunds',
    faqs: [
      {
        q: 'How do I return something?',
        a: 'Within 30 days of delivery, open the order and choose “Return or replace items”.',
        link: { label: 'Returns & refunds', href: '/account/returns' },
      },
      {
        q: 'When do I get my money back?',
        a: 'When the item arrives back with us, we refund the card you paid with. Banks usually show it within 5–10 business days.',
      },
      {
        q: 'Items from marketplace sellers',
        a: 'They follow the same 30-day policy and you return them through NIXZORA, like everything else.',
      },
    ],
  },
  {
    title: 'Payments and prices',
    faqs: [
      {
        q: 'Which payment methods do you take?',
        a: 'Cards, Apple Pay and Google Pay.',
        link: { label: 'Payment methods', href: '/account/payments' },
      },
      {
        q: 'How do I use a coupon?',
        a: 'Enter the code in your cart. One code per order.',
        link: { label: 'Coupons & rewards', href: '/account/coupons' },
      },
      {
        q: 'Do you charge sales tax?',
        a: 'Where the law requires it; the cart shows it before you pay.',
      },
    ],
  },
  {
    title: 'Your account',
    faqs: [
      {
        q: 'I forgot my password',
        a: 'Use “Forgot password” on the sign-in screen.',
        link: { label: 'Reset password', href: '/forgot-password' },
      },
      {
        q: 'How do I keep my account safe?',
        a: 'Turn on two-step verification and review your signed-in devices in Login & security.',
        link: { label: 'Login & security', href: '/account/security' },
      },
      {
        q: 'How do I close my account?',
        a: 'Go to Login & security and choose “Delete account”. Your order history is kept as the law requires.',
      },
    ],
  },
];

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
  return (
    <Screen>
      <View style={{ gap: space.xs }}>
        <Text variant="title">How can we help?</Text>
        <Text muted>Quick answers first. Can't find yours? We reply within one business day.</Text>
      </View>
      <Button title="Contact support" onPress={() => router.push('/help/contact')} />
      <MenuList
        items={[
          { icon: 'cube-outline', label: 'Track a package', href: '/orders?filter=open' },
          {
            icon: 'bug-outline',
            label: 'Report a problem',
            href: '/help/contact?topic=PROBLEM',
          },
          ...(status === 'signedIn'
            ? [
                {
                  icon: 'chatbubbles-outline' as const,
                  label: 'Your support requests',
                  href: '/account/support' as Href,
                },
              ]
            : []),
        ]}
      />
      {SECTIONS.map((section) => (
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
