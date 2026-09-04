<script lang="ts">
	import Header from '$lib/components/Header.svelte';
	import DualEditor from '$lib/components/DualEditor.svelte';
	import DropZone from '$lib/components/DropZone.svelte';
	import FileList from '$lib/components/FileList.svelte';
	import DiffOptions from '$lib/components/DiffOptions.svelte';
	import DiffViewer from '$lib/components/DiffViewer.svelte';
	import Toolbar from '$lib/components/Toolbar.svelte';
	import Footer from '$lib/components/Footer.svelte';
	import { appState } from '$lib/state.svelte';
	import { Button } from '$lib/components/ui/button';
	import { Layers, SlidersHorizontal, ChevronDown, ChevronUp } from 'lucide-svelte';

	let showBatchDrop = $state(false);
	let showOptions = $state(true);

	const hasFiles = $derived(appState.files.size > 0);
	const hasDiff = $derived(appState.diffResult !== null);
</script>

<Header />

<main class="flex-1 w-full max-w-7xl mx-auto px-4 py-6 space-y-6">
	<!-- Dual Input Editors (Diffchecker Style) -->
	<section aria-label="Subtitle input editors">
		<DualEditor />
	</section>

	<!-- Diff Results Area (Rendered immediately below editors for instant visibility!) -->
	{#if hasDiff}
		<section id="diff-results-anchor" class="space-y-4 pt-1 animate-fade-in" aria-label="Comparison results">
			<div class="flex flex-wrap items-center justify-between gap-3 pb-1 border-b border-border">
				<div>
					<h2 class="text-base font-semibold tracking-tight text-foreground flex items-center gap-2">
						<span>Comparison Results</span>
						<span class="text-xs font-normal text-muted-foreground">({appState.diffOutputFormat})</span>
					</h2>
				</div>
				<Toolbar />
			</div>
			<DiffViewer />
		</section>
	{/if}

	<!-- Options & Batch Upload Toggle Section -->
	<section class="space-y-4 pt-4 border-t border-border">
		<div class="flex flex-wrap items-center justify-between gap-3">
			<div class="flex items-center gap-2">
				<Button
					variant="outline"
					size="sm"
					onclick={() => { showOptions = !showOptions; }}
					class="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
				>
					<SlidersHorizontal class="h-3.5 w-3.5 text-indigo-500" />
					<span>Subtitle Cleaning Filters & Presets</span>
					{#if showOptions}
						<ChevronUp class="h-3.5 w-3.5 opacity-60" />
					{:else}
						<ChevronDown class="h-3.5 w-3.5 opacity-60" />
					{/if}
				</Button>

				<Button
					variant="outline"
					size="sm"
					onclick={() => { showBatchDrop = !showBatchDrop; }}
					class="gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground"
				>
					<Layers class="h-3.5 w-3.5 text-emerald-500" />
					<span>Batch Files & Global Drop Area</span>
					{#if showBatchDrop}
						<ChevronUp class="h-3.5 w-3.5 opacity-60" />
					{:else}
						<ChevronDown class="h-3.5 w-3.5 opacity-60" />
					{/if}
				</Button>
			</div>

			{#if appState.statusMessage}
				<p class="text-xs text-indigo-600 dark:text-indigo-400 animate-pulse font-medium">
					{appState.statusMessage}
				</p>
			{/if}
		</div>

		<!-- Collapsible Batch Drop Zone -->
		{#if showBatchDrop}
			<div class="animate-fade-in">
				<DropZone />
			</div>
		{/if}

		<!-- Options Panel & File List -->
		{#if showOptions || hasFiles}
			<div class="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-6 items-start">
				{#if showOptions}
					<div class="rounded-xl border border-border bg-card p-4 shadow-xs">
						<DiffOptions />
					</div>
				{/if}

				{#if hasFiles}
					<div class="space-y-4 rounded-xl border border-border bg-card p-4 shadow-xs">
						<FileList />
					</div>
				{/if}
			</div>
		{/if}
	</section>
</main>

<Footer />
