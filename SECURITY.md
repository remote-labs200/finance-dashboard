# Security Policy

## Supported Versions

| Version | Supported |
|---|---|
| 1.x (current) | ✅ Active development — security fixes applied in the next release |
| < 1.0 | ❌ Pre-release — use at your own risk |

## Reporting a Vulnerability

SmoothTax handles financial data — tax records, income, expenses, and personal
information — so security is taken seriously.

If you discover a security vulnerability, **please do not open a public issue**.
Instead, report it privately by emailing **[INSERT SECURITY EMAIL]**.

### What to include

- **Type of issue** (e.g., SQL injection, XSS, exposed credentials, RLS bypass)
- **Location** — file paths, line numbers, or commit hashes if known
- **Steps to reproduce** — the minimum actions needed to trigger the issue
- **Impact** — what an attacker could gain or damage
- **Suggested fix** (optional, but appreciated)

### What to expect

1. **Acknowledgement** within 48 hours of your report
2. **Validation** — we confirm the issue and assess severity
3. **Fix timeline** — critical issues are prioritised and patched within 7 days;
   moderate issues within 30 days
4. **Disclosure** — after the fix is released, we'll publicly acknowledge your
   responsible disclosure (unless you prefer to remain anonymous)

## Security Architecture

### Cloud-First, SQLite Cache

- **Supabase** is the source of truth. All user data is stored in PostgreSQL
  with **Row-Level Security (RLS)** enforced per `auth.uid()`. Every table has
  an RLS policy scoped to the authenticated user.
- **SQLite** is a local cache. No secrets, passwords, or tokens are stored in
  the SQLite database.

### Authentication

- Auth is handled entirely by **Supabase Auth** (email/password + OAuth).
- No passwords are ever hashed or stored locally. All credential verification
  happens server-side.
- Session tokens are stored in `expo-secure-store` (hardware-backed encrypted
  storage on iOS/Android).
- The Supabase publishable key is public by design (RLS protects the data), but the
  **service role key** must never be exposed client-side.

### API & AI

- All AI requests go through **Supabase Edge Functions** — no LLM API keys
  are embedded in the client bundle.
- Edge Functions use the Supabase service role key server-side only.

### Receipt Storage

- Receipt images are uploaded to **Supabase Storage** with RLS policies.
- Storage buckets are configured with per-user folder isolation.
- Images are encrypted at rest by Supabase.

### Data in Transit

- All communication with Supabase is over **TLS 1.2+**.
- The Supabase client (`@supabase/supabase-js`) enforces HTTPS-only connections.

## Best Practices for Contributors

- **Never commit secrets.** API keys, tokens, passwords, and service role keys
  must never appear in the codebase. Use `.env` files (excluded by `.gitignore`).
- **Use env vars for configuration.** All configurable values should be read from
  environment variables (`EXPO_PUBLIC_*` prefix for client-safe; server-only
  values must not use the `EXPO_PUBLIC_` prefix).
- **Keep RLS policies permissive only to `auth.uid()`.** Every database
  operation must be scoped to the authenticated user. Never write queries that
  bypass RLS on the client side.
- **Validate inputs server-side.** Client-side validation is for UX only.
  Supabase RLS and Edge Functions must validate all inputs.
- **Review dependency updates.** Before updating a dependency, check for known
  vulnerabilities via `npm audit` or Snyk.

## Vulnerability Disclosure Timeline

| Phase | Duration |
|---|---|
| Initial acknowledgement | ≤ 48 hours |
| Severity assessment | ≤ 72 hours |
| Critical fix release | ≤ 7 days |
| Moderate fix release | ≤ 30 days |
| Public disclosure | After fix is released |

## Contact

For security-related issues: **[INSERT SECURITY EMAIL]**

For general issues or questions, use the project's [GitHub Issues](https://github.com/<your-org>/smooth-tax/issues).
