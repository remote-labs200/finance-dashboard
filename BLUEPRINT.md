# Blueprint — Personal Finance Dashboard for Freelancers (Micro-SaaS)

> Status: Planning (pre-build)
> Platform: React Native + Expo (SDK 56) — iOS / Android / Web
> Repo: `finance-dashboard` (currently the default Expo starter; this doc defines what we build on top of it)

---

## 1. Problem & Why Now

Standard tools (QuickBooks, legacy TurboTax Self-Employed) assume a steady employee paycheck. Freelancers face three frictions those tools ignore:

1. **Irregular income** — lumpy monthly revenue with "dry months" that break cash-flow planning.
2. **Multi-currency payments** — clients pay in USD/EUR/GBP; tools treat everything as one currency.
3. **Dynamic quarterly tax estimation** — localized (state/country) estimates that must update as income/expenses land, not a once-a-year surprise.

**Market tailwind:** US freelance market grew ~90% between 2020–2024 and is projected to hit ~86.5M freelancers by 2027 — more than half the workforce (Millo, 2025). Solopreneurs will "gladly pay a manageable monthly subscription" for software that works _the way freelancers actually work_.

---

## 2. Competitive Audit

### 2.1 Who's in the field

| Player                                                                  | Model                          | Core strength                                                                                                             | Gap vs. our wedge                                                      |
| ----------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| **Hurdlr**                                                              | SaaS tracker                   | Auto expense + mileage, **live tax estimates & reminders**, P&L/BS reports. $8B+ tracked, $300M+ tax saved, 4.7★          | Tracks but does **not smooth** irregular income; single-currency focus |
| **Keeper**                                                              | SaaS + tax pros                | **AI deduction discovery**, industry-specific write-offs, filed & signed by a CPA at ~½ CPA price ($99–$399/yr), 4.4★     | Filing-focused; light on day-to-day cash-flow smoothing                |
| **Bonsai**                                                              | SaaS suite                     | Full biz mgmt (CRM→invoicing→bookkeeping→reports) + **Bonsai MCP** (AI agent hooks). 10k+ firms                           | Built for _agencies/consultancies_; too heavy for solo freelancers     |
| **Found**                                                               | **Neobank**                    | Business banking **+ built-in bookkeeping + automatic tax withholding & quarterly estimates + Schedule C** + 1099/pockets | Requires banking license/partner & capital; holds user money           |
| **Lili**                                                                | **Neobank**                    | Freelancer banking with automatic **tax set-aside** bucket, expense tracking                                              | Same neobank trap; banking-led, not software-led                       |
| **QuickBooks Self-Employed**                                            | SaaS (Intuit)                  | Was the incumbent (mileage, expenses, quarterly estimates)                                                                | **Discontinued** — incumbent exited, leaving a gap                     |
| **FreshBooks / Wave**                                                   | SaaS accounting                | Invoicing, expense import, reports                                                                                        | General accounting; no income-smoothing or localized tax automation    |
| **TurboTax/H&R Block Self-Employed, TaxAct, TaxSlayer, Cash App Taxes** | Filing                         | Annual filing + deduction finders                                                                                         | Point-in-time filing, not ongoing tracking                             |
| **SnapTax / ExpenseBot.ai**                                             | SaaS AI                        | AI scans Gmail/receipts → Schedule C / T2125 reports                                                                      | Narrow (receipts only)                                                 |
| **Catch / Trezeo / Sunrise (by H&R Block)**                             | **DEFUNCT** freelancer fintech | —                                                                                                                         | See §4 (what killed them)                                              |

### 2.2 What winners do (copy these)

- **Real-time / automatic tracking** is table stakes (Hurdlr, Found). Manual entry loses users.
- **Live quarterly tax estimates + deadline reminders** directly answer the core pain (Hurdlr, QB SE, TaxSlayer).
- **AI deduction discovery** is the current differentiator (Keeper, ExpenseBot).
- **Industry-specific deduction intelligence** (TurboTax SE, TaxAct "Deduction Maximizer").
- **AI-agent / MCP integration** is the forward edge (Bonsai MCP — connect Claude/ChatGPT/Gemini).
- **Mobile-first capture** of receipts & mileage.

### 2.3 What losers teach us (avoid these)

