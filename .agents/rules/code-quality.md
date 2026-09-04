# Code Quality, Formatting & Verification Rules

This project enforces strict static analysis, formatting, and zero-defect guidelines.

---

## 1. Zero Warnings & Zero Errors Policy

All PRs, commits, and agent tasks must maintain **0 errors and 0 warnings** across all tooling:

```bash
bun run check          # Svelte & TypeScript check
bun run lint           # Oxlint static analysis
bun run format:check   # Oxfmt formatting check
bun run build          # Production bundle compilation
```

## 2. Formatting Standards (Oxfmt)

- **Indent:** 4 spaces (defined in `.oxfmtrc.json`).
- **Trailing Comma:** `none`
- **Arrow Parens:** `avoid`
- **Print Width:** 120
- Format files using `bun run format`.

## 3. Linting Standards (Oxlint)

- Configured in `.oxlintrc.json` with `typescript` and `unicorn` plugins.
- Disallowed anti-patterns:
    - `no-async-promise-executor`
    - `no-case-declarations`
    - `no-class-assign`
    - `no-compare-neg-zero`
    - Floating promises in unhandled contexts
    - Unused variables or imports

## 4. Package Dependencies

- Package management is handled with Bun (`bun.lock`).
- Do not run `npm install` or `pnpm install` which would create unwanted lockfiles (`package-lock.json`, `pnpm-lock.yaml`).
