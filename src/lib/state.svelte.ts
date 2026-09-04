/**
 * Global application state using Svelte 5 runes.
 */
import type { Caption } from "./engine/subtitle-parser";
import type { ProcessingOptions } from "./engine/text-processor";
import { DEFAULT_OPTIONS } from "./engine/text-processor";
import type { DiffResult } from "./engine/diff-engine";
import { SvelteMap } from "svelte/reactivity";

export interface LoadedFile {
    hash: string;
    filename: string;
    format: string;
    data: Caption[];
    title: string;
    styles: Set<string>;
    rawText?: string;
}

export interface AppState {
    files: Map<string, LoadedFile>;
    fileA: string | null;
    fileB: string | null;
    options: ProcessingOptions;
    diffMatching: "words" | "lines" | "none";
    diffOutputFormat: "side-by-side" | "line-by-line";
    diffResult: DiffResult | null;
    theme: "light" | "dark";
    isComputing: boolean;
    statusMessage: string;
}

function createAppState(): AppState {
    const prefersDark =
        typeof window !== "undefined" ? window.matchMedia("(prefers-color-scheme: dark)").matches : true;

    return {
        files: new SvelteMap<string, LoadedFile>(),
        fileA: null,
        fileB: null,
        options: { ...DEFAULT_OPTIONS },
        diffMatching: "words",
        diffOutputFormat: "side-by-side",
        diffResult: null,
        theme: prefersDark ? "dark" : "light",
        isComputing: false,
        statusMessage: ""
    };
}

export const appState = $state<AppState>(createAppState());
