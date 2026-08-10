// Read-only Supabase connectivity check (no writes)
// Verifies: client init, REST reachability, auth session endpoint, and
// existence of the core sync tables via a lightweight probe.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

const env = readFileSync(".env", "utf8");
const get = (k) => {
  const line = env.split("\n").find((l) => l.startsWith(`${k}=`));
  return line ? line.slice(k.length + 1).trim() : undefined;
};

const url = get("EXPO_PUBLIC_SUPABASE_URL");
const key = get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

console.log("URL:", url);
console.log("KEY set:", !!key, "len:", key?.length ?? 0);

if (!url || !key) {
  console.log("RESULT: FAIL — missing credentials");
  process.exit(1);
}

const supabase = createClient(url, key, { auth: { persistSession: false } });

// 1. REST reachability + auth endpoint
try {
  const { data, error } = await supabase.auth.getSession();
  if (error) {
    console.log("AUTH:", error.message);
  } else {
    console.log("AUTH: reachable (no session — expected)");
  }
} catch (e) {
  console.log("AUTH ERROR:", e.message);
  process.exit(1);
}

// 2. Probe each core sync table (select limit 1 — read-only)
// user_preferences uses a composite PK (user_id, key) — no `id` column.
const tables = [
  { name: "accounts", col: "id" },
  { name: "categories", col: "id" },
  { name: "clients", col: "id" },
  { name: "transactions", col: "id" },
  { name: "tax_settings", col: "id" },
  { name: "user_preferences", col: "user_id" },
  { name: "users", col: "id" },
];
for (const { name, col } of tables) {
  try {
    const { data, error } = await supabase.from(name).select(col).limit(1);
    if (error) {
      console.log(`TABLE ${name}: ERROR — ${error.code} ${error.message}`);
    } else {
      console.log(`TABLE ${name}: OK (${data?.length ?? 0} rows returned)`);
    }
  } catch (e) {
    console.log(`TABLE ${name}: THREW — ${e.message}`);
  }
}

console.log("RESULT: done");