- **~90% of fintech startups fail** (CB Insights 2023); **~75% within 5 years** (industry analyses, 2025–26).
- Top failure causes: **regulatory complexity**, **high customer-acquisition cost**, **security infrastructure burden**, and **"building tech without a validated problem"** (Forbes, 2025).
- **"Too early is the same as being wrong"** — YC's fintech graveyard: many failed because market/infra wasn't ready; AI may make the _best_ of those ideas viable _now_.
- **Neobank trap (Catch, Trezeo, Sunrise):** banking-as-a-feature without deep differentiation is capital-intensive, low-margin, and regulation-heavy. **We will NOT become a bank.** Stay a _software_ layer (track → smooth → estimate → export) that integrates, never holds money.
- **Feature bloat:** Bonsai wins agencies but is too much for solo users. Keep the core ruthlessly simple; expand via modules.

---

## 3. Our Positioning & Wedge

**Tagline candidate:** _"Smooth income. Know your taxes. Freelancer-native."_

Three things **no incumbent leads with**:

1. **Income smoothing for dry months** — forecast lumpy cash flow, compute a "safe monthly pay-yourself" amount, and visualize the buffer needed to survive dry spells. (Hurdlr/Found track; none _smooth_.)
2. **Localized, automatic quarterly tax estimation** — rule-based engine per jurisdiction (US federal + state to start; locale-configurable) that recomputes live as transactions land, with set-aside guidance and deadline alerts.
3. **Multi-currency by default** — native multi-currency income/expense with FX normalization for tax reporting.

**Layer on top (catch-up in the AI era):**

- AI receipt OCR + auto-categorization.
- AI cash-flow forecasting & "can I afford X this month?" natural-language answers.
- Export-ready Schedule C / tax summaries.

**Why Expo + local SQLite + Supabase fits:** cross-platform reach (iOS/Android/Web) at low cost; **offline-first local SQLite** for privacy/speed (most rivals are cloud-only); **Supabase** for auth, encrypted cloud backup, multi-device sync, and server-side tax rules.

---

## 4. Tech Architecture

### 4.1 Stack (confirmed from repo)

- **Expo SDK 56** (`expo: ^56.0.16`), **React 19.2**, **React Native 0.85**, **Expo Router** (file-based, `typedRoutes` + `reactCompiler` on — `app.json:37-39`), **TypeScript strict**.
- Existing primitives to reuse: `ThemedText`/`ThemedView` (`src/components/themed-text.tsx`, `src/components/themed-view.tsx`), `useTheme()` (`src/hooks/use-theme.ts`), `Colors`/`Spacing`/`MaxContentWidth` (`src/constants/theme.ts`), platform-split files via `.web.tsx` (see `src/components/app-tabs.web.tsx`).
- ⚠️ **Caveat to fix before build:** `eslint-config-expo` is declared twice — `~57.0.0` in `dependencies` (`package.json:7`) and `~56.0.4` in `devDependencies` (`package.json:34`). Consolidate to one version matching the SDK.

### 4.2 Layered architecture

```
┌─────────────────────────────────────────────┐
│  UI (Expo Router screens)  ·  src/app/*   │
├─────────────────────────────────────────────┤
│  Feature modules (hooks + components)        │
│   income · expenses · smoothing · tax · ai   │
├─────────────────────────────────────────────┤
│  State / domain layer (Zustand or Context) │
├─────────────────────────────────────────────┤
│  Local store: SQLite (offline-first, SoT)   │  ← primary, fast, private
├─────────────────────────────────────────────┤
│  Sync / Auth / Cloud: Supabase            │  ← backup, multi-device, rules
│   Auth · Postgres · Storage (receipts)      │
├─────────────────────────────────────────────┤
│  AI services (edge + cloud LLM)            │
│   OCR · categorization · forecasting · chat  │
└─────────────────────────────────────────────┘
```

- **Local-first:** SQLite is the source of truth on-device (OP-SQLite / `expo-sqlite`). Works offline; no round-trips for daily entry.
- **Cloud sync:** Supabase Postgres mirrors the local schema; sync engine pushes/pulls on change + conflict resolution (last-write-wins + version vector for MVP, CRDT later if needed).
- **Auth:** Supabase Auth (email + OAuth: Google/Apple). Never store secrets in the bundle; use Supabase anon key + RLS policies.
- **Receipts:** images → Supabase Storage (encrypted at rest); thumbnails cached locally.
- **AI:** see §7.

### 4.3 Proposed dependencies to add

- `expo-sqlite` (or OP-SQLite) — local DB.
- `zustand` — lightweight state (avoids Context re-render pain; complements existing hooks).
- `react-native-svg` + a charts lib (`victory-native` or `expo-charts`) — dashboard viz.
- `@supabase/supabase-js` + `expo-sqlite` sync adapter.
- AI SDK of choice (`@ai-sdk/openai` or Anthropic) behind a server route (never expose keys client-side).
- `react-hook-form` + `zod` — forms & validation.
- `expo-localization` + `i18n` — multi-currency/locale.

