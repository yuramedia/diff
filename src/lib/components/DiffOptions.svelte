<script lang="ts">
	import { Settings2, ChevronDown, Wand2, RotateCcw } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { Switch } from '$lib/components/ui/switch';
	import { Separator } from '$lib/components/ui/separator';
	import * as Collapsible from '$lib/components/ui/collapsible';
	import { Button } from '$lib/components/ui/button';
	import { processLines } from '$lib/engine/text-processor';
	import { computeDiff } from '$lib/engine/diff-engine';

	let isOpen = $state(true);

	const toggleOptions: Array<{ key: keyof typeof appState.options; label: string; description: string }> = [
		{ key: 'stripTags', label: 'Strip ASS/SSA tags', description: 'Remove {\\an8}, {\\b1}, {\\c&H...&} override tags' },
		{ key: 'removeDrawLines', label: 'Strip drawing commands', description: 'Skip vector drawings {\\p1}...{\\p0}' },
		{ key: 'removePosLines', label: 'Remove \\pos lines', description: 'Skip signs and positioned lines' },
		{ key: 'removeEmptyLines', label: 'Remove empty lines', description: 'Skip blank caption lines' },
		{ key: 'normalizeWhitespace', label: 'Normalize whitespace', description: 'Collapse spaces and trim' },
		{ key: 'normalizeCharacters', label: 'Normalize characters', description: 'Smart quotes → straight quotes' },
		{ key: 'mergeDuplicateLines', label: 'Merge duplicates', description: 'Merge identical consecutive lines' },
		{ key: 'mergeAlphaTiming', label: 'Merge alpha timing', description: 'Merge progressive reveals' },
		{ key: 'removeSpecialCharacters', label: 'Remove punctuation', description: 'Strip punctuation and symbols' },
		{ key: 'removeHonorifics', label: 'Remove honorifics', description: 'Strip -san, -kun, -chan, etc.' },
		{ key: 'lowerCase', label: 'Convert to lowercase', description: 'Case-insensitive comparison' },
	];

	function recomputeDiffIfActive() {
		if (!appState.diffResult || !appState.fileA || !appState.fileB) return;
		const fileA = appState.files.get(appState.fileA);
		const fileB = appState.files.get(appState.fileB);
		if (!fileA || !fileB) return;

		try {
			const processedA = processLines(fileA.data, {
				...appState.options,
				excludedStyles: appState.options.excludedStyles,
				replace: appState.options.replace
			});

			const processedB = processLines(fileB.data, {
				...appState.options,
				excludedStyles: appState.options.excludedStyles,
				replace: appState.options.replace
			});

			appState.diffResult = computeDiff(
				processedA.lines,
				processedB.lines,
				fileA.title,
				fileB.title,
				{
					outputFormat: appState.diffOutputFormat,
					matching: appState.diffMatching
				}
			);
		} catch (err) {
			console.error('Recompute error:', err);
		}
	}

	function toggleOption(key: keyof typeof appState.options) {
		(appState.options as Record<string, boolean>)[key] = !(appState.options as Record<string, boolean>)[key];
		recomputeDiffIfActive();
	}

	function applyPreset(preset: 'default' | 'strict' | 'raw') {
		if (preset === 'default') {
			appState.options.stripTags = true;
			appState.options.removeDrawLines = true;
			appState.options.removePosLines = false;
			appState.options.removeEmptyLines = true;
			appState.options.normalizeWhitespace = true;
			appState.options.normalizeCharacters = true;
			appState.options.mergeDuplicateLines = false;
			appState.options.mergeAlphaTiming = false;
			appState.options.removeSpecialCharacters = false;
			appState.options.removeHonorifics = false;
			appState.options.lowerCase = false;
		} else if (preset === 'strict') {
			appState.options.stripTags = true;
			appState.options.removeDrawLines = true;
			appState.options.removePosLines = true;
			appState.options.removeEmptyLines = true;
			appState.options.normalizeWhitespace = true;
			appState.options.normalizeCharacters = true;
			appState.options.mergeDuplicateLines = true;
			appState.options.mergeAlphaTiming = true;
			appState.options.removeSpecialCharacters = false;
			appState.options.removeHonorifics = false;
			appState.options.lowerCase = false;
		} else if (preset === 'raw') {
			appState.options.stripTags = false;
			appState.options.removeDrawLines = false;
			appState.options.removePosLines = false;
			appState.options.removeEmptyLines = false;
			appState.options.normalizeWhitespace = false;
			appState.options.normalizeCharacters = false;
			appState.options.mergeDuplicateLines = false;
			appState.options.mergeAlphaTiming = false;
			appState.options.removeSpecialCharacters = false;
			appState.options.removeHonorifics = false;
			appState.options.lowerCase = false;
		}
		recomputeDiffIfActive();
	}
