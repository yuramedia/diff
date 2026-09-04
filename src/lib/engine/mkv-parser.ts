/**
 * Matroska (MKV/MKS) Subtitle Extractor
 *
 * Efficient chunked browser-compatible EBML parser that streams subtitle tracks
 * directly from File/Blob without loading gigabytes of video into memory.
 * Accurately handles S_TEXT/ASS, S_TEXT/SSA, S_TEXT/UTF8, S_TEXT/WEBVTT,
 * reconstructing full subtitle files with timestamps and CodecPrivate headers.
 */

import { parseSubtitle, type ParsedSubtitle } from "./subtitle-parser";
import { formatTrackTitle } from "./language-names";

export interface MkvTrackMeta {
    number: number;
    name: string;
    language: string;
    codecId: string;
    type: "ass" | "ssa" | "srt" | "vtt";
    header: string;
}

interface RawSubtitleLine {
    trackNumber: number;
    timeMs: number;
    durationMs: number;
    payload: string;
}

/**
 * Helper class to read binary slices from a File without buffering the entire file.
 */
class ChunkedFileReader {
    private file: File;
    private cachedChunk: Uint8Array | null = null;
    private cachedOffset = -1;
    private readonly chunkSize = 1024 * 1024; // 1MB buffer window

    constructor(file: File) {
        this.file = file;
    }

    get size(): number {
        return this.file.size;
    }

    async readBytes(offset: number, length: number): Promise<Uint8Array> {
        if (offset >= this.file.size) return new Uint8Array(0);

        const actualLen = Math.min(length, this.file.size - offset);
        if (actualLen <= 0) return new Uint8Array(0);

        // Check if entirely within cached chunk
        if (
            this.cachedChunk &&
            offset >= this.cachedOffset &&
            offset + actualLen <= this.cachedOffset + this.cachedChunk.byteLength
        ) {
            const start = offset - this.cachedOffset;
            return this.cachedChunk.subarray(start, start + actualLen);
        }

        // Fetch slice
        const fetchLen = Math.max(actualLen, this.chunkSize);
        const slice = this.file.slice(offset, Math.min(offset + fetchLen, this.file.size));
        const buffer = await slice.arrayBuffer();
        this.cachedChunk = new Uint8Array(buffer);
        this.cachedOffset = offset;

        return this.cachedChunk.subarray(0, actualLen);
    }
}

// Common EBML IDs
const _ID_EBML = 0x1a45dfa3;
const ID_SEGMENT = 0x18538067;
const _ID_SEEKHEAD = 0x114d9b74;
const ID_INFO = 0x1549a966;
const ID_TIMECODESCALE = 0x2ad7b1;
const ID_TRACKS = 0x1654ae6b;
const ID_TRACKENTRY = 0xae;
const ID_TRACKNUMBER = 0xd7;
const ID_TRACKTYPE = 0x83;
const ID_CODECID = 0x86;
const ID_CODECPRIVATE = 0x63a2;
const ID_NAME = 0x536e;
const ID_LANGUAGE = 0x22b59c;
const ID_LANGUAGE_IETF = 0x22b59d;

const ID_CLUSTER = 0x1f43b675;
const ID_TIMECODE = 0xe7;
const ID_BLOCKGROUP = 0xa0;
const ID_BLOCK = 0xa1;
const ID_BLOCKDURATION = 0x9b;
const ID_SIMPLEBLOCK = 0xa3;

const TRACK_TYPE_SUBTITLE = 0x11; // 17

/**
 * Read variable-length EBML ID (raw bits preserved).
 */
function readEbmlId(buf: Uint8Array, offset: number): { id: number; length: number } | null {
    if (offset >= buf.length) return null;
    const first = buf[offset];
    let mask = 0x80;
    let length = 1;

    while (mask > 0 && !(first & mask)) {
        length++;
        mask >>= 1;
    }

    if (length > 4 || offset + length > buf.length) return null;

    let id = first;
    for (let i = 1; i < length; i++) {
        id = (id << 8) | buf[offset + i];
    }

    return { id: id >>> 0, length };
}

