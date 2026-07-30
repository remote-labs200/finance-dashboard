import { useCallback } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import type { TextStyle } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { Spacing } from '@/constants/theme';
import {
  useUiPrefs,
  useFontScale,
  type FontScaleLevel,
} from '@/stores/use-ui-prefs';

// ── Preview type ─────────────────────────────────────────────────────────

interface PreviewItem {
  type: string;
  text: string;
  fontSize: number;
  fontWeight?: TextStyle['fontWeight'];
  opacity?: number;
}

// ── Font scale options ───────────────────────────────────────────────────

const LEVELS: { value: FontScaleLevel; label: string; description: string; previewSize: number }[] = [
  { value: 'small', label: 'Small', description: 'Compact — fits more content on screen', previewSize: 14 },
  { value: 'medium', label: 'Medium', description: 'Default — balanced readability and density', previewSize: 16 },
  { value: 'large', label: 'Large', description: 'Relaxed — easier reading at a glance', previewSize: 20 },
];

// ── Preview text samples ─────────────────────────────────────────────────

const PREVIEW_TEXTS: PreviewItem[] = [
  { type: 'Headline', text: 'Sample Headline', fontSize: 28, fontWeight: '700' },
  { type: 'Title', text: 'Screen Title Example', fontSize: 24, fontWeight: '600' },
  { type: 'Body', text: 'The quick brown fox jumps over the lazy dog. This is how most text will appear throughout the app.', fontSize: 16 },
  { type: 'Caption', text: '12:30 PM \u00b7 Tax deadline in 14 days', fontSize: 14, opacity: 0.7 },
];

// ── Component ────────────────────────────────────────────────────────────

export default function FontSizeStyleScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { fontScaleLevel, setFontScaleLevel } = useUiPrefs();
  const fontScale = useFontScale();

  const handleSelect = useCallback((level: FontScaleLevel) => {
    setFontScaleLevel(level);
  }, [setFontScaleLevel]);

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
        {/* ── Header ──────────────────────────────────────────────── */}
        <View style={styles.header}>
          <Pressable
            onPress={() => router.back()}
            style={({ pressed }) => [
              styles.backBtn,
              { opacity: pressed ? 0.6 : 1 },
            ]}
          >
            <ThemedText type="default" style={{ fontSize: 22 }}>{'←'}</ThemedText>
          </Pressable>
          <ThemedText type="title" style={{ fontSize: 24 }}>
            Font Size &amp; Style
          </ThemedText>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* ── Scale selector ─────────────────────────────────────── */}
          <ThemedView style={[styles.card, { backgroundColor: theme.card }]}>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: Spacing.three }}>
              Text Size
            </ThemedText>

            {LEVELS.map((level) => {
              const selected = fontScaleLevel === level.value;
              return (
                <Pressable
                  key={level.value}
                  onPress={() => handleSelect(level.value)}
                  style={({ pressed }) => [
                    styles.optionRow,
                    {
                      backgroundColor: pressed
                        ? theme.inputBackground
                        : 'transparent',
                      borderColor: selected ? theme.primary : theme.border,
                    },
                  ]}
                >
                  <View style={styles.optionInfo}>
                    <ThemedText
                      type="default"
                      style={{
                        fontWeight: '600',
                        fontSize: Math.round(level.previewSize * fontScale),
                      }}
                    >
                      {level.label}
                    </ThemedText>
                    <ThemedText type="default" style={{ fontSize: 13, opacity: 0.6, marginTop: 2 }}>
                      {level.description}
                    </ThemedText>
                  </View>
                  {selected && (
                    <ThemedText style={{ color: theme.primary, fontSize: 20 }}>{'✓'}</ThemedText>
                  )}
                </Pressable>
              );
            })}
          </ThemedView>

          {/* ── Live preview ────────────────────────────────────────── */}
          <ThemedView style={[styles.card, { backgroundColor: theme.card }]}>
            <ThemedText type="subtitle" style={{ fontSize: 18, marginBottom: Spacing.three }}>
              Preview
            </ThemedText>
            <ThemedView
              style={[
                styles.previewBox,
                { backgroundColor: theme.background, borderColor: theme.border },
              ]}
            >
              {PREVIEW_TEXTS.map((item, idx) => (
                <View key={idx} style={{ marginBottom: 12 }}>
                  <ThemedText
                    type="default"
                    style={{
                      fontSize: 12,
                      opacity: 0.4,
                      marginBottom: 4,
                      textTransform: 'uppercase',
                      letterSpacing: 1,
                    }}
                  >
                    {item.type}
                  </ThemedText>
                  <ThemedText
                    type="default"
                    style={{
                      fontSize: Math.round(item.fontSize * fontScale),
                      fontWeight: item.fontWeight ?? '400',
                      opacity: item.opacity ?? 1,
                    }}
                  >
                    {item.text}
                  </ThemedText>
                </View>
              ))}
            </ThemedView>
          </ThemedView>

          {/* ── Info footer ──────────────────────────────────────────── */}
          <ThemedView style={[styles.card, { backgroundColor: theme.card }]}>
            <ThemedText type="default" style={{ fontSize: 13, lineHeight: 20, opacity: 0.7 }}>
              Font size changes apply immediately across all screens. Headers, body text, captions, and tab labels all scale proportionally.
            </ThemedText>
          </ThemedView>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safe: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
  },
  backBtn: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: Spacing.three,
    paddingBottom: 40,
  },
  card: {
    borderRadius: 12,
    padding: Spacing.three,
    marginBottom: Spacing.three,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1.5,
    marginBottom: 8,
  },
  optionInfo: {
    flex: 1,
  },
  previewBox: {
    borderRadius: 10,
    padding: 16,
    borderWidth: 1,
  },
});
