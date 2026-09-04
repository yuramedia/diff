import { createTwoFilesPatch } from "diff";
import { html as diff2htmlHtml } from "diff2html";
import { sanitizeDiffHtml, sanitizePatchHeader } from "../utils/sanitize";

export const MAX_DIFF_LINES = 20_000;

export interface DiffOptions {
    matching?: "words" | "lines" | "none";
    diffStyle?: "words" | "lines" | "none";
    outputFormat?: "side-by-side" | "line-by-line";
}

export interface DiffResult {
    html: string;
    additions: number;
    deletions: number;
    unchanged: number;
    isEmpty: boolean;
    isTruncated?: boolean;
}

export function computeDiff(
    inputA: string[] | string,
    inputB: string[] | string,
    titleA: string = "Original",
    titleB: string = "Changed",
    options: DiffOptions = {}
): DiffResult {
    let linesA = Array.isArray(inputA)
        ? [...inputA]
        : typeof inputA === "string"
          ? inputA.length === 0
              ? []
              : inputA.split(/\r?\n/)
          : [];

    let linesB = Array.isArray(inputB)
        ? [...inputB]
        : typeof inputB === "string"
          ? inputB.length === 0
              ? []
              : inputB.split(/\r?\n/)
          : [];

    let isTruncated = false;
    if (linesA.length > MAX_DIFF_LINES) {
        linesA = linesA.slice(0, MAX_DIFF_LINES);
        isTruncated = true;
    }
    if (linesB.length > MAX_DIFF_LINES) {
        linesB = linesB.slice(0, MAX_DIFF_LINES);
        isTruncated = true;
    }

    const textA = linesA.join("\n");
    const textB = linesB.join("\n");

    const countA = linesA.length;
    const countB = linesB.length;

    if (textA === textB) {
        return {
            html: "",
            additions: 0,
            deletions: 0,
            unchanged: countA,
            isEmpty: true,
            isTruncated
        };
    }

    const cleanTitleA = sanitizePatchHeader(titleA) || "Original";
    const cleanTitleB = sanitizePatchHeader(titleB) || "Changed";

    const patch = createTwoFilesPatch(cleanTitleA, cleanTitleB, textA, textB, "", "", {
        context: 3
    });

    const matchStyle = options.matching || options.diffStyle || "words";
    const outputFormat = options.outputFormat || "side-by-side";

    const rawHtml = diff2htmlHtml(patch, {
        matching: matchStyle === "words" ? "words" : matchStyle === "lines" ? "lines" : "none",
        outputFormat: outputFormat,
        drawFileList: false,
        rawTemplates: {}
    });

    const sanitizedHtml = sanitizeDiffHtml(rawHtml);

    const bannerHtml = isTruncated
        ? `<div class="mb-3 p-3 bg-amber-500/10 border border-amber-500/30 text-amber-600 dark:text-amber-400 rounded-md text-xs font-medium">
             ⚠️ File exceeds the maximum comparison limit of ${MAX_DIFF_LINES.toLocaleString()} lines. Content was truncated to prevent browser UI lockup.
           </div>`
        : "";

    // Count changes
    let additions = 0;
    let deletions = 0;
    const patchLines = patch.split("\n");
    for (const line of patchLines) {
        if (line.startsWith("+") && !line.startsWith("+++")) additions++;
        if (line.startsWith("-") && !line.startsWith("---")) deletions++;
    }
    const unchanged = Math.max(countA, countB) - Math.max(additions, deletions);

    return {
        html: bannerHtml + sanitizedHtml,
        additions,
        deletions,
        unchanged: Math.max(0, unchanged),
        isEmpty: false,
        isTruncated
    };
}
