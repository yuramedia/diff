<script lang="ts">
	import { X, FileText, Check, Search, Trash2 } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { Badge } from '$lib/components/ui/badge';
	import { Button } from '$lib/components/ui/button';

	const files = $derived(Array.from(appState.files.values()));
	let searchQuery = $state('');

	const filteredFiles = $derived(
		files.filter(f =>
			!searchQuery ||
			f.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			f.filename.toLowerCase().includes(searchQuery.toLowerCase()) ||
			f.format.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	// Check if all files come from the same parent file (e.g. MKV)
	const commonFileName = $derived.by(() => {
		if (files.length <= 1) return null;
		const first = files[0].filename;
		return files.every(f => f.filename === first) ? first : null;
	});

	function setSide(side: 'A' | 'B', hash: string) {
		if (side === 'A') {
			appState.fileA = hash;
		} else {
			appState.fileB = hash;
		}
	}

	function toggleSelect(hash: string) {
		if (hash === appState.fileA) {
			appState.fileA = null;
		} else if (hash === appState.fileB) {
			appState.fileB = null;
		} else if (!appState.fileA) {
			appState.fileA = hash;
		} else if (!appState.fileB) {
			appState.fileB = hash;
		} else {
			// If both slots are full, swap out Side B by default
			appState.fileB = hash;
		}
	}

	function removeFile(hash: string) {
		if (appState.fileA === hash) appState.fileA = null;
		if (appState.fileB === hash) appState.fileB = null;
		appState.files.delete(hash);
	}

	function clearAll() {
		appState.fileA = null;
		appState.fileB = null;
		appState.files.clear();
		appState.diffResult = null;
	}

	function getFormatColor(format: string): string {
		switch (format.toLowerCase()) {
			case 'ass': return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
			case 'ssa': return 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30';
			case 'srt': return 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30';
			case 'vtt': return 'bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/30';
			case 'txt': return 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30';
			default: return 'bg-muted text-muted-foreground border-border';
		}
	}
</script>

{#if files.length > 0}
	<div class="space-y-2.5">
		<!-- Header with count & Clear All -->
		<div class="flex items-center justify-between px-1">
			<div class="flex items-center gap-2">
				<p class="text-xs font-bold text-muted-foreground uppercase tracking-wider">
					Loaded Tracks ({files.length})
				</p>
				{#if commonFileName}
					<span class="text-[10px] text-muted-foreground/80 font-normal truncate max-w-[120px]" title={commonFileName}>
						from MKV
					</span>
				{/if}
			</div>
			<button
				type="button"
				onclick={clearAll}
				class="text-[11px] text-muted-foreground hover:text-destructive flex items-center gap-1 transition-colors cursor-pointer"
				title="Remove all loaded files"
			>
				<Trash2 class="h-3 w-3" />
				<span>Clear</span>
			</button>
		</div>

		<!-- Search filter if more than 4 files -->
		{#if files.length > 4}
			<div class="relative">
				<Search class="h-3.5 w-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
				<input
					type="text"
					bind:value={searchQuery}
					placeholder="Search tracks or languages..."
					class="w-full pl-8 pr-2.5 py-1.5 text-xs bg-muted/40 border border-border rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-foreground placeholder:text-muted-foreground/70"
				/>
			</div>
		{/if}

		<!-- Scrollable track list -->
		<div class="grid gap-1.5 max-h-[460px] overflow-y-auto pr-1">
			{#each filteredFiles as file (file.hash)}
				{@const isA = file.hash === appState.fileA}
				{@const isB = file.hash === appState.fileB}
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="group flex items-center gap-2 p-2 rounded-lg border text-left w-full transition-all duration-150 cursor-pointer
						{isA
							? 'border-blue-500/50 bg-blue-500/10 ring-1 ring-blue-500/30'
							: isB
								? 'border-emerald-500/50 bg-emerald-500/10 ring-1 ring-emerald-500/30'
								: 'border-border bg-card/60 hover:border-primary/40 hover:bg-muted/50'}"
					onclick={() => toggleSelect(file.hash)}
					onkeydown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggleSelect(file.hash); }}
					role="button"
					tabindex="0"
				>
					<!-- Selection indicator / Badge -->
					{#if isA}
						<span class="flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-bold text-white shrink-0 bg-blue-600 dark:bg-blue-500 shadow-2xs">
							A
						</span>
					{:else if isB}
						<span class="flex items-center justify-center h-6 w-6 rounded-md text-[11px] font-bold text-white shrink-0 bg-emerald-600 dark:bg-emerald-500 shadow-2xs">
							B
						</span>
					{:else}
						<span class="flex items-center justify-center h-6 w-6 rounded-md text-muted-foreground shrink-0 bg-muted/60 group-hover:bg-muted transition-colors">
							<FileText class="h-3.5 w-3.5" />
						</span>
					{/if}

					<!-- Track info -->
					<div class="flex-1 min-w-0">
						<p class="text-xs font-semibold text-foreground truncate" title={file.title}>
							{file.title}
						</p>
						{#if !commonFileName}
							<p class="text-[10px] text-muted-foreground truncate" title={file.filename}>
								{file.filename}
							</p>
						{/if}
					</div>

					<!-- Format badge -->
					<span class="text-[9px] font-mono uppercase px-1.5 py-0.5 rounded border {getFormatColor(file.format)} shrink-0">
						{file.format}
					</span>

					<!-- Line count -->
					{#if file.data?.length}
						<span class="text-[10px] text-muted-foreground font-mono shrink-0">
							{file.data.length}L
						</span>
					{/if}

					<!-- Quick Set A / Set B buttons on hover -->
					<div class="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity">
						{#if !isA}
							<button
								type="button"
								onclick={(e) => { e.stopPropagation(); setSide('A', file.hash); }}
								class="px-1 py-0.5 text-[9px] font-bold rounded bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-600 dark:text-blue-400 transition-colors"
								title="Assign to Side A"
							>
								A
							</button>
						{/if}
						{#if !isB}
							<button
								type="button"
								onclick={(e) => { e.stopPropagation(); setSide('B', file.hash); }}
								class="px-1 py-0.5 text-[9px] font-bold rounded bg-emerald-500/20 hover:bg-emerald-500 hover:text-white text-emerald-600 dark:text-emerald-400 transition-colors"
								title="Assign to Side B"
							>
								B
							</button>
						{/if}
						<button
							type="button"
							class="p-0.5 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
							onclick={(e) => { e.stopPropagation(); removeFile(file.hash); }}
							title="Remove track"
							aria-label="Remove track"
						>
							<X class="h-3 w-3" />
						</button>
					</div>
				</div>
			{:else}
				<div class="py-4 text-center text-xs text-muted-foreground">
					No tracks match "{searchQuery}"
				</div>
			{/each}
		</div>

		{#if !appState.fileA || !appState.fileB}
			<p class="text-[11px] text-muted-foreground text-center py-1 bg-muted/20 rounded-md">
				{#if !appState.fileA && !appState.fileB}
					Click a track to assign to Side A, then another for Side B
				{:else}
					Select one more track to compare
				{/if}
			</p>
		{/if}
	</div>
{/if}
