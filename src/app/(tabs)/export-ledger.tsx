import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = "csv" | "xlsx" | "pdf";
type ExportScope = "all" | "this-year" | "last-quarter" | "custom";

interface FormatOption {
  id: ExportFormat;
  label: string;
  icon: React.ComponentProps<typeof SymbolView>["name"];
  description: string;
}

interface ScopeOption {
  id: ExportScope;
  label: string;
  description: string;
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const FORMATS: FormatOption[] = [
  {
    id: "csv",
    label: "CSV",
    icon: { ios: "tablecells", android: "table_chart", web: "table_chart" },
    description:
      "Universal spreadsheet format — open in Excel, Google Sheets, or Numbers.",
  },
  {
    id: "xlsx",
    label: "XLSX (Excel)",
    icon: {
      ios: "doc.richtext",
      android: "description",
      web: "description",
    },
    description: "Formatted Excel workbook with multiple sheets.",
  },
  {
    id: "pdf",
    label: "Tax-Ready PDF",
    icon: { ios: "doc.fill", android: "picture_as_pdf", web: "picture_as_pdf" },
    description: "Audit-ready summary grouped by category, with totals.",
  },
];

const SCOPES: ScopeOption[] = [
  {
    id: "all",
    label: "All Time",
    description: "Every transaction in the ledger.",
  },
  {
    id: "this-year",
    label: "This Year",
    description: "Transactions from 1 Jan 2026 to today.",
  },
  {
    id: "last-quarter",
    label: "Last Quarter",
    description: "Previous tax quarter for quarterly filing.",
  },
  {
    id: "custom",
    label: "Custom Range",
    description: "Pick specific start and end dates.",
  },
];

// ---------------------------------------------------------------------------
// Selectable Chip
// ---------------------------------------------------------------------------

function Chip<T extends string>({
  label,
  selected,
  onSelect,
}: {
  label: string;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  return (
    <NeumorphicPressable
      inset={selected}
      onPress={onSelect}
      style={styles.chip}
    >
      <ThemedText
        type="default"
        style={{
          color: selected ? theme.primary : theme.text,
          fontWeight: selected ? "600" : "400",
        }}
      >
        {label}
      </ThemedText>
    </NeumorphicPressable>
  );
}

// ---------------------------------------------------------------------------
// Format Card
// ---------------------------------------------------------------------------

function FormatCard({
  format,
  selected,
  onSelect,
}: {
  format: FormatOption;
  selected: boolean;
  onSelect: () => void;
}) {
  const theme = useTheme();
  return (
    <NeumorphicPressable
      inset={selected}
      onPress={onSelect}
      style={styles.formatCard}
    >
      <View style={styles.formatTop}>
        <SymbolView name={format.icon} size={24} tintColor={theme.primary} />
        <ThemedText
          type="default"
          style={{ fontWeight: "600", marginLeft: Spacing.two }}
        >
          {format.label}
        </ThemedText>
        {selected && (
          <View
            style={[styles.checkCircle, { backgroundColor: theme.primary }]}
          >
            <SymbolView
              name={{
                ios: "checkmark",
                android: "check",
                web: "check",
              }}
              size={12}
              tintColor={theme.primaryText}
            />
          </View>
        )}
      </View>
      <ThemedText type="small" themeColor="textSecondary">
        {format.description}
      </ThemedText>
    </NeumorphicPressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExportLedgerScreen() {
  const router = useRouter();
  const theme = useTheme();
  const insets = useSafeAreaInsets();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [selectedScope, setSelectedScope] = useState<ExportScope>("all");
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // In production, this would generate the file and share it.
      // For now, simulate a delay and show the share dialog with sample content.
      await new Promise((resolve) => setTimeout(resolve, 800));

      const dateRange =
        selectedScope === "all"
          ? "All Time"
          : selectedScope === "this-year"
            ? "2026"
            : selectedScope === "last-quarter"
              ? "Q2 2026"
              : "Custom Range";

      const sampleCSV = `Date,Amount,Note,Category,Account,Currency
2026-07-15,5000.00,"Client payment - Acme Corp",Client Payment,Checking,USD
2026-07-14,150.00,"AWS hosting",Software,Checking,USD
2026-07-10,3200.00,"Freelance project - Client A",Client Payment,Checking,USD
2026-07-08,42.00,"Domain renewal",Software,Checking,USD
2026-07-05,1200.00,"Consulting retainer",Client Payment,Checking,USD`;

      await Share.share({
        message:
          selectedFormat === "csv"
            ? sampleCSV
            : `PaySmooth Export — ${dateRange}\n\n5 transactions\nTotal Income: $9,400.00\nTotal Expenses: $192.00\nNet: $9,208.00`,
        title: `PaySmooth Ledger Export (${dateRange})`,
      });

      Alert.alert(
        "Export Complete",
        `Your ledger has been exported as ${selectedFormat.toUpperCase()} for ${dateRange}.`,
      );
    } catch (e: any) {
      if (e?.message !== "User did not share") {
        Alert.alert("Export Failed", e?.message ?? "Unknown error");
      }
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, selectedFormat, selectedScope]);

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
            Export Ledger
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
          {/* Format selection */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Export Format
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSub}
            >
              Choose how you want to receive your data.
            </ThemedText>
            {FORMATS.map((fmt) => (
              <FormatCard
                key={fmt.id}
                format={fmt}
                selected={selectedFormat === fmt.id}
                onSelect={() => setSelectedFormat(fmt.id)}
              />
            ))}
          </View>

          {/* Date scope */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Date Range
            </ThemedText>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.sectionSub}
            >
              Select which transactions to include.
            </ThemedText>
            <View style={styles.chipRow}>
              {SCOPES.map((scope) => (
                <Chip
                  key={scope.id}
                  label={scope.label}
                  selected={selectedScope === scope.id}
                  onSelect={() => setSelectedScope(scope.id)}
                />
              ))}
            </View>
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.chipHint}
            >
              {SCOPES.find((s) => s.id === selectedScope)?.description}
            </ThemedText>
          </View>

          {/* Data summary */}
          <NeumorphicCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Transactions
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                247
              </ThemedText>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: theme.divider },
              ]}
            />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Date Range
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {selectedScope === "all"
                  ? "Jan 2024 – Jul 2026"
                  : selectedScope === "this-year"
                    ? "Jan – Jul 2026"
                    : selectedScope === "last-quarter"
                      ? "Apr – Jun 2026"
                      : "Custom"}
              </ThemedText>
            </View>
            <View
              style={[
                styles.summaryDivider,
                { backgroundColor: theme.divider },
              ]}
            />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Estimated Size
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                ~68 KB
              </ThemedText>
            </View>
          </NeumorphicCard>

          {/* Export button */}
          <NeumorphicButton
            variant="primary"
            onPress={handleExport}
            disabled={isExporting}
            style={[styles.exportBtn, { opacity: isExporting ? 0.6 : 1 }]}
          >
            {isExporting
              ? "Preparing Export..."
              : `Export as ${selectedFormat.toUpperCase()}`}
          </NeumorphicButton>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{
                ios: "info.circle",
                android: "info",
                web: "info",
              }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}
            >
              Exported data never leaves your device unless you choose to share
              it. PDF exports include a category-summary page suitable for tax
              preparation.
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
  sectionSub: {
    lineHeight: 18,
  },
  formatCard: {
    padding: Spacing.three,
    gap: Spacing.one,
  },
  formatTop: {
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
  chipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
  },
  chipHint: {
    lineHeight: 18,
  },
  summaryCard: {
    padding: Spacing.three,
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: Spacing.one,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.half,
  },
  exportBtn: {
    paddingVertical: Spacing.three,
    minHeight: 48,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
