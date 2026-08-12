import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import {
  NeumorphicButton,
  NeumorphicCard,
  NeumorphicPressable,
} from "@/components/ui";
import { BottomTabInset, MaxContentWidth, Spacing } from "@/constants/theme";
import DateTimePicker, {
  DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { useSQLiteContext } from "@/db/provider";
import { getPreference } from "@/db/preferences-repo";
import type { Transaction } from "@/db/schema";
import { findTransactionsByUser } from "@/db/transaction-repo";
import { sendTransactionalEmail } from "@/lib/email-service";
import {
  exportLedgerPdf,
  exportLedgerXlsx,
} from "@/lib/export-builders";
import { useTheme } from "@/hooks/use-theme";
import { useAuthStore } from "@/stores/use-auth-store";
import { useFocusEffect, useRouter } from "expo-router";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Alert,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function escapeCsv(value: string): string {
  if (/[",\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatCents(cents: number, currency: string = "USD"): string {
  return (Math.abs(cents) / 100).toLocaleString(undefined, {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

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
    description: `Transactions from 1 Jan ${new Date().getFullYear()} to today.`,
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
// Date-range helpers
// ---------------------------------------------------------------------------

function lastQuarterRange(): { start: string; end: string } {
  const now = new Date();
  const quarter = Math.floor(now.getMonth() / 3);
  const start = new Date(now.getFullYear(), quarter * 3 - 3, 1);
  const end = new Date(now.getFullYear(), quarter * 3, 0);
  return {
    start: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-01`,
    end: `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`,
  };
}

function scopeRange(
  scope: ExportScope,
  custom?: { start: string; end: string },
): { start: string; end: string } | null {
  if (scope === "all") return null;
  if (scope === "this-year") {
    const year = new Date().getFullYear();
    return {
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    };
  }
  if (scope === "last-quarter") return lastQuarterRange();
  return custom ?? null; // custom — explicit start/end from the date pickers
}

// ---------------------------------------------------------------------------
// Selectable Chip
// ---------------------------------------------------------------------------

function Chip({
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
  const db = useSQLiteContext();
  const user = useAuthStore((s) => s.user);

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>("csv");
  const [selectedScope, setSelectedScope] = useState<ExportScope>("all");
  const [isExporting, setIsExporting] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [baseCurrency, setBaseCurrency] = useState("USD");

  // Custom range pickers
  const [customStart, setCustomStart] = useState<string>(() => {
    const d = new Date();
    d.setDate(1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  });
  const [customEnd, setCustomEnd] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [pickerTarget, setPickerTarget] = useState<"start" | "end" | null>(null);

  const customRange = useMemo(
    () =>
      selectedScope === "custom"
        ? { start: customStart, end: customEnd }
        : undefined,
    [selectedScope, customStart, customEnd],
  );

  const handleDateChange = useCallback(
    (event: DateTimePickerEvent, date?: Date) => {
      setPickerTarget(null);
      if (event.type === "dismissed" || !date) return;
      const iso = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
      if (pickerTarget === "start") {
        setCustomStart(iso);
      } else {
        setCustomEnd(iso);
      }
    },
    [pickerTarget],
  );

  useEffect(() => {
    if (!user) return;
    let mounted = true;
    getPreference(db, user.id, "base_currency").then((value) => {
      if (mounted) setBaseCurrency(value);
    });
    return () => {
      mounted = false;
    };
  }, [db, user]);

  // Load real transactions for the selected scope (for the summary)
  useFocusEffect(
    useCallback(() => {
      if (!user) return;
      let active = true;
      (async () => {
        try {
          const range = scopeRange(selectedScope, customRange);
          const txs = await findTransactionsByUser(db, user.id, {
            startDate: range?.start,
            endDate: range?.end,
            limit: 5000,
          });
          if (!active) return;
          setTransactions(txs);
          setLoaded(true);
        } catch (e: unknown) {
          if (e instanceof Error && e.message.includes("closed")) return;
          console.warn("Failed to load transactions for export:", e);
        }
      })();
      return () => {
        active = false;
      };
    }, [db, user, selectedScope, customRange]),
  );

  const buildExportContent = useCallback((): string => {
    const range = scopeRange(selectedScope, customRange);
    const dateRangeLabel =
      selectedScope === "all"
        ? "All Time"
        : range
          ? `${fmtDate(range.start)} – ${fmtDate(range.end)}`
          : "Custom Range";

    if (selectedFormat === "csv") {
      const header = "Date,Amount,Note,Category,Account,Currency";
      const rows = transactions.map((t) =>
        [
          t.date.slice(0, 10),
          (t.amountCents / 100).toFixed(2),
          escapeCsv(t.note ?? ""),
          escapeCsv(t.categoryName ?? "Uncategorized"),
          escapeCsv(t.accountName ?? ""),
          t.currencyCode,
        ].join(","),
      );
      return [header, ...rows].join("\n");
    }

    // Text summary (used for the email copy; XLSX/PDF use real file builders)
    const totalIncome = transactions
      .filter((t) => t.amountCents > 0)
      .reduce((s, t) => s + t.amountCents, 0);
    const totalExpense = transactions
      .filter((t) => t.amountCents < 0)
      .reduce((s, t) => s + -t.amountCents, 0);
    const net = totalIncome - totalExpense;

    const lines = [
      `PaySmooth Ledger Export — ${dateRangeLabel}`,
      `Exported: ${new Date().toLocaleString()}`,
      "",
      `Transactions: ${transactions.length}`,
      `Total Income: ${formatCents(totalIncome, baseCurrency)}`,
      `Total Expenses: ${formatCents(totalExpense, baseCurrency)}`,
      `Net: ${formatCents(net, baseCurrency)}`,
      "",
      "Date,Amount,Note,Category,Account,Currency",
    ];
    for (const t of transactions) {
      lines.push(
        [
          t.date.slice(0, 10),
          (t.amountCents / 100).toFixed(2),
          t.note ?? "",
          t.categoryName ?? "Uncategorized",
          t.accountName ?? "",
          t.currencyCode,
        ].join(","),
      );
    }
    return lines.join("\n");
  }, [selectedFormat, selectedScope, transactions, baseCurrency, customRange]);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const range = scopeRange(selectedScope, customRange);
      const dateRangeLabel =
        selectedScope === "all"
          ? "All Time"
          : range
            ? `${fmtDate(range.start)} – ${fmtDate(range.end)}`
            : "Custom Range";

      if (selectedFormat === "xlsx") {
        await exportLedgerXlsx(
          transactions,
          {
            label: dateRangeLabel,
            start: range?.start ?? null,
            end: range?.end ?? null,
          },
          baseCurrency,
        );
      } else if (selectedFormat === "pdf") {
        await exportLedgerPdf(
          transactions,
          {
            label: dateRangeLabel,
            start: range?.start ?? null,
            end: range?.end ?? null,
          },
          baseCurrency,
        );
      } else {
        const content = buildExportContent();
        await Share.share({
          message: content,
          title: `PaySmooth Ledger Export (${dateRangeLabel})`,
        });
      }

      Alert.alert(
        "Export Complete",
        `Your ledger has been exported as ${selectedFormat.toUpperCase()} for ${dateRangeLabel}.`,
      );
    } catch (e: unknown) {
      const err = e as { message?: string } | null;
      if (err?.message !== "User did not share") {
        Alert.alert("Export Failed", err?.message ?? "Unknown error");
      }
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, buildExportContent, selectedFormat, selectedScope, customRange, transactions, baseCurrency]);

  const [emailing, setEmailing] = useState(false);

  // Email a copy of the export to the signed-in user via Brevo
  // (the edge function sends to the caller's own auth email).
  const handleEmailExport = useCallback(async () => {
    if (!user || emailing) return;
    setEmailing(true);
    try {
      const content = buildExportContent();
      const MAX_BODY = 90_000;
      const truncated = content.length > MAX_BODY;
      await sendTransactionalEmail({
        subject: `PaySmooth ${selectedFormat.toUpperCase()} export — ${new Date().toLocaleDateString()}`,
        text: truncated
          ? `${content.slice(0, MAX_BODY)}\n\n[Truncated — full export is ${(content.length / 1024).toFixed(0)} KB]`
          : content,
        toName: user.email?.split("@")[0] ?? "",
      });
      Alert.alert(
        "Email Sent",
        truncated
          ? "A truncated copy of your export was sent to your email."
          : `A copy of your export was sent to ${user.email}.`,
      );
    } catch (e: any) {
      Alert.alert("Email Failed", e?.message ?? "Could not send the email.");
    } finally {
      setEmailing(false);
    }
  }, [user, emailing, buildExportContent, selectedFormat]);

  // Summary stats from real data
  const totalIncome = transactions
    .filter((t) => t.amountCents > 0)
    .reduce((s, t) => s + t.amountCents, 0);
  const totalExpense = transactions
    .filter((t) => t.amountCents < 0)
    .reduce((s, t) => s + -t.amountCents, 0);
  const firstDate =
    transactions.length > 0
      ? transactions[transactions.length - 1]?.date
      : null;
  const lastDate = transactions.length > 0 ? transactions[0]?.date : null;
  const dateRangeLabel =
    firstDate && lastDate
      ? `${fmtDate(firstDate)} – ${fmtDate(lastDate)}`
      : "No transactions yet";
  const estSizeKB = Math.max(
    1,
    Math.round((buildExportContent().length * 2) / 1024),
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

            {/* Custom range pickers */}
            {selectedScope === "custom" && (
              <View style={styles.customRange}>
                <NeumorphicPressable
                  onPress={() => setPickerTarget("start")}
                  style={styles.datePickerBtn}
                >
                  <View style={styles.datePickerRow}>
                    <SymbolView
                      name={{
                        ios: "calendar",
                        android: "calendar_today",
                        web: "calendar_today",
                      }}
                      size={18}
                      tintColor={theme.primary}
                    />
                    <ThemedText type="default" style={{ fontWeight: "500" }}>
                      Start: {fmtDate(customStart)}
                    </ThemedText>
                  </View>
                </NeumorphicPressable>
                <NeumorphicPressable
                  onPress={() => setPickerTarget("end")}
                  style={styles.datePickerBtn}
                >
                  <View style={styles.datePickerRow}>
                    <SymbolView
                      name={{
                        ios: "calendar",
                        android: "calendar_today",
                        web: "calendar_today",
                      }}
                      size={18}
                      tintColor={theme.primary}
                    />
                    <ThemedText type="default" style={{ fontWeight: "500" }}>
                      End: {fmtDate(customEnd)}
                    </ThemedText>
                  </View>
                </NeumorphicPressable>
              </View>
            )}

            {pickerTarget && (
              <DateTimePicker
                value={
                  new Date(
                    pickerTarget === "start"
                      ? `${customStart}T00:00:00`
                      : `${customEnd}T00:00:00`,
                  )
                }
                mode="date"
                display={Platform.OS === "ios" ? "spinner" : "default"}
                maximumDate={new Date()}
                onChange={handleDateChange}
              />
            )}
          </View>

          {/* Data summary */}
          <NeumorphicCard style={styles.summaryCard}>
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Transactions
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {loaded ? transactions.length : "…"}
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
                {loaded ? dateRangeLabel : "…"}
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
                Income
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {loaded ? formatCents(totalIncome, baseCurrency) : "…"}
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
                Expenses
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: "600" }}>
                {loaded ? formatCents(totalExpense, baseCurrency) : "…"}
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
                {loaded ? `~${estSizeKB} KB` : "…"}
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

          {/* Email a copy */}
          <NeumorphicButton
            variant="secondary"
            onPress={handleEmailExport}
            disabled={!loaded || emailing}
            style={[styles.emailBtn, { opacity: !loaded || emailing ? 0.6 : 1 }]}
          >
            {emailing ? "Sending..." : "Email a copy to me"}
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
              CSV exports a plain text file. XLSX produces a real Excel
              workbook with a Transactions and Summary sheet. PDF produces a
              print-ready report grouped by category with totals.
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
  customRange: {
    flexDirection: "row",
    gap: Spacing.two,
    marginTop: Spacing.two,
  },
  datePickerBtn: {
    flex: 1,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  datePickerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.one,
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
  emailBtn: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.two,
  },
  infoBox: {
    flexDirection: "row",
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: "flex-start",
  },
  infoText: { flex: 1, lineHeight: 18 },
});
