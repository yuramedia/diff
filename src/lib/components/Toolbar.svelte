<script lang="ts">
	import {
		ArrowLeftRight,
		Trash2,
		ImageDown,
		GitCompareArrows,
		Loader2,
		ChevronDown,
		FileCode,
		FileText,
		Download
	} from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { processLines } from '$lib/engine/text-processor';
	import { computeDiff } from '$lib/engine/diff-engine';
	import { Button } from '$lib/components/ui/button';
	import diff2htmlRawCss from 'diff2html/bundles/css/diff2html.min.css?raw';

	let showExportMenu = $state(false);
	let isExporting = $state(false);
	let exportMenuRef = $state<HTMLDivElement>();

	function swapFiles() {
		const temp = appState.fileA;
		appState.fileA = appState.fileB;
		appState.fileB = temp;
	}

	function clearAll() {
		appState.files.clear();
		appState.fileA = null;
		appState.fileB = null;
		appState.diffResult = null;
	}

	function makeErrorHtml(message: string): string {
		return '<div class="p-4 text-center text-muted-foreground">' + message + '</div>';
	}

	function makeNoDiffHtml(titleA: string, titleB: string): string {
		return '<div class="p-8 text-center"><p class="text-lg font-medium text-emerald-600 dark:text-emerald-400">✓ No differences</p><p class="text-sm text-muted-foreground mt-1">' + titleA + ' and ' + titleB + ' are identical after processing.</p></div>';
	}

	function findDifferences() {
		if (!appState.fileA || !appState.fileB) return;

		const fileA = appState.files.get(appState.fileA);
		const fileB = appState.files.get(appState.fileB);
		if (!fileA || !fileB) return;

		appState.isComputing = true;

		requestAnimationFrame(() => {
			try {
				const processedA = processLines(fileA.data, {
					...appState.options,
					excludedStyles: appState.options.excludedStyles,
					replace: appState.options.replace
				});

				const processedB = processLines(fileB.data, {
					...appState.options,
					excludedStyles: appState.options.excludedStyles,
					replace: appState.options.replace
				});

				if (processedA.lines.length === 0 && processedB.lines.length === 0) {
					appState.diffResult = {
						html: makeErrorHtml('Both files are empty after processing.'),
						additions: 0, deletions: 0, unchanged: 0, isEmpty: true
					};
					appState.isComputing = false;
					return;
				}

				if (processedA.lines.length === 0) {
					appState.diffResult = {
						html: makeErrorHtml('File "' + fileA.title + '" is empty after filtering.'),
						additions: 0, deletions: 0, unchanged: 0, isEmpty: true
					};
					appState.isComputing = false;
					return;
				}

				if (processedB.lines.length === 0) {
					appState.diffResult = {
						html: makeErrorHtml('File "' + fileB.title + '" is empty after filtering.'),
						additions: 0, deletions: 0, unchanged: 0, isEmpty: true
					};
					appState.isComputing = false;
					return;
				}

				const result = computeDiff(
					processedA.lines,
					processedB.lines,
					fileA.title,
					fileB.title,
					{
						matching: appState.diffMatching,
						outputFormat: appState.diffOutputFormat
					}
				);

				if (result.isEmpty) {
					appState.diffResult = {
						html: makeNoDiffHtml(fileA.title, fileB.title),
						additions: 0, deletions: 0,
						unchanged: processedA.lines.length,
						isEmpty: true
					};
				} else {
					appState.diffResult = result;
				}
			} catch (err) {
				console.error('Diff computation error:', err);
				appState.diffResult = {
					html: makeErrorHtml('Error computing diff: ' + (err as Error).message),
					additions: 0, deletions: 0, unchanged: 0, isEmpty: true
				};
			} finally {
				appState.isComputing = false;
			}
		});
	}

	/**
	 * Export Full Image (PNG):
	 * Captures the COMPLETE height of the diff table, eliminating truncation.
	 */
	async function exportFullImage() {
		showExportMenu = false;
		const diffEl = document.querySelector('.diff-output') as HTMLElement;
		if (!diffEl) return;

		isExporting = true;
		appState.statusMessage = 'Rendering full-length PNG image (all lines)...';

		// Save current constraints
		const origMaxHeight = diffEl.style.maxHeight;
		const origHeight = diffEl.style.height;
		const origOverflow = diffEl.style.overflow;
		const origContain = diffEl.style.contain;

		try {
			// Temporarily expand diff container to its full natural scroll height
			diffEl.style.maxHeight = 'none';
			diffEl.style.height = 'auto';
			diffEl.style.overflow = 'visible';
			diffEl.style.contain = 'none';

			// Give DOM a tick to layout
			await new Promise(r => setTimeout(r, 60));

			const fullHeight = diffEl.scrollHeight;
			const fullWidth = Math.max(diffEl.scrollWidth, 1100);
			const isDark = document.documentElement.classList.contains('dark');

			const { toPng } = await import('html-to-image');
			const dataUrl = await toPng(diffEl, {
				quality: 1,
				pixelRatio: 1.5,
				height: fullHeight,
				width: fullWidth,
				backgroundColor: isDark ? '#141416' : '#ffffff',
				style: {
					maxHeight: 'none',
					height: `${fullHeight}px`,
					overflow: 'visible',
					contain: 'none'
				}
			});

			const fileA = appState.fileA ? appState.files.get(appState.fileA) : null;
			const fileB = appState.fileB ? appState.files.get(appState.fileB) : null;
			const titleA = fileA?.title || 'Original';
			const titleB = fileB?.title || 'Changed';
			const cleanName = `${titleA}_vs_${titleB}`.replace(/[^a-zA-Z0-9_-]/g, '_');

			const link = document.createElement('a');
			link.download = `diff_${cleanName}_full.png`;
			link.href = dataUrl;
			link.click();

			appState.statusMessage = 'Full diff image downloaded successfully!';
		} catch (err) {
			console.error('Export error:', err);
			appState.statusMessage = 'Export failed: ' + (err instanceof Error ? err.message : 'Unknown error');
		} finally {
			// Restore scrollable constraints
			diffEl.style.maxHeight = origMaxHeight;
			diffEl.style.height = origHeight;
			diffEl.style.overflow = origOverflow;
			diffEl.style.contain = origContain;
			isExporting = false;
		}
	}

	function escapeHtml(str: string): string {
		return str
			.replace(/&/g, '&amp;')
			.replace(/</g, '&lt;')
			.replace(/>/g, '&gt;')
			.replace(/"/g, '&quot;')
			.replace(/'/g, '&#039;');
	}

	/**
	 * Export Standalone HTML (.html):
	 * Self-contained HTML report with embedded styles, clean GitHub-grade theme, and no watermarks.
	 */
	function exportFullHtml() {
		showExportMenu = false;
		if (!appState.diffResult) return;

		const fileA = appState.fileA ? appState.files.get(appState.fileA) : null;
		const fileB = appState.fileB ? appState.files.get(appState.fileB) : null;
		const titleA = fileA?.title || 'Original (A)';
		const titleB = fileB?.title || 'Changed (B)';
		const isDark = document.documentElement.classList.contains('dark');
		const isSideBySide = appState.diffOutputFormat !== 'line-by-line';

		// Clean up diff2html output: remove hardcoded light/dark scheme classes to let CSS variables take full control
		const cleanedDiffHtml = appState.diffResult.html.replace(/\bd2h-(?:light|dark|auto)-color-scheme\b/g, '');

		const columnHeaderHtml = isSideBySide
			? `<div class="column-headers">
					<div class="col-header">
						<span class="col-tag col-tag-a">A</span>
						<span class="col-title" title="${escapeHtml(titleA)}">${escapeHtml(titleA)}</span>
					</div>
					<div class="col-header">
						<span class="col-tag col-tag-b">B</span>
						<span class="col-title" title="${escapeHtml(titleB)}">${escapeHtml(titleB)}</span>
					</div>
				</div>`
			: '';

		const htmlDocument = `<!DOCTYPE html>
<html lang="en" class="${isDark ? 'dark' : ''}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(titleA)} vs ${escapeHtml(titleB)} · Diff</title>
  <style>
${diff2htmlRawCss}

:root {
  --color-bg: #f6f8fa;
  --color-surface: #ffffff;
  --color-surface-hover: #f3f4f6;
  --color-border: #d0d7de;
  --color-text: #1f2328;
  --color-text-muted: #656d76;
  --color-hunk-bg: #f6f8fa;
  --color-hunk-text: #57606a;

  --diff-ins-bg: #dafbe1;
  --diff-ins-fg: #1a7f37;
  --diff-ins-border: rgba(46, 160, 67, 0.35);
  --diff-ins-hl: #acf2bd;

  --diff-del-bg: #ffebe9;
  --diff-del-fg: #cf222e;
  --diff-del-border: rgba(248, 81, 73, 0.35);
  --diff-del-hl: #ff8182;
}

html.dark {
  --color-bg: #0d1117;
  --color-surface: #161b22;
  --color-surface-hover: #1f242c;
  --color-border: #30363d;
  --color-text: #e6edf3;
  --color-text-muted: #7d8590;
  --color-hunk-bg: #13171f;
  --color-hunk-text: #7d8590;

  --diff-ins-bg: rgba(46, 160, 67, 0.15);
  --diff-ins-fg: #3fb950;
  --diff-ins-border: rgba(46, 160, 67, 0.35);
  --diff-ins-hl: rgba(46, 160, 67, 0.4);

  --diff-del-bg: rgba(248, 81, 73, 0.15);
  --diff-del-fg: #f85149;
  --diff-del-border: rgba(248, 81, 73, 0.35);
  --diff-del-hl: rgba(248, 81, 73, 0.4);
}

* {
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif;
  margin: 0;
  padding: 24px;
  background-color: var(--color-bg);
  color: var(--color-text);
  line-height: 1.5;
  transition: background-color 0.15s ease, color 0.15s ease;
}

.diff-page {
  max-width: 1440px;
  margin: 0 auto;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 16px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.page-title {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.file-name {
  word-break: break-all;
}

.title-arrow {
  color: var(--color-text-muted);
  font-size: 14px;
  font-weight: 400;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.stat-pills {
  display: flex;
  align-items: center;
  gap: 6px;
}

.stat-pill {
  display: inline-flex;
  align-items: center;
  font-size: 12px;
  font-weight: 600;
  padding: 3px 10px;
  border-radius: 6px;
  font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace;
}

.stat-add {
  background: var(--diff-ins-bg);
  color: var(--diff-ins-fg);
  border: 1px solid var(--diff-ins-border);
}

.stat-del {
  background: var(--diff-del-bg);
  color: var(--diff-del-fg);
  border: 1px solid var(--diff-del-border);
}

.stat-unc {
  background: var(--color-surface);
  color: var(--color-text-muted);
  border: 1px solid var(--color-border);
}

.theme-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  color: var(--color-text);
  padding: 4px 12px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s ease;
  user-select: none;
}

.theme-btn:hover {
  background: var(--color-surface-hover);
  border-color: var(--color-text-muted);
}

.diff-container {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
}

/* Side Column Headers */
.column-headers {
  display: flex;
  background: var(--color-bg);
  border-bottom: 1px solid var(--color-border);
  font-size: 12px;
  font-weight: 600;
}

.col-header {
  width: 50%;
  flex: 1 1 50%;
  padding: 8px 16px;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.col-header:first-child {
  border-right: 1px solid var(--color-border);
}

.col-title {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.col-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 4px;
  flex-shrink: 0;
}

.col-tag-a {
  background: var(--diff-del-bg);
  color: var(--diff-del-fg);
  border: 1px solid var(--diff-del-border);
}

.col-tag-b {
  background: var(--diff-ins-bg);
  color: var(--diff-ins-fg);
  border: 1px solid var(--diff-ins-border);
}

/* diff2html overrides */
.d2h-wrapper {
  margin: 0 !important;
  text-align: left !important;
  background: transparent !important;
}

.d2h-file-wrapper {
  border: none !important;
  margin: 0 !important;
  border-radius: 0 !important;
  background: transparent !important;
}

.d2h-file-header {
  display: none !important;
}

.d2h-files-diff {
  display: flex !important;
  width: 100% !important;
}

.d2h-file-side-diff {
  width: 50% !important;
  flex: 1 1 50% !important;
  border-right: 1px solid var(--color-border) !important;
  overflow-x: auto !important;
  background: var(--color-surface) !important;
}

.d2h-file-side-diff:last-child {
  border-right: none !important;
}

.d2h-diff-table {
  width: 100% !important;
  border-collapse: collapse !important;
  table-layout: fixed !important;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace !important;
  font-size: 12.5px !important;
}

.d2h-diff-tbody > tr > td {
  padding: 0 !important;
  vertical-align: top !important;
}

.d2h-info {
  background-color: var(--color-hunk-bg) !important;
  color: var(--color-hunk-text) !important;
  border-top: 1px solid var(--color-border) !important;
  border-bottom: 1px solid var(--color-border) !important;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace !important;
  font-size: 11px !important;
  font-weight: 600 !important;
  padding: 4px 12px !important;
}

.d2h-emptyplaceholder,
.d2h-code-side-emptyplaceholder {
  background-color: var(--color-bg) !important;
  border: none !important;
  min-height: 22px !important;
}

.d2h-code-side-linenumber,
.d2h-code-linenumber {
  position: static !important;
  display: table-cell !important;
  width: 3.5em !important;
  min-width: 3.5em !important;
  max-width: 3.5em !important;
  box-sizing: border-box !important;
  direction: ltr !important;
  text-align: right !important;
  vertical-align: top !important;
  padding: 2px 8px !important;
  line-height: 1.45 !important;
  font-size: 11px !important;
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, monospace !important;
  user-select: none !important;
  background-color: var(--color-bg) !important;
  color: var(--color-text-muted) !important;
  border-right: 1px solid var(--color-border) !important;
  border-top: none !important;
  border-bottom: none !important;
}

.d2h-code-side-line,
.d2h-code-line {
  display: flex !important;
  flex-direction: row !important;
  align-items: flex-start !important;
  padding: 2px 6px !important;
  width: 100% !important;
  box-sizing: border-box !important;
  line-height: 1.45 !important;
}

.d2h-code-line-prefix {
  display: inline-block !important;
  width: 1.2em !important;
  min-width: 1.2em !important;
  max-width: 1.2em !important;
  flex-shrink: 0 !important;
  text-align: center !important;
  user-select: none !important;
  font-weight: 700 !important;
  opacity: 0.8 !important;
  line-height: 1.45 !important;
}

.d2h-code-line-ctn {
  flex: 1 1 auto !important;
  width: auto !important;
  min-width: 0 !important;
  white-space: pre-wrap !important;
  word-break: break-word !important;
  unicode-bidi: plaintext !important;
  line-height: 1.45 !important;
  color: var(--color-text) !important;
}

.d2h-cntx {
  background-color: var(--color-surface) !important;
}

.d2h-ins {
  background-color: var(--diff-ins-bg) !important;
  border-color: transparent !important;
}

.d2h-ins .d2h-code-side-linenumber,
.d2h-ins .d2h-code-linenumber {
  background-color: var(--diff-ins-bg) !important;
  color: var(--diff-ins-fg) !important;
}

.d2h-del {
  background-color: var(--diff-del-bg) !important;
  border-color: transparent !important;
}

.d2h-del .d2h-code-side-linenumber,
.d2h-del .d2h-code-linenumber {
  background-color: var(--diff-del-bg) !important;
  color: var(--diff-del-fg) !important;
}

del, .d2h-del del {
  display: inline !important;
  background-color: var(--diff-del-hl) !important;
  color: inherit !important;
  text-decoration: none !important;
  border-radius: 3px !important;
  padding: 0 2px !important;
}

ins, .d2h-ins ins {
  display: inline !important;
  background-color: var(--diff-ins-hl) !important;
  color: inherit !important;
  text-decoration: none !important;
  border-radius: 3px !important;
  padding: 0 2px !important;
}
  </style>
</head>
<body>
  <div class="diff-page">
    <header class="app-header">
      <div class="header-left">
        <h1 class="page-title">
          <span class="file-name">${escapeHtml(titleA)}</span>
          <span class="title-arrow">↔</span>
          <span class="file-name">${escapeHtml(titleB)}</span>
        </h1>
      </div>
      <div class="header-right">
        <div class="stat-pills">
          <span class="stat-pill stat-add">+${appState.diffResult.additions} added</span>
          <span class="stat-pill stat-del">-${appState.diffResult.deletions} removed</span>
          <span class="stat-pill stat-unc">=${appState.diffResult.unchanged} unchanged</span>
        </div>
        <button id="themeToggle" class="theme-btn" onclick="toggleTheme()" type="button" aria-label="Toggle Theme">
          <span id="themeIcon">${isDark ? '☀️' : '🌙'}</span>
          <span id="themeLabel">${isDark ? 'Light' : 'Dark'}</span>
        </button>
      </div>
    </header>
    <main class="diff-container">
      ${columnHeaderHtml}
      ${cleanedDiffHtml}
    </main>
  </div>
  <script>
    function updateThemeUI(isDark) {
      var icon = document.getElementById('themeIcon');
      var label = document.getElementById('themeLabel');
      if (icon && label) {
        icon.textContent = isDark ? '☀️' : '🌙';
        label.textContent = isDark ? 'Light' : 'Dark';
      }
    }

    function toggleTheme() {
      var isDark = document.documentElement.classList.toggle('dark');
      try {
        localStorage.setItem('diff_report_theme', isDark ? 'dark' : 'light');
      } catch (e) {}
      updateThemeUI(isDark);
    }

    (function() {
      try {
        var saved = localStorage.getItem('diff_report_theme');
        if (saved === 'dark') {
          document.documentElement.classList.add('dark');
        } else if (saved === 'light') {
          document.documentElement.classList.remove('dark');
        }
      } catch (e) {}
      var isDark = document.documentElement.classList.contains('dark');
      updateThemeUI(isDark);
    })();
  ${'<'}/script>
</body>
</html>`;

		const blob = new Blob([htmlDocument], { type: 'text/html;charset=utf-8' });
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		const cleanName = `${titleA}_vs_${titleB}`.replace(/[^a-zA-Z0-9_-]/g, '_');
		link.download = `diff_${cleanName}.html`;
		link.href = url;
		link.click();
		URL.revokeObjectURL(url);
		appState.statusMessage = 'Full standalone HTML report exported!';
	}

	/**
	 * Export Unified Patch (.diff):
	 * Standard patch format for Git or text diffing tools.
	 */
	function exportPatch() {
		showExportMenu = false;
		const fileA = appState.fileA ? appState.files.get(appState.fileA) : null;
		const fileB = appState.fileB ? appState.files.get(appState.fileB) : null;
		if (!fileA || !fileB) return;

		const titleA = fileA.title || 'Original';
		const titleB = fileB.title || 'Changed';
		const textA = fileA.rawText || fileA.data.map(c => c.content || c.text).join('\n');
		const textB = fileB.rawText || fileB.data.map(c => c.content || c.text).join('\n');

		import('diff').then(({ createTwoFilesPatch }) => {
			const patch = createTwoFilesPatch(titleA, titleB, textA, textB, 'a/' + fileA.filename, 'b/' + fileB.filename);
			const blob = new Blob([patch], { type: 'text/x-diff;charset=utf-8' });
			const url = URL.createObjectURL(blob);
			const link = document.createElement('a');
			const cleanName = `${titleA}_vs_${titleB}`.replace(/[^a-zA-Z0-9_-]/g, '_');
			link.download = `diff_${cleanName}.diff`;
			link.href = url;
			link.click();
			URL.revokeObjectURL(url);
			appState.statusMessage = 'Unified .diff patch exported!';
		});
	}

	// Close export menu on outside click
	$effect(() => {
		if (showExportMenu && typeof document !== 'undefined') {
			function handleOutside(e: MouseEvent) {
				if (exportMenuRef && !exportMenuRef.contains(e.target as Node)) {
					showExportMenu = false;
				}
			}
			document.addEventListener('mousedown', handleOutside);
			return () => document.removeEventListener('mousedown', handleOutside);
		}
	});

	const canCompare = $derived(appState.fileA !== null && appState.fileB !== null);
	const hasFiles = $derived(appState.files.size > 0);
	const hasDiffResult = $derived(appState.diffResult !== null && !appState.diffResult.isEmpty);
</script>

<div class="flex flex-wrap items-center gap-2">
	<Button
		onclick={findDifferences}
		disabled={!canCompare || appState.isComputing}
		size="sm"
		class="gap-2 flex-1 sm:flex-none cursor-pointer"
	>
		{#if appState.isComputing}
			<Loader2 class="h-4 w-4 animate-spin" />
			Computing...
		{:else}
			<GitCompareArrows class="h-4 w-4" />
			Find Differences
		{/if}
	</Button>

	{#if hasFiles}
		<Button variant="outline" size="sm" onclick={swapFiles} disabled={!canCompare} class="gap-1.5 cursor-pointer">
			<ArrowLeftRight class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Swap</span>
		</Button>

		<!-- Export Menu Dropdown -->
		{#if hasDiffResult}
			<div bind:this={exportMenuRef} class="relative inline-block text-left">
				<Button
					variant="outline"
					size="sm"
					onclick={() => showExportMenu = !showExportMenu}
					disabled={isExporting}
					class="gap-1.5 cursor-pointer border-indigo-200 dark:border-indigo-800 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-50 dark:hover:bg-indigo-950/50"
				>
					{#if isExporting}
						<Loader2 class="h-3.5 w-3.5 animate-spin" />
						<span>Exporting...</span>
					{:else}
						<Download class="h-3.5 w-3.5" />
						<span>Export Full</span>
						<ChevronDown class="h-3 w-3 opacity-60 transition-transform {showExportMenu ? 'rotate-180' : ''}" />
					{/if}
				</Button>

				{#if showExportMenu}
					<div
						class="absolute right-0 top-full mt-1.5 z-50 w-64 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-1.5 space-y-1 animate-fade-in"
						role="menu"
					>
						<div class="px-2.5 py-1 text-[10px] uppercase font-bold tracking-wider text-muted-foreground border-b border-border/50">
							Select Export Format
						</div>

						<button
							type="button"
							onclick={exportFullImage}
							class="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer text-xs group"
						>
							<ImageDown class="h-4 w-4 text-indigo-500 mt-0.5 shrink-0" />
							<div>
								<div class="font-semibold text-foreground group-hover:text-primary">Full Image (PNG)</div>
								<div class="text-[11px] text-muted-foreground">High-res, entire scrollable diff from line 1 to end</div>
							</div>
						</button>

						<button
							type="button"
							onclick={exportFullHtml}
							class="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer text-xs group"
						>
							<FileCode class="h-4 w-4 text-emerald-500 mt-0.5 shrink-0" />
							<div>
								<div class="font-semibold text-foreground group-hover:text-primary">Standalone HTML (.html)</div>
								<div class="text-[11px] text-muted-foreground">Self-contained offline report with full diff & styling</div>
							</div>
						</button>

						<button
							type="button"
							onclick={exportPatch}
							class="w-full flex items-start gap-2.5 p-2 rounded-lg hover:bg-muted text-left transition-colors cursor-pointer text-xs group"
						>
							<FileText class="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
							<div>
								<div class="font-semibold text-foreground group-hover:text-primary">Unified Patch (.diff)</div>
								<div class="text-[11px] text-muted-foreground">Standard git diff format for text/subtitle tools</div>
							</div>
						</button>
					</div>
				{/if}
			</div>
		{/if}

		<Button variant="ghost" size="sm" onclick={clearAll} class="gap-1.5 text-destructive hover:text-destructive cursor-pointer">
			<Trash2 class="h-3.5 w-3.5" />
			<span class="hidden sm:inline">Clear</span>
		</Button>
	{/if}
</div>