/**
 * Read variable-length EBML size or integer.
 */
function readEbmlVint(buf: Uint8Array, offset: number): { value: number; length: number } | null {
    if (offset >= buf.length) return null;
    const first = buf[offset];
    let mask = 0x80;
    let length = 1;

    while (mask > 0 && !(first & mask)) {
        length++;
        mask >>= 1;
    }

    if (length > 8 || offset + length > buf.length) return null;

    // Check for "unknown size" (all value bits are 1)
    const isUnknown =
        (first & (mask - 1)) === mask - 1 && buf.subarray(offset + 1, offset + length).every(b => b === 0xff);

    if (isUnknown) {
        return { value: -1, length };
    }

    // Mask out marker bit for size
    let value = first & (mask - 1);
    for (let i = 1; i < length; i++) {
        value = value * 256 + buf[offset + i];
        if (value > Number.MAX_SAFE_INTEGER) {
            return null; // integer overflow
        }
    }

    return { value, length };
}

function readBigEndianUint(buf: Uint8Array, offset: number, size: number): number {
    let val = 0;
    for (let i = 0; i < size; i++) {
        val = val * 256 + (buf[offset + i] || 0);
    }
    return val;
}

function readStringUtf8(buf: Uint8Array, offset: number, size: number): string {
    const slice = buf.subarray(offset, offset + size);
    return new TextDecoder("utf-8", { fatal: false }).decode(slice);
}

function formatAssTime(ms: number): string {
    const safeMs = Math.max(0, ms);
    const totalSec = Math.floor(safeMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const cs = Math.floor((safeMs % 1000) / 10);
    return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs).padStart(2, "0")}`;
}

function formatSrtTime(ms: number): string {
    const safeMs = Math.max(0, ms);
    const totalSec = Math.floor(safeMs / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    const remainder = Math.floor(safeMs % 1000);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(remainder).padStart(3, "0")}`;
}

/**
 * Extracts all embedded subtitle tracks from an MKV/MKS file.
 */
