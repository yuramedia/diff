---
name: subtitle-diff
description: >-
    Provides workflows, procedures, and architectural references for modifying,
    debugging, or enhancing the subtitle comparison engine, normalization pipeline,
    diff rendering modes (Side-by-Side and Unified), and export functions.
---

# Subtitle Diff Engineering Skill

This skill guides agents through the lifecycle of subtitle ingestion, cleaning, diffing, rendering, and exporting in this repository.

---

## 1. Architecture & Pipeline Overview

```
User Input (DropZone / DualEditor / MKV Tracks)
       │
       ▼
1. Parsing (subtitle-parser.ts / mkv-parser.ts)
   Extract lines from ASS/SSA, SRT, VTT, TXT, or Matroska stream
       │
       ▼
2. Normalization & Filtering (text-processor.ts)
   Apply options: stripTags, removeDrawLines, removePosLines,
   mergeAlphaTiming, normalizeWhitespace, removeHonorifics, etc.
       │
       ▼
3. Diff Calculation (diff-engine.ts via diff-pipeline.ts)
   Clamp to MAX_DIFF_LINES (20,000)
   Run Myers algorithm (createTwoFilesPatch)
   Convert to diff2html AST (diff2htmlHtml)
   Sanitize HTML with DOMPurify (sanitize.ts)
       │
       ▼
4. Rendering & Export (DiffViewer.svelte / Toolbar.svelte)
   Side-by-Side (.d2h-files-diff) or Unified (.d2h-file-diff)
   Export: Standalone HTML (exportFullHtml) or Full PNG (exportFullImage)
```

---

## 2. Step-by-Step Workflows

### Workflow A: Adding a New Subtitle Cleaning Filter

1. **Update State Definition:**
    - Add the filter boolean property to the `options` object in `src/lib/state.svelte.ts`.
2. **Implement Filter Logic:**
    - Add the transformation function in `src/lib/engine/text-processor.ts`.
    - Ensure the regex or string operation does not cause catastrophic backtracking (ReDoS).
    - Verify that sequential filters do not interfere with line numbers or indexing.
3. **Expose Filter in UI:**
    - Add a switch entry to `toggleOptions` in `src/lib/components/DiffOptions.svelte`.
    - Update preset configurations (`default`, `strict`, `raw`) if appropriate.
4. **Trigger Recomputation:**
    - Call `runDiffPipeline()` from `src/lib/engine/diff-pipeline.ts` to trigger a non-blocking debounced diff calculation.

### Workflow B: Modifying Diff Rendering or Theming

1. **Side-by-Side vs Unified Containers:**
    - Side-by-Side uses `.d2h-files-diff` with two `.d2h-file-side-diff` blocks.
    - Unified uses `.d2h-file-diff`.
2. **Line Number Alignment:**
    - Side-by-Side line numbers use `.d2h-code-side-linenumber` (`width: 3.6em`).
    - Unified line numbers use `.d2h-code-linenumber` (`width: 7.6em`), containing `.line-num1` (old #, `3.6em`, left) and `.line-num2` (new #, `3.6em`, right).
    - Keep `line-height: 18px` locked on both line number cells and code line cells to prevent vertical drift.
3. **Overriding diff2html Colors:**
    - Always override both `.d2h-del`, `.d2h-ins` and the compound `.d2h-file-diff .d2h-del.d2h-change` / `.d2h-file-diff .d2h-ins.d2h-change` classes in `src/app.css`.
    - Mirror any style overrides into the embedded `<style>` block in `Toolbar.svelte` for standalone HTML export.

### Workflow C: Verifying Export Output

1. **HTML Export:**
    - Ensure `Toolbar.svelte` generates a self-contained HTML document with embedded CSP, theme CSS, and sanitized diff markup.
2. **PNG Image Export:**
    - Verify that `html-to-image` temporarily unclamps `maxHeight`, `height`, and `overflow` on `.diff-output`.
    - Respect canvas dimensions: clamp rendered height to maximum `16,000px` to prevent browser canvas allocation crashes.

---

## 3. Verification Commands

Always run after making changes to the diff engine or components:

```bash
bun run check
bun run lint
bun run format:check
bun run build
```
