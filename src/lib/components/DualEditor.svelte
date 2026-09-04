<script lang="ts">
	import { Upload, Clipboard, Trash2, ArrowLeftRight, Sparkles, Play, FileText, Film, X, Search } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { parseSubtitle } from '$lib/engine/subtitle-parser';
	import { extractMkvSubtitles } from '$lib/engine/mkv-parser';
	import { guessGroup } from '$lib/engine/group-detector';
	import { hashContent } from '$lib/engine/file-hasher';
	import { runDiffPipeline } from '$lib/engine/diff-pipeline';
	import { SAMPLE_SUBTITLE_A, SAMPLE_SUBTITLE_B } from '$lib/engine/sample-data';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';
	import TrackCombobox from './TrackCombobox.svelte';

	let textA = $state('');
	let textB = $state('');
	let titleA = $state('Original Text');
	let titleB = $state('Changed Text');
	let formatA = $state('txt');
	let formatB = $state('txt');

	let fileInputA = $state<HTMLInputElement>();
	let fileInputB = $state<HTMLInputElement>();

	let isDragOverA = $state(false);
	let isDragOverB = $state(false);

	// Multi-track modal state
	let showMkvModal = $state(false);
	let mkvModalFileName = $state('');
	let mkvModalTracks = $state<Array<{ hash: string; title: string; format: string; lines: number; trackNum: number }>>([]);
	let trackSearchQuery = $state('');

	const filteredModalTracks = $derived(
		mkvModalTracks.filter(t => !trackSearchQuery || t.title.toLowerCase().includes(trackSearchQuery.toLowerCase()))
	);

	const availableTrackList = $derived(
		Array.from(appState.files.values()).map(f => ({
			hash: f.hash,
			title: f.title || f.filename,
			format: f.format,
			lines: f.data ? f.data.length : (f.rawText ? f.rawText.split('\n').length : 0)
		}))
	);

	// Sync with appState files when user selects files from the file list
	$effect(() => {
		if (appState.fileA) {
			const f = appState.files.get(appState.fileA);
			if (f) {
				titleA = f.title || f.filename;
				formatA = f.format;
				if (f.rawText) {
					textA = f.rawText;
				} else if (f.data) {
					textA = f.data.map(c => c.content || c.text).join('\n');
				}
			}
		}
	});

	$effect(() => {
		if (appState.fileB) {
			const f = appState.files.get(appState.fileB);
			if (f) {
				titleB = f.title || f.filename;
				formatB = f.format;
				if (f.rawText) {
					textB = f.rawText;
				} else if (f.data) {
					textB = f.data.map(c => c.content || c.text).join('\n');
				}
			}
		}
	});

	async function loadContentIntoSide(side: 'A' | 'B', content: string, filename: string, format?: string) {
		const hash = await hashContent(content + side);
		const parsed = parseSubtitle(content, format);
		const groupTitle = parsed.title || guessGroup(filename) || filename;

		const file = {
			hash,
			filename,
			format: parsed.format,
			data: parsed.data,
			title: groupTitle,
			styles: new Set<string>(),
			rawText: content
		};

		for (const cap of parsed.data) {
			if (cap.data?.Style) file.styles.add(cap.data.Style);
		}

		appState.files.set(hash, file);

		if (side === 'A') {
			appState.fileA = hash;
			textA = content;
			titleA = groupTitle;
			formatA = parsed.format;
		} else {
			appState.fileB = hash;
			textB = content;
			titleB = groupTitle;
			formatB = parsed.format;
		}
	}

	function selectTrackForSide(side: 'A' | 'B', hash: string) {
		if (!hash) return;
		const f = appState.files.get(hash);
		if (!f) return;

		if (side === 'A') {
			appState.fileA = hash;
			titleA = f.title || f.filename;
			formatA = f.format;
			textA = f.rawText || f.data.map(c => c.content || c.text).join('\n');
		} else {
			appState.fileB = hash;
			titleB = f.title || f.filename;
			formatB = f.format;
			textB = f.rawText || f.data.map(c => c.content || c.text).join('\n');
		}

		if (textA.trim() && textB.trim()) {
			findDifferences();
		}
	}

	async function handleFileDrop(side: 'A' | 'B', file: File) {
		const normalized = file.name.toLowerCase();
		if (normalized.endsWith('.mkv') || normalized.endsWith('.mks')) {
			try {
				appState.statusMessage = `Extracting subtitles from ${file.name}...`;
				const subs = await extractMkvSubtitles(file);
				if (subs.length > 0) {
					const trackList: Array<{ hash: string; title: string; format: string; lines: number; trackNum: number }> = [];

					for (let i = 0; i < subs.length; i++) {
						const sub = subs[i];
						const trackContent = sub.raw || sub.data.map(c => c.content || c.text).join('\n');
						const trackTitle = sub.title || `Track ${i + 1}`;
						const hash = await hashContent(trackContent + '_' + i);

						const fileEntry = {
							hash,
							filename: file.name,
							format: sub.format,
							data: sub.data,
							title: trackTitle,
							styles: new Set<string>(),
							rawText: trackContent
						};
						for (const cap of sub.data) {
							if (cap.data?.Style) fileEntry.styles.add(cap.data.Style);
						}
						appState.files.set(hash, fileEntry);

						trackList.push({
							hash,
							title: trackTitle,
							format: sub.format,
							lines: sub.data.length,
							trackNum: i + 1
						});
					}

					mkvModalFileName = file.name;
					mkvModalTracks = trackList;

					// Smart selection: If English and Indonesian exist, pair them up!
					const eng = trackList.find(t => t.title.toLowerCase().includes('english') || t.title.toLowerCase().includes('[en]'));
					const ind = trackList.find(t => t.title.toLowerCase().includes('indonesian') || t.title.toLowerCase().includes('[id]'));

					if (eng && ind) {
						selectTrackForSide('A', eng.hash);
						selectTrackForSide('B', ind.hash);
					} else if (trackList.length > 0) {
						selectTrackForSide(side, trackList[0].hash);
						if (trackList.length > 1) {
							const otherSide = side === 'A' ? 'B' : 'A';
							selectTrackForSide(otherSide, trackList[1].hash);
						}
					}

					showMkvModal = false;

					if (textA.trim() && textB.trim()) {
						findDifferences();
					}
					appState.statusMessage = `Extracted ${subs.length} subtitle track${subs.length > 1 ? 's' : ''} from ${file.name}`;
				} else {
					appState.statusMessage = `No text subtitle tracks (ASS/SSA/SRT/VTT) found in ${file.name}. (PGS/VobSub bitmap subtitles are not supported)`;
				}
			} catch (err) {
				console.error('MKV extraction error:', err);
				appState.statusMessage = `Failed to parse ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`;
			}
		} else {
			if (file.size > 25 * 1024 * 1024) {
				appState.statusMessage = `File "${file.name}" exceeds 25MB limit.`;
				return;
			}
			const text = await file.text();
			await loadContentIntoSide(side, text, file.name);
		}
	}

	let inputDebounceTimerA: ReturnType<typeof setTimeout> | undefined;
	let inputDebounceTimerB: ReturnType<typeof setTimeout> | undefined;

	function handleInputA(val: string) {
		textA = val;
		clearTimeout(inputDebounceTimerA);
		inputDebounceTimerA = setTimeout(() => {
			loadContentIntoSide('A', val, 'Input A.txt');
		}, 300);
	}

	function handleInputB(val: string) {
		textB = val;
		clearTimeout(inputDebounceTimerB);
		inputDebounceTimerB = setTimeout(() => {
			loadContentIntoSide('B', val, 'Input B.txt');
		}, 300);
	}

	async function pasteSide(side: 'A' | 'B') {
		try {
			const clip = await navigator.clipboard.readText();
			if (clip) {
				if (clip.length > 10_000_000) {
					appState.statusMessage = 'Pasted text exceeds safety limit (10MB).';
					return;
				}
				await loadContentIntoSide(side, clip, `Pasted ${side}.txt`);
			}
		} catch (err) {
			console.warn('Clipboard read error, use Ctrl+V:', err);
		}
	}

	function clearSide(side: 'A' | 'B') {
		if (side === 'A') {
			textA = '';
			titleA = 'Original Text';
			if (appState.fileA) {
				appState.files.delete(appState.fileA);
				appState.fileA = null;
			}
		} else {
			textB = '';
			titleB = 'Changed Text';
			if (appState.fileB) {
				appState.files.delete(appState.fileB);
				appState.fileB = null;
			}
		}
		appState.diffResult = null;
	}

	function swapSides() {
		const tempText = textA;
		textA = textB;
		textB = tempText;

		const tempTitle = titleA;
		titleA = titleB;
		titleB = tempTitle;

		const tempFormat = formatA;
		formatA = formatB;
		formatB = tempFormat;

		const tempHash = appState.fileA;
		appState.fileA = appState.fileB;
		appState.fileB = tempHash;

		if (appState.diffResult) {
			findDifferences();
		}
	}

	async function loadSampleSubtitles() {
		await loadContentIntoSide('A', SAMPLE_SUBTITLE_A, 'Sample_Commie.ass', 'ass');
		await loadContentIntoSide('B', SAMPLE_SUBTITLE_B, 'Sample_Erai-raws.ass', 'ass');
		findDifferences();
	}

	async function findDifferences() {
		if (appState.isComputing) return;
		if (!textA.trim() || !textB.trim()) {
			appState.statusMessage = 'Please enter or upload text for both sides to compare.';
			return;
		}

		appState.isComputing = true;
		appState.statusMessage = '';

		try {
			await Promise.all([
				loadContentIntoSide('A', textA, titleA, formatA),
				loadContentIntoSide('B', textB, titleB, formatB)
			]);
			await runDiffPipeline();
		} catch (err) {
			console.error('Diff error:', err);
			appState.statusMessage = `Diff error: ${err instanceof Error ? err.message : 'Unknown error'}`;
		} finally {
			appState.isComputing = false;
		}
	}