export async function extractMkvSubtitles(file: File): Promise<ParsedSubtitle[]> {
    const reader = new ChunkedFileReader(file);
    const tracks = new Map<number, MkvTrackMeta>();
    const lines: RawSubtitleLine[] = [];
    let timecodeScaleNs = 1_000_000; // default 1ms

    let offset = 0;
    const fileLen = reader.size;

    // 1. Scan EBML Root elements
    while (offset < fileLen) {
        const headerBytes = await reader.readBytes(offset, 12);
        if (headerBytes.length < 2) break;

        const idResult = readEbmlId(headerBytes, 0);
        if (!idResult) {
            offset++;
            continue;
        }

        const sizeResult = readEbmlVint(headerBytes, idResult.length);
        if (!sizeResult) {
            offset += idResult.length;
            continue;
        }

        const elemId = idResult.id;
        const elemSize =
            sizeResult.value === -1 ? fileLen - offset - idResult.length - sizeResult.length : sizeResult.value;
        const dataOffset = offset + idResult.length + sizeResult.length;

        if (elemId === ID_SEGMENT) {
            // Enter Segment
            offset = dataOffset;
            continue;
        }

        if (elemId === ID_INFO) {
            // Parse Info for TimecodeScale
            const infoData = await reader.readBytes(dataOffset, Math.min(elemSize, 65536));
            let p = 0;
            while (p < infoData.length) {
                const fId = readEbmlId(infoData, p);
                if (!fId) break;
                const fSize = readEbmlVint(infoData, p + fId.length);
                if (!fSize) break;
                const fOffset = p + fId.length + fSize.length;
                if (fId.id === ID_TIMECODESCALE) {
                    timecodeScaleNs = readBigEndianUint(infoData, fOffset, fSize.value);
                }
                p = fOffset + fSize.value;
            }
            offset = dataOffset + elemSize;
            continue;
        }

        if (elemId === ID_TRACKS) {
            // Parse Tracks - clamp header allocation to 10MB max
            if (elemSize <= 0 || elemSize > 10 * 1024 * 1024) {
                offset = dataOffset + Math.max(0, elemSize);
                continue;
            }
            const tracksData = await reader.readBytes(dataOffset, elemSize);
            let p = 0;
            while (p < tracksData.length) {
                const tId = readEbmlId(tracksData, p);
                if (!tId) break;
                const tSize = readEbmlVint(tracksData, p + tId.length);
                if (!tSize || tSize.value < 0) break;
                const tOffset = p + tId.length + tSize.length;

                if (tId.id === ID_TRACKENTRY) {
                    let ep = tOffset;
                    const endEp = tOffset + tSize.value;
                    let trackNum = 0;
                    let trackType = 0;
                    let codecId = "";
                    let name = "";
                    let language = "";
                    let header = "";

                    while (ep < endEp) {
                        const eId = readEbmlId(tracksData, ep);
                        if (!eId) break;
                        const eSize = readEbmlVint(tracksData, ep + eId.length);
                        if (!eSize) break;
                        const eOffset = ep + eId.length + eSize.length;

                        switch (eId.id) {
                            case ID_TRACKNUMBER:
                                trackNum = readBigEndianUint(tracksData, eOffset, eSize.value);
                                break;
                            case ID_TRACKTYPE:
                                trackType = readBigEndianUint(tracksData, eOffset, eSize.value);
                                break;
                            case ID_CODECID:
                                codecId = readStringUtf8(tracksData, eOffset, eSize.value).trim();
                                break;
                            case ID_NAME:
                                name = readStringUtf8(tracksData, eOffset, eSize.value).trim();
                                break;
                            case ID_LANGUAGE:
                            case ID_LANGUAGE_IETF:
                                language = readStringUtf8(tracksData, eOffset, eSize.value).trim();
                                break;
                            case ID_CODECPRIVATE:
                                header = readStringUtf8(tracksData, eOffset, eSize.value);
                                break;
                        }
                        ep = eOffset + eSize.value;
                    }

                    if (trackType === TRACK_TYPE_SUBTITLE && trackNum > 0) {
                        const normalizedCodec = codecId.toUpperCase();
                        let type: "ass" | "ssa" | "srt" | "vtt" = "srt";
                        if (normalizedCodec.includes("ASS")) type = "ass";
                        else if (normalizedCodec.includes("SSA")) type = "ssa";
                        else if (normalizedCodec.includes("WEBVTT")) type = "vtt";

                        const displayTitle = formatTrackTitle(trackNum, name, language);
                        tracks.set(trackNum, {
                            number: trackNum,
                            name: displayTitle,
                            language: language || "und",
                            codecId,
                            type,
                            header
                        });
                    }
                }
                p = tOffset + tSize.value;
            }
            offset = dataOffset + elemSize;
            continue;
        }

        if (elemId === ID_CLUSTER) {
            // Only parse clusters if we have subtitle tracks!
            if (tracks.size === 0) {
                offset = dataOffset + elemSize;
                continue;
            }

            let clusterTimecode = 0;
            let cp = dataOffset;
            const clusterEnd = dataOffset + elemSize;

            while (cp < clusterEnd && cp < fileLen) {
                const cHeader = await reader.readBytes(cp, 16);
                if (cHeader.length < 2) break;

                const cId = readEbmlId(cHeader, 0);
                if (!cId) {
                    cp++;
                    continue;
                }
                const cSize = readEbmlVint(cHeader, cId.length);
                if (!cSize) {
                    cp += cId.length;
                    continue;
                }

                const cDataOffset = cp + cId.length + cSize.length;
                const cElemSize = cSize.value;

                if (cElemSize <= 0 || cDataOffset + cElemSize > clusterEnd) {
                    // Unknown or invalid size inside cluster: break out safely
                    break;
                }

                if (cId.id === ID_TIMECODE) {
                    if (cElemSize <= 8) {
                        const tBytes = await reader.readBytes(cDataOffset, cElemSize);
                        clusterTimecode = readBigEndianUint(tBytes, 0, cElemSize);
                    }
                    cp = cDataOffset + cElemSize;
                    continue;
                }

                if (cId.id === ID_SIMPLEBLOCK || cId.id === ID_BLOCK) {
                    if (cElemSize > 5 * 1024 * 1024) {
                        cp = cDataOffset + cElemSize;
                        continue;
                    }

                    // Read block header
                    const blockHeader = await reader.readBytes(cDataOffset, Math.min(10, cElemSize));
                    const trackVint = readEbmlVint(blockHeader, 0);
                    if (trackVint && tracks.has(trackVint.value)) {
                        const trackNum = trackVint.value;
                        const relTimeOffset = trackVint.length;
                        if (blockHeader.length >= relTimeOffset + 3) {
                            const relTime = (blockHeader[relTimeOffset] << 8) | blockHeader[relTimeOffset + 1];
                            const signedRelTime = relTime >= 0x8000 ? relTime - 0x10000 : relTime;
                            const flagsOffset = relTimeOffset + 2;

                            const payloadStart = cDataOffset + flagsOffset + 1;
                            const payloadSize = cElemSize - (flagsOffset + 1);

                            if (
                                payloadSize > 0 &&
                                payloadSize <= 5 * 1024 * 1024 &&
                                payloadStart + payloadSize <= reader.size
                            ) {
                                const payloadBytes = await reader.readBytes(payloadStart, payloadSize);
                                const payloadStr = new TextDecoder("utf-8", { fatal: false }).decode(payloadBytes);
                                const scaleMs = timecodeScaleNs / 1_000_000;
                                const timeMs = (clusterTimecode + signedRelTime) * scaleMs;

                                lines.push({
                                    trackNumber: trackNum,
                                    timeMs,
                                    durationMs: 0,
                                    payload: payloadStr
                                });
                            }
                        }
                    }
                    cp = cDataOffset + cElemSize;
                    continue;
                }

                if (cId.id === ID_BLOCKGROUP) {
                    if (cElemSize > 5 * 1024 * 1024) {
                        cp = cDataOffset + cElemSize;
                        continue;
                    }

                    // Parse BlockGroup for Block + Duration
                    const bgBytes = await reader.readBytes(cDataOffset, cElemSize);
                    let bgp = 0;
                    let groupBlock: { trackNum: number; relTime: number; payload: string } | null = null;
                    let groupDurationMs = 0;

                    while (bgp < bgBytes.length) {
                        const bId = readEbmlId(bgBytes, bgp);
                        if (!bId) break;
                        const bSize = readEbmlVint(bgBytes, bgp + bId.length);
                        if (!bSize || bSize.value < 0) break;
                        const bDataOffset = bgp + bId.length + bSize.length;

                        if (bId.id === ID_BLOCK) {
                            const trackVint = readEbmlVint(bgBytes, bDataOffset);
                            if (trackVint && tracks.has(trackVint.value)) {
                                const trackNum = trackVint.value;
                                const relTimeOffset = bDataOffset + trackVint.length;
                                if (bgBytes.length >= relTimeOffset + 3) {
                                    const relTime = (bgBytes[relTimeOffset] << 8) | bgBytes[relTimeOffset + 1];
                                    const signedRelTime = relTime >= 0x8000 ? relTime - 0x10000 : relTime;
                                    const flagsOffset = relTimeOffset + 2;
                                    const pStart = flagsOffset + 1;
                                    const pSize = bDataOffset + bSize.value - pStart;
                                    if (pSize > 0 && pStart + pSize <= bgBytes.length) {
                                        const pStr = new TextDecoder("utf-8", { fatal: false }).decode(
                                            bgBytes.subarray(pStart, pStart + pSize)
                                        );
                                        groupBlock = { trackNum, relTime: signedRelTime, payload: pStr };
                                    }
                                }
                            }
                        } else if (bId.id === ID_BLOCKDURATION) {
                            const scaleMs = timecodeScaleNs / 1_000_000;
                            groupDurationMs = readBigEndianUint(bgBytes, bDataOffset, bSize.value) * scaleMs;
                        }

                        bgp = bDataOffset + bSize.value;
                    }

                    if (groupBlock) {
                        const scaleMs = timecodeScaleNs / 1_000_000;
                        const timeMs = (clusterTimecode + groupBlock.relTime) * scaleMs;
                        lines.push({
                            trackNumber: groupBlock.trackNum,
                            timeMs,
                            durationMs: groupDurationMs,
                            payload: groupBlock.payload
                        });
                    }

                    cp = cDataOffset + cElemSize;
                    continue;
                }

                // Skip other elements in cluster
                cp = cDataOffset + cElemSize;
            }

            offset = clusterEnd;
            continue;
        }

        // Skip other root elements
        offset = dataOffset + elemSize;
    }

    // 2. Sort lines by timecode per track and reconstruct full subtitle files
    const results: ParsedSubtitle[] = [];

    for (const track of tracks.values()) {
        const trackLines = lines.filter(l => l.trackNumber === track.number).sort((a, b) => a.timeMs - b.timeMs);

        let fullContent = "";

        if (track.type === "ass" || track.type === "ssa") {
            let header = track.header || "";
            if (!header.includes("[Script Info]")) {
                header = `[Script Info]\nTitle: ${track.name}\nScriptType: v4.00+\nScaledBorderAndShadow: yes\n\n[V4+ Styles]\nFormat: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding\nStyle: Default,Arial,20,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,2,2,10,10,10,1\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n`;
            } else if (!header.includes("[Events]")) {
                header +=
                    "\n\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\n";
            }

            const dialogueLines = trackLines.map(line => {
                const startStr = formatAssTime(line.timeMs);
                const defaultDuration = Math.max(2000, line.payload.length * 60);
                const endMs = line.durationMs > 0 ? line.timeMs + line.durationMs : line.timeMs + defaultDuration;
                const endStr = formatAssTime(endMs);

                // If payload already has "Dialogue:", preserve it
                if (line.payload.startsWith("Dialogue:") || line.payload.startsWith("Comment:")) {
                    return line.payload;
                }

                // Check if payload is in Matroska CSV format: ReadOrder, Layer, Style, Name, MarginL, MarginR, MarginV, Effect, Text
                const parts = line.payload.split(",");
                if (parts.length >= 9) {
                    // ReadOrder is parts[0]
                    const layer = parts[1] || "0";
                    const style = parts[2] || "Default";
                    const name = parts[3] || "";
                    const marginL = parts[4] || "0";
                    const marginR = parts[5] || "0";
                    const marginV = parts[6] || "0";
                    const effect = parts[7] || "";
                    const text = parts.slice(8).join(",");
                    return `Dialogue: ${layer},${startStr},${endStr},${style},${name},${marginL},${marginR},${marginV},${effect},${text}`;
                }

                // Raw text fallback
                return `Dialogue: 0,${startStr},${endStr},Default,,0,0,0,,${line.payload}`;
            });

            fullContent = header.trimEnd() + "\n" + dialogueLines.join("\n");
        } else {
            // Reconstruct SRT
            const srtBlocks = trackLines.map((line, idx) => {
                const startStr = formatSrtTime(line.timeMs);
                const defaultDuration = Math.max(2000, line.payload.length * 60);
                const endMs = line.durationMs > 0 ? line.timeMs + line.durationMs : line.timeMs + defaultDuration;
                const endStr = formatSrtTime(endMs);
                return `${idx + 1}\n${startStr} --> ${endStr}\n${line.payload.trim()}\n`;
            });
            fullContent = srtBlocks.join("\n");
        }

        if (fullContent.trim().length > 0) {
            const parsed = parseSubtitle(fullContent, track.type);
            results.push({
                format: track.type,
                data: parsed.data,
                title: track.name || `Track ${track.number}`,
                raw: fullContent
            });
        }
    }

    return results;
}
