import { MenuList } from '@/components/MenuList';
import { Screen, Text } from '@/components/ui';
import { APP_VERSION, WEB_URL } from '@/lib/config';

/** About NIXZORA and its legal pages; they live on the website and open in the in-app browser. */
export default function PoliciesScreen() {
  return (
    <Screen>
      <MenuList
        title="About"
        items={[
          { icon: 'information-circle-outline', label: 'About NIXZORA', url: `${WEB_URL}/about` },
        ]}
      />
      <MenuList
        title="Policies"
        items={[
          { icon: 'document-text-outline', label: 'Terms & conditions', url: `${WEB_URL}/terms` },
          { icon: 'lock-closed-outline', label: 'Privacy policy', url: `${WEB_URL}/privacy` },
          { icon: 'cube-outline', label: 'Shipping policy', url: `${WEB_URL}/policies/shipping` },
          {
            icon: 'return-down-back-outline',
            label: 'Return policy',
            url: `${WEB_URL}/policies/returns`,
          },
        ]}
      />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        App version {APP_VERSION}
      </Text>
    </Screen>
  );
}
