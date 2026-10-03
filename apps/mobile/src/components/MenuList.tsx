import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { Pressable, View } from 'react-native';
import { PressableLink } from './PressableLink';
import { Card, Divider, Pill, Row, Text } from './ui';
import { space, usePalette } from '@/lib/theme';

export type MenuItem = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  hint?: string;
  badge?: string;
  /** In-app screen… */
  href?: Href;
  /** …or a page on the website (opens in the in-app browser). */
  url?: string;
  onPress?: () => void;
  tone?: 'danger';
};

function Content({ item }: { item: MenuItem }) {
  const p = usePalette();
  const color = item.tone === 'danger' ? p.errFg : p.fg;
  return (
    <Row style={{ minHeight: 48 }}>
      <Ionicons name={item.icon} size={21} color={color} />
      <View style={{ flex: 1, gap: 1 }}>
        <Text style={{ color }}>{item.label}</Text>
        {item.hint ? (
          <Text variant="small" muted numberOfLines={1}>
            {item.hint}
          </Text>
        ) : null}
      </View>
      {item.badge ? <Pill label={item.badge} tone="warn" /> : null}
      {item.href || item.url ? (
        <Ionicons name={item.url ? 'open-outline' : 'chevron-forward'} size={18} color={p.muted} />
      ) : null}
    </Row>
  );
}

/** A titled group of rows, like the settings lists of iOS and Android. */
export function MenuList({ title, items }: { title?: string; items: MenuItem[] }) {
  return (
    <View style={{ gap: space.xs }}>
      {title ? (
        <Text variant="label" muted style={{ paddingHorizontal: space.xs }}>
          {title}
        </Text>
      ) : null}
      <Card style={{ paddingVertical: 2, gap: 0 }}>
        {items.map((item, i) => (
          <View key={item.label}>
            {i ? <Divider /> : null}
            {item.href ? (
              <PressableLink
                href={item.href}
                accessibilityRole="link"
                style={({ pressed }) => ({ paddingVertical: space.xs, opacity: pressed ? 0.6 : 1 })}
              >
                <Content item={item} />
              </PressableLink>
            ) : (
              <Pressable
                accessibilityRole={item.url ? 'link' : 'button'}
                onPress={() =>
                  item.url ? void WebBrowser.openBrowserAsync(item.url) : item.onPress?.()
                }
                style={({ pressed }) => ({ paddingVertical: space.xs, opacity: pressed ? 0.6 : 1 })}
              >
                <Content item={item} />
              </Pressable>
            )}
          </View>
        ))}
      </Card>
    </View>
  );
}
