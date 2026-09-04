/**
 * Mapping of ISO 639-1 and ISO 639-2 language codes to human-readable names.
 */

const LANGUAGE_MAP: Record<string, string> = {
    eng: "English",
    en: "English",
    ind: "Indonesian",
    id: "Indonesian",
    in: "Indonesian",
    jpn: "Japanese",
    ja: "Japanese",
    ara: "Arabic",
    ar: "Arabic",
    chi: "Chinese",
    zho: "Chinese",
    zh: "Chinese",
    "zh-hant": "Chinese (Traditional)",
    "zh-hans": "Chinese (Simplified)",
    "pt-br": "Portuguese",
    "es-419": "Spanish",
    "es-es": "Spanish",
    fre: "French",
    fra: "French",
    fr: "French",
    ger: "German",
    deu: "German",
    de: "German",
    spa: "Spanish",
    es: "Spanish",
    ita: "Italian",
    it: "Italian",
    kor: "Korean",
    ko: "Korean",
    may: "Malay",
    msa: "Malay",
    ms: "Malay",
    pol: "Polish",
    pl: "Polish",
    por: "Portuguese",
    pt: "Portuguese",
    rus: "Russian",
    ru: "Russian",
    tha: "Thai",
    th: "Thai",
    tur: "Turkish",
    tr: "Turkish",
    vie: "Vietnamese",
    vi: "Vietnamese",
    dut: "Dutch",
    nld: "Dutch",
    nl: "Dutch",
    hin: "Hindi",
    hi: "Hindi",
    fil: "Filipino",
    tgl: "Tagalog",
    tl: "Tagalog",
    ces: "Czech",
    cze: "Czech",
    cs: "Czech",
    dan: "Danish",
    da: "Danish",
    fin: "Finnish",
    fi: "Finnish",
    gre: "Greek",
    ell: "Greek",
    el: "Greek",
    heb: "Hebrew",
    he: "Hebrew",
    hun: "Hungarian",
    hu: "Hungarian",
    nor: "Norwegian",
    no: "Norwegian",
    rum: "Romanian",
    ron: "Romanian",
    ro: "Romanian",
    swe: "Swedish",
    sv: "Swedish",
    ukr: "Ukrainian",
    uk: "Ukrainian"
};

function cleanTrackStr(str: string): string {
    return str
        .replace(/[\r\n\0]/g, " ")
        .replace(/[<>]/g, "")
        .trim();
}

export function getLanguageName(code: string): string {
    if (!code || code === "und") return "";
    const clean = code.toLowerCase().trim();
    if (LANGUAGE_MAP[clean]) return LANGUAGE_MAP[clean];
    if (/^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(clean)) {
        return clean.toUpperCase();
    }
    return "";
}

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

        // If langName already includes cleanName (e.g. lang="Chinese (Traditional)", name="Traditional")
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
