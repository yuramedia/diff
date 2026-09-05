/**
 * Language name resolution and track title formatting using standard ECMAScript Intl.DisplayNames API.
 * Supports ISO 639-1 (2-letter), ISO 639-2 (3-letter), ISO 639-3, and BCP-47 language tags natively.
 */

let displayNames: Intl.DisplayNames | null = null;

try {
    if (typeof Intl !== "undefined" && typeof Intl.DisplayNames !== "undefined") {
        displayNames = new Intl.DisplayNames(["en"], { type: "language", fallback: "none" });
    }
} catch {
    displayNames = null;
}

function cleanTrackStr(str: string): string {
    return str
        .replace(/[\r\n\0]/g, " ")
        .replace(/[<>]/g, "")
        .trim();
}

/**
 * Returns human-readable English name for a given language code (ISO 639-1, 639-2, or BCP-47).
 */
export function getLanguageName(code: string): string {
    if (!code || code === "und") return "";
    const clean = code.trim().replace(/_/g, "-");

    if (displayNames) {
        try {
            const name = displayNames.of(clean);
            if (name) return name;
        } catch {
            // Ignore RangeError on custom/non-standard tags and attempt base language tag
        }

        if (clean.includes("-")) {
            const base = clean.split("-")[0];
            try {
                const name = displayNames.of(base);
                if (name) return name;
            } catch {
                // Ignore RangeError
            }
        }
    }

    // Fallback for valid 2-3 letter code when Intl cannot resolve
    if (/^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(clean)) {
        return clean.toUpperCase();
    }

    return "";
}

/**
 * Formats a clean, readable track title from track metadata.
 */
export function formatTrackTitle(trackNum: number, name?: string, language?: string): string {
    const cleanLang = language ? cleanTrackStr(language) : "";
    const langName = cleanLang ? getLanguageName(cleanLang) : "";
    const cleanName = name ? cleanTrackStr(name) : "";

    const langSuffix = cleanLang && cleanLang !== "und" ? ` [${cleanLang}]` : "";

    if (langName && cleanName) {
        const normLang = langName.toLowerCase();
        const normName = cleanName.toLowerCase();

        // Exact match or redundant name
        if (normLang === normName) {
            return `${langName}${langSuffix}`;
        }

        // If cleanName already starts with or contains langName (e.g. "Chinese (Traditional)")
        if (normName.startsWith(normLang)) {
            return `${cleanName}${langSuffix}`;
        }

        // If langName already includes cleanName (e.g. lang="Traditional Chinese", name="Traditional")
        if (
            normLang.includes(`(${normName})`) ||
            normLang.includes(` ${normName}`) ||
            normLang.endsWith(normName) ||
            normName.includes(normLang)
        ) {
            return `${langName}${langSuffix}`;
        }

        return `${langName} (${cleanName})${langSuffix}`;
    }

    if (langName) {
        return `${langName}${langSuffix}`;
    }

    if (cleanName) {
        return cleanName;
    }

    return `Track ${trackNum}`;
}
