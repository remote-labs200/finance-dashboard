/**
 * AI Insights — Supabase Edge Function
 *
 * Answers natural language questions about the user's finances.
 * Uses a rule-based template engine that works immediately.
 *
 * To upgrade to LLM-powered insights:
 * 1. Set OPENAI_API_KEY in your Supabase Edge Function secrets:
 *    supabase secrets set OPENAI_API_KEY=sk-...
 * 2. The function will use GPT-4o-mini for intelligent financial Q&A.
 */

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';

// ---------------------------------------------------------------------------
// CORS headers
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
interface FinancialContext {
  ytdIncome: number;
  ytdExpenses: number;
  recentTransactions: Array<{
    description: string;
    amount: number;
    date: string;
    category: string;
  }>;
  accounts: Array<{
    name: string;
    balance: number;
  }>;
}

// ---------------------------------------------------------------------------
// Rule-based insight engine (works without any external API)
// ---------------------------------------------------------------------------
function ruleBasedInsight(question: string, context: FinancialContext): { answer: string; confidence: number } {
  const normalized = question.toLowerCase().trim();

  const netIncome = context.ytdIncome - context.ytdExpenses;
  const totalBalance = context.accounts.reduce((sum, a) => sum + a.balance, 0);

  // Income question
  if (normalized.includes('income') || normalized.includes('earn') || normalized.includes('made')) {
    if (normalized.includes('total') || normalized.includes('ytd') || normalized.includes('year')) {
      return {
        answer: `Your year-to-date income is $${context.ytdIncome.toFixed(2)}. You've made $${(context.ytdIncome / (new Date().getMonth() + 1)).toFixed(2)} per month on average.`,
        confidence: 1.0,
      };
    }
    if (normalized.includes('month') || normalized.includes('this month')) {
      const thisMonth = context.recentTransactions
        .filter((t) => t.amount > 0 && t.date.startsWith(new Date().toISOString().slice(0, 7)))
        .reduce((sum, t) => sum + t.amount, 0);
      return {
        answer: `You've earned $${thisMonth.toFixed(2)} this month so far.`,
        confidence: 1.0,
      };
    }
  }

  // Expense question
  if (normalized.includes('expense') || normalized.includes('spend') || normalized.includes('spent') || normalized.includes('cost') || normalized.includes('went')) {
    if (normalized.includes('total') || normalized.includes('ytd') || normalized.includes('year')) {
      return {
        answer: `Your year-to-date expenses are $${context.ytdExpenses.toFixed(2)}. That's $${(context.ytdExpenses / (new Date().getMonth() + 1)).toFixed(2)} per month on average.`,
        confidence: 1.0,
      };
    }
    if (normalized.includes('month') || normalized.includes('this month')) {
      const thisMonth = context.recentTransactions
        .filter((t) => t.amount < 0 && t.date.startsWith(new Date().toISOString().slice(0, 7)))
        .reduce((sum, t) => sum + Math.abs(t.amount), 0);
      return {
        answer: `You've spent $${thisMonth.toFixed(2)} this month so far.`,
        confidence: 1.0,
      };
    }
    if (normalized.includes('category') || normalized.includes('categor')) {
      const byCategory: Record<string, number> = {};
      for (const t of context.recentTransactions.filter((t) => t.amount < 0)) {
        byCategory[t.category] = (byCategory[t.category] || 0) + Math.abs(t.amount);
      }
      const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
      if (sorted.length > 0) {
        const top = sorted.slice(0, 3).map(([cat, amt]) => `${cat} ($${amt.toFixed(2)})`).join(', ');
        return {
          answer: `Your top expense categories: ${top}. Total tracked: $${context.ytdExpenses.toFixed(2)}.`,
          confidence: 1.0,
        };
      }
    }
  }

  // Net / profit question
  if (normalized.includes('net') || normalized.includes('profit') || normalized.includes('left')) {
    return {
      answer: `Your net income is $${netIncome.toFixed(2)} ($${context.ytdIncome.toFixed(2)} income - $${context.ytdExpenses.toFixed(2)} expenses).`,
      confidence: 1.0,
    };
  }

  // Balance / account question
  if (normalized.includes('balance') || normalized.includes('account') || normalized.includes('worth') || normalized.includes('have')) {
    const accountDetails = context.accounts.map((a) => `${a.name}: $${a.balance.toFixed(2)}`).join(', ');
    return {
      answer: `Your total balance across ${context.accounts.length} account(s) is $${totalBalance.toFixed(2)}. Details: ${accountDetails}.`,
      confidence: 1.0,
    };
  }

  // Tax question
  if (normalized.includes('tax') || normalized.includes('irs') || normalized.includes('quarterly')) {
    const estimatedTax = netIncome > 0 ? netIncome * 0.25 : 0;
    return {
      answer: `Based on your YTD net income of $${netIncome.toFixed(2)}, a rough estimated tax liability is ~$${estimatedTax.toFixed(2)} (25% self-employment estimate). Set aside approximately $${(estimatedTax / 4).toFixed(2)} per quarter. Consult a tax professional for accuracy.`,
      confidence: 0.7,
    };
  }

  // Can I afford question
  if (normalized.includes('can i afford') || normalized.includes('can i pay') || normalized.includes('can i spend')) {
    const amountMatch = normalized.match(/\$?(\d+(?:,\d{3})*(?:\.\d{1,2})?)/);
    if (amountMatch) {
      const requested = parseFloat(amountMatch[1].replace(/,/g, ''));
      if (netIncome >= requested) {
        return {
          answer: `Yes, your net income of $${netIncome.toFixed(2)} covers $${requested.toFixed(2)}. After this, you'd have $${(netIncome - requested).toFixed(2)} remaining.`,
          confidence: 0.8,
        };
      } else {
        return {
          answer: `Your current net income is $${netIncome.toFixed(2)}, which is less than $${requested.toFixed(2)}. You may want to wait or draw from savings (total balance: $${totalBalance.toFixed(2)}).`,
          confidence: 0.8,
        };
      }
    }
  }

  // Default: ask for clarification
  return {
    answer: `I understand you're asking about "${question}". I can help with: income/earnings, expenses/spending, net profit, account balances, tax estimates, and affordability. Try rephrasing your question — for example: "How much have I earned this month?" or "What are my top expense categories?"`,
    confidence: 0.5,
  };
}

