import { useCallback, useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ExportFormat = 'csv' | 'xlsx' | 'pdf';
type ExportScope = 'all' | 'this-year' | 'last-quarter' | 'custom';

interface FormatOption {
  id: ExportFormat;
  label: string;
  icon: React.ComponentProps<typeof SymbolView>['name'];
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
    id: 'csv',
    label: 'CSV',
    icon: { ios: 'tablecells', android: 'table_chart', web: 'table_chart' },
    description: 'Universal spreadsheet format — open in Excel, Google Sheets, or Numbers.',
  },
  {
    id: 'xlsx',
    label: 'XLSX (Excel)',
    icon: {
      ios: 'doc.richtext',
      android: 'description',
      web: 'description',
    },
    description: 'Formatted Excel workbook with multiple sheets.',
  },
  {
    id: 'pdf',
    label: 'Tax-Ready PDF',
    icon: { ios: 'doc.fill', android: 'picture_as_pdf', web: 'picture_as_pdf' },
    description: 'Audit-ready summary grouped by category, with totals.',
  },
];

const SCOPES: ScopeOption[] = [
  { id: 'all', label: 'All Time', description: 'Every transaction in the ledger.' },
  { id: 'this-year', label: 'This Year', description: 'Transactions from 1 Jan 2026 to today.' },
  {
    id: 'last-quarter',
    label: 'Last Quarter',
    description: 'Previous tax quarter for quarterly filing.',
  },
  { id: 'custom', label: 'Custom Range', description: 'Pick specific start and end dates.' },
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
    <Pressable
      onPress={onSelect}
      style={[
        styles.chip,
        {
          borderColor: selected ? theme.primary : theme.inputBorder,
          backgroundColor: selected ? `${theme.primary}15` : 'transparent',
        },
      ]}>
      <ThemedText
        type="default"
        style={{
          color: selected ? theme.primary : theme.text,
          fontWeight: selected ? '600' : '400',
        }}>
        {label}
      </ThemedText>
    </Pressable>
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
    <Pressable
      onPress={onSelect}
      style={[
        styles.formatCard,
        {
          borderColor: selected ? theme.primary : theme.cardBorder,
          backgroundColor: selected ? `${theme.primary}08` : theme.card,
        },
      ]}>
      <View style={styles.formatTop}>
        <SymbolView name={format.icon} size={24} tintColor={theme.primary} />
        <ThemedText type="default" style={{ fontWeight: '600', marginLeft: Spacing.two }}>
          {format.label}
        </ThemedText>
        {selected && (
          <View style={[styles.checkCircle, { backgroundColor: theme.primary }]}>
            <SymbolView
              name={{
                ios: 'checkmark',
                android: 'check',
                web: 'check',
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
    </Pressable>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------

export default function ExportLedgerScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('csv');
  const [selectedScope, setSelectedScope] = useState<ExportScope>('all');
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      // In production, this would generate the file and share it.
      // For now, simulate a delay and show the share dialog with sample content.
      await new Promise((resolve) => setTimeout(resolve, 800));

      const dateRange =
        selectedScope === 'all'
          ? 'All Time'
          : selectedScope === 'this-year'
            ? '2026'
            : selectedScope === 'last-quarter'
              ? 'Q2 2026'
              : 'Custom Range';

      const sampleCSV = `Date,Amount,Note,Category,Account,Currency
2026-07-15,5000.00,"Client payment - Acme Corp",Client Payment,Checking,USD
2026-07-14,150.00,"AWS hosting",Software,Checking,USD
2026-07-10,3200.00,"Freelance project - Client A",Client Payment,Checking,USD
2026-07-08,42.00,"Domain renewal",Software,Checking,USD
2026-07-05,1200.00,"Consulting retainer",Client Payment,Checking,USD`;

      await Share.share({
        message:
          selectedFormat === 'csv'
            ? sampleCSV
            : `SmoothTax Export — ${dateRange}\n\n5 transactions\nTotal Income: $9,400.00\nTotal Expenses: $192.00\nNet: $9,208.00`,
        title: `SmoothTax Ledger Export (${dateRange})`,
      });

      Alert.alert(
        'Export Complete',
        `Your ledger has been exported as ${
          selectedFormat.toUpperCase()
        } for ${dateRange}.`,
      );
    } catch (e: any) {
      if (e?.message !== 'User did not share') {
        Alert.alert('Export Failed', e?.message ?? 'Unknown error');
      }
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, selectedFormat, selectedScope]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView
              name={{
                ios: 'chevron.left',
                android: 'arrow_back',
                web: 'arrow_back',
              }}
              size={20}
              tintColor={theme.primary}
            />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>
            Export Ledger
          </ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          {/* Format selection */}
          <View style={styles.section}>
            <ThemedText type="callout" style={styles.sectionTitle}>
              Export Format
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSub}>
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
            <ThemedText type="small" themeColor="textSecondary" style={styles.sectionSub}>
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
            <ThemedText type="small" themeColor="textSecondary" style={styles.chipHint}>
              {SCOPES.find((s) => s.id === selectedScope)?.description}
            </ThemedText>
          </View>

          {/* Data summary */}
          <View
            style={[
              styles.summaryCard,
              { borderColor: theme.cardBorder, backgroundColor: theme.card },
            ]}>
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Transactions
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                247
              </ThemedText>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: theme.divider }]}
            />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Date Range
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                {selectedScope === 'all'
                  ? 'Jan 2024 – Jul 2026'
                  : selectedScope === 'this-year'
                    ? 'Jan – Jul 2026'
                    : selectedScope === 'last-quarter'
                      ? 'Apr – Jun 2026'
                      : 'Custom'}
              </ThemedText>
            </View>
            <View
              style={[styles.summaryDivider, { backgroundColor: theme.divider }]}
            />
            <View style={styles.summaryRow}>
              <ThemedText type="default" themeColor="textSecondary">
                Estimated Size
              </ThemedText>
              <ThemedText type="default" style={{ fontWeight: '600' }}>
                ~68 KB
              </ThemedText>
            </View>
          </View>

          {/* Export button */}
          <Pressable
            onPress={handleExport}
            disabled={isExporting}
            style={[
              styles.exportBtn,
              {
                backgroundColor: isExporting
                  ? theme.inputBorder
                  : theme.primary,
                opacity: isExporting ? 0.6 : 1,
              },
            ]}>
            <SymbolView
              name={{
                ios: 'square.and.arrow.up',
                android: 'share',
                web: 'share',
              }}
              size={18}
              tintColor={theme.primaryText}
            />
            <ThemedText
              type="default"
              style={{ color: theme.primaryText, fontWeight: '600' }}>
              {isExporting ? 'Preparing Export...' : `Export as ${selectedFormat.toUpperCase()}`}
            </ThemedText>
          </Pressable>

          {/* Info */}
          <View style={styles.infoBox}>
            <SymbolView
              name={{
                ios: 'info.circle',
                android: 'info',
                web: 'info',
              }}
              size={16}
              tintColor={theme.primary}
            />
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.infoText}>
              Exported data never leaves your device unless you choose to share
              it. PDF exports include a category-summary page suitable for tax
              preparation.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
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
    flexDirection: 'row',
    alignItems: 'center',
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
    alignSelf: 'center',
    width: '100%',
    gap: Spacing.three,
  },
  section: {
    gap: Spacing.one,
  },
  sectionTitle: {
    fontWeight: '600',
  },
  sectionSub: {
    lineHeight: 18,
  },
  formatCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
    gap: Spacing.one,
  },
  formatTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 'auto',
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one,
    marginTop: Spacing.one,
  },
  chip: {
    paddingVertical: Spacing.one,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  chipHint: {
    lineHeight: 18,
  },
  summaryCard: {
    padding: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: Spacing.one,
  },
  summaryDivider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: Spacing.half,
  },
  exportBtn: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    borderRadius: Spacing.three,
  },
  infoBox: {
    flexDirection: 'row',
    gap: Spacing.two,
    padding: Spacing.three,
    alignItems: 'flex-start',
  },
  infoText: { flex: 1, lineHeight: 18 },
});
