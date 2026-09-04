import { appState } from "../state.svelte";
import { processLines } from "./text-processor";
import { computeDiff } from "./diff-engine";
import { escapeHtml, sanitizeDiffHtml } from "../utils/sanitize";

let currentRequestId = 0;

export function makeErrorHtml(message: string): string {
    return `<div class="p-6 text-center text-muted-foreground">${escapeHtml(message)}</div>`;
}

export function makeNoDiffHtml(titleA: string, titleB: string): string {
    const escapedA = escapeHtml(titleA || "Original");
    const escapedB = escapeHtml(titleB || "Changed");
    return `<div class="p-12 text-center">
        <p class="text-xl font-medium text-emerald-600 dark:text-emerald-400">✓ No differences</p>
        <p class="text-sm text-muted-foreground mt-2">${escapedA} and ${escapedB} are identical after processing.</p>
    </div>`;
}

/**
 * Executes the unified subtitle diff processing pipeline.
 * Guards against race conditions, ensures proper escaping, and handles empty file states.
 */
export function runDiffPipeline(): Promise<void> {
    const reqId = ++currentRequestId;

    if (!appState.fileA || !appState.fileB) {
        return Promise.resolve();
    }

    const fileA = appState.files.get(appState.fileA);
    const fileB = appState.files.get(appState.fileB);

    if (!fileA || !fileB) {
        return Promise.resolve();
    }

    appState.isComputing = true;
    appState.statusMessage = "";

    return new Promise<void>(resolve => {
        requestAnimationFrame(() => {
            if (reqId !== currentRequestId) {
                // Superseded by a newer request
                resolve();
                return;
            }

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

                // Fallback to raw text if available and processed lines are empty
                let linesA = processedA.lines;
                if (linesA.length === 0 && fileA.rawText) {
                    linesA = fileA.rawText
                        .split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(l => l.length > 0);
                }

                let linesB = processedB.lines;
                if (linesB.length === 0 && fileB.rawText) {
                    linesB = fileB.rawText
                        .split(/\r?\n/)
                        .map(l => l.trim())
                        .filter(l => l.length > 0);
                }

                if (reqId !== currentRequestId) {
                    resolve();
                    return;
                }

                if (linesA.length === 0 && linesB.length === 0) {
                    appState.diffResult = {
                        html: makeErrorHtml("Both files are empty after processing."),
                        additions: 0,
                        deletions: 0,
                        unchanged: 0,
                        isEmpty: true
                    };
                    return;
                }

                if (linesA.length === 0) {
                    appState.diffResult = {
                        html: makeErrorHtml(`File "${fileA.title || fileA.filename}" is empty after filtering.`),
                        additions: 0,
                        deletions: 0,
                        unchanged: 0,
                        isEmpty: true
                    };
                    return;
                }

                if (linesB.length === 0) {
                    appState.diffResult = {
                        html: makeErrorHtml(`File "${fileB.title || fileB.filename}" is empty after filtering.`),
                        additions: 0,
                        deletions: 0,
                        unchanged: 0,
                        isEmpty: true
                    };
                    return;
                }

                const result = computeDiff(
                    linesA,
                    linesB,
                    fileA.title || fileA.filename || "Original",
                    fileB.title || fileB.filename || "Changed",
                    {
                        matching: appState.diffMatching,
                        outputFormat: appState.diffOutputFormat
                    }
                );

                if (reqId !== currentRequestId) {
                    resolve();
                    return;
                }

                if (result.isEmpty) {
                    appState.diffResult = {
                        html: sanitizeDiffHtml(
                            makeNoDiffHtml(fileA.title || fileA.filename, fileB.title || fileB.filename)
                        ),
                        additions: 0,
                        deletions: 0,
                        unchanged: linesA.length,
                        isEmpty: true
                    };
                } else {
                    appState.diffResult = result;
                }
            } catch (err) {
                console.error("Diff pipeline error:", err);
                if (reqId === currentRequestId) {
                    const msg = err instanceof Error ? err.message : "Unknown diff computation error";
                    appState.diffResult = {
                        html: sanitizeDiffHtml(makeErrorHtml(`Error computing diff: ${msg}`)),
                        additions: 0,
                        deletions: 0,
                        unchanged: 0,
                        isEmpty: true
                    };
                }
            } finally {
                if (reqId === currentRequestId) {
                    appState.isComputing = false;
                }
                resolve();
            }
        });
    });
}
