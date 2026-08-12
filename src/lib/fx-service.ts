/**
 * Multi-Currency FX Service
 *
 * Provides currency conversion with real rates fetched from
 * open.er-api.com (free, no API key). Results are cached to the user's
 * preferences (SQLite + Supabase mirror) and support manual overrides.
 *
 * When Supabase/local storage is unavailable (e.g. pre-login or web
 * render), it falls back to an in-memory cache and hardcoded rates.
 */

import type { SQLiteDatabase } from "expo-sqlite";

import { getPreference, setPreference } from "@/db/preferences-repo";

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

export interface RateCache {
  base: string;
  rates: Record<string, number>;
  timestamp: number;
}

// --- Supported Currencies ---

export const SUPPORTED_CURRENCIES: CurrencyInfo[] = [
  { code: "USD", name: "US Dollar", symbol: "$", decimalDigits: 2 },
  { code: "EUR", name: "Euro", symbol: "\u20AC", decimalDigits: 2 },
  { code: "GBP", name: "British Pound", symbol: "\u00A3", decimalDigits: 2 },
  { code: "CAD", name: "Canadian Dollar", symbol: "C$", decimalDigits: 2 },
  { code: "AUD", name: "Australian Dollar", symbol: "A$", decimalDigits: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "\u00A5", decimalDigits: 0 },
  { code: "CHF", name: "Swiss Franc", symbol: "CHF ", decimalDigits: 2 },
  { code: "CNY", name: "Chinese Yuan", symbol: "\u00A5", decimalDigits: 2 },
  { code: "INR", name: "Indian Rupee", symbol: "\u20B9", decimalDigits: 2 },
  { code: "BRL", name: "Brazilian Real", symbol: "R$", decimalDigits: 2 },
  { code: "MXN", name: "Mexican Peso", symbol: "MX$", decimalDigits: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", decimalDigits: 2 },
  { code: "NZD", name: "New Zealand Dollar", symbol: "NZ$", decimalDigits: 2 },
  { code: "KRW", name: "South Korean Won", symbol: "\u20A9", decimalDigits: 0 },
  { code: "NGN", name: "Nigerian Naira", symbol: "\u20A6", decimalDigits: 2 },
  { code: "ZAR", name: "South African Rand", symbol: "R", decimalDigits: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "DH", decimalDigits: 2 },
  { code: "SAR", name: "Saudi Riyal", symbol: "SR", decimalDigits: 2 },
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
  CNY: 7.24,
  INR: 83.12,
  BRL: 4.97,
  MXN: 17.15,
  SGD: 1.34,
  NZD: 1.63,
  KRW: 1320.0,
  NGN: 1550.0,
  ZAR: 18.5,
  AED: 3.67,
  SAR: 3.75,
};

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

// ---------------------------------------------------------------------------
// Fetching
// ---------------------------------------------------------------------------

/**
 * Fetch live rates from open.er-api.com. Returns null on failure so callers
 * can decide whether to fall back.
 */
async function fetchLiveRates(base: string): Promise<Record<string, number> | null> {
  try {
    const response = await fetch(`https://open.er-api.com/v6/latest/${base}`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.result !== "success" || !data.rates) return null;

    const rates: Record<string, number> = {};
    for (const currency of SUPPORTED_CURRENCIES) {
      if (data.rates[currency.code] != null) {
        rates[currency.code] = data.rates[currency.code];
      }
    }
    return rates;
  } catch {
    return null;
  }
}

function fallbackRates(base: string): Record<string, number> {
  const rates: Record<string, number> = {};
  for (const currency of SUPPORTED_CURRENCIES) {
    if (FALLBACK_RATES[currency.code] && FALLBACK_RATES[base]) {
      rates[currency.code] = FALLBACK_RATES[currency.code] / FALLBACK_RATES[base];
    }
  }
  return rates;
}

// ---------------------------------------------------------------------------
// Persistence
// ---------------------------------------------------------------------------

function parseRateCache(raw: string | null | undefined): RateCache | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as RateCache;
    if (!parsed || typeof parsed.rates !== "object" || !parsed.base) return null;
    return parsed;
  } catch {
    return null;
  }
}

function parseManualRates(raw: string | null | undefined): Record<string, number> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, number>;
    return typeof parsed === "object" && parsed ? parsed : {};
  } catch {
    return {};
  }
}

