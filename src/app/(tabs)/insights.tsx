import { FlashList, FlashListRef } from "@shopify/flash-list";
import { SymbolView } from "expo-symbols";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { NeumorphicInput, NeumorphicPressable } from "@/components/ui";
import { BottomTabInset, Spacing } from "@/constants/theme";
import { findAccountsByUser } from "@/db/account-repo";
import { useSQLiteContext } from "@/db/provider";
import { findTransactionsByUser } from "@/db/transaction-repo";
import { useThemeColors } from "@/hooks/use-theme";
import { aiInsightQuery, isAIEnabled } from "@/lib/ai-service";
import { useAuthStore } from "@/stores/use-auth-store";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
}

const SUGGESTED_QUESTIONS = [
  "How much did I spend this month?",
  "What's my biggest expense category?",
  "Am I on track for my tax estimate?",
  "Show my income trend over the last 3 months",
  "Can I afford to pay myself $4k this month?",
];

export default function InsightsScreen() {
  const colors = useThemeColors();
  const insets = useSafeAreaInsets();
  const db = useSQLiteContext();
  const user = useAuthStore((state) => state.user);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const flatListRef = useRef<FlashListRef<Message>>(null);

  useEffect(() => {
    if (!isAIEnabled()) {
      setMessages([
        {
          id: "welcome",
          role: "assistant",
          content:
            'AI insights are not yet configured. To enable this feature, set up the AI Edge Function URL in your .env file.\n\nOnce configured, you can ask questions like:\n- "How much did I spend on software this quarter?"\n- "Am I saving enough for taxes?"\n- "What\'s my most profitable client?"',
          timestamp: new Date(),
        },
      ]);
    }
  }, []);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || !user) return;

      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: "user",
        content: text.trim(),
        timestamp: new Date(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setInput("");
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
            description: t.note ?? t.categoryName ?? "Transaction",
            amount: t.amountCents / 100,
            date: t.date,
            category: t.categoryName ?? "Uncategorized",
          })),
          accounts: accs.map((a) => ({
            name: a.name,
            balance: a.balanceCents / 100,
          })),
        };

        const response = await aiInsightQuery(text.trim(), context);

        const assistantMessage: Message = {
          id: `msg_${Date.now() + 1}`,
          role: "assistant",
          content: response.answer,
          timestamp: new Date(),
        };

        setMessages((prev) => [...prev, assistantMessage]);
      } catch {
        setMessages((prev) => [
          ...prev,
          {
            id: `msg_${Date.now() + 1}`,
            role: "assistant",
            content:
              "Sorry, I encountered an error processing your question. Please try again.",
            timestamp: new Date(),
          },
        ]);
      } finally {
        setLoading(false);
      }
    },
    [db, user],
  );

  const renderMessage = useCallback(
    ({ item }: { item: Message }) => (
      <View
        style={[
          styles.message,
          item.role === "user" ? styles.userMessage : styles.assistantMessage,
        ]}
      >
        {item.role === "assistant" && (
          <View
            style={[
              styles.avatar,
              { backgroundColor: "rgba(60,135,247,0.15)" },
            ]}
          >
            <SymbolView
              name={{
                ios: "sparkles",
                android: "auto_awesome",
                web: "auto_awesome",
              }}
              size={14}
              tintColor={colors.primary}
            />
          </View>
        )}
        <View
          style={[
            styles.bubble,
            item.role === "user"
              ? [styles.userBubble, { backgroundColor: colors.primary }]
              : [
                  styles.assistantBubble,
                  { backgroundColor: "rgba(128,128,128,0.1)" },
                ],
          ]}
        >
          <ThemedText
            type="default"
            style={{
              color: item.role === "user" ? colors.primaryText : undefined,
            }}
          >
            {item.content}
          </ThemedText>
        </View>
      </View>
    ),
    [colors],
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.safeArea}>
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
          <ThemedText type="title">Insights</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            AI-powered financial Q{"&"}A
          </ThemedText>
        </View>

        {messages.length === 0 && (
          <View
            style={[
              styles.suggestions,
              {
                paddingLeft: insets.left + Spacing.four,
                paddingRight: insets.right + Spacing.four,
              },
            ]}
          >
            <ThemedText
              type="small"
              themeColor="textSecondary"
              style={styles.suggestionsTitle}
            >
              Try asking:
            </ThemedText>
            {SUGGESTED_QUESTIONS.map((q, i) => (
              <NeumorphicPressable
                key={i}
                onPress={() => sendMessage(q)}
                style={styles.suggestionChip}
              >
                <ThemedText type="small">{q}</ThemedText>
              </NeumorphicPressable>
            ))}
          </View>
        )}

        <FlashList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={[
            styles.messageList,
            {
              paddingLeft: insets.left + Spacing.four,
              paddingRight: insets.right + Spacing.four,
            },
          ]}
          onContentSizeChange={() =>
            flatListRef.current?.scrollToEnd({ animated: true })
          }
        />

        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          keyboardVerticalOffset={Platform.OS === "android" ? 20 : 0}
        >
          <View
            style={[
              styles.inputContainer,
              {
                paddingLeft: insets.left + Spacing.four,
                paddingRight: insets.right + Spacing.four,
                paddingBottom: insets.bottom + BottomTabInset + Spacing.two,
              },
            ]}
          >
            <NeumorphicInput
              containerStyle={styles.inputWrap}
              style={styles.input}
              placeholder="Ask about your finances..."
              value={input}
              onChangeText={setInput}
              editable={!loading}
              rightIcon={
                <Pressable
                  onPress={() => sendMessage(input)}
                  style={[
                    styles.sendBtn,
                    { backgroundColor: colors.primary },
                    (!input.trim() || loading) && {
                      backgroundColor: colors.divider,
                    },
                  ]}
                  disabled={!input.trim() || loading}
                >
                  <SymbolView
                    name={{
                      ios: "arrow.up.circle.fill",
                      android: "send",
                      web: "send",
                    }}
                    size={24}
                    tintColor={
                      input.trim() && !loading
                        ? colors.primaryText
                        : colors.placeholder
                    }
                  />
                </Pressable>
              }
            />
          </View>
        </KeyboardAvoidingView>
      </View>
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
    alignSelf: "flex-start",
  },
  messageList: {
    paddingHorizontal: Spacing.four,
    paddingBottom: Spacing.two,
    gap: Spacing.two,
    flexGrow: 1,
  },
  message: {
    flexDirection: "row",
    gap: Spacing.one,
  },
  userMessage: {
    justifyContent: "flex-end",
  },
  assistantMessage: {
    justifyContent: "flex-start",
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 4,
  },
  bubble: {
    maxWidth: "80%",
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
    flexDirection: "row",
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.two,
    paddingBottom: BottomTabInset + Spacing.two,
    gap: Spacing.two,
    alignItems: "center",
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    fontSize: 16,
    paddingRight: 8,
  },
  sendBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 6,
  },
});
