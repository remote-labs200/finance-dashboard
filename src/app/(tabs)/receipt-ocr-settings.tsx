import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Toggle row
// ---------------------------------------------------------------------------

function ToggleRow({
  label,
  description,
  value,
  onValueChange,
}: {
  label: string;
  description: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  const theme = useTheme();
  return (
    <View style={styles.toggleRow}>
      <View style={styles.toggleBody}>
        <ThemedText type="default" style={{ fontWeight: "500" }}>
          {label}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary">
          {description}
        </ThemedText>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: theme.inputBorder, true: theme.primary }}
        thumbColor="#fff"
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Compression level selector
// ---------------------------------------------------------------------------

function CompressionLevel({
  label,
  description,
  selected,
  onSelect,
}: {
  label: string;
  description: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  return (
    <NeumorphicPressable
      inset={selected}
      onPress={onSelect}
      style={styles.compCard}
    >
      <View style={styles.compTop}>
        <ThemedText
          type="default"
          style={{
            fontWeight: "600",
            color: selected ? theme.primary : theme.text,
          }}
        >
          {label}
        </ThemedText>
        {selected && (
          <View
            style={[styles.checkCircle, { backgroundColor: theme.primary }]}
          >
            <SymbolView
              name={{ ios: "checkmark", android: "check", web: "check" }}
              size={12}
              tintColor={theme.primaryText}
            />
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {description}
      </ThemedText>
    </NeumorphicPressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ReceiptOcrSettingsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [autoCategorize, setAutoCategorize] = useState(true);
  const [extractDates, setExtractDates] = useState(true);
  const [extractMerchants, setExtractMerchants] = useState(true);
  const [compressImages, setCompressImages] = useState(true);
  const [compressionLevel, setCompressionLevel] = useState<
    "balanced" | "quality" | "max"
  >("balanced");

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safe}>
        {/* Header */}
        <View
          style={[
            styles.header,
            {
              paddingTop: insets.top + Spacing.three,
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: "chevron.left",
                android: "arrow_back",
                web: "arrow_back",
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Receipt OCR Settings
          </ThemedText>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
        >
          {/* Auto-categorization */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Auto-Categorization
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <ToggleRow
                label="Auto-Categorize Receipts"
                description="AI assigns categories based on merchant and amount patterns."
                value={autoCategorize}
                onValueChange={setAutoCategorize}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Extract Dates"
                description="Automatically detect and set purchase dates from receipt text."
                value={extractDates}
                onValueChange={setExtractDates}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Extract Merchants"
                description="Parse merchant names from receipt headers and logos."
                value={extractMerchants}
                onValueChange={setExtractMerchants}
              />
            </NeumorphicCard>
          </View>

          {/* Storage */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Image Storage
            </ThemedText>
            <NeumorphicCard style={styles.card}>
              <ToggleRow
                label="Compress Uploaded Images"
                description="Reduce file size before saving to device storage."
                value={compressImages}
                onValueChange={setCompressImages}
              />
            </NeumorphicCard>

            {compressImages && (
              <View style={styles.compSection}>
                <ThemedText
                  type="default"
                  style={{ fontWeight: "500", marginBottom: Spacing.one }}
                >
                  Compression Level
                </ThemedText>
                <CompressionLevel
                  label="Balanced"
                  description="Good quality at ~60% size reduction. Best for everyday use."
                  selected={compressionLevel === "balanced"}
                  onSelect={() => setCompressionLevel("balanced")}
                />
                <CompressionLevel
                  label="Quality First"
                  description="Minimal compression — preserves text sharpness for OCR accuracy."
                  selected={compressionLevel === "quality"}
                  onSelect={() => setCompressionLevel("quality")}
                />
                <CompressionLevel
                  label="Max Storage Saving"
                  description="Highest compression — suitable for archive-only receipts."
                  selected={compressionLevel === "max"}
                  onSelect={() => setCompressionLevel("max")}
                />
              </View>
            )}
          </View>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{ ios: "info.circle", android: "info", web: "info" }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}
            >
              OCR processing runs on-device when possible. Receipt images are
              encrypted at rest.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </View>
    </ThemedView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
  },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: {
    paddingHorizontal: Spacing.four,
    maxWidth: MaxContentWidth,
    alignSelf: "center",
    width: "100%",
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: "600",
  },
  card: {
    paddingHorizontal: Spacing.three,
  },
  toggleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing.two,
    gap: Spacing.three,
  },
  toggleBody: {
    flex: 1,
    gap: 1,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  compSection: {
    marginTop: Spacing.two,
    gap: Spacing.one,
  },
  compCard: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  compTop: {
    flexDirection: "row",
    alignItems: "center",
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
