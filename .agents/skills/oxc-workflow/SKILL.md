---
name: oxc-workflow
description: >-
    Provides step-by-step procedures for running Oxlint, Oxfmt, SvelteKit type checks,
    and resolving static analysis or formatting issues in the Subtitle Diff codebase.
---

# Oxc Tooling & Verification Workflow

This skill provides procedures for maintaining code quality using the Oxc suite (Oxlint and Oxfmt) alongside SvelteKit's type-checker in this repository.

---

## 1. Quick Command Reference

| Action               | Command                | Configuration               |
| :------------------- | :--------------------- | :-------------------------- |
| **Check Formatting** | `bun run format:check` | `.oxfmtrc.json`             |
| **Apply Formatting** | `bun run format`       | `.oxfmtrc.json`             |
| **Lint Code**        | `bun run lint`         | `.oxlintrc.json`            |
| **Type Check**       | `bun run check`        | `tsconfig.json` & SvelteKit |
| **Production Build** | `bun run build`        | `vite.config.ts`            |

---

## 2. Formatting Guidelines (Oxfmt)

The project configuration in `.oxfmtrc.json`:

- **Tab Width:** 4 spaces
- **Trailing Comma:** `none`
- **Arrow Parens:** `avoid`
- **Print Width:** 120
- **Ignored Patterns:** `.svelte-kit`, `build`, `dist`, `node_modules`, `*.log`, `bun.lockb`

When editing files:

1. Always run `bun run format` before submitting changes.
2. Verify with `bun run format:check` to confirm zero formatting diffs.

---

## 3. Linting Guidelines (Oxlint)

The project configuration in `.oxlintrc.json` enables the `typescript` and `unicorn` plugins.

Key rules enforced:

- `constructor-super`: error
- `for-direction`: error
- `no-async-promise-executor`: error
- `no-case-declarations`: error
- `no-class-assign`: error
- `no-compare-neg-zero`: error

If Oxlint reports any warnings or errors:

1. Locate the file and line number from the report.
2. Fix the violation according to TypeScript strict and modern ES conventions.
3. Re-run `bun run lint` until it reports `Found 0 warnings and 0 errors.`

---

## 4. Svelte & TypeScript Check

Run `bun run check`:

1. SvelteKit will synchronize routing types (`svelte-kit sync`).
2. `svelte-check` will validate all `.svelte`, `.ts`, and `.js` files.
3. Common fixes:
    - For `$bindable(null)` errors in component libraries, ensure `ref?: E | null` is allowed in `WithElementRef`.
    - Ensure Svelte 5 runes (`$state`, `$derived`, `$props`) are used without legacy Svelte 4 reactivity.
