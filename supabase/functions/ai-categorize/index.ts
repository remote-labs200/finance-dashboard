/**
 * AI Categorize — Supabase Edge Function
 *
 * Automatically categorizes a transaction based on its description and amount.
 * Uses a keyword-based rule engine that works immediately after deployment.
 *
 * To upgrade to LLM-powered categorization:
 * 1. Set OPENAI_API_KEY in your Supabase Edge Function secrets:
 *    supabase secrets set OPENAI_API_KEY=sk-...
 * 2. The function will automatically use GPT-4o-mini for smarter categorization.
 */

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

// ---------------------------------------------------------------------------
// CORS headers — required for Supabase Edge Functions
// ---------------------------------------------------------------------------
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ---------------------------------------------------------------------------
// Rule engine — deterministic, works without any external API
// ---------------------------------------------------------------------------
interface Rule {
  pattern: RegExp;
  category: string;
  type: 'income' | 'expense';
}

const RULES: Rule[] = [
  // Income
  { pattern: /invoice|payment received|client|freelance|contract|retainer/i, category: 'Client Payment', type: 'income' },
  { pattern: /salary|payroll|wage|direct deposit/i, category: 'Salary', type: 'income' },
  { pattern: /refund|reimbursement|rebate/i, category: 'Refund', type: 'income' },
  { pattern: /dividend|interest|investment|crypto|stock/i, category: 'Investment Income', type: 'income' },
  { pattern: /rental|property income|airbnb/i, category: 'Rental Income', type: 'income' },
  { pattern: /royalty|affiliate|commission/i, category: 'Commission & Royalties', type: 'income' },
  { pattern: /gig|uber|lyft|doordash|delivery/i, category: 'Gig Income', type: 'income' },

  // Expenses
  { pattern: /office|supplies|stationery|printer|ink|paper/i, category: 'Office Supplies', type: 'expense' },
  { pattern: /software|saas|subscription|license|cloud|hosting|domain|aws|azure|gcp/i, category: 'Software & Subscriptions', type: 'expense' },
  { pattern: /travel|flight|hotel|airbnb|uber|lyft|taxi|gas|fuel|parking|toll/i, category: 'Travel', type: 'expense' },
  { pattern: /meal|lunch|dinner|breakfast|coffee|restaurant|cafe|takeout|dining/i, category: 'Meals & Entertainment', type: 'expense' },
  { pattern: /marketing|advertising|ad|promo|social media|seo|ppc/i, category: 'Marketing & Advertising', type: 'expense' },
  { pattern: /phone|internet|mobile|cellular|broadband|voip/i, category: 'Telecommunications', type: 'expense' },
  { pattern: /rent|lease|cowork|workspace/i, category: 'Rent & Workspace', type: 'expense' },
  { pattern: /insurance|policy|premium|coverage/i, category: 'Insurance', type: 'expense' },
  { pattern: /medical|doctor|dentist|pharmacy|health|vision|dental|therapy/i, category: 'Healthcare', type: 'expense' },
  { pattern: /education|course|training|workshop|book|tutorial|conference|udemy/i, category: 'Education & Training', type: 'expense' },
  { pattern: /tax|irs|filing|accountant|cpa|bookkeeper/i, category: 'Tax & Accounting', type: 'expense' },
  { pattern: /bank fee|service fee|atm|overdraft|interest charge/i, category: 'Bank & Financial Fees', type: 'expense' },
  { pattern: /electric|water|gas|utility|power|sewer|trash/i, category: 'Utilities', type: 'expense' },
  { pattern: /shipping|postage|courier|fedex|ups|usps/i, category: 'Shipping & Postage', type: 'expense' },
  { pattern: /equipment|hardware|laptop|monitor|keyboard|mouse|computer/i, category: 'Equipment & Hardware', type: 'expense' },
  { pattern: /legal|attorney|lawyer|notary|contract review/i, category: 'Legal & Professional', type: 'expense' },
  { pattern: /charity|donation|nonprofit|sponsor/i, category: 'Donations', type: 'expense' },
  { pattern: /clothing|uniform|apparel|dry cleaning/i, category: 'Clothing & Appearance', type: 'expense' },
  { pattern: /grocery|supermarket|groceries/i, category: 'Groceries', type: 'expense' },
  { pattern: /entertainment|movie|netflix|spotify|hulu|game|concert/i, category: 'Entertainment', type: 'expense' },
];

function ruleBasedCategorize(description: string, amount: number): { category: string; confidence: number; reason: string } {
  const normalized = description.toLowerCase().trim();

  for (const rule of RULES) {
    if (rule.pattern.test(normalized)) {
      return {
        category: rule.category,
        confidence: 0.85,
        reason: `Matched keyword pattern: "${rule.pattern.source.slice(0, 40)}..."`,
      };
    }
  }

  // Fallback based on amount sign
  if (amount < 0) {
    return { category: 'Uncategorized Expense', confidence: 0.3, reason: 'Negative amount — defaulting to expense' };
  }
  return { category: 'Uncategorized Income', confidence: 0.3, reason: 'Positive amount — defaulting to income' };
}

// ---------------------------------------------------------------------------
// LLM integration (optional — enabled when OPENAI_API_KEY is set)
// ---------------------------------------------------------------------------
async function llmCategorize(
  description: string,
  amount: number,
  existingCategories: string[],
  openAiKey: string,
): Promise<{ category: string; confidence: number; reason: string } | null> {
  try {
    const categoryList = existingCategories.length > 0
      ? existingCategories.map((c) => `- ${c}`).join('\n')
      : 'No existing categories provided. Suggest a reasonable one.';

    const prompt = `You are a financial categorization assistant. Categorize the following transaction:

Description: "${description}"
Amount: ${amount}

Existing categories the user has defined:
${categoryList}

Respond with ONLY a JSON object:
{
  "category": "string — the best matching category name",
  "confidence": 0.0–1.0,
  "reason": "brief explanation"
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
        temperature: 0.1,
        max_tokens: 150,
      }),
    });

    if (!response.ok) return null;

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    if (!content) return null;

    // Extract JSON from the response (handles markdown-wrapped responses)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const result = JSON.parse(jsonMatch[0]);

    return {
      category: result.category || 'Uncategorized',
      confidence: Math.min(1, Math.max(0, result.confidence || 0.5)),
      reason: result.reason || 'AI categorization via GPT-4o-mini',
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
    const { description, amount, existingCategories } = await req.json();

    if (!description || typeof description !== 'string') {
      return new Response(
        JSON.stringify({ error: 'description is required and must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    // Try LLM if API key is configured
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiKey) {
      const llmResult = await llmCategorize(description, amount ?? 0, existingCategories ?? [], openAiKey);
      if (llmResult) {
        return new Response(JSON.stringify(llmResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Fallback to rule-based
    const result = ruleBasedCategorize(description, amount ?? 0);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
    );
  }
});
