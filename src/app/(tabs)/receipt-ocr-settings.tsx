import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicCard, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { getAllPreferences, setPreference } from "@/db/preferences-repo";
import { useSQLiteContext } from "@/db/provider";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type OcrCompressionLevel = "balanced" | "quality" | "max";

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
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);

  const [autoCategorize, setAutoCategorize] = useState(true);
  const [extractDates, setExtractDates] = useState(true);
  const [extractMerchants, setExtractMerchants] = useState(true);
  const [compressImages, setCompressImages] = useState(true);
  const [compressionLevel, setCompressionLevel] =
    useState<OcrCompressionLevel>("balanced");

  // Load saved OCR preferences on focus
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          const prefs = await getAllPreferences(db, user.id);
          if (!active) return;
          setAutoCategorize(prefs.ocr_auto_categorize !== "false");
          setExtractDates(prefs.ocr_extract_dates !== "false");
          setExtractMerchants(prefs.ocr_extract_merchants !== "false");
          setCompressImages(prefs.ocr_compress_images !== "false");
          const level = prefs.ocr_compression_level;
          setCompressionLevel(
            level === "quality" || level === "max" ? level : "balanced",
          );
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("closed")) return;
          console.warn("Failed to load OCR preferences:", e);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user]),
  );

  const savePref = useCallback(
    async (
      key:
        | "ocr_auto_categorize"
        | "ocr_extract_dates"
        | "ocr_extract_merchants"
        | "ocr_compress_images"
        | "ocr_compression_level",
      value: string,
    ) => {
      if (!user) return;
      try {
        await setPreference(db, user.id, key, value);
      } catch (e: unknown) {
        console.warn(`Failed to save ${key}:`, e);
      }
    },
    [db, user],
  );

  const handleAutoCategorize = useCallback(
    (v: boolean) => {
      setAutoCategorize(v);
      savePref("ocr_auto_categorize", v ? "true" : "false");
    },
    [savePref],
  );

  const handleExtractDates = useCallback(
    (v: boolean) => {
      setExtractDates(v);
      savePref("ocr_extract_dates", v ? "true" : "false");
    },
    [savePref],
  );

  const handleExtractMerchants = useCallback(
    (v: boolean) => {
      setExtractMerchants(v);
      savePref("ocr_extract_merchants", v ? "true" : "false");
    },
    [savePref],
  );

  const handleCompressImages = useCallback(
    (v: boolean) => {
      setCompressImages(v);
      savePref("ocr_compress_images", v ? "true" : "false");
    },
    [savePref],
  );

  const handleCompressionLevel = useCallback(
    (level: OcrCompressionLevel) => {
      setCompressionLevel(level);
      savePref("ocr_compression_level", level);
    },
    [savePref],
  );

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
                onValueChange={handleAutoCategorize}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Extract Dates"
                description="Automatically detect and set purchase dates from receipt text."
                value={extractDates}
                onValueChange={handleExtractDates}
              />
              <View
                style={[styles.divider, { backgroundColor: theme.divider }]}
              />
              <ToggleRow
                label="Extract Merchants"
                description="Parse merchant names from receipt headers and logos."
                value={extractMerchants}
                onValueChange={handleExtractMerchants}
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
                onValueChange={handleCompressImages}
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
                  onSelect={() => handleCompressionLevel("balanced")}
                />
                <CompressionLevel
                  label="Quality First"
                  description="Minimal compression — preserves text sharpness for OCR accuracy."
                  selected={compressionLevel === "quality"}
                  onSelect={() => handleCompressionLevel("quality")}
                />
                <CompressionLevel
                  label="Max Storage Saving"
                  description="Highest compression — suitable for archive-only receipts."
                  selected={compressionLevel === "max"}
                  onSelect={() => handleCompressionLevel("max")}
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