</script>

<div class="space-y-4">
	<!-- Action Bar (Diffchecker style) -->
	<div class="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-card border border-border shadow-xs">
		<div class="flex items-center gap-2">
			<Button
				variant="default"
				size="default"
				onclick={findDifferences}
				disabled={appState.isComputing || (!textA.trim() && !textB.trim())}
				class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium shadow-sm transition-all gap-2 px-5 cursor-pointer"
			>
				<Play class="h-4 w-4 fill-current" />
				<span>Find Differences</span>
			</Button>

			<Button
				variant="outline"
				size="default"
				onclick={swapSides}
				title="Swap Side A and Side B"
				class="gap-1.5 text-xs font-medium cursor-pointer"
			>
				<ArrowLeftRight class="h-3.5 w-3.5" />
				<span class="hidden sm:inline">Swap</span>
			</Button>

			<Button
				variant="secondary"
				size="default"
				onclick={loadSampleSubtitles}
				title="Load sample ASS subtitles with tags, comments, and translation differences"
				class="gap-1.5 text-xs font-medium text-indigo-700 dark:text-indigo-300 bg-indigo-50 dark:bg-indigo-950/40 hover:bg-indigo-100 dark:hover:bg-indigo-900/60 border border-indigo-200/50 dark:border-indigo-800/40 cursor-pointer"
			>
				<Sparkles class="h-3.5 w-3.5 text-indigo-500" />
				<span>Load Sample (ASS)</span>
			</Button>

			{#if mkvModalTracks.length > 1}
				<Button
					variant="outline"
					size="default"
					onclick={() => showMkvModal = true}
					class="gap-1.5 text-xs font-medium border-indigo-300 dark:border-indigo-800 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-950/60 cursor-pointer"
				>
					<Film class="h-3.5 w-3.5" />
					<span>Subtitle Tracks ({mkvModalTracks.length})</span>
				</Button>
			{/if}
		</div>

		<div class="flex items-center gap-2">
			{#if textA || textB}
				<Button
					variant="ghost"
					size="sm"
					onclick={() => { clearSide('A'); clearSide('B'); }}
					class="text-xs text-muted-foreground hover:text-destructive gap-1 cursor-pointer"
				>
					<Trash2 class="h-3.5 w-3.5" />
					<span>Clear All</span>
				</Button>
			{/if}
		</div>
	</div>

	<!-- Side-by-side Input Editors -->
	<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
		<!-- Left Panel: Original / File A -->
		<div
			class="flex flex-col rounded-xl border border-border bg-card shadow-xs transition-colors
				{isDragOverA ? 'ring-2 ring-indigo-500 border-indigo-500 bg-indigo-50/10' : ''}"
			ondragover={(e) => { e.preventDefault(); isDragOverA = true; }}
			ondragleave={() => { isDragOverA = false; }}
			ondrop={(e) => {
				e.preventDefault();
				isDragOverA = false;
				if (e.dataTransfer?.files?.[0]) handleFileDrop('A', e.dataTransfer.files[0]);
			}}
			role="region"
			aria-label="Original text input"
		>
			<div class="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 gap-2 rounded-t-xl">
				<TrackCombobox
					side="A"
					label="Original (A)"
					selectedHash={appState.fileA}
					selectedTitle={titleA}
					format={formatA}
					tracks={availableTrackList}
					otherSideHash={appState.fileB}
					onSelect={(hash) => selectTrackForSide('A', hash)}
				/>

				<div class="flex items-center gap-1 shrink-0">
					<input
						bind:this={fileInputA}
						type="file"
						accept=".mkv,.mks,.ass,.ssa,.srt,.vtt,.txt"
						class="hidden"
						onchange={(e) => {
							const f = (e.target as HTMLInputElement).files?.[0];
							if (f) handleFileDrop('A', f);
						}}
					/>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => fileInputA?.click()}
						class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
						title="Upload .mkv, .ass, .srt, .vtt, or .txt"
					>
						<Upload class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Upload</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => pasteSide('A')}
						class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
						title="Paste from clipboard"
					>
						<Clipboard class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Paste</span>
					</Button>
					{#if textA}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => clearSide('A')}
							class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
							title="Clear Original"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			</div>

			<div class="relative flex-1 min-h-[260px]">
				<textarea
					bind:value={textA}
					oninput={(e) => handleInputA((e.target as HTMLTextAreaElement).value)}
					placeholder="Paste, type, or drop original subtitle file (.mkv, .ass, .srt, .vtt, .txt) here..."
					class="w-full h-full min-h-[260px] p-3 text-xs md:text-sm font-mono bg-transparent resize-y outline-none leading-relaxed text-foreground placeholder:text-muted-foreground/60 border-0"
					spellcheck="false"
				></textarea>
			</div>
			<div class="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground font-mono rounded-b-xl">
				<span>{textA ? textA.split('\n').length : 0} lines</span>
				<span>{textA.length} chars</span>
			</div>
		</div>

		<!-- Right Panel: Changed / File B -->
		<div
			class="flex flex-col rounded-xl border border-border bg-card shadow-xs transition-colors
				{isDragOverB ? 'ring-2 ring-emerald-500 border-emerald-500 bg-emerald-50/10' : ''}"
			ondragover={(e) => { e.preventDefault(); isDragOverB = true; }}
			ondragleave={() => { isDragOverB = false; }}
			ondrop={(e) => {
				e.preventDefault();
				isDragOverB = false;
				if (e.dataTransfer?.files?.[0]) handleFileDrop('B', e.dataTransfer.files[0]);
			}}
			role="region"
			aria-label="Changed text input"
		>
			<div class="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40 gap-2 rounded-t-xl">
				<TrackCombobox
					side="B"
					label="Changed (B)"
					selectedHash={appState.fileB}
					selectedTitle={titleB}
					format={formatB}
					tracks={availableTrackList}
					otherSideHash={appState.fileA}
					onSelect={(hash) => selectTrackForSide('B', hash)}
				/>

				<div class="flex items-center gap-1 shrink-0">
					<input
						bind:this={fileInputB}
						type="file"
						accept=".mkv,.mks,.ass,.ssa,.srt,.vtt,.txt"
						class="hidden"
						onchange={(e) => {
							const f = (e.target as HTMLInputElement).files?.[0];
							if (f) handleFileDrop('B', f);
						}}
					/>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => fileInputB?.click()}
						class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
						title="Upload .mkv, .ass, .srt, .vtt, or .txt"
					>
						<Upload class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Upload</span>
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onclick={() => pasteSide('B')}
						class="h-7 px-2 text-xs gap-1 text-muted-foreground hover:text-foreground cursor-pointer"
						title="Paste from clipboard"
					>
						<Clipboard class="h-3.5 w-3.5" />
						<span class="hidden sm:inline">Paste</span>
					</Button>
					{#if textB}
						<Button
							variant="ghost"
							size="sm"
							onclick={() => clearSide('B')}
							class="h-7 w-7 p-0 text-muted-foreground hover:text-destructive cursor-pointer"
							title="Clear Changed"
						>
							<Trash2 class="h-3.5 w-3.5" />
						</Button>
					{/if}
				</div>
			</div>

			<div class="relative flex-1 min-h-[260px]">
				<textarea
					bind:value={textB}
					oninput={(e) => handleInputB((e.target as HTMLTextAreaElement).value)}
					placeholder="Paste, type, or drop changed subtitle file (.mkv, .ass, .srt, .vtt, .txt) here..."
					class="w-full h-full min-h-[260px] p-3 text-xs md:text-sm font-mono bg-transparent resize-y outline-none leading-relaxed text-foreground placeholder:text-muted-foreground/60 border-0"
					spellcheck="false"
				></textarea>
			</div>
			<div class="px-3 py-1.5 border-t border-border bg-muted/20 flex items-center justify-between text-[11px] text-muted-foreground font-mono rounded-b-xl">
				<span>{textB ? textB.split('\n').length : 0} lines</span>
				<span>{textB.length} chars</span>
			</div>
		</div>
	</div>
</div>

<!-- Modal: Select Subtitle Tracks from MKV -->
{#if showMkvModal}
	<div class="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
		<div class="bg-card border border-border rounded-2xl p-5 max-w-2xl w-full shadow-2xl space-y-4 max-h-[85vh] flex flex-col">
			<div class="flex items-center justify-between border-b border-border pb-3">
				<div>
					<h3 class="font-semibold text-base flex items-center gap-2 text-foreground">
						<Film class="h-4 w-4 text-indigo-500" />
						<span>Select Subtitle Tracks to Compare</span>
					</h3>
					<p class="text-xs text-muted-foreground truncate max-w-md">{mkvModalFileName} ({mkvModalTracks.length} tracks detected)</p>
				</div>
				<button
					class="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
					onclick={() => showMkvModal = false}
					aria-label="Close modal"
				>
					<X class="h-4 w-4" />
				</button>
			</div>

			<!-- Search / Filter input for tracks -->
			<div class="relative">
				<Search class="h-3.5 w-3.5 absolute left-3 top-2.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={trackSearchQuery}
					placeholder="Search track by language or name (e.g. Indonesian, English, Japanese)..."
					class="w-full pl-9 pr-3 py-1.5 text-xs bg-muted/50 border border-border rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-foreground placeholder:text-muted-foreground"
				/>
			</div>

			<!-- Scrollable Tracks List -->
			<div class="overflow-y-auto space-y-1.5 flex-1 pr-1 max-h-[45vh]">
				{#each filteredModalTracks as track (track.hash)}
					<div class="flex items-center justify-between p-2.5 rounded-xl border border-border bg-muted/20 hover:bg-muted/40 transition-colors gap-3">
						<div class="min-w-0 flex-1">
							<div class="flex items-center gap-2">
								<span class="text-xs font-semibold text-foreground truncate">{track.title}</span>
								<Badge variant="outline" class="text-[10px] font-mono uppercase bg-background shrink-0">{track.format}</Badge>
							</div>
							<p class="text-[11px] text-muted-foreground">{track.lines} dialogue lines</p>
						</div>

						<div class="flex items-center gap-1.5 shrink-0">
							<Button
								variant={appState.fileA === track.hash ? "default" : "outline"}
								size="sm"
								onclick={() => selectTrackForSide('A', track.hash)}
								class="h-7 text-xs px-2.5 cursor-pointer {appState.fileA === track.hash ? 'bg-blue-600 hover:bg-blue-500 text-white font-medium shadow-xs' : ''}"
							>
								{appState.fileA === track.hash ? '✓ Side A' : 'Set Side A'}
							</Button>
							<Button
								variant={appState.fileB === track.hash ? "default" : "outline"}
								size="sm"
								onclick={() => selectTrackForSide('B', track.hash)}
								class="h-7 text-xs px-2.5 cursor-pointer {appState.fileB === track.hash ? 'bg-emerald-600 hover:bg-emerald-500 text-white font-medium shadow-xs' : ''}"
							>
								{appState.fileB === track.hash ? '✓ Side B' : 'Set Side B'}
							</Button>
						</div>
					</div>
				{/each}
			</div>

			<div class="pt-3 border-t border-border flex flex-wrap items-center justify-between gap-3">
				<div class="text-xs text-muted-foreground">
					Side A: <strong class="text-blue-600 dark:text-blue-400">{titleA}</strong> ↔ Side B: <strong class="text-emerald-600 dark:text-emerald-400">{titleB}</strong>
				</div>
				<Button
					variant="default"
					size="sm"
					onclick={() => { showMkvModal = false; findDifferences(); }}
					class="bg-indigo-600 hover:bg-indigo-500 text-white font-medium gap-1.5 px-4 cursor-pointer"
				>
					<Play class="h-3.5 w-3.5 fill-current" />
					<span>Compare Selected Tracks</span>
				</Button>
			</div>
		</div>
	</div>
{/if}
