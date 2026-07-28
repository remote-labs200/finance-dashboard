/**
 * AI Service
 *
 * Provides AI-powered features for the finance dashboard:
 * 1. Auto-categorization of transactions (via Supabase Edge Function)
 * 2. Receipt OCR (extract merchant, amount, date from image)
 * 3. Insights Q&A (natural language questions about finances)
 *
 * All AI calls go through a Supabase Edge Function to keep API keys secure.
 * A local rule-based fallback is available when offline.
 */

import { supabase } from './supabase';

// --- Types ---

export interface CategorizationResult {
  suggestedCategory: string;
  confidence: number;
  reason: string;
}

export interface ReceiptExtraction {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  tax: number | null;
  total: number | null;
  currency: string;
}

export interface InsightResponse {
  answer: string;
  data?: Record<string, unknown>;
  confidence: number;
}

// --- Configuration ---

const AI_EDGE_FUNCTION_URL = process.env.EXPO_PUBLIC_AI_EDGE_FUNCTION_URL;
const AI_ENABLED = !!AI_EDGE_FUNCTION_URL && !!supabase;

// --- Rule-Based Fallback Categorization ---

const CATEGORY_RULES: Array<{ pattern: RegExp; category: string; type: 'income' | 'expense' }> = [
  // Income patterns
  { pattern: /invoice|payment|client|freelance|contract|retainer/i, category: 'Client Payment', type: 'income' },
  { pattern: /salary|payroll|wage/i, category: 'Salary', type: 'income' },
  { pattern: /refund|reimburse/i, category: 'Refund', type: 'income' },
  { pattern: /dividend|interest|investment/i, category: 'Investment Income', type: 'income' },

  // Expense patterns
  { pattern: /office|supplies|stationery|printer|ink/i, category: 'Office Supplies', type: 'expense' },
  { pattern: /software|saas|subscription|license|cloud|hosting|domain/i, category: 'Software & Subscriptions', type: 'expense' },
  { pattern: /travel|flight|hotel|uber|lyft|taxi|gas|fuel|mileage/i, category: 'Travel', type: 'expense' },
  { pattern: /food|lunch|dinner|coffee|restaurant|meal|grocery/i, category: 'Meals & Entertainment', type: 'expense' },
  { pattern: /marketing|advertising|ad|promo|social media|seo/i, category: 'Marketing', type: 'expense' },
  { pattern: /phone|internet|mobile|cellular|broadband/i, category: 'Communications', type: 'expense' },
  { pattern: /rent|lease|cowork|workspace|office space/i, category: 'Rent & Workspace', type: 'expense' },
  { pattern: /insurance|policy|coverage/i, category: 'Insurance', type: 'expense' },
  { pattern: /health|medical|doctor|pharmacy|dental|vision/i, category: 'Health & Medical', type: 'expense' },
  { pattern: /education|course|training|book|tutorial|conference/i, category: 'Education', type: 'expense' },
  { pattern: /tax|irs|filing|accountant|cpa/i, category: 'Tax & Accounting', type: 'expense' },
  { pattern: /bank|fee|charge|interest|loan/i, category: 'Bank Fees', type: 'expense' },
  { pattern: /utility|electric|water|power/i, category: 'Utilities', type: 'expense' },
  { pattern: /personal|clothing|grooming|haircut/i, category: 'Personal', type: 'expense' },
];

export function ruleBasedCategorize(
  description: string,
  existingCategories: string[]
): CategorizationResult {
  const normalizedDesc = description.toLowerCase().trim();

  for (const rule of CATEGORY_RULES) {
    if (rule.pattern.test(normalizedDesc)) {
      const match = existingCategories.find(
        (cat) => cat.toLowerCase() === rule.category.toLowerCase()
      );
      return {
        suggestedCategory: match ?? rule.category,
        confidence: 0.85,
        reason: `Matched pattern: ${rule.pattern.source.substring(0, 30)}...`,
      };
    }
  }

  return {
    suggestedCategory: existingCategories[0] ?? 'Uncategorized',
    confidence: 0.3,
    reason: 'No pattern match, using default category',
  };
}

// --- AI-Powered Functions (Supabase Edge Functions Primary) ---

/**
 * Auto-categorize a transaction using the Supabase AI Edge Function.
 * Falls back to rule-based when offline or AI is unavailable.
 */
export async function aiCategorize(
  description: string,
  amount: number,
  existingCategories: string[]
): Promise<CategorizationResult> {
  // Try Supabase Edge Function first
  if (AI_ENABLED && supabase) {
    try {
      const { data, error } = await supabase.functions.invoke('ai-categorize', {
        body: { description, amount, existingCategories },
      });

      if (!error && data?.category) {
        return {
          suggestedCategory: data.category,
          confidence: data.confidence ?? 0.9,
          reason: data.reason ?? 'AI categorization via Supabase Edge Function',
        };
      }
    } catch {
      // Edge Function unavailable — fall through to rule-based
    }
  }

  // Fallback: rule-based categorization (works offline)
  return ruleBasedCategorize(description, existingCategories);
}

/**
 * Extract receipt data from an image URL using the Supabase AI Edge Function.
 * Returns null when AI is unavailable.
 */
export async function aiExtractReceipt(
  imageUrl: string
): Promise<ReceiptExtraction | null> {
  if (!AI_ENABLED) return null;

  try {
    const { data, error } = await supabase!.functions.invoke('ai-receipt-ocr', {
      body: { imageUrl },
    });

    if (error || !data) return null;

    return {
      merchant: data.merchant ?? null,
      amount: data.amount ?? null,
      date: data.date ?? null,
      items: data.items ?? [],
      tax: data.tax ?? null,
      total: data.total ?? null,
      currency: data.currency ?? 'USD',
    };
  } catch {
    return null;
  }
}

/**
 * Answer a natural language question about the user's finances using the
 * Supabase AI Edge Function.
 */
export async function aiInsightQuery(
  question: string,
  financialContext: {
    ytdIncome: number;
    ytdExpenses: number;
    recentTransactions: Array<{
      description: string;
      amount: number;
      date: string;
      category: string;
    }>;
    accounts: Array<{ name: string; balance: number }>;
  }
): Promise<InsightResponse> {
  if (!AI_ENABLED || !supabase) {
    return {
      answer: 'AI insights require Supabase to be configured with an AI Edge Function. Configure it in Settings.',
      confidence: 0,
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('ai-insights', {
      body: { question, context: financialContext },
    });

    if (error || !data) {
      return {
        answer: 'Unable to process your question. Please try again.',
        confidence: 0,
      };
    }

    return {
      answer: data.answer ?? 'No answer available.',
      data: data.data,
      confidence: data.confidence ?? 0.5,
    };
  } catch {
    return {
      answer: 'AI service is currently unavailable.',
      confidence: 0,
    };
  }
}

/**
 * Check if AI features are available (requires Supabase + Edge Function URL).
 */
export function isAIEnabled(): boolean {
  return AI_ENABLED;
}
