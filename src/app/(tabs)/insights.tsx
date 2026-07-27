import { useCallback, useEffect, useRef, useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SymbolView } from 'expo-symbols';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useSQLiteContext } from '@/db/provider';
import { useAuthStore } from '@/stores/use-auth-store';
import { findTransactionsByUser } from '@/db/transaction-repo';
import { findAccountsByUser } from '@/db/account-repo';
import { aiInsightQuery, isAIEnabled } from '@/lib/ai-service';
import { useThemeColors } from '@/hooks/use-theme';
import { BottomTabInset, MaxContentWidth, Spacing } from '@/constants/theme';
import { formatCurrency } from '@/lib/format';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  'How much did I spend this month?',
  'What\'s my biggest expense category?',
  'Am I on track for my tax estimate?',
  'Show my income trend over the last 3 months',
  'Can I afford to pay myself $4k this month?',
];

export default function InsightsScreen() {
  const colors = useThemeColors();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlatList>(null);

  useEffect(() => {
    if (!isAIEnabled()) {
      setMessages([{
        id: 'welcome',
        role: 'assistant',
        content: 'AI insights are not yet configured. To enable this feature, set up the AI Edge Function URL in your .env file.\n\nOnce configured, you can ask questions like:\n- "How much did I spend on software this quarter?"\n- "Am I saving enough for taxes?"\n- "What\'s my most profitable client?"',
        timestamp: new Date(),
      }]);
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || !user) return;

    const userMessage: Message = {
      id: `msg_${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Gather financial context
      const [txns, accs] = await Promise.all([
        findTransactionsByUser(db, user.id, { limit: 100 }),
        findAccountsByUser(db, user.id),
      ]);

      const now = new Date();
      const year = now.getFullYear();
      const ytdTxns = txns.filter((t) => {
        const d = new Date(t.date);
        return d.getFullYear() === year;
      });

      const context = {
        ytdIncome: ytdTxns
          .filter((t) => t.amountCents > 0)
          .reduce((sum, t) => sum + t.amountCents, 0),
        ytdExpenses: ytdTxns
          .filter((t) => t.amountCents < 0)
          .reduce((sum, t) => sum + Math.abs(t.amountCents), 0),
        recentTransactions: ytdTxns.slice(0, 20).map((t) => ({
          description: t.note ?? t.categoryName ?? 'Transaction',
          amount: t.amountCents / 100,
          date: t.date,
          category: t.categoryName ?? 'Uncategorized',
        })),
        accounts: accs.map((a) => ({
          name: a.name,
          balance: a.balanceCents / 100,
        })),
      };

      const response = await aiInsightQuery(text.trim(), context);

      const assistantMessage: Message = {
        id: `msg_${Date.now() + 1}`,
        role: 'assistant',
        content: response.answer,
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, assistantMessage]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `msg_${Date.now() + 1}`,
          role: 'assistant',
          content: 'Sorry, I encountered an error processing your question. Please try again.',
          timestamp: new Date(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [db, user]);

  const renderMessage = useCallback(({ item }: { item: Message }) => (
    <View style={[styles.message, item.role === 'user' ? styles.userMessage : styles.assistantMessage]}>
      {item.role === 'assistant' && (
        <View style={[styles.avatar, { backgroundColor: 'rgba(60,135,247,0.15)' }]}>  
          <SymbolView name={{ ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' }} size={14} tintColor={colors.primary} />
        </View>
      )}
      <View style={[styles.bubble, item.role === 'user' ? [styles.userBubble, { backgroundColor: colors.primary }] : [styles.assistantBubble, { backgroundColor: 'rgba(128,128,128,0.1)' }]]}>  
        <ThemedText
          type="default"
          style={{ color: item.role === 'user' ? colors.primaryText : undefined }}>
          {item.content}
        </ThemedText>
      </View>
    </View>
  ), [colors]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
        <View style={styles.header}>
          <ThemedText type="title">Insights</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">AI-powered financial Q{'&'}A</ThemedText>
        </View>

        {messages.length === 0 && (
          <View style={styles.suggestions}>
            <ThemedText type="small" themeColor="textSecondary" style={styles.suggestionsTitle}>
              Try asking:
            </ThemedText>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <Pressable key={i} onPress={() => sendMessage(q)} style={[styles.suggestionChip, { borderColor: colors.divider, backgroundColor: 'rgba(60,135,247,0.05)' }]}>  
                <ThemedText type="small">{q}</ThemedText>
              </Pressable>
            ))}
          </View>
        )}

        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={styles.messageList}
          onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'android' ? 20 : 0}>
          <View style={styles.inputContainer}>
            <TextInput
              style={[styles.input, { borderColor: 'rgba(128,128,128,0.3)', color: colors.text }]}  
              placeholder="Ask about your finances..."
              value={input}
              onChangeText={setInput}
              placeholderTextColor={colors.placeholder}
              editable={!loading}
            />
            <Pressable
              onPress={() => sendMessage(input)}
              style={[styles.sendBtn, { backgroundColor: colors.primary }, (!input.trim() || loading) && { backgroundColor: colors.divider }]}
              disabled={!input.trim() || loading}>
              <SymbolView
                name={{ ios: 'arrow.up.circle.fill', android: 'send', web: 'send' }}
                size={24}
                tintColor={input.trim() && !loading ? colors.primaryText : colors.placeholder}
              />
            </Pressable>
          </View>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
  header: {
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.three,
    paddingBottom: Spacing.two,
  },
  suggestions: {
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
    gap: Spacing.two,
  },
  suggestionsTitle: {
    marginBottom: Spacing.one,
  },
  suggestionChip: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Spacing.three,
    borderWidth: 1,
  },
  messageList: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    flexGrow: 1,
  },
  message: {
    flexDirection: 'row',
    gap: Spacing.one,
  },
  userMessage: {
    justifyContent: 'flex-end',
  },
  assistantMessage: {
    justifyContent: 'flex-start',
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  bubble: {
    maxWidth: '80%',
    padding: Spacing.three,
    borderRadius: Spacing.three,
  },
  userBubble: {
    borderBottomRightRadius: Spacing.half,
  },
  assistantBubble: {
    borderBottomLeftRadius: Spacing.half,
  },
  inputContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.two,
    alignItems: 'center',
  },
  input: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Spacing.three,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.two,
    fontSize: 16,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
