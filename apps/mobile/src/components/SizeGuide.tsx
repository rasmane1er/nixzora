import Ionicons from '@expo/vector-icons/Ionicons';
import { FIT_MIN_ANSWERS, type ProductDetail } from '@nixzora/validation';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Text } from '@/components/ui';
import { useFormatters } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { READABLE_WIDTH } from '@/lib/layout';
import { brand, fonts, radius, space, usePalette } from '@/lib/theme';

type Guide = NonNullable<ProductDetail['sizeGuide']>;

/**
 * Size & fit guide (p10-26): how reviewers say it fits, and the size chart in a sheet with the
 * fit breakdown. Shown on clothing and shoes, next to the size choice.
 */
export function SizeGuide({ guide }: { guide: Guide }) {
  const t = useT('sizeGuide');
  const f = useFormatters();
  const p = usePalette();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const { fit, chart } = guide;
  if (!chart && !fit.answers) return null;
  const share = (n: number) => (fit.answers ? n / fit.answers : 0);
  const cell = { paddingVertical: space.xs, paddingHorizontal: space.sm, minWidth: 72 };

  return (
    <View style={{ gap: space.xs }}>
      {fit.verdict ? (
        <Text variant="small">
          <Text variant="small" style={{ fontFamily: fonts.bodyBold }}>
            {t(`fit_${fit.verdict}`)}
          </Text>
          {` · ${t(`advice_${fit.verdict}`)} `}
          <Text variant="small" muted>
            {t('fitBased', { count: fit.answers })}
          </Text>
        </Text>
      ) : fit.answers >= FIT_MIN_ANSWERS ? (
        <Text variant="small" muted>
          {t('fitMixed')}
        </Text>
      ) : null}
      <Pressable
        accessibilityRole="button"
        onPress={() => setOpen(true)}
        hitSlop={8}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: space.xs,
          alignSelf: 'flex-start',
        }}
      >
        <Ionicons name="resize-outline" size={16} color={p.fg} />
        <Text variant="small" style={{ textDecorationLine: 'underline' }}>
          {t('open')}
        </Text>
      </Pressable>

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
        supportedOrientations={['portrait', 'landscape']}
      >
        <Pressable
          accessibilityLabel={t('close')}
          onPress={() => setOpen(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' }}
        />
        <View
          accessibilityViewIsModal
          style={{
            position: 'absolute',
            bottom: 0,
            alignSelf: 'center',
            width: '100%',
            maxWidth: READABLE_WIDTH,
            maxHeight: '85%',
            backgroundColor: p.bg,
            borderTopLeftRadius: radius * 2,
            borderTopRightRadius: radius * 2,
            paddingBottom: insets.bottom + space.md,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: space.md,
              borderBottomWidth: 1,
              borderBottomColor: p.line,
            }}
          >
            <Text variant="title" accessibilityRole="header" style={{ flexShrink: 1 }}>
              {chart?.name ?? t('title')}
            </Text>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('close')}
              onPress={() => setOpen(false)}
              hitSlop={10}
            >
              <Ionicons name="close" size={24} color={p.fg} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: space.md, gap: space.md }}>
            {chart ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View style={{ borderWidth: 1, borderColor: p.line, borderRadius: radius }}>
                  <View style={{ flexDirection: 'row', backgroundColor: p.card }}>
                    {[t('size'), ...chart.columns].map((c) => (
                      <Text key={c} variant="small" style={[cell, { fontFamily: fonts.bodyBold }]}>
                        {c}
                      </Text>
                    ))}
                  </View>
                  {chart.rows.map((row) => (
                    <View
                      key={row.size}
                      style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: p.line }}
                    >
                      <Text variant="small" style={[cell, { fontFamily: fonts.bodyBold }]}>
                        {row.size}
                      </Text>
                      {row.values.map((v, i) => (
                        <Text key={i} variant="small" style={cell}>
                          {v}
                        </Text>
                      ))}
                    </View>
                  ))}
                </View>
              </ScrollView>
            ) : (
              <Text muted>{t('noChart')}</Text>
            )}
            {chart?.note ? (
              <Text variant="small" muted>
                {chart.note}
              </Text>
            ) : null}

            <Text variant="label" muted>
              {t('fitTitle')}
            </Text>
            {fit.answers ? (
              <View style={{ gap: space.sm }}>
                {(
                  [
                    ['small', fit.small],
                    ['trueToSize', fit.trueToSize],
                    ['large', fit.large],
                  ] as const
                ).map(([label, n]) => (
                  <View
                    key={label}
                    accessible
                    accessibilityLabel={`${t(label)}: ${f.percent(share(n))}`}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}
                  >
                    <Text variant="small" style={{ width: 96 }}>
                      {t(label)}
                    </Text>
                    <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: p.line }}>
                      <View
                        style={{
                          width: `${share(n) * 100}%`,
                          height: 8,
                          borderRadius: 4,
                          backgroundColor: brand.signal,
                        }}
                      />
                    </View>
                    <Text variant="small" muted style={{ width: 44, textAlign: 'right' }}>
                      {f.percent(share(n))}
                    </Text>
                  </View>
                ))}
                <Text variant="small" muted>
                  {t('fitBased', { count: fit.answers })}
                </Text>
              </View>
            ) : (
              <Text variant="small" muted>
                {t('fitNone')}
              </Text>
            )}
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
