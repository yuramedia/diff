/**
 * Diff engine using jsdiff + diff2html.
 */
import { createTwoFilesPatch } from "diff";
import { html as diff2htmlHtml } from "diff2html";

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
}

export function computeDiff(
    inputA: string[] | string,
    inputB: string[] | string,
    titleA: string = "Original",
    titleB: string = "Changed",
    options: DiffOptions = {}
): DiffResult {
    const textA = Array.isArray(inputA)
        ? inputA.join("\n")
        : typeof inputA === "string"
          ? inputA
          : String(inputA ?? "");

    const textB = Array.isArray(inputB)
        ? inputB.join("\n")
        : typeof inputB === "string"
          ? inputB
          : String(inputB ?? "");

    const countA = Array.isArray(inputA) ? inputA.length : textA.split(/\r?\n/).length;
    const countB = Array.isArray(inputB) ? inputB.length : textB.split(/\r?\n/).length;

    if (textA === textB) {
        return {
            html: "",
            additions: 0,
            deletions: 0,
            unchanged: countA,
            isEmpty: true
        };
    }

    const patch = createTwoFilesPatch(titleA, titleB, textA, textB, "", "", {
        context: 3
    });

    const matchStyle = options.matching || options.diffStyle || "words";
    const outputFormat = options.outputFormat || "side-by-side";

    const html = diff2htmlHtml(patch, {
        matching: matchStyle === "words" ? "words" : matchStyle === "lines" ? "lines" : "none",
        outputFormat: outputFormat,
        drawFileList: false,
        rawTemplates: {}
    });

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
        html,
        additions,
        deletions,
        unchanged: Math.max(0, unchanged),
        isEmpty: false
    };
}