---

## 5. Data Model

### 5.1 Local SQLite (primary)

```sql
users            (id, supabase_uid, default_currency, tax_locale, created_at)
accounts         (id, name, type[bank|wallet|client], currency, is_primary)
transactions     (id, account_id, type[income|expense], amount, currency,
                  amount_base, fx_rate, category_id, txn_date, counterparty,
                  note, receipt_id, created_at, updated_at, sync_status)
categories       (id, name, kind[income|expense], is_deductible, tax_bucket, color)
receipts         (id, txn_id, local_path, remote_path, ocr_raw, created_at)
tax_profiles     (id, user_id, locale, filing_status, entity_type[sole_prop|llc|s_corp],
                  quarterly_due_dates, ytd_income_base, ytd_expense_base, ytd_deductible_base)
tax_rules        (id, locale, bracket_def, deductible_categories, effective_from)
smoothed_plan   (id, user_id, month, safe_pay, buffer_required, projected_net_base)
budgets          (id, category_id, period[monthly|quarterly], limit_base, created_at)
sync_log         (entity, entity_id, last_synced_at, version, op[upsert|delete])
```

### 5.2 Supabase (cloud mirror + auth + rules)

- `auth.users` (managed by Supabase).
- Postgres tables mirroring the above, **Row-Level Security** scoped to `auth.uid()`.
- `storage.receipts` bucket (per-user folder).
- `tax_rules` table (server-authored; client reads only) — keeps tax logic centralized & updatable without app releases.

---

## 6. Feature Modules (full app)

### 6.1 Auth & Onboarding

- Supabase email + Google/Apple OAuth (`src/app/(auth)/*` new routes).
- Guided onboarding: entity type (sole prop / LLC / S-corp), tax locale (US federal + state picker), default currency, typical monthly expenses.
- "Connect a client/currency" step to seed multi-currency from day one.
- Reuse `ThemeProvider` + `AnimatedSplashOverlay` (`src/app/_layout.tsx:14`) for branded entry.

### 6.2 Income Tracking (irregular by design)

- Manual + recurring templates (retainer/client) + import (CSV/bank later).
- **Multi-currency:** each transaction carries `currency` + `amount_base` (normalized to user base currency via FX table).
- Client ledger: per-client YTD income, outstanding invoices.
- Irregularity signal: tag "lumpy" clients; feed the smoothing engine.

### 6.3 Expense Tracking (AI-assisted)

- Quick entry; **AI auto-categorization** from description/receipt.
- **Receipt OCR:** snap → AI extracts merchant/amount/date/tax → pre-fills txn.
- Deductibility flag per category (drives tax engine).
- Mileage logger (bonus, Hurdlr-style) using `expo-location` later.

### 6.4 Income Smoothing (OUR WEDGE)

- **Safe monthly pay:** given YTD income, fixed obligations, and a volatility model of past income, compute the max stable amount the user can pay themselves each month without dipping below buffer.
- **Dry-month buffer:** projected net per month; highlight months where net < safe-pay and show "save X now."
- Visualization: 12-month cash-flow ribbon (charts lib) with buffer band.
- Adjustable assumptions (expected next income, tax set-aside %).

### 6.5 Tax Engine (localized, automatic, live)

- **Rule-based core** (deterministic, auditable) driven by `tax_rules`:
  - Estimated tax = f(income_base, entity_type, locale brackets, deductions).
  - Quarterly split (US: 90% annual / 4 with safe-harbor logic).
  - **Recomputes live** as transactions land; shows "projected owe" vs "paid/withheld."
- **Set-aside guidance:** recommended tax bucket per month = projected quarterly ÷ 3, surfaced in smoothing.
- **Deadline reminders:** push/local notifications for quarterly due dates (`tax_profiles.quarterly_due_dates`).
- **Export:** Schedule C-ready summary + CSV for CPA; "reviewed by a pro" upsell hook (Keeper-style) _without_ us becoming the filer.
- Locale-configurable: start US federal+state; structure so EU/UK VAT-style logic can plug in.

### 6.6 Multi-Currency

- FX table (cached daily, refreshed on connectivity).
- All tax/math in `amount_base`; UI shows original + converted.
- Per-currency account balances; consolidated base-currency net worth.

