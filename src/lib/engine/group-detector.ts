/**
 * Group detection regex and logic ported from evadiff.
 * Auto-detects fansub/release group name from filename.
 */

const GROUP_BLACKLIST = [
    "xvid",
    "x264",
    "x265",
    "avc",
    "hevc",
    "dvd",
    "dvd5",
    "dvd9",
    "dvdiso",
    "dvd-r",
    "dvdr",
    "movie",
    "4k",
    "2160p",
    "1080p",
    "720p",
    "576p",
    "480p",
    "2160",
    "1080",
    "720",
    "576",
    "480",
    "bluray",
    "bdmv",
    "bdiso",
    "proper",
    "aac",
    "ac3",
    "flac",
    "vob",
    "ifo",
    "vob ifo",
    "vob.ifo",
    "vob_ifo",
    "avi",
    "remux",
    "uncut",
    "dl",
    "us",
    "r",
    "j",
    "jp",
    "jpn",
    "ita",
    "dvdrip",
    "pal",
    "ntsc",
    "bd",
    "bdremux",
    "bdremux.1080p",
    "1080p remux",
    "hd",
    "eng",
    "exclusive",
    "japanese",
    "nogrp",
    "nogroup",
    "3d half sbs",
    "r1",
    "r2",
    "r2j",
    "extras",
    "trailers",
    "rifftrax",
    "cd1",
    "cd2"
];

export function guessGroup(filename: string): string {
    // Discord-style naming
    const discordStyle = filename.match(/^([A-Za-z0-9-]+)_[A-Za-z_]+_-_(?:[Ss]\d+)?[Ee]?\d+[_.]/);
    if (discordStyle) return discordStyle[1];

    // Standard group extraction via regex
    const groupRegex =
        /^\[(?!Japanese)(?:[0-9]+[pP]?|MOVIE|DVD(?:[95]|ISO|-?R)?|BDMV|([^[\u4E00-\u9FCC¶^\]]+))\](?!\[).*|^\[(?!Japanese)(?:MOVIE|DVD(?:[95]|ISO|-?R)?|BDMV|\d{6}|([^½ \]\u4E00-\u9FCC]+))\].*|.*[a-zA-Z .\]]\[(?:.* Edition|[rR]iff[tT]rax|REMUX|PROPER|MOVIE|DVD(?:[95]|ISO|R).*|BD(?:MV|\d+)|AC3|AAC|.* DVD|[0-9]+[pP]?|.*?26[45]+.*?|[a-f0-9]{8}|[A-F0-9]{8}|.*FLAC|R2[ JFD].*|([^[)+-]+))](?:\[[0-9]+[pP]])$|.*(?:\.|[xhXH]\.?26[45] )(?:REMUX|PROPER|MOVIE|DVD(?:[95]|ISO|-?R)?|BD(?:MV|\d+)|AC3|AAC|FLAC|PAL|NTSC|XVID|DTS|DUB|[xhXH]\.?26[45]|(?![cC][dD]\d|BLURAY)([A-Z]-)?([A-Z][A-Zi0-9]+|[A-Z][a-z][A-Z]|@[a-zA-Z]{2,}))$/g;

    const baseName = filename.replace(/\.[^/.]+$/, "").trim();
    const groupName = baseName.replace("DTS-HD-", "-").replace(groupRegex, "$1$2$3$4$5");

    if (groupName && groupName.length > 0 && !GROUP_BLACKLIST.includes(groupName.toLowerCase())) {
        return groupName;
    }

    return filename.replace(/\.[^/.]+$/, "");
}
