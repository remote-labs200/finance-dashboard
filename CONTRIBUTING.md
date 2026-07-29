# Contributing to SmoothTax

Thanks for your interest in contributing to SmoothTax. This document covers
everything you need to know to contribute effectively — from setting up your
environment to landing a pull request.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Workflow](#development-workflow)
- [Project Architecture](#project-architecture)
- [Coding Standards](#coding-standards)
- [Commit Conventions](#commit-conventions)
- [Pull Request Process](#pull-request-process)
- [Testing](#testing)
- [Reporting Issues](#reporting-issues)

---

## Code of Conduct

This project follows the [Contributor Covenant](CODE_OF_CONDUCT.md). By
participating, you agree to uphold its standards. Unacceptable behaviour should
be reported to the project maintainers.

---

## Getting Started

### Prerequisites

- **Node.js** >= 18
- **npm** >= 10
- **Expo CLI** — `npx expo` (no global install required)
- **Supabase account** (free tier) — for auth and cloud sync features
- **iOS Simulator** (macOS) / **Android Emulator** or a physical device

### Local Setup

```bash
# Clone the repo
git clone https://github.com/<your-org>/smooth-tax
cd smooth-tax

# Install dependencies
npm install

# Set up environment
cp .env.example .env
# Fill in your Supabase project URL and anon key

# Start the dev server
npx expo start
```

### Supabase Setup

1. Create a project at [supabase.com](https://supabase.com)
2. Run the migration in `supabase/migrations/20240727000000_initial_schema.sql`
   via the SQL Editor
3. Enable email/password auth in **Authentication > Providers**
4. Copy your project URL and anon key into `.env`

---

## Development Workflow

### Branch Strategy

| Branch | Purpose |
|---|---|
| `main` | Stable, release-ready. Protected — no direct pushes. |
| `develop` | Integration branch for feature work. |
| `feat/<name>` | New features. Branch off `develop`. |
| `fix/<name>` | Bug fixes. Branch off `develop`. |
| `docs/<name>` | Documentation changes. Branch off `develop`. |
| `refactor/<name>` | Code refactors with no behaviour change. Branch off `develop`. |

### Workflow

1. Create a feature/fix branch from `develop`:
   ```bash
   git checkout develop
   git pull origin develop
   git checkout -b feat/my-feature
   ```

2. Make your changes, following the coding standards below.

3. Keep your branch up to date:
   ```bash
   git fetch origin
   git rebase origin/develop
   ```

4. Run type checking and linting before committing:
   ```bash
   npx tsc --noEmit
   npm run lint
   ```

5. Push and open a pull request against `develop`.

---

## Project Architecture

SmoothTax follows a **layered architecture** with a clear separation of concerns:

```
src/
├── app/           # Expo Router screens (UI layer)
├── components/    # Reusable UI components
├── constants/     # Theme tokens (colors, spacing, fonts)
├── db/            # Repository layer (data access)
│   ├── *-repo.ts  #   CRUD operations per entity
│   ├── cloud-writer.ts  #   Cloud write helper
│   ├── cache-metadata.ts #  Cache freshness tracking
│   └── schema.ts  #   SQLite migrations + type interfaces
├── hooks/         # Custom React hooks
├── lib/           # Service libraries (ai, sync, tax, fx, etc.)
└── stores/        # Zustand state management
```

### Key Principles

- **Repositories** (`src/db/*-repo.ts`) own all data access. Screens and services
  never write raw SQL or Supabase queries — they call repo functions.
- **Services** (`src/lib/*.ts`) encapsulate business logic (tax computation,
  income smoothing, AI orchestration, FX rate management).
- **Stores** (`src/stores/*.ts`) manage global UI state (auth session, theme).
  They use Zustand for simplicity and performance.
- **Screens** (`src/app/*`) are thin — they compose components, call repos
  and stores, and handle navigation.

### Data Flow

```
User Action → Screen → Repo → cloudUpsert() → Supabase (source of truth)
                                         ↘ SQLite cache (offline read)
```

All writes go to **Supabase first** (source of truth) then cache locally in
**SQLite**. Reads come from SQLite for instant response. If offline, writes
queue in `sync_log` and flush when connectivity returns.

---

## Coding Standards

### TypeScript

- **Strict mode** is enabled in `tsconfig.json`. Avoid `any` — use proper
  types, generics, or `unknown` with narrowing.
- All interfaces and types for data entities are defined in
  `src/db/schema.ts`.
- Use explicit return types on exported functions (especially repo functions).
- Prefer `const` over `let`. Never use `var`.

### Naming Conventions

| Category | Convention | Example |
|---|---|---|
| Files & directories | `kebab-case` | `account-repo.ts`, `cloud-writer.ts` |
| React components | `PascalCase` | `ThemedText`, `AnimatedIcon` |
| Functions & variables | `camelCase` | `findAccountsByUser()`, `lastSyncedAt` |
| Interfaces & types | `PascalCase` | `Account`, `Transaction` |
| Constants | `UPPER_SNAKE_CASE` | `MIGRATIONS`, `SYNC_TABLES` |
| Database tables | `snake_case` | `user_preferences`, `cache_metadata` |

### React & Expo

- Use **Expo Router** for all navigation — never import React Navigation directly.
- Use `ThemedText` and `ThemedView` from `src/components/` instead of raw
  `Text` and `View` for theme-aware rendering.
- Platform-specific code goes in `.web.tsx` variants. The base `.tsx` file
  targets mobile. Expo Router resolves the correct file automatically.
- Use `useTheme()` hook from `src/hooks/use-theme.ts` for runtime theme access.
- Avoid `useEffect` for data fetching — use repo functions directly in event
  handlers or Zustand actions.

### SQL & Supabase

- Local SQLite queries use the `expo-sqlite` API via safe wrappers.
- Supabase queries use `@supabase/supabase-js` via the client in
  `src/lib/supabase.ts`.
- Always scope queries to the authenticated user: `eq('user_id', auth.uid())`.
- Never bypass RLS — do not use `.select('*', { head: true })` or service role
  key on the client.

### Styles & Layout

- Use `StyleSheet.create()` for component styles (not inline styles).
- Reference theme tokens from `src/constants/theme.ts`:
  `Colors`, `Spacing`, `FontSize`, `MaxContentWidth`.
- Prefer flexbox layout. Avoid fixed widths/heights where possible.
- Support light and dark mode — `Colors` returns the correct palette based on
  the current theme.

---

## Commit Conventions

We use **Conventional Commits** with the following prefixes:

| Prefix | Scope | Example |
|---|---|---|
| `feat:` | New feature | `feat: add income smoothing visualisation` |
| `fix:` | Bug fix | `fix: safe area padding on web scan screen` |
| `refactor:` | Code change with no behaviour change | `refactor: extract cloudUpsert helper` |
| `docs:` | Documentation | `docs: add MermaidJS architecture diagrams` |
| `chore:` | Tooling, deps, CI | `chore: upgrade expo to 56.0.17` |
| `style:` | Formatting, whitespace | `style: sort imports alphabetically` |
| `test:` | Adding or fixing tests | `test: add account-repo unit tests` |
| `perf:` | Performance improvement | `perf: memoise forecast calculation` |
| `security:` | Security fix | `security: sanitise receipt filename input` |

**Commit message format:**

```
<prefix>(<optional-scope>): <short description>

<body — optional, explain why and what, not how>
```

**Good examples:**

```
feat: add cache-metadata freshness tracking per table
fix(web): prevent header overlap on scan screen
refactor: replace local auth fallback with Supabase Auth
```

**Bad examples:**

```
fix bug
WIP
Update file
```

---

## Pull Request Process

1. **Create your PR** against the `develop` branch (not `main`).
2. **Title** should follow the commit convention format
   (e.g., `feat: add income smoothing engine`).
3. **Description** must include:
   - What changed and why
   - Screenshots (for UI changes — mobile and web)
   - Testing instructions
   - Any breaking changes or migration steps
4. **TypeScript check** must pass:
   ```bash
   npx tsc --noEmit
   ```
5. **Lint check** must pass:
   ```bash
   npm run lint
   ```
6. **Review requirements**:
   - At least one maintainer review required
   - All review comments must be resolved before merge
   - No merge conflicts with `develop`
7. **Merge**: Squash-merge into `develop`. The merge commit title should match
   the PR title.

---

## Testing

Tests are run via the standard Expo / Jest setup:

```bash
# Run all tests
npx jest

# Watch mode
npx jest --watch

# Run tests for a specific file
npx jest src/db/account-repo.test.ts
```

### Test Guidelines

- Unit test **repositories** with an in-memory SQLite database.
- Unit test **services** (tax engine, income smoothing, forecast) with
  deterministic inputs and expected outputs.
- Use **descriptive test names** that explain the scenario and expected
  behaviour:
  ```typescript
  describe('findAccountsByUser', () => {
    it('returns only accounts belonging to the given user', async () => { ... });
    it('returns empty array when user has no accounts', async () => { ... });
  });
  ```
- Mock the Supabase client for repo tests — never hit the production API.

---

## Reporting Issues

### Bug Reports

Open a [GitHub Issue](https://github.com/<your-org>/smooth-tax/issues) and
include:

- **Steps to reproduce** — minimal, complete, verifiable steps
- **Expected behaviour** — what should happen
- **Actual behaviour** — what actually happens (screenshots help)
- **Environment** — device, OS version, Expo SDK version, app version
- **Logs** — relevant console output or crash logs

### Feature Requests

Open a [GitHub Issue](https://github.com/<your-org>/smooth-tax/issues) with the
label `enhancement` and describe:

- **Problem** — what's missing or painful
- **Proposed solution** — how you'd like it to work
- **Alternatives considered** — what else could solve the problem
- **Context** — how this fits into the SmoothTax product direction

### Security Vulnerabilities

**Do not open a public issue.** Email reports privately —
see [SECURITY.md](SECURITY.md) for details.

---

## Need Help?

- Check the [README](README.md) for setup and usage guides.
- Review the [BLUEPRINT](BLUEPRINT.md) for product direction and architecture
  rationale.
- Open a [GitHub Discussion](https://github.com/<your-org>/smooth-tax/discussions)
  for questions or ideas.

Thank you for contributing to SmoothTax.
