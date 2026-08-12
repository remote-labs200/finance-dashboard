import { supabase } from "@/lib/supabase";
import { queueSync } from "@/lib/sync-service";
import * as SQLite from "expo-sqlite";
import { cloudUpsert } from "./cloud-writer";
import { isNetworkError } from "./network-utils";

export type UserPreferenceKey =
  | "tax_year"
  | "notifications_enabled"
  // Push notifications
  | "push_token"
  // Marketing consent (gates the Sender.net sync)
  | "marketing_consent"
  // Legal acceptance (timestamp of when the user accepted Terms & Privacy)
  | "terms_accepted_at"
  // Per-type notification preferences
  | "notif_tax_deadline"
  | "notif_payment_reminder"
  | "notif_weekly_summary"
  | "notif_anomaly"
  | "notif_sync_status"
  | "notif_feature"
  | "notif_system"
  // Profile fields
  | "profile_first_name"
  | "profile_last_name"
  | "profile_business_phone"
  // Business information
  | "business_legal_name"
  | "business_structure"
  | "business_ein"
  | "business_address_line1"
  | "business_address_line2"
  | "business_city"
  | "business_state"
  | "business_zip"
  // Tax profile
  | "tax_filing_status"
  | "tax_entity_type"
  | "tax_locale"
  // Accounting year
  | "fy_start_month"
  | "fy_start_day"
  | "fy_type"
  // Financial Core & Currencies
  | "base_currency"
  | "secondary_currencies"
  | "fx_auto_update"
  | "fx_auto_update_interval"
  | "fx_rates_cache"
  | "fx_manual_rates"
  | "smoothing_target_pct"
  | "smoothing_buffer_months"
  | "smoothing_min_pay"
  | "calibration_state_rate"
  | "calibration_prior_year_tax"
  | "calibration_current_quarter"
  | "calibration_safe_harbor"
  // AI Financial Insights
  | "ai_anomaly_alerts"
  | "ai_weekly_digest"
  | "ai_tax_opportunities"
  | "ai_insight_frequency"
  | "ai_forecast_threshold"
  // Receipt OCR
  | "ocr_auto_categorize"
  | "ocr_extract_dates"
  | "ocr_extract_merchants"
  | "ocr_compress_images"
  | "ocr_compression_level";

const PREFERENCE_DEFAULTS: Record<UserPreferenceKey, string> = {
  tax_year: String(new Date().getFullYear()),
  notifications_enabled: "true",
  push_token: "",
  marketing_consent: "false",
  terms_accepted_at: "",
  notif_tax_deadline: "true",
  notif_payment_reminder: "true",
  notif_weekly_summary: "true",
  notif_anomaly: "true",
  notif_sync_status: "true",
  notif_feature: "true",
  notif_system: "true",
  profile_first_name: "",
  profile_last_name: "",
  profile_business_phone: "",
  business_legal_name: "",
  business_structure: "sole_prop",
  business_ein: "",
  business_address_line1: "",
  business_address_line2: "",
  business_city: "",
  business_state: "",
  business_zip: "",
  tax_filing_status: "single",
  tax_entity_type: "sole_prop",
  tax_locale: "US",
  fy_start_month: "1",
  fy_start_day: "1",
  fy_type: "calendar",
  base_currency: "USD",
  secondary_currencies: "",
  fx_auto_update: "true",
  fx_auto_update_interval: "24",
  fx_rates_cache: "",
  fx_manual_rates: "",
  smoothing_target_pct: "70",
  smoothing_buffer_months: "3",
  smoothing_min_pay: "0",
  calibration_state_rate: "0",
  calibration_prior_year_tax: "0",
  calibration_current_quarter: "1",
  calibration_safe_harbor: "true",
  ai_anomaly_alerts: "true",
  ai_weekly_digest: "true",
  ai_tax_opportunities: "true",
  ai_insight_frequency: "weekly",
  ai_forecast_threshold: "3000",
  ocr_auto_categorize: "true",
  ocr_extract_dates: "true",
  ocr_extract_merchants: "true",
  ocr_compress_images: "true",
  ocr_compression_level: "balanced",
};

export async function getPreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey,
): Promise<string> {
  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM user_preferences WHERE user_id = ? AND key = ?",
    userId,
    key,
  );
  return row?.value ?? PREFERENCE_DEFAULTS[key];
}

export async function setPreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey,
  value: string,
): Promise<void> {
  const now = new Date().toISOString();

  // Write to Supabase first (source of truth)
  // Preferences use composite key (user_id, key) — Supabase table mirrors this
  await cloudUpsert(
    db,
    "user_preferences",
    `${userId}_${key}`,
    {
      user_id: userId,
      key,
      value,
      updated_at: now,
    },
    "user_id,key",
  );

  // Cache to local SQLite
  await db.runAsync(
    `INSERT OR REPLACE INTO user_preferences (user_id, key, value, updated_at)
     VALUES (?, ?, ?, ?)`,
    userId,
    key,
    value,
    now,
  );
}

export async function getAllPreferences(
  db: SQLite.SQLiteDatabase,
  userId: string,
): Promise<Record<string, string>> {
  const rows = await db.getAllAsync<{ key: string; value: string | null }>(
    "SELECT key, value FROM user_preferences WHERE user_id = ?",
    userId,
  );

  const prefs: Record<string, string> = { ...PREFERENCE_DEFAULTS };
  for (const row of rows) {
    if (row.value !== null) {
      prefs[row.key] = row.value;
    }
  }
  return prefs;
}

export async function deletePreference(
  db: SQLite.SQLiteDatabase,
  userId: string,
  key: UserPreferenceKey,
): Promise<void> {
  // Delete from Supabase first (source of truth)
  // user_preferences uses composite key, not id — delete via filter
  if (supabase) {
    try {
      const { error } = await supabase
        .from("user_preferences")
        .delete()
        .eq("user_id", userId)
        .eq("key", key);

      if (error) {
        if (isNetworkError(error)) {
          await queueSync(db, "user_preferences", `${userId}_${key}`, "delete");
        } else {
          throw error;
        }
      }
    } catch (err) {
      if (!isNetworkError(err)) throw err;
      await queueSync(db, "user_preferences", `${userId}_${key}`, "delete");
    }
  }

  // Remove from local SQLite cache
  await db.runAsync(
    "DELETE FROM user_preferences WHERE user_id = ? AND key = ?",
    userId,
    key,
  );
}
