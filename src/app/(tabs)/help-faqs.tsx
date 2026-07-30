import { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';

interface FaqSection {
  question: string;
  answer: string;
}

const FAQS: FaqSection[] = [
  {
    question: 'How is my tax calculated?',
    answer: 'SmoothTax uses a rule-based estimation engine that applies federal, state/regional, and self-employment tax brackets based on your configured tax locale. This is an estimate — always consult a qualified tax professional for filing.',
  },
  {
    question: 'What tax deductions can I track?',
    answer: 'Common freelance deductions include: home office (simplified or regular method), business equipment and software, professional development, health insurance premiums, retirement contributions (SEP IRA, Solo 401k), business travel and meals, internet and phone, and mileage.',
  },
  {
    question: 'How does income smoothing work?',
    answer: 'Income smoothing calculates a "safe monthly pay" — a consistent amount you can transfer to your checking account each month. It sets aside tax reserves and builds a dry-month buffer for low-income periods. This prevents the feast-or-famine cycle common in freelance income.',
  },
  {
    question: 'When are quarterly estimated taxes due?',
    answer: 'For the US: Q1 (Apr 15), Q2 (Jun 15), Q3 (Sep 15), Q4 (Jan 15 next year). Deadlines vary by jurisdiction. SmoothTax shows your next deadline on the dashboard and can send reminders.',
  },
  {
    question: 'Is my data encrypted?',
    answer: 'Yes. All local data is encrypted at rest using AES-256. Data in transit to Supabase uses TLS 1.3. You can manage your encryption key in Settings > Privacy & Security > Data Encryption Key.',
  },
  {
    question: 'Can I export my data for my accountant?',
    answer: 'Yes. Go to Account > Integrations & Sync > Export Ledger. You can export as CSV (for spreadsheets), XLSX (Excel), or a tax-ready PDF with category summaries.',
  },
  {
    question: 'How does multi-currency work?',
    answer: 'Set your base currency in Financial Core settings. Add secondary currencies for irregular foreign income. Exchange rates can be auto-fetched or manually overridden. All dashboard values are shown in your base currency.',
  },
  {
    question: 'What happens if I clear app data?',
    answer: 'Your data is backed up to Supabase cloud storage. Sign back in and tap Sync to restore all your accounts, categories, and transactions. Make sure cloud sync is configured and has been run at least once.',
  },
];

export default function HelpFaqsScreen() {
  const router = useRouter();
  const theme = useTheme();
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView edges={['top', 'left', 'right']} style={styles.safe}>
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <SymbolView name={{ ios: 'chevron.left', android: 'arrow_back', web: 'arrow_back' }} size={20} tintColor={theme.primary} />
          </Pressable>
          <ThemedText type="title" style={styles.headerTitle}>Help &amp; Tax FAQs</ThemedText>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <View style={[styles.introCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
            <SymbolView name={{ ios: 'questionmark.circle', android: 'help', web: 'help' }} size={28} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={{ flex: 1, lineHeight: 18 }}>
              Answers to common questions about SmoothTax, freelance taxes, and income smoothing.
            </ThemedText>
          </View>

          {FAQS.map((faq, idx) => {
            const isOpen = expanded === `faq-${idx}`;
            return (
              <Pressable
                key={idx}
                onPress={() => setExpanded(isOpen ? null : `faq-${idx}`)}
                style={[styles.faqCard, { borderColor: theme.cardBorder, backgroundColor: theme.card }]}>
                <View style={styles.faqTop}>
                  <ThemedText type="default" style={{ fontWeight: '500', flex: 1 }}>
                    {faq.question}
                  </ThemedText>
                  <SymbolView
                    name={isOpen ? { ios: 'chevron.up', android: 'expand_less', web: 'expand_less' } : { ios: 'chevron.down', android: 'expand_more', web: 'expand_more' }}
                    size={16}
                    tintColor={theme.placeholder}
                  />
                </View>
                {isOpen && (
                  <ThemedText type="small" themeColor="textSecondary" style={styles.faqAnswer}>
                    {faq.answer}
                  </ThemedText>
                )}
              </Pressable>
            );
          })}

          <View style={styles.infoBox}>
            <SymbolView name={{ ios: 'info.circle', android: 'info', web: 'info' }} size={16} tintColor={theme.primary} />
            <ThemedText type="small" themeColor="textSecondary" style={styles.infoText}>
              Not financial advice. Tax laws vary by jurisdiction. Consult a qualified tax professional for your specific situation.
            </ThemedText>
          </View>

          <View style={{ height: BottomTabInset + Spacing.six }} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safe: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: Spacing.four, paddingTop: Spacing.three, paddingBottom: Spacing.two, gap: Spacing.two },
  headerTitle: { flex: 1 },
  backBtn: { padding: Spacing.one },
  scroll: { paddingHorizontal: Spacing.four, maxWidth: MaxContentWidth, alignSelf: 'center', width: '100%', paddingBottom: Spacing.three },
  introCard: { flexDirection: 'row', padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1, gap: Spacing.two, alignItems: 'center' },
  faqCard: { padding: Spacing.three, borderRadius: Spacing.three, borderWidth: 1 },
  faqTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  faqAnswer: { marginTop: Spacing.two, lineHeight: 20, paddingTop: Spacing.two },
  infoBox: { flexDirection: 'row', gap: Spacing.two, padding: Spacing.three, alignItems: 'flex-start' },
  infoText: { flex: 1, lineHeight: 18 },
});
