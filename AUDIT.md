# PaySmooth — Product & Screen Audit

> Date: 2026-08-11 · Scope: all app screens, settings hub, settings categories/subcategories, and core functionality
> Purpose: capture findings so they can be implemented systematically. Everything below is actionable.

---

## Progress tracker

| Item | Status | Notes |
|---|---|---|
| **P0-1** Real TOTP 2FA | ✅ Done | Supabase MFA: enroll QR/secret, verify, recovery codes, sign-in code prompt (native + web). |
| **P0-2** Data Encryption Key screen | ✅ Done | Screen, route, and settings entry removed. |
| **P0-3** Security Logs screen | ✅ Done | Screen, route, and settings entry removed. |
| **P0-4** Connected Devices screen | ✅ Done | Screen, route, and settings entry removed. |
| **P0-5** Biometric Lock persistence | ✅ Done | Real SecureStore wiring + launch/return gate + working test button. |
| **P0-6** Tax locale restricted to US | ✅ Done | Selector is US-only with honest "coming soon" note. |
| **P1-7** Seed default categories | ✅ Done | `ensureDefaultCategories` seeds 12 expense + 4 income categories on first run. |
| **P1-6** `is_deductible` on categories | ✅ Done | Column + migration; toggle in categories screen; tax engine uses deductible-only expenses. |
| **P1-1** Receipts per transaction | ✅ Done | `receipts` table + repo; scan creates linked receipt; edit screen shows receipt image. |
| **P1-2** Real P&L report | ✅ Done | Category income/expense breakdown with deductible totals in Reports. |
| **P1-3** Real XLSX/PDF exports | ⏳ In Progress | `expo-print` + `exceljs` installed; PDF via `printToFileAsync(html)`. |
| **P1-4** Tax payments + paid-vs-owe | ✅ Done | `tax-payments.tsx` screen + Reports shows Paid / Estimated Remaining. |
| **P1-5** Recurring transactions | ✅ Done | Template UI + repo (`recurring-transaction-repo.ts`) + `generateRecurringTransactions` + Supabase migration + settings entry. |
| **P1-8** Notification toggles pruning | ⬜ Pending | See §4. |
| H-1 … H-6 | ⬜ Pending | See §4. |

---

## 0. Executive verdict

The engineering is genuinely strong:

- Offline-first local SQLite (source of truth on device) + Supabase cloud mirror with an offline write queue (`sync_log`).
- A real **income-smoothing engine** (`safePayCents`, volatility, dry-month buffer) — the differentiated wedge.
- A deterministic **US tax engine** (SE tax, federal/state brackets, safe-harbor, quarterly due dates, deadline reminders).
- **Multi-currency by default** (10 currencies, live FX service, 1-hour cache, base-currency normalization).
- Mileage tracker with GPS (`expo-location`) and IRS rate.
- AI receipt OCR + auto-categorization + natural-language insights, all with graceful offline/not-configured fallbacks.
- Push notifications (Supabase Realtime + edge functions) and local tax-deadline/dry-month notifications.
- 5-step onboarding wizard; clean settings hub structure; type-strict TS codebase.

**The problems are not in what's built well.** They are:

1. **Security theater** — fake security screens that actively hurt trust (P0).
2. **Orphaned / duplicate screens and dead settings** (P1).
3. A handful of **table-stakes features missing** that every competitor ships (P1).
4. **UI ahead of engine** — toggles/options presented as working that have no backend behind them (P1).

---

## 1. Main tab structure — verdict: healthy, don't touch

| Tab | Screen | Verdict |
|---|---|---|
| Home | `(tabs)/(main)/index.tsx` | Strong. Safe-Pay hero, tax deadline + quarterly reserve, quick actions, smoothing, forecast, client ledger, mileage, accounts. **Invest here — this is the moat screen.** |
| Transactions | `(tabs)/(main)/explore.tsx` | Solid (search + All/Income/Expense filter + edit/delete + pull-to-refresh). Cap of 100 txns is the only real gap → paginate. |
| Scan | `(tabs)/(main)/scan.tsx` | Good, table-stakes. Needs receipt-per-transaction attachment (see P1-1). |
| Reports + Analytics | `(tabs)/(main)/reports.tsx` | Good two-tab structure (Reports sub-tab + Analytics sub-tab with 5 charts). Missing a real **P&L report** (P1-2). |
| Clients | `(tabs)/(main)/clients.tsx` | Good CRUD + per-client summaries. No invoicing — explicit product decision needed (see §6.1). |
| Auth stack | `(auth)/welcome·sign-in·sign-up·onboarding` | Professional. 5-step onboarding; skippable. |

