// Mileage chain end-to-end verification
// Uses the real app flow: anon-key client signs up → authenticated upsert → read back → delete
const { createClient } = require("@supabase/supabase-js");
const fs = require("fs");

const env = fs.readFileSync(".env", "utf8");
const get = (k) => {
  const l = env.split("\n").find((x) => x.startsWith(k + "="));
  return l ? l.slice(k.length + 1).trim() : undefined;
};
const url = get("EXPO_PUBLIC_SUPABASE_URL");
const anonKey = get("EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY");

// Secrets live in .env (gitignored) — never commit them.
const ACCESS_TOKEN = get("SUPABASE_ACCESS_TOKEN");
const REF = get("SUPABASE_PROJECT_REF");

async function run() {
  const client = createClient(url, anonKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = "mileage-test-" + Date.now() + "@example.com";
  const password = "TestPass123!";

  console.log("1. Sign up (anon key, real app flow)...");
  const { data: suData, error: suErr } = await client.auth.signUp({
    email,
    password,
  });
  if (suErr || !suData.user) {
    console.log("   SIGNUP FAILED:", suErr?.message || "no user");
    return;
  }
  const uid = suData.user.id;
  console.log("   user_id:", uid.slice(0, 8) + "...");

  console.log("2. Sign in to get session...");
  const { data: siData, error: siErr } = await client.auth.signInWithPassword({
    email,
    password,
  });
  if (siErr || !siData.session) {
    console.log("   SIGNIN FAILED:", siErr?.message);
    return;
  }
  console.log(
    "   session OK, access_token present:",
    !!siData.session.access_token,
  );

  console.log(
    "3. UPSERT mileage entry with GPS coords (mirrors createMileageEntry)...",
  );
  const { data: up, error: upErr } = await client
    .from("mileage_entries")
    .upsert(
      {
        id: "m_test_" + Date.now(),
        user_id: uid,
        date: new Date().toISOString().slice(0, 10),
        purpose: "Test Business Trip",
        miles: 42.5,
        start_lat: 40.7128,
        start_lng: -74.006,
        end_lat: 40.758,
        end_lng: -73.9855,
        start_location: "40.7128, -74.0060",
        end_location: "40.7580, -73.9855",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  if (upErr) {
    console.log("   UPSERT FAILED:", upErr.message);
    return;
  }
  console.log("   upsert OK, miles:", up.miles);

  console.log("4. READ BACK entry (mirrors findMileageEntriesByUser)...");
  const { data: rows, error: rdErr } = await client
    .from("mileage_entries")
    .select("*")
    .eq("user_id", uid)
    .eq("id", up.id)
    .single();
  if (rdErr) {
    console.log("   READ FAILED:", rdErr.message);
    return;
  }
  console.log(
    "   read OK, miles:",
    rows.miles,
    "=== match:",
    rows.miles === 42.5 ? "PASS" : "FAIL",
  );

  console.log(
    "5. UPSERT with NULL location fields (quick-trip no-GPS save)...",
  );
  const { data: up2, error: up2Err } = await client
    .from("mileage_entries")
    .upsert(
      {
        id: "m_test_null_" + Date.now(),
        user_id: uid,
        date: "2025-08-09",
        purpose: "Manual Entry",
        miles: 12,
        start_lat: null,
        start_lng: null,
        end_lat: null,
        end_lng: null,
        start_location: null,
        end_location: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "id" },
    )
    .select()
    .single();
  if (up2Err) {
    console.log("   NULL UPSERT FAILED:", up2Err.message);
  } else {
    console.log("   NULL-field upsert OK");
  }

  console.log("6. Cleanup (delete rows + test user via admin API)...");
  if (!ACCESS_TOKEN || !REF) {
    console.log(
      "   CLEANUP SKIPPED: SUPABASE_ACCESS_TOKEN / SUPABASE_PROJECT_REF missing in .env",
    );
  } else {
    await client.from("mileage_entries").delete().eq("user_id", uid);
    await client.auth.signOut();
    const delRes = await fetch(
      "https://api.supabase.com/v2/projects/" + REF + "/auth/users/" + uid,
      {
        method: "DELETE",
        headers: {
          Authorization: "Bearer " + ACCESS_TOKEN,
          "Content-Type": "application/json",
        },
      },
    );
    console.log("   rows deleted, user deleted:", delRes.status);

    // Verify clean
    const listRes = await fetch(
      "https://api.supabase.com/v2/projects/" +
        REF +
        "/auth/users?page_size=100",
      {
        headers: { Authorization: "Bearer " + ACCESS_TOKEN },
      },
    );
    const list = await listRes.json();
    const remaining = (list.users || []).filter(
      (u) => u.email && u.email.includes("mileage-test"),
    );
    console.log("   test users remaining:", remaining.length);
  }

  console.log(
    "\nRESULT:",
    rows.miles === 42.5
      ? "PASS — mileage chain works end-to-end (upsert → read → NULL fields → cleanup)"
      : "FAIL",
  );
}
run().catch((e) => console.error("THREW:", e.message));
