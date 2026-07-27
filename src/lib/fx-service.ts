/**
 * Multi-Currency FX Service
 *
 * Provides currency conversion with cached rates.
 * Uses a free API for live rates, falls back to hardcoded rates.
 */

// --- Types ---

export interface FxRate {
  from: string;
  to: string;
  rate: number;
  timestamp: number;
}

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  decimalDigits: number;
}

// --- Supported Currencies ---

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: 'USD', name: 'US Dollar', symbol: '$', decimalDigits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '\u20AC', decimalDigits: 2 },
  { code: 'GBP', name: 'British Pound', symbol: '\u00A3', decimalDigits: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', decimalDigits: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', decimalDigits: 2 },
  { code: 'JPY', name: 'Japanese Yen', symbol: '\u00A5', decimalDigits: 0 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF ', decimalDigits: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '\u20B9', decimalDigits: 2 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', decimalDigits: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', decimalDigits: 2 },
];

// --- Fallback Rates (against USD) ---

const FALLBACK_RATES: Record<string, number> = {
  USD: 1,
  EUR: 0.92,
  GBP: 0.79,
  CAD: 1.36,
  AUD: 1.53,
  JPY: 149.5,
  CHF: 0.88,
  INR: 83.12,
  BRL: 4.97,
  MXN: 17.15,
};

// --- Rate Cache ---

const RATE_CACHE_KEY = 'fx_rates_cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface RateCache {
  rates: Record<string, number>;
  timestamp: number;
}

let memoryCache: RateCache | null = null;

/**
 * Fetch live rates from a free API, with fallback to hardcoded rates.
 * Caches results for 1 hour in memory.
 */
export async function fetchRates(baseCurrency: string = 'USD'): Promise<Record<string, number>> {
  // Check memory cache first
  if (memoryCache && Date.now() - memoryCache.timestamp < CACHE_TTL_MS) {
    return memoryCache.rates;
  }

  try {
    const response = await fetch(
      `https://open.er-api.com/v6/latest/${baseCurrency}`
    );
    const data = await response.json();

    if (data.result === 'success' && data.rates) {
      const rates: Record<string, number> = {};
      for (const currency of SUPPORTED_CURRENCIES) {
        if (data.rates[currency.code]) {
          rates[currency.code] = data.rates[currency.code];
        }
      }
      memoryCache = { rates, timestamp: Date.now() };
      return rates;
    }
  } catch {
    // API failed, use fallback
  }

  // Return fallback rates
  const rates: Record<string, number> = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    if (FALLBACK_RATES[currency.code] && FALLBACK_RATES[baseCurrency]) {
      rates[currency.code] = FALLBACK_RATES[currency.code] / FALLBACK_RATES[baseCurrency];
    }
  }
  memoryCache = { rates, timestamp: Date.now() };
  return rates;
}

/**
 * Convert an amount from one currency to another.
 */
export async function convertCurrency(
  amountCents: number,
  fromCurrency: string,
  toCurrency: string
): Promise<number> {
  if (fromCurrency === toCurrency) return amountCents;

  const rates = await fetchRates(fromCurrency);
  const rate = rates[toCurrency];

  if (!rate) return amountCents; // Unknown currency, return as-is

  return Math.round(amountCents * rate);
}

/**
 * Get all rates relative to a base currency.
 */
export async function getAllRates(baseCurrency: string = 'USD'): Promise<FxRate[]> {
  const rates = await fetchRates(baseCurrency);
  const timestamp = memoryCache?.timestamp ?? Date.now();

  return Object.entries(rates).map(([currency, rate]) => ({
    from: baseCurrency,
    to: currency,
    rate,
    timestamp,
  }));
}

/**
 * Get a single exchange rate.
 */
export async function getRate(from: string, to: string): Promise<number> {
  if (from === to) return 1;
  const rates = await fetchRates(from);
  return rates[to] ?? 1;
}

/**
 * Get currency info by code.
 */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}
