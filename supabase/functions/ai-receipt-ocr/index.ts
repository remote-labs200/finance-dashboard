/**
 * AI Receipt OCR — Supabase Edge Function
 *
 * Extracts merchant, amount, date, and line items from a receipt image.
 * Uses a simulated extraction from the image filename/URL when no LLM is configured.
 *
 * To upgrade to LLM-powered extraction:
 * 1. Deploy with image analysis support or set OPENAI_API_KEY:
 *    supabase secrets set OPENAI_API_KEY=sk-...
 * 2. The function will use GPT-4o-mini with vision capability for accurate extraction.
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
// Simulated extraction (used when no LLM is available)
// ---------------------------------------------------------------------------
function simulateExtraction(imageUrl: string): {
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  tax: number | null;
  total: number | null;
  currency: string;
} {
  // Try to derive info from the URL filename
  const filename = imageUrl.split('/').pop()?.split('?')[0]?.toLowerCase() ?? '';
  const decoded = decodeURIComponent(filename);

  // Best-effort merchant name from filename
  const merchantMatch = decoded.match(/from[_-]([a-z0-9]+)/i);
  const merchant = merchantMatch
    ? merchantMatch[1].replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
    : null;

  // Date from filename (common patterns: 2024-01-15, 20240115, etc.)
  const dateMatch = decoded.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
  const date = dateMatch ? `${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}` : new Date().toISOString().split('T')[0];

  return {
    merchant,
    amount: null,
    date,
    items: [],
    tax: null,
    total: null,
    currency: 'USD',
  };
}

// ---------------------------------------------------------------------------
// LLM-powered extraction (used when OPENAI_API_KEY is set)
// ---------------------------------------------------------------------------
async function llmExtract(
  imageUrl: string,
  openAiKey: string,
): Promise<{
  merchant: string | null;
  amount: number | null;
  date: string | null;
  items: Array<{ description: string; amount: number }>;
  tax: number | null;
  total: number | null;
  currency: string;
} | null> {
  try {
    const prompt = `You are a receipt OCR assistant. Extract the following information from this receipt image. Return ONLY valid JSON with NO markdown formatting:

{
  "merchant": "store or business name, or null if not visible",
  "amount": 123.45,
  "date": "2024-01-15 or null",
  "items": [{"description": "item name", "amount": 12.34}],
  "tax": 5.67,
  "total": 123.45,
  "currency": "USD"
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: imageUrl } },
            ],
          },
        ],
        temperature: 0.1,
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
      merchant: result.merchant ?? null,
      amount: result.amount ?? null,
      date: result.date ?? null,
      items: result.items ?? [],
      tax: result.tax ?? null,
      total: result.total ?? null,
      currency: result.currency ?? 'USD',
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
    const { imageUrl } = await req.json();

    if (!imageUrl || typeof imageUrl !== 'string') {
      return new Response(
        JSON.stringify({ error: 'imageUrl is required and must be a string' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 },
      );
    }

    // Try LLM extraction if API key is configured
    const openAiKey = Deno.env.get('OPENAI_API_KEY');
    if (openAiKey) {
      const llmResult = await llmExtract(imageUrl, openAiKey);
      if (llmResult) {
        return new Response(JSON.stringify(llmResult), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Fallback to simulated extraction
    const result = simulateExtraction(imageUrl);

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
