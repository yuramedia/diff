/**
 * Subtitle parser supporting ASS/SSA, SRT, VTT, TXT formats.
 * Replaces the subsrt dependency with a lightweight built-in parser.
 */

export interface Caption {
    type: "caption";
    index: number;
    start: number;
    end: number;
    content: string; // raw content with tags
    text: string; // stripped text
    data?: {
        Style?: string;
        [key: string]: string | undefined;
    };
}

export interface ParsedSubtitle {
    format: string;
    data: Caption[];
    title?: string;
    raw?: string;
}

export function detectFormat(content: string): string {
    const trimmed = content.trim();
    if (
        trimmed.startsWith("[Script Info]") ||
        trimmed.startsWith("[V4+ Styles]") ||
        trimmed.startsWith("[V4 Styles]")
    ) {
        return trimmed.includes("[V4+ Styles]") ? "ass" : "ssa";
    }
    if (trimmed.startsWith("WEBVTT")) return "vtt";
    if (/^\d+\s*\r?\n\d{2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{2}:\d{2}:\d{2}[,.]\d{3}/m.test(trimmed)) return "srt";
    // Fallback: try to detect SRT-like patterns
    if (/\d{2}:\d{2}:\d{2}/.test(trimmed)) return "srt";
    return "txt";
}

function parseTimeSrt(time: string): number {
    const match = time.trim().match(/(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/);
    if (!match) return 0;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const ms = parseInt(match[4], 10);
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s) || Number.isNaN(ms)) return 0;
    return h * 3600000 + m * 60000 + s * 1000 + ms;
}

function parseTimeAss(time: string): number {
    const match = time.trim().match(/(\d+):(\d{2}):(\d{2})\.(\d{2})/);
    if (!match) return 0;
    const h = parseInt(match[1], 10);
    const m = parseInt(match[2], 10);
    const s = parseInt(match[3], 10);
    const cs = parseInt(match[4], 10);
    if (Number.isNaN(h) || Number.isNaN(m) || Number.isNaN(s) || Number.isNaN(cs)) return 0;
    return h * 3600000 + m * 60000 + s * 1000 + cs * 10;
}

function stripAssTags(text: string): string {
    return text
        .replace(/\{[^}]*\\p[1-9]\d*[^}]*\}[\s\S]*?(?:\{[^}]*\\p0[^}]*\}|$)/g, "")
        .replace(/\{[^}]*\}/g, "")
        .replace(/\\h/g, " ")
        .replace(/\s?\\n\s?/g, " ")
        .replace(/\s?\\N\s?/g, "\n");
}

function stripHtmlTags(text: string): string {
    return text.replace(/<[^>]+>/g, "");
}

export function parseSrt(content: string): Caption[] {
    const captions: Caption[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);

    for (const block of blocks) {
        const lines = block.trim().split(/\r?\n/);
        if (lines.length < 2) continue;

        let timeLineIndex = 0;
        // Find the timing line
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("-->")) {
                timeLineIndex = i;
                break;
            }
        }

        const timeParts = lines[timeLineIndex].split("-->");
        if (timeParts.length !== 2) continue;

        const text = lines.slice(timeLineIndex + 1).join("\n");
        const strippedText = stripHtmlTags(text);

        captions.push({
            type: "caption",
            index: captions.length,
            start: parseTimeSrt(timeParts[0]),
            end: parseTimeSrt(timeParts[1]),
            content: text,
            text: strippedText
        });
    }

    return captions;
}

