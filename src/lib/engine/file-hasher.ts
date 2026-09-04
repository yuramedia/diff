/**
 * File hasher using Web Crypto API with FNV-1a fallback.
 * Used for deduplication of loaded subtitle files.
 */
export async function hashContent(data: string): Promise<string> {
    const safeData = data ? String(data).replace(/\r\n/g, "\n") : "";

    if (typeof crypto !== "undefined" && crypto?.subtle && typeof crypto.subtle.digest === "function") {
        try {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(safeData);
            const hashBuffer = await crypto.subtle.digest("SHA-1", dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, "0")).join("");
        } catch {
            // Fallback if crypto.subtle is restricted or throws
        }
    }

    // Fast 64-bit FNV-1a fallback for insecure contexts, test runners, or older WebViews
    let h1 = 0x811c9dc5;
    let h2 = 0x811c9dc5;
    for (let i = 0; i < safeData.length; i++) {
        const c = safeData.charCodeAt(i);
        h1 = Math.imul(h1 ^ (c & 0xff), 0x01000193);
        h2 = Math.imul(h2 ^ (c >>> 8), 0x01000193);
    }
    return (h1 >>> 0).toString(16).padStart(8, "0") + (h2 >>> 0).toString(16).padStart(8, "0");
}
