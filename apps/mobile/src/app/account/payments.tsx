import { router } from 'expo-router';
import { Button, Card, Divider, Screen, Text } from '@/components/ui';
import { fonts, space } from '@/lib/theme';
import { View } from 'react-native';

/**
 * NIXZORA does not keep cards: they go into the payment provider's secure sheet at checkout.
 * Same message as the website's Payment methods page.
 */
export default function PaymentsScreen() {
  return (
    <Screen>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">Ways to pay</Text>
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>Credit and debit cards</Text>
          <Text variant="small" muted>
            Visa, Mastercard, American Express and Discover.
          </Text>
        </View>
        <Divider />
        <View style={{ gap: 2 }}>
          <Text style={{ fontFamily: fonts.bodyMedium }}>Apple Pay and Google Pay</Text>
          <Text variant="small" muted>
            Offered at checkout on phones that support them.
          </Text>
        </View>
      </Card>
      <Card style={{ gap: space.sm }}>
        <Text variant="heading">No saved cards, on purpose</Text>
        <Text>
          You enter your card in our payment provider's secure sheet at checkout, each time. Card
          numbers never reach NIXZORA's servers and are not stored in your account.
        </Text>
        <Text variant="small" muted>
          Refunds always go back to the card you paid with.
        </Text>
        <Button
          title="Returns & refunds"
          tone="ghost"
          onPress={() => router.push('/account/returns')}
        />
      </Card>
    </Screen>
  );
}
