<script lang="ts">
	import { ChevronDown, Search, Check, FileText } from 'lucide-svelte';
	import { Badge } from '$lib/components/ui/badge';

	interface TrackItem {
		hash: string;
		title: string;
		format: string;
		lines?: number;
	}

	let {
		side,
		label,
		selectedHash = null,
		selectedTitle = 'Select Subtitle Track...',
		format = 'txt',
		tracks = [],
		otherSideHash = null,
		onSelect
	}: {
		side: 'A' | 'B';
		label?: string;
		selectedHash?: string | null;
		selectedTitle?: string;
		format?: string;
		tracks?: TrackItem[];
		otherSideHash?: string | null;
		onSelect: (hash: string) => void;
	} = $props();

	let isOpen = $state(false);
	let searchQuery = $state('');
	let containerRef = $state<HTMLDivElement>();
	let searchInputRef = $state<HTMLInputElement>();

	const filteredTracks = $derived(
		tracks.filter(t =>
			!searchQuery ||
			t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
			t.format.toLowerCase().includes(searchQuery.toLowerCase())
		)
	);

	function toggleDropdown() {
		if (tracks.length === 0) return;
		isOpen = !isOpen;
		if (isOpen) {
			searchQuery = '';
			setTimeout(() => searchInputRef?.focus(), 50);
		}
	}

	function handleSelect(hash: string) {
		onSelect(hash);
		isOpen = false;
	}

	// Close on click outside or escape key
	$effect(() => {
		if (isOpen && typeof document !== 'undefined') {
			function handleClickOutside(e: MouseEvent) {
				if (containerRef && !containerRef.contains(e.target as Node)) {
					isOpen = false;
				}
			}
			function handleKeyDown(e: KeyboardEvent) {
				if (e.key === 'Escape') isOpen = false;
			}
			document.addEventListener('mousedown', handleClickOutside);
			document.addEventListener('keydown', handleKeyDown);
			return () => {
				document.removeEventListener('mousedown', handleClickOutside);
				document.removeEventListener('keydown', handleKeyDown);
			};
		}
	});
</script>

<div bind:this={containerRef} class="relative inline-flex items-center gap-2 text-left min-w-0">
	<!-- Side Label -->
	<span class="text-xs font-bold uppercase tracking-wider shrink-0 {side === 'A' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}">
		{label || (side === 'A' ? 'Original (A)' : 'Changed (B)')}
	</span>

	<!-- Trigger Combobox Button -->
	{#if tracks.length > 0}
		<button
			type="button"
			onclick={toggleDropdown}
			class="group flex items-center gap-2 px-2.5 py-1 rounded-lg border border-border bg-background hover:bg-muted/70 hover:border-primary/50 transition-all duration-150 text-left shadow-2xs cursor-pointer max-w-[200px] sm:max-w-[280px] md:max-w-[340px]"
			aria-haspopup="listbox"
			aria-expanded={isOpen}
			title="Click to select or search subtitle track ({tracks.length} tracks available)"
		>
			<!-- Selected track title -->
			<span class="text-xs font-semibold text-foreground truncate min-w-0 flex-1">
				{selectedTitle || (side === 'A' ? 'Original (A)' : 'Changed (B)')}
			</span>

			<!-- Track count badge if multiple -->
			{#if tracks.length > 1}
				<span class="text-[10px] font-medium bg-muted px-1.5 py-0.2 rounded text-muted-foreground group-hover:text-foreground shrink-0" title="{tracks.length} subtitle tracks available">
					{tracks.length}
				</span>
			{/if}

			<!-- Format badge -->
			<Badge variant="outline" class="text-[9px] px-1 py-0 font-mono uppercase bg-card shrink-0">
				{format}
			</Badge>

			<!-- Chevron -->
			<ChevronDown class="h-3.5 w-3.5 text-muted-foreground group-hover:text-foreground transition-transform duration-200 shrink-0 {isOpen ? 'rotate-180 text-primary' : ''}" />
		</button>
	{:else}
		<div class="flex items-center gap-2 min-w-0">
			<span class="text-xs font-medium truncate max-w-[140px] text-muted-foreground" title={selectedTitle}>
				{selectedTitle}
			</span>
			<Badge variant="outline" class="text-[9px] px-1 py-0 font-mono uppercase bg-background shrink-0">
				{format}
			</Badge>
		</div>
	{/if}

	<!-- Popover Dropdown Menu -->
	{#if isOpen}
		<div
			class="absolute left-0 top-full mt-1.5 z-50 w-72 sm:w-84 rounded-xl border border-border bg-popover/95 backdrop-blur-md shadow-2xl p-2 space-y-1.5 animate-fade-in"
			role="listbox"
		>
			<!-- Search filter input -->
			{#if tracks.length > 3}
				<div class="relative px-1 pt-1 pb-1">
					<Search class="h-3.5 w-3.5 absolute left-3.5 top-3 text-muted-foreground" />
					<input
						bind:this={searchInputRef}
						type="text"
						bind:value={searchQuery}
						placeholder="Search track / language (e.g. Indonesian, English, jpn)..."
						class="w-full pl-8 pr-3 py-1.5 text-xs bg-muted/60 border border-border rounded-lg outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-foreground placeholder:text-muted-foreground"
					/>
				</div>
			{/if}

			<!-- Track List Header -->
			<div class="flex items-center justify-between px-2 pt-0.5 text-[10px] uppercase tracking-wider font-semibold text-muted-foreground">
				<span>Select Subtitle Track</span>
				<span>{filteredTracks.length} / {tracks.length}</span>
			</div>

			<!-- Scrollable list -->
			<div class="max-h-60 overflow-y-auto space-y-1 pr-0.5">
				{#each filteredTracks as track (track.hash)}
					{@const isSelected = track.hash === selectedHash}
					{@const isOtherSelected = otherSideHash && track.hash === otherSideHash}
					<button
						type="button"
						onclick={() => handleSelect(track.hash)}
						class="w-full flex items-center justify-between p-2 rounded-lg text-left transition-all text-xs cursor-pointer
							{isSelected
								? (side === 'A' ? 'bg-blue-500/15 text-blue-700 dark:text-blue-300 font-semibold ring-1 ring-blue-500/30' : 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold ring-1 ring-emerald-500/30')
								: 'hover:bg-muted text-foreground'}"
						role="option"
						aria-selected={isSelected}
					>
						<div class="flex items-center gap-2 min-w-0 flex-1 pr-2">
							{#if isSelected}
								<Check class="h-3.5 w-3.5 shrink-0 {side === 'A' ? 'text-blue-600 dark:text-blue-400' : 'text-emerald-600 dark:text-emerald-400'}" />
							{:else}
								<FileText class="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
							{/if}
							<span class="truncate">{track.title}</span>
						</div>

						<div class="flex items-center gap-1.5 shrink-0">
							{#if isOtherSelected}
								<span class="text-[9px] px-1.5 py-0.2 rounded font-medium {side === 'A' ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10' : 'text-blue-600 dark:text-blue-400 bg-blue-500/10'}">
									Side {side === 'A' ? 'B' : 'A'}
								</span>
							{/if}
							{#if track.lines}
								<span class="text-[10px] text-muted-foreground font-mono">{track.lines}L</span>
							{/if}
							<Badge variant="outline" class="text-[9px] px-1 py-0 font-mono uppercase bg-background">
								{track.format}
							</Badge>
						</div>
					</button>
				{:else}
					<div class="py-4 text-center text-xs text-muted-foreground">
						No subtitle tracks match "{searchQuery}"
					</div>
				{/each}
			</div>
		</div>
	{/if}
</div>
