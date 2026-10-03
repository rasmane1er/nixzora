import { useWindowDimensions } from 'react-native';

/** Text and forms read best at this width; wider screens centre them. */
export const READABLE_WIDTH = 760;

/**
 * Screen-size facts for layouts that adapt from small phones to iPads and Android tablets:
 * product grids get more columns, the product page goes side by side, forms stay readable.
 */
export function useLayout() {
  const { width, height } = useWindowDimensions();
  const columns = width >= 1100 ? 5 : width >= 840 ? 4 : width >= 560 ? 3 : 2;
  return {
    width,
    height,
    /** A tablet-sized screen (shortest side 600pt or more), in any orientation. */
    isTablet: Math.min(width, height) >= 600,
    /** Room for two panes side by side (tablet, or a large phone in landscape). */
    wide: width >= 840,
    columns,
  };
}