export function parseVtt(content: string): Caption[] {
    const captions: Caption[] = [];
    const blocks = content.trim().split(/\r?\n\r?\n/);

    const parseVttTime = (t: string): number => {
        const cleaned = t.trim().split(" ")[0]; // Remove position info
        const parts = cleaned.split(":");
        if (parts.length === 2) {
            // mm:ss.mmm
            const min = parseInt(parts[0], 10);
            const secMs = parts[1].split(".");
            const sec = parseInt(secMs[0] || "0", 10);
            const ms = parseInt(secMs[1] || "0", 10);
            if (Number.isNaN(min) || Number.isNaN(sec) || Number.isNaN(ms)) return 0;
            return min * 60000 + sec * 1000 + ms;
        }
        return parseTimeSrt(cleaned);
    };

    for (const block of blocks) {
        const trimmed = block.trim();
        if (!trimmed) continue;
        // Skip WEBVTT header and NOTE blocks cleanly without eating subsequent cues
        if (trimmed.startsWith("WEBVTT") || trimmed.startsWith("NOTE")) continue;

        const lines = trimmed.split(/\r?\n/);
        if (lines.length < 1) continue;

        let timeLineIndex = -1;
        for (let i = 0; i < lines.length; i++) {
            if (lines[i].includes("-->")) {
                timeLineIndex = i;
                break;
            }
        }
        if (timeLineIndex === -1) continue;

        const timeParts = lines[timeLineIndex].split("-->");
        if (timeParts.length !== 2) continue;

        const text = lines.slice(timeLineIndex + 1).join("\n");
        const strippedText = stripHtmlTags(text);

        captions.push({
            type: "caption",
            index: captions.length,
            start: parseVttTime(timeParts[0]),
            end: parseVttTime(timeParts[1]),
            content: text,
            text: strippedText
        });
    }

    return captions;
}

export function parseAss(content: string): Caption[] {
    const captions: Caption[] = [];
    const lines = content.split(/\r?\n/);

    let inEvents = false;
    let formatFields: string[] = [];

    for (const line of lines) {
        if (line.trim().startsWith("[Events]")) {
            inEvents = true;
            continue;
        }
        if (line.trim().startsWith("[") && !line.trim().startsWith("[Events]")) {
            if (inEvents) break;
            continue;
        }

        if (inEvents) {
            if (line.startsWith("Format:")) {
                formatFields = line
                    .substring(7)
                    .split(",")
                    .map(f => f.trim());
                continue;
            }

            const isDialogue = line.startsWith("Dialogue:") || line.startsWith("Comment:");
            if (!isDialogue) continue;

            const prefix = line.startsWith("Dialogue:") ? "Dialogue:" : "Comment:";
            const parts = line.substring(prefix.length).split(",");

            if (parts.length < formatFields.length) continue;

            const data: Record<string, string> = {};
            const textFieldIndex = formatFields.indexOf("Text");

            for (let i = 0; i < formatFields.length; i++) {
                if (i === textFieldIndex) {
                    // Text field contains everything after the last format comma
                    data[formatFields[i]] = parts.slice(i).join(",").trim();
                } else {
                    data[formatFields[i]] = (parts[i] || "").trim();
                }
            }

            const rawText = data["Text"] || "";
            const strippedText = stripAssTags(rawText);

            const startTime = data["Start"] ? parseTimeAss(data["Start"]) : 0;
            const endTime = data["End"] ? parseTimeAss(data["End"]) : 0;

            captions.push({
                type: "caption",
                index: captions.length,
                start: startTime,
                end: endTime,
                content: rawText,
                text: strippedText,
                data: {
                    Style: data["Style"],
                    Name: data["Name"],
                    MarginL: data["MarginL"],
                    MarginR: data["MarginR"],
                    MarginV: data["MarginV"],
                    Effect: data["Effect"]
                }
            });
        }
    }

    return captions;
}

export function parseTxt(content: string): Caption[] {
    const lines = content.split(/\r?\n/);
    return lines
        .filter(l => l.trim().length > 0)
        .map((line, i) => ({
            type: "caption" as const,
            index: i,
            start: 0,
            end: 0,
            content: line,
            text: line.trim()
        }));
}

export function parseSubtitle(content: string, format?: string): ParsedSubtitle {
    const detectedFormat = format || detectFormat(content);
    let data: Caption[];

    switch (detectedFormat) {
        case "ass":
        case "ssa":
            data = parseAss(content);
            break;
        case "srt":
            data = parseSrt(content);
            break;
        case "vtt":
            data = parseVtt(content);
            break;
        default:
            data = parseTxt(content);
    }

    // Critical fallback: if subtitle parser returned 0 captions but text is not empty,
    // treat each line as a text caption line so diff comparison always works!
    if (data.length === 0 && content.trim().length > 0) {
        data = parseTxt(content);
    }

    // Extract title from ASS metadata
    let title: string | undefined;
    if (detectedFormat === "ass" || detectedFormat === "ssa") {
        const titleMatch = content.match(/^Title:\s*(.+)$/m);
        if (titleMatch) title = titleMatch[1].trim();
    }

    return { format: detectedFormat, data, title };
}