/**
 * Load the freshest available rates for `base`:
 *  1. manual overrides (user-set) take precedence per currency,
 *  2. a persisted live cache if it's fresh (or auto-update is off),
 *  3. a fresh network fetch (persisted for next time).
 */
export async function getRates(
  db: SQLiteDatabase,
  userId: string,
  base: string = "USD",
  opts?: { forceRefresh?: boolean },
): Promise<RateCache> {
  const [autoRaw, cachedRaw, manualRaw] = await Promise.all([
    getPreference(db, userId, "fx_auto_update"),
    getPreference(db, userId, "fx_rates_cache"),
    getPreference(db, userId, "fx_manual_rates"),
  ]);
  const autoUpdate = autoRaw !== "false";
  const manual = parseManualRates(manualRaw);
  const cached = parseRateCache(cachedRaw);

  const freshEnough =
    cached && cached.base === base && Date.now() - cached.timestamp < CACHE_TTL_MS;

  // Manual mode: if auto-update is off, respect the last cached snapshot.
  if (!autoUpdate) {
    if (cached?.base === base) return applyOverrides(cached, manual);
    const rates = await fetchLiveRates(base) ?? fallbackRates(base);
    const cache: RateCache = { base, rates, timestamp: Date.now() };
    await persistCache(db, userId, cache);
    return applyOverrides(cache, manual);
  }

  // Auto mode: use cache if fresh; otherwise fetch and persist.
  if (freshEnough && !opts?.forceRefresh) {
    return applyOverrides(cached!, manual);
  }

  const rates = await fetchLiveRates(base) ?? cached?.rates ?? fallbackRates(base);
  const cache: RateCache = { base, rates, timestamp: Date.now() };
  await persistCache(db, userId, cache);
  return applyOverrides(cache, manual);
}

function applyOverrides(
  cache: RateCache,
  manual: Record<string, number>,
): RateCache {
  if (Object.keys(manual).length === 0) return cache;
  const rates = { ...cache.rates };
  for (const [code, rate] of Object.entries(manual)) {
    if (typeof rate === "number" && rate > 0) rates[code] = rate;
  }
  return { ...cache, rates };
}

async function persistCache(
  db: SQLiteDatabase,
  userId: string,
  cache: RateCache,
): Promise<void> {
  try {
    await setPreference(db, userId, "fx_rates_cache", JSON.stringify(cache));
  } catch {
    // best-effort — non-fatal if persistence fails
  }
}

/**
 * Set a manual override rate for one currency (in units per 1 base).
 * Pass `null` to clear the override.
 */
export async function setManualRate(
  db: SQLiteDatabase,
  userId: string,
  code: string,
  rate: number | null,
): Promise<void> {
  const manualRaw = await getPreference(db, userId, "fx_manual_rates");
  const manual = parseManualRates(manualRaw);
  if (rate === null) {
    delete manual[code];
  } else {
    manual[code] = rate;
  }
  await setPreference(db, userId, "fx_manual_rates", JSON.stringify(manual));
}

// ---------------------------------------------------------------------------
// Conversion
// ---------------------------------------------------------------------------

/**
 * Convert an amount from one currency to another using real rates.
 */
export async function convertCurrency(
  db: SQLiteDatabase,
  userId: string,
  amountCents: number,
  fromCurrency: string,
  toCurrency: string,
): Promise<number> {
  if (fromCurrency === toCurrency) return amountCents;

  const cache = await getRates(db, userId, fromCurrency);
  const rate = cache.rates[toCurrency];
  if (!rate) return amountCents;

  return Math.round(amountCents * rate);
}

/**
 * Get a single exchange rate.
 */
export async function getRate(
  db: SQLiteDatabase,
  userId: string,
  from: string,
  to: string,
): Promise<number> {
  if (from === to) return 1;
  const cache = await getRates(db, userId, from);
  return cache.rates[to] ?? 1;
}

/**
 * All rates relative to a base currency (for the exchange-rates screen).
 */
export async function getAllRates(
  db: SQLiteDatabase,
  userId: string,
  base: string = "USD",
  opts?: { forceRefresh?: boolean },
): Promise<FxRate[]> {
  const cache = await getRates(db, userId, base, opts);
  return Object.entries(cache.rates).map(([currency, rate]) => ({
    from: base,
    to: currency,
    rate,
    timestamp: cache.timestamp,
  }));
}

/**
 * Get currency info by code.
 */
export function getCurrencyInfo(code: string): CurrencyInfo | undefined {
  return SUPPORTED_CURRENCIES.find((c) => c.code === code);
}
