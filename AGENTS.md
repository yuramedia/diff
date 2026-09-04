# AGENTS.md

Welcome to **Subtitle Diff** (`yuramedia/diff`), a high-performance web application designed for comparing subtitles across formats (ASS, SSA, SRT, VTT, TXT) and embedded tracks inside MKV containers.

This document establishes the architectural standards, conventions, safety boundaries, and workflows that all AI agents operating in this repository must follow.

---

## 1. Technology Stack & Tooling

| Layer                  | Technology                                                                       | Details                                                                                           |
| :--------------------- | :------------------------------------------------------------------------------- | :------------------------------------------------------------------------------------------------ |
| **Framework**          | [SvelteKit 2](https://kit.svelte.dev/) + [Svelte 5](https://svelte.dev/)         | Runes mode exclusively (`$state`, `$derived`, `$props`). No Svelte 4 legacy syntax.               |
| **Language**           | TypeScript (Strict)                                                              | `strict: true`, `moduleResolution: "bundler"`, `skipLibCheck: true`.                              |
| **Styling**            | [Tailwind CSS 4](https://tailwindcss.com/) + CSS variables                       | Vanilla CSS design tokens in `src/app.css` mapped to OKLCH colors.                                |
| **Diff Engine**        | [diff](https://github.com/kpdecker/jsdiff) + [diff2html](https://diff2html.xyz/) | Myers diffing with dual view modes: Side-by-Side and Unified.                                     |
| **Sanitizer**          | [DOMPurify](https://github.com/cure53/DOMPurify)                                 | Strict SVG/HTML sanitization sink for diff rendering and HTML export.                             |
| **Parsers**            | Custom EBML/Matroska parser + Subtitle Parser                                    | In-memory stream parser with bounds clamping and DoS guards.                                      |
| **Runtime & PM**       | [Bun](https://bun.sh/)                                                           | Bun runtime and package manager (`bun run <script>`, `bun.lock`).                                 |
| **Linter & Formatter** | [Oxlint](https://oxc.rs/) + [Oxfmt](https://oxc.rs/)                             | 4 spaces, no trailing commas, print width 120. Configured via `.oxlintrc.json` & `.oxfmtrc.json`. |

---

## 2. Directory Structure & Architecture

```text
src/
├── app.css                         # Global CSS, theme design tokens (OKLCH), diff2html overrides
├── app.d.ts                        # SvelteKit application types
├── app.html                        # Base HTML shell with strict CSP and inline dark theme script
├── lib/
│   ├── components/                 # Svelte UI components
│   │   ├── DiffOptions.svelte      # Subtitle cleaning filter switches & presets
│   │   ├── DiffViewer.svelte       # diff2html render sink, line highlight & change navigation
│   │   ├── DropZone.svelte         # Drag & drop upload target with size limits
│   │   ├── DualEditor.svelte       # Side-by-side subtitle text inputs & track selectors
│   │   ├── FileList.svelte         # Loaded MKV tracks & dropped files drawer
│   │   ├── Header.svelte           # Top navigation bar & theme toggle
│   │   ├── Toolbar.svelte          # Action buttons, diff triggers, HTML/PNG export
│   │   └── ui/                     # Reusable UI primitives (shadcn-svelte style)
│   ├── engine/                     # Core business logic & processing engines
│   │   ├── diff-engine.ts          # createTwoFilesPatch + diff2htmlHtml + line caps
│   │   ├── diff-pipeline.ts        # Unified diff pipeline with monotonic request tokens
│   │   ├── file-hasher.ts          # SHA-256 with 64-bit FNV-1a fallback
│   │   ├── group-detector.ts       # Subtitle release group tagging
│   │   ├── language-names.ts       # ISO language name mapping & sanitization
│   │   ├── mkv-parser.ts           # Safe EBML container parser for subtitle tracks
│   │   ├── subtitle-parser.ts      # ASS, SSA, SRT, VTT text extraction
│   │   └── text-processor.ts       # Filtering, tag stripping, alpha timing merge
│   ├── state.svelte.ts             # Central reactive AppState class (Svelte 5 runes)
│   ├── utils.ts                    # Class name merging & WithElementRef type helper
│   └── utils/
│       └── sanitize.ts             # DOMPurify config, escapeHtml, sanitizePatchHeader
└── routes/
    ├── +layout.svelte              # Root layout & global container
    └── +page.svelte                # Main application page
```

---

## 3. Strict Development Rules

### Rule 1: Svelte 5 Runes Only

- **Never** use legacy Svelte 3/4 syntax (`let count = 0; $: doubled = count * 2; export let prop`).
- **Always** use runes:
    - `$state(...)` for reactive variables and objects.
    - `$derived(...)` or `$derived.by(() => ...)` for computed values.
    - `$props()` for component inputs.
    - `$bindable()` for two-way bindings.
    - In `WithElementRef` components, always allow `ref?: E | null` to accommodate `$bindable(null)`.
    - Use HTML standard event handlers (e.g. `onclick={() => ...}` instead of `on:click`).

### Rule 2: Zero Errors & Zero Warnings

Before declaring any task complete, verify that all checks pass cleanly:

```bash
bun run check          # svelte-check: must report 0 errors and 0 warnings
bun run lint           # oxlint: must report 0 errors and 0 warnings
bun run format:check   # oxfmt: all matched files must use correct format
bun run build          # vite build: production bundle must compile without error
```

### Rule 3: Security & XSS Prevention

- All user-supplied input, filenames, track names, and error messages MUST be sanitized using `escapeHtml()` or `sanitizePatchHeader()`.
- Diff HTML rendered in the UI or exported as standalone files MUST be sanitized using `sanitizeDiffHtml()` from `src/lib/utils/sanitize.ts`.
- Standalone HTML exports in `Toolbar.svelte` must embed a strict Content Security Policy (`default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; img-src data:;`).

### Rule 4: DoS Prevention & Bounds Clamping

- **Max Diff Lines:** Myers diffing is bounded to `MAX_DIFF_LINES = 20_000` lines in `diff-engine.ts`. Never remove this guard.
- **File Upload Limits:** Text subtitle files are capped at 25MB; MKV containers are capped at 2GB; clipboard paste is capped at 10MB.
- **EBML Parsing:** In `mkv-parser.ts`, always validate VINT integers against `Number.MAX_SAFE_INTEGER`, clamp track headers to 10MB, clamp block groups to 5MB, and guard cluster loops against infinite iterations (`cElemSize = -1`).
- **Regex Safety:** Never write catastrophic backtracking regex patterns. Always use bounded or atomic regexes when parsing drawing tags or comments.

### Rule 5: Subtitle Text Normalization Correctness

- In `text-processor.ts`, `mergeAlphaTiming` must never drop line 1 (guard `lines.length === 0`).
- Excluded style filtering must correctly handle bracketed override tags and `\r` style resets.
- Normalization of punctuation, honorifics, and whitespace must remain idempotent.

---

## 4. Helpful Commands

```bash
bun run dev            # Start Vite development server (port 5173)
bun run build          # Build production bundle with @sveltejs/adapter-static
bun run preview        # Preview production build locally (port 4173)
bun run check          # Type-check Svelte and TypeScript
bun run lint           # Fast static analysis with Oxlint
bun run format         # Format code using Oxfmt (4 spaces, no trailing comma)
bun run format:check   # Validate formatting without writing
```
