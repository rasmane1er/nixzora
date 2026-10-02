import { type Href, router } from 'expo-router';
import { Pressable, type PressableProps } from 'react-native';

/**
 * A pressable that navigates. Used instead of <Link asChild> so pressed-state styles
 * (style functions) work the same on iOS, Android and the web preview.
 */
export function PressableLink({
  href,
  replace,
  ...props
}: PressableProps & { href: Href; replace?: boolean }) {
  return (
    <Pressable
      accessibilityRole="link"
      {...props}
      onPress={(event) => {
        props.onPress?.(event);
        if (replace) router.replace(href);
        else router.push(href);
      }}
    />
  );
}
