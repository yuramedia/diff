/**
 * Text processor with 12+ configurable filters.
 * Ported from evadiff's handleLines() function.
 */
import type { Caption } from "./subtitle-parser";

export interface ProcessingOptions {
    stripTags: boolean;
    removeEmptyLines: boolean;
    normalizeWhitespace: boolean;
    normalizeCharacters: boolean;
    removePosLines: boolean;
    removeDrawLines: boolean;
    mergeDuplicateLines: boolean;
    mergeAlphaTiming: boolean;
    removeSpecialCharacters: boolean;
    removeHonorifics: boolean;
    lowerCase: boolean;
    ignorePunctuation: boolean;
    ignoreHonorifics: boolean;
    excludedStyles: string[];
    replace: Record<string, string>;
}

export const DEFAULT_OPTIONS: ProcessingOptions = {
    stripTags: true,
    removeEmptyLines: true,
    normalizeWhitespace: true,
    normalizeCharacters: true,
    removePosLines: true,
    removeDrawLines: true,
    mergeDuplicateLines: true,
    mergeAlphaTiming: false,
    removeSpecialCharacters: false,
    removeHonorifics: false,
    lowerCase: false,
    ignorePunctuation: false,
    ignoreHonorifics: false,
    excludedStyles: [],
    replace: {}
};

export interface ProcessedResult {
    lines: string[];
    styles: Set<string>;
}

export function processLines(data: Caption[] | undefined | null, options: ProcessingOptions): ProcessedResult {
    const lines: string[] = [];
    const styles = new Set<string>();

    if (!Array.isArray(data)) return { lines, styles };

    for (const line of data) {
        if (line.type !== "caption") continue;

        // Skip excluded styles
        if (line.data?.Style && options.excludedStyles?.includes(line.data.Style) && !line.content?.includes("{")) {
            continue;
        }

        // Remove \\pos lines
        if (options.removePosLines && line.content && /\{[^}]*\\pos/.test(line.content)) continue;

        // Remove \\p (drawing) lines
        if (options.removeDrawLines && line.content && /\{[^}]*\\p[0-9 .\-\\}]/.test(line.content)) continue;

        let text = line.content || line.text || "";

        // Handle style exclusions with \\r overrides
        if (options.excludedStyles.length > 0 && line.content.includes("{")) {
            const matches = [...line.content.matchAll(/\{[^}]*\\r([^\\}]*)[^}]*\}/g)];
            if (matches.length > 0) {
                const sp = line.content.split(/\{[^}]*\\r[^\\}]*[^}]*\}/g);
                let newText = sp[0] || "";

                for (let i = 0; i < matches.length; i++) {
                    let effectiveStyle = matches[i][1];
                    if (line.data?.Style && effectiveStyle === "") {
                        effectiveStyle = line.data.Style;
                    }
                    if (!options.excludedStyles.includes(effectiveStyle)) {
                        newText += matches[i][0] + (sp[i + 1] || "");
                    }
                }
                text = newText;
            }
        }

        // Always apply thorough tag cleaning when stripTags is enabled
        if (options.stripTags) {
            text = text
                // Strip drawing commands: {\p1}...{\p0}
                .replace(
                    /\{[^}]*\\p(?:0+[1-9]|[1-9]{1}\d{0,3})[^}]*\}.*?\{[^}]*\\p0.*?(?<!\\p1)\}|\{[^}]*\\p(?:0+[1-9]|[1-9]{1}\d{0,3}).*$/g,
                    ""
                )
                // Strip all ASS override tags and comments in curly brackets: { ... }
                .replace(/\{[^}]*\}/g, "")
                // Strip HTML tags: <i>, <b>, <u>, <font...>, etc.
                .replace(/<[^>]+>/g, "")
                // Convert hard space \h to regular space
                .replace(/\\h/g, " ")
                // Convert ASS newline markers \N and \n to space
                .replace(/\s*\\[nN]\s*/g, " ");
        }

        // Normalize characters (smart quotes, ellipsis)
        if (options.normalizeCharacters) {
            text = text
                .replace(/[\u2018\u2019]/g, "'")
                .replace(/[\u201C\u201D]/g, '"')
                .replace(/…/g, "...");
        }

        // Remove special characters
        if (options.removeSpecialCharacters) {
            text = text.replace(/[.,/#!$%^&*;:{}=\-_`~()…?–—]/g, "");
        }

        // Remove honorifics
        if (options.removeHonorifics) {
            text = text.replace(
                /\b-(?:san|sama|kun|chan|tan|senpai|sensei|kohai|hakase|neechan|oneesan|oneesama|oneechan|onichan|onisan|obasan|oobasan|neesan|aneki|aniki|zeki|han|niichan|dono|ojosama|niisan|oniisama|ojisan|nee|nii)\b/gi,
                ""
            );
        }

        // Normalize whitespace
        if (options.normalizeWhitespace) {
            text = text.replace(/\xa0/g, " ").replace(/\s+/g, " ").trim();
        } else {
            text = text.trim();
        }

        // Remove empty lines (after stripping tags & normalizing whitespace)
        if (options.removeEmptyLines && text === "") continue;

        // Custom replacements
        for (const rep in options.replace) {
            text = text.replaceAll(rep, options.replace[rep]);
        }

        // Lower case
        if (options.lowerCase) {
            text = text.toLowerCase();
        }

        // Merge duplicate lines
        if (lines[lines.length - 1] === text) {
            if (options.mergeDuplicateLines) continue;
        } else if (options.mergeAlphaTiming && text.startsWith(lines[lines.length - 1] || "")) {
            lines[lines.length - 1] = text;
            continue;
        }

        lines.push(text);

        if (line.data?.Style) {
            styles.add(line.data.Style);
        }
    }

    return { lines, styles };
}