</script>

<Collapsible.Root bind:open={isOpen}>
	<div class="flex items-center justify-between">
		<Collapsible.Trigger asChild>
			<Button variant="ghost" size="sm" class="justify-between text-foreground hover:bg-muted/60 gap-2 font-medium px-2">
				<span class="flex items-center gap-2">
					<Settings2 class="h-4 w-4 text-indigo-500" />
					<span class="text-xs font-semibold">Processing & Subtitle Filters</span>
				</span>
				<ChevronDown class="h-3.5 w-3.5 transition-transform duration-200 {isOpen ? 'rotate-180' : ''}" />
			</Button>
		</Collapsible.Trigger>

		<!-- Presets -->
		<div class="flex items-center gap-1">
			<button
				type="button"
				onclick={() => applyPreset('default')}
				class="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
				title="Standard evadiff filters (Strip tags, drawings, whitespace)"
			>
				Default
			</button>
			<button
				type="button"
				onclick={() => applyPreset('strict')}
				class="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
				title="All subtitle cleaning filters enabled"
			>
				Clean All
			</button>
			<button
				type="button"
				onclick={() => applyPreset('raw')}
				class="text-[10px] px-2 py-0.5 rounded border border-border bg-muted/30 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors font-medium"
				title="No filtering — compare verbatim text"
			>
				Raw
			</button>
		</div>
	</div>

	<Collapsible.Content>
		<div class="pt-3 pb-1 space-y-4">
			<!-- View Mode & Matching Row -->
			<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
				<!-- View Mode -->
				<div class="space-y-1.5">
					<p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">View Mode</p>
					<div class="flex rounded-lg bg-muted/50 p-1 border border-border gap-1">
						<button
							type="button"
							class="flex-1 text-xs py-1 px-2 rounded-md transition-all font-medium
								{appState.diffOutputFormat === 'side-by-side'
									? 'bg-indigo-600 text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/50'}"
							onclick={() => {
								appState.diffOutputFormat = 'side-by-side';
								recomputeDiffIfActive();
							}}
						>
							Side by Side
						</button>
						<button
							type="button"
							class="flex-1 text-xs py-1 px-2 rounded-md transition-all font-medium
								{appState.diffOutputFormat === 'line-by-line'
									? 'bg-indigo-600 text-white shadow-xs'
									: 'text-muted-foreground hover:text-foreground hover:bg-background/50'}"
							onclick={() => {
								appState.diffOutputFormat = 'line-by-line';
								recomputeDiffIfActive();
							}}
						>
							Unified
						</button>
					</div>
				</div>

				<!-- Matching Mode -->
				<div class="space-y-1.5">
					<p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Matching</p>
					<div class="flex rounded-lg bg-muted/50 p-1 border border-border gap-1">
						{#each ['words', 'lines', 'none'] as mode}
							<button
								type="button"
								class="flex-1 text-xs py-1 px-2 rounded-md capitalize transition-all font-medium
									{appState.diffMatching === mode
										? 'bg-indigo-600 text-white shadow-xs'
										: 'text-muted-foreground hover:text-foreground hover:bg-background/50'}"
								onclick={() => {
									appState.diffMatching = mode as 'words' | 'lines' | 'none';
									recomputeDiffIfActive();
								}}
							>
								{mode}
							</button>
						{/each}
					</div>
				</div>
			</div>

			<Separator />

			<!-- Toggle Options Grid -->
			<div class="space-y-1">
				<p class="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider pb-1">Subtitle Cleaning Filters</p>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
					{#each toggleOptions as opt (opt.key)}
						<!-- svelte-ignore a11y_click_events_have_key_events -->
						<!-- svelte-ignore a11y_no_static_element_interactions -->
						<div
							class="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer group"
							onclick={() => toggleOption(opt.key)}
						>
							<div class="min-w-0 pr-3">
								<p class="text-xs font-medium text-foreground group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{opt.label}</p>
								<p class="text-[10px] text-muted-foreground truncate">{opt.description}</p>
							</div>
							<Switch
								bind:checked={appState.options[opt.key] as boolean}
								onCheckedChange={() => recomputeDiffIfActive()}
							/>
						</div>
					{/each}
				</div>
			</div>
		</div>
	</Collapsible.Content>
</Collapsible.Root>
