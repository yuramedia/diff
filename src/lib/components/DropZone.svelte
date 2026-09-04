<script lang="ts">
	import { Upload, FileText, Clipboard, Film } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { parseSubtitle } from '$lib/engine/subtitle-parser';
	import { extractMkvSubtitles } from '$lib/engine/mkv-parser';
	import { guessGroup } from '$lib/engine/group-detector';
	import { hashContent } from '$lib/engine/file-hasher';

	let isDragOver = $state(false);
	let fileInput: HTMLInputElement;

	const ACCEPTED_EXTENSIONS = ['.mkv', '.mks', '.ass', '.ssa', '.srt', '.vtt', '.txt'];
	const ACCEPT_STRING = ACCEPTED_EXTENSIONS.join(',');

	async function addSubtitleFile(filename: string, content: string, format?: string, title?: string) {
		const hash = await hashContent(content);
		if (appState.files.has(hash)) return;

		const parsed = parseSubtitle(content, format);
		if (parsed.data.length === 0) return;

		const groupTitle = title || parsed.title || guessGroup(filename);

		const file = {
			hash,
			filename,
			format: parsed.format,
			data: parsed.data,
			title: groupTitle,
			styles: new Set<string>()
		};

		// Collect styles
		for (const cap of parsed.data) {
			if (cap.data?.Style) file.styles.add(cap.data.Style);
		}

		appState.files.set(hash, file);

		// Auto-select if slots available
		if (!appState.fileA) {
			appState.fileA = hash;
		} else if (!appState.fileB) {
			appState.fileB = hash;
		}
	}

	async function handleFiles(files: FileList | File[]) {
		appState.statusMessage = `Loading ${files.length} file${files.length > 1 ? 's' : ''}...`;

		for (const file of Array.from(files)) {
			const normalized = file.name.toLowerCase();

			if (normalized.endsWith('.mkv') || normalized.endsWith('.mks')) {
				if (file.size > 2 * 1024 * 1024 * 1024) {
					appState.statusMessage = `File "${file.name}" exceeds 2GB maximum limit.`;
					continue;
				}
				try {
					const subs = await extractMkvSubtitles(file);
					for (const sub of subs) {
						const content = sub.raw || sub.data.map(c => c.content || c.text).join('\n');
						await addSubtitleFile(file.name, content, sub.format, sub.title);
					}
					if (subs.length === 0) {
						appState.statusMessage = `No text subtitle tracks found in ${file.name}`;
					}
				} catch (err) {
					console.error('MKV parse error:', err);
					appState.statusMessage = `Error parsing ${file.name}`;
				}
			} else if (
				normalized.endsWith('.ass') || normalized.endsWith('.ssa') ||
				normalized.endsWith('.srt') || normalized.endsWith('.vtt') ||
				normalized.endsWith('.txt')
			) {
				if (file.size > 25 * 1024 * 1024) {
					appState.statusMessage = `File "${file.name}" exceeds 25MB maximum limit.`;
					continue;
				}
				const text = await file.text();
				await addSubtitleFile(file.name, text);
			}
		}

		appState.statusMessage = '';
	}

	function handleDrop(e: DragEvent) {
		e.preventDefault();
		isDragOver = false;
		if (e.dataTransfer?.files) {
			handleFiles(e.dataTransfer.files);
		}
	}

	function handleDragOver(e: DragEvent) {
		e.preventDefault();
		isDragOver = true;
	}

	function handleDragLeave() {
		isDragOver = false;
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (target.files) {
			handleFiles(target.files);
			target.value = '';
		}
	}

	function handlePaste(e: ClipboardEvent) {
		const paste = e.clipboardData?.getData('text');
		if (!paste?.trim()) return;
		if (paste.length > 10_000_000) {
			appState.statusMessage = 'Pasted text exceeds 10MB limit.';
			return;
		}
		addSubtitleFile('clipboard.txt', paste, undefined, 'Clipboard');
	}

	$effect(() => {
		if (typeof document !== 'undefined') {
			document.addEventListener('paste', handlePaste);
			return () => document.removeEventListener('paste', handlePaste);
		}
	});
</script>

<div
	class="relative group"
	role="region"
	aria-label="File upload area"
	ondrop={handleDrop}
	ondragover={handleDragOver}
	ondragleave={handleDragLeave}
>
	<div
		class="border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 cursor-pointer
			{isDragOver
				? 'border-primary bg-primary/5 scale-[1.01]'
				: 'border-border hover:border-primary/50 hover:bg-muted/30'}"
		onclick={() => fileInput.click()}
		onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') fileInput.click(); }}
		tabindex="0"
		role="button"
		aria-label="Click to upload files or drag and drop"
	>
		<div class="flex flex-col items-center gap-3">
			<div class="p-3 rounded-full bg-muted/50 group-hover:bg-primary/10 transition-colors">
				<Upload class="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
			</div>

			<div class="space-y-1">
				<p class="font-medium text-sm">
					Drop files here or <span class="text-primary underline underline-offset-2">browse</span>
				</p>
				<p class="text-xs text-muted-foreground">
					Supports MKV, ASS, SSA, SRT, VTT, TXT · Ctrl+V to paste
				</p>
			</div>

			<div class="flex flex-wrap justify-center gap-1.5 mt-1">
				{#each ['.mkv', '.ass', '.srt', '.vtt', '.txt', 'paste'] as label}
					<span class="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-mono">
						{#if label === '.mkv'}
							<Film class="h-3 w-3" />
						{:else if label === 'paste'}
							<Clipboard class="h-3 w-3" />
						{:else}
							<FileText class="h-3 w-3" />
						{/if}
						{label}
					</span>
				{/each}
			</div>
		</div>
	</div>

	<input
		bind:this={fileInput}
		type="file"
		multiple
		accept={ACCEPT_STRING}
		onchange={handleInputChange}
		class="hidden"
	/>
</div>

{#if appState.statusMessage}
	<p class="text-xs text-muted-foreground text-center mt-2 animate-pulse">
		{appState.statusMessage}
	</p>
{/if}