// ---------------------------------------------------------------------------
// LLM-powered insight (used when OPENAI_API_KEY is set)
// ---------------------------------------------------------------------------
async function llmInsight(
  question: string,
  context: FinancialContext,
  openAiKey: string,
): Promise<{ answer: string; data?: Record<string, unknown>; confidence: number } | null> {
  try {
    const topTransactions = context.recentTransactions
      .slice(0, 20)
      .map((t) => `- ${t.date} | ${t.description} | $${t.amount.toFixed(2)} | ${t.category}`)
      .join('\n');

    const accountSummary = context.accounts
      .map((a) => `- ${a.name}: $${a.balance.toFixed(2)}`)
      .join('\n');

    const prompt = `You are a financial analyst assistant for a freelancer. Answer the user's question based on their financial data.

CONTEXT:
- YTD Income: $${context.ytdIncome.toFixed(2)}
- YTD Expenses: $${context.ytdExpenses.toFixed(2)}
- Net Income: $${(context.ytdIncome - context.ytdExpenses).toFixed(2)}
- Number of Accounts: ${context.accounts.length}

RECENT TRANSACTIONS (top 20):
${topTransactions || '(none)'}

ACCOUNTS:
${accountSummary || '(none)'}

USER QUESTION: "${question}"

Respond with a JSON object:
{
  "answer": "your detailed, helpful response",
  "data": { "any": "relevant structured data to include" },
  "confidence": 0.0–1.0
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 500,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);

    return {
      answer: result.answer || 'No answer available.',
      data: result.data || undefined,
      confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Request handler
// ---------------------------------------------------------------------------
serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { question, context } = await req.json();

    if (!question || typeof question !== 'string') {
      return new Response(
        JSON.stringify({ error: 'question is required and must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    if (!context || typeof context !== 'object') {
      return new Response(
        JSON.stringify({ error: 'financialContext is required and must be an object' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    const ctx: FinancialContext = {
      ytdIncome: context.ytdIncome ?? 0,
      ytdExpenses: context.ytdExpenses ?? 0,
      recentTransactions: context.recentTransactions ?? [],
      accounts: context.accounts ?? [],
    };

    // Try LLM if API key is configured
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiKey) {
      const llmResult = await llmInsight(question, ctx, openAiKey);
      if (llmResult) {
        return new Response(JSON.stringify(llmResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Fallback to rule-based
    const result = ruleBasedInsight(question, ctx);

    return new Response(
      JSON.stringify({
        answer: result.answer,
        confidence: result.confidence,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 },
    );
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
