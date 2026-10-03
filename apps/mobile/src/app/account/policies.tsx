import { MenuList } from '@/components/MenuList';
import { Screen, Text } from '@/components/ui';
import { APP_VERSION, WEB_URL } from '@/lib/config';
import { useT } from '@/lib/i18n';

/** About NIXZORA and its legal pages; they live on the website and open in the in-app browser. */
export default function PoliciesScreen() {
  const t = useT('appAccount');
  return (
    <Screen>
      <MenuList
        title={t('policiesAbout')}
        items={[
          { icon: 'information-circle-outline', label: t('aboutNixzora'), url: `${WEB_URL}/about` },
        ]}
      />
      <MenuList
        title={t('policiesTitle')}
        items={[
          { icon: 'document-text-outline', label: t('terms'), url: `${WEB_URL}/terms` },
          { icon: 'lock-closed-outline', label: t('privacyPolicy'), url: `${WEB_URL}/privacy` },
          { icon: 'cube-outline', label: t('shippingPolicy'), url: `${WEB_URL}/policies/shipping` },
          {
            icon: 'return-down-back-outline',
            label: t('returnPolicy'),
            url: `${WEB_URL}/policies/returns`,
          },
        ]}
      />
      <Text variant="small" muted style={{ textAlign: 'center' }}>
        {t('appVersion', { version: APP_VERSION })}
      </Text>
    </Screen>
  );
}