### 6.7 Dashboard & AI Insights

- Hero cards: this-month net, safe-pay, next tax deadline + amount due, buffer health.
- **AI insights:** natural-language answers ("Can I pay myself $4k this month?", "Which category blew up vs last quarter?").
- **AI forecast:** predict next-quarter income/expense using history + seasonality.
- MCP-style agent hook (Bonsai-inspired): expose read-only data tools so external AIs can query (stretch goal, post-MVP).

### 6.8 Reports

- P&L, categorized spend, deductible total, quarterly tax summary.
- One-tap export (PDF/CSV) for accountants.

### 6.9 Settings & Sync

- Profile, currencies, tax locale, categories, notification prefs.
- Sync status indicator; manual "sync now"; offline queue.
- Privacy: local-first, encrypt SQLite at rest, receipts encrypted in Storage.

---

## 7. AI Integration Plan

| Capability               | Approach                                      | Where                                               |
| ------------------------ | --------------------------------------------- | --------------------------------------------------- |
| Receipt OCR + extraction | Vision LLM (Cloud) or on-device ML            | Server route (keys safe) → writes `transactions`    |
| Auto-categorization      | Few-shot LLM + learned user rules             | Server; caches category suggestions locally         |
| Tax Q&A / forecasting    | LLM with tool-calls into local DB (read-only) | Server agent; returns plain-language + numbers      |
| Deduction discovery      | Rules engine + LLM edge-case scan             | Hybrid: rules primary, LLM explains/surfaces misses |
| Agent/MCP (stretch)      | Expose read-only data tools                   | Post-MVP                                            |

**Guardrails:** never expose API keys in the RN bundle (all AI via Supabase Edge Functions / server route); show confidence + let user correct (corrections improve local model); keep tax _math_ deterministic (AI explains, rules compute).

---

## 8. Monetization (Micro-SaaS)

- **Free:** 1 currency, manual entry, basic dashboard, quarterly estimate.
- **Pro (target ~$8–12/mo):** multi-currency, AI OCR + categorization, income smoothing, set-aside automation, reports/export, multi-device sync.
- **Tax-assist add-on (optional):** CPA review/efile referral (Keeper-style partnership, not us filing).
- Avoid neobank; revenue = subscription + referral fees (no balance-sheet risk).

---

## 9. Build Phases

**Phase 0 — Foundation (align repo)**

- Fix duplicate `eslint-config-expo`; confirm SDK 56 toolchain.
- Add deps; stand up SQLite + Zustand; scaffold route tree under `src/app/`.

**Phase 1 — MVP (tracking + smoothing + tax core)**

- Auth (Supabase), transactions (income/expense), categories, multi-currency base.
- Localized quarterly tax engine (US federal+state), live recompute, reminders.
- Income-smoothing module + dashboard hero cards.
- Local SQLite only; Supabase sync stubbed.

**Phase 2 — Cloud + AI**

- Supabase auth/sync/Storage; offline queue + conflict resolution.
- AI receipt OCR + auto-categorization; AI insights Q&A.
- Reports/export (Schedule C summary, CSV).

**Phase 3 — Polish & Growth**

- Multi-currency FX refresh, per-client ledgers, mileage.
- AI forecasting; MCP/agent hook (stretch).
- Subscription paywall, onboarding polish, notifications.

---

## 10. Risks & Lessons Carried From Failures

- **Don't become a bank** (Catch/Trezeo/Sunrise). Software-only; partner for anything money-moving.
- **Validated problem, not tech-first** — income smoothing + localized tax is the wedge; ship that, not a 20-module suite.
- **CAC discipline** — lean on Expo cross-platform + content/SEO (freelancer finance) vs paid blitz.
- **Security & compliance by default** — encrypt local DB + receipts; RLS on every Supabase table; no keys client-side.
- **Deterministic tax math** — users trust numbers; AI assists, rules compute.
- **Offline resilience** — local-first means the app is useful with zero connectivity; sync is a bonus.

---

## 11. Open Questions (decide before Phase 1)

1. **Primary locale to ship first?** (Assume US federal + one state; which state?)
2. **Entity types in v1?** (sole prop only, or + LLC/S-corp?)
3. **AI provider** (OpenAI vs Anthropic vs on-device) and latency/cost budget?
4. **Sync conflict policy** (last-write-wins acceptable for MVP?).
5. **Subscription price point** validation with 5–10 freelancers pre-build.
6. **Bank/CSV import** in MVP or Phase 2+? (Affects "automatic" perception.)