No tab is missing or excessive at the top level.

---

## 2. P0 — Security theater: fix or remove (credibility blocker)

| # | Screen | Problem | Status |
|---|---|---|---|
| P0-1 | **Two-Factor Auth** | Real Supabase TOTP implemented. | ✅ Done |
| P0-2 | **Data Encryption Key** | Screen, route, settings entry removed. | ✅ Done |
| P0-3 | **Security Logs** | Screen, route, settings entry removed. | ✅ Done |
| P0-4 | **Connected Devices** | Screen, route, settings entry removed. | ✅ Done |
| P0-5 | **Biometric Lock** | SecureStore persistence + launch/return gate + test button. | ✅ Done |
| P0-6 | **Tax locale** | Selector restricted to US + honest note. | ✅ Done |

---

## 3. P1 — Table-stakes features

| # | Feature | Status |
|---|---|---|
| P1-1 | Receipts attached to transactions | ✅ Done |
| P1-2 | Real P&L report | ✅ Done |
| P1-3 | Real file exports (XLSX/PDF) | ⏳ In Progress |
| P1-4 | Tax payments tracking + paid-vs-owe | ✅ Done |
| P1-5 | Recurring transactions | ⏳ In Progress |
| P1-6 | Deductibility flag per category | ✅ Done |
| P1-7 | Seed default categories | ✅ Done |
| P1-8 | Un-implemented notification toggles | ⬜ Pending |

---

## 4. P1/P2 — Navigation & settings hygiene

| # | Finding | Action |
|---|---|---|
| H-1 | **Orphaned screens:** `currency-settings.tsx` and `tax-config.tsx` registered but unreachable. | Delete routes + files, or wire them. |
| H-2 | **Duplicate row:** "Cloud Sync" appears twice in settings hub. | Consolidate to one entry. |
| H-3 | **Mock integrations:** `bank-connections.tsx` and `invoicing-integrations.tsx` show simulated Connect flows. | Label "Coming soon" or gate. |
| H-4 | **Export "Custom date range"** not implemented. | Add date picker or remove option. |
| H-5 | **Feature-tuning screens buried** 4 levels deep. | Surface next to feature. |
| H-6 | **Transactions list capped at 100.** | Paginate. |

---

## 5. Categories / subcategories

- Keep flat for v1 — do NOT add subcategories yet.
- Higher-value additions: `is_deductible` ✅ + per-category budget (BLUEPRINT §5.1 `budgets` table).
- If subcategories later: nullable `categories.parent_id`.

---

## 6. Product decisions

### 6.1 Invoicing — build or drop
- **(a)** Minimal invoice module: create invoice → mark paid → auto-create income transaction.
- **(b)** Remove "Invoicing Integrations" settings + dashboard hint until (a) exists.

### 6.2 Don't build the banking layer
- BLUEPRINT's own competitive audit kills the neobank trap. Stay software.

### 6.3 Defer
- MCP / AI-agent hooks.
- Google/Apple OAuth.
- AI-forecast learning loop.

---

## 7. Execution order

| Phase | Work | Status |
|---|---|---|
| **Week 1 — Trust** | P0-1 … P0-6 | ✅ **Complete** |
| **Week 2 — Data completeness** | P1-1, P1-6, P1-7, P1-4 | ✅ **Complete** |
| **Week 3 — Professional outputs** | P1-2, P1-3, H-4 | ✅ P1-2 done; P1-3 in progress |
| **Week 4 — Moat strengthening** | P1-5 recurring · budgets · H-1 · H-2 · H-3 · P1-8 · H-6 | ✅ P1-5 done; budgets · H-1 · H-2 · H-3 · P1-8 · H-6 pending |

---

## Appendix A — Stub / UI-only screens inventory

| Screen | Status | Detail |
|---|---|---|
| `bank-connections.tsx` | UI + simulated | Status strings persisted; OAuth not real. |
| `invoicing-integrations.tsx` | UI + simulated | Toggles only. |
| `two-factor-auth.tsx` | ✅ Real | Supabase TOTP enrollment/verification/recovery. |
| `data-encryption-key.tsx` | ❌ Removed | Was UI-only / false claim. |
| `security-logs.tsx` | ❌ Removed | Was hardcoded mock array. |
| `connected-devices.tsx` | ❌ Removed | Was hardcoded mock array. |
| `export-ledger.tsx` | Partial | XLSX/PDF fallbacks. |
| `biometric-lock.tsx` | ✅ Fixed | Real SecureStore persistence + gate. |
