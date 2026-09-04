<script lang="ts">
	import { ChevronUp, ChevronDown, Plus, Minus, Equal } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { sanitizeDiffHtml } from '$lib/utils/sanitize';

	let diffContainer = $state<HTMLDivElement>();
	let currentChangeIndex = $state(0);

	const diffResult = $derived(appState.diffResult);

	function navigateChange(direction: 'prev' | 'next') {
		if (!diffContainer) return;
		const rows = Array.from(diffContainer.querySelectorAll<HTMLElement>('.d2h-diff-tbody > tr')).filter(
			(tr) => tr.querySelector('.d2h-ins, .d2h-del, .d2h-change')
		);
		if (rows.length === 0) return;

		if (direction === 'next') {
			currentChangeIndex = Math.min(currentChangeIndex + 1, rows.length - 1);
		} else {
			currentChangeIndex = Math.max(currentChangeIndex - 1, 0);
		}

		rows[currentChangeIndex]?.scrollIntoView({ behavior: 'smooth', block: 'center' });
	}

	// Handle line highlighting
	function handleLineClick(e: MouseEvent) {
		if (!diffContainer) return;
		const target = e.target as HTMLElement;
		const lineNum = target.closest('.d2h-code-side-linenumber, .d2h-code-linenumber');
		if (!lineNum) return;

		const row = lineNum.closest('tr');
		if (!row) return;

		if (e.shiftKey) {
			// Range selection
			const highlighted = diffContainer.querySelectorAll('tr.highlight');
			if (highlighted.length > 0) {
				const tbody = row.closest('tbody');
				if (!tbody) return;
				const rows = Array.from(tbody.children) as HTMLElement[];
				const startIdx = rows.indexOf(highlighted[0] as HTMLElement);
				const endIdx = rows.indexOf(row);
				const [from, to] = [Math.min(startIdx, endIdx), Math.max(startIdx, endIdx)];
				rows.slice(from, to + 1).forEach(r => r.classList.add('highlight'));
			}
		} else {
			// Single selection (toggle)
			const wasHighlighted = row.classList.contains('highlight');
			diffContainer.querySelectorAll('tr.highlight').forEach(r => r.classList.remove('highlight'));
			if (!wasHighlighted) {
				row.classList.add('highlight');

				// For side-by-side, also highlight the corresponding row
				if (appState.diffOutputFormat === 'side-by-side') {
					const tbody = row.closest('tbody');
					if (tbody) {
						const idx = Array.from(tbody.children).indexOf(row);
						const otherTable = row.closest('.d2h-file-side-diff')?.parentElement;
						if (otherTable) {
							const otherDiff = otherTable.querySelectorAll('.d2h-file-side-diff');
							for (const od of otherDiff) {
								if (od !== row.closest('.d2h-file-side-diff')) {
									const otherTbody = od.querySelector('.d2h-diff-tbody');
									if (otherTbody?.children[idx]) {
										(otherTbody.children[idx] as HTMLElement).classList.add('highlight');
									}
								}
							}
						}
					}
				}
			}
		}
	}
</script>

{#if diffResult}
	<div class="space-y-3 animate-fade-in">
		<!-- Stats bar -->
		<div class="flex items-center justify-between px-3 py-2 bg-muted/30 rounded-lg border border-border/50">
			<div class="flex items-center gap-4 text-xs">
				<span class="flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400">
					<Plus class="h-3 w-3" />
					<span class="font-mono font-medium">{diffResult.additions}</span>
					<span class="text-muted-foreground">added</span>
				</span>
				<span class="flex items-center gap-1.5 text-red-600 dark:text-red-400">
					<Minus class="h-3 w-3" />
					<span class="font-mono font-medium">{diffResult.deletions}</span>
					<span class="text-muted-foreground">removed</span>
				</span>
				<span class="flex items-center gap-1.5 text-muted-foreground hidden sm:flex">
					<Equal class="h-3 w-3" />
					<span class="font-mono font-medium">{diffResult.unchanged}</span>
					<span>unchanged</span>
				</span>
			</div>

			<!-- Navigation -->
			<div class="flex items-center gap-1">
				<button
					type="button"
					class="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
					onclick={() => navigateChange('prev')}
					aria-label="Previous change"
				>
					<ChevronUp class="h-4 w-4" />
				</button>
				<button
					type="button"
					class="p-1 rounded hover:bg-muted transition-colors cursor-pointer"
					onclick={() => navigateChange('next')}
					aria-label="Next change"
				>
					<ChevronDown class="h-4 w-4" />
				</button>
			</div>
		</div>

		<!-- Diff output -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			bind:this={diffContainer}
			class="diff-output relative rounded-lg border border-border overflow-auto max-h-[75vh] bg-card shadow-xs"
			style="contain: paint;"
			onclick={handleLineClick}
		>
			{@html sanitizeDiffHtml(diffResult.html)}
		</div>
	</div>
{/if}
