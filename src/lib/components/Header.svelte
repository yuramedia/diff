<script lang="ts">
	import { GitCompareArrows } from 'lucide-svelte';
	import ThemeToggle from './ThemeToggle.svelte';
</script>

<header class="flex items-center justify-between px-4 py-3 border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
	<div class="flex items-center gap-3">
		<div class="flex items-center gap-2">
			<div class="p-1.5 rounded-lg bg-primary/10">
				<GitCompareArrows class="h-5 w-5 text-primary" />
			</div>
			<h1 class="text-lg font-bold tracking-tight">
				<span class="text-primary">diff</span>
			</h1>
		</div>
		<span class="text-xs text-muted-foreground hidden sm:inline-block px-2 py-0.5 rounded-full bg-muted">
			subtitle comparison tool
		</span>
	</div>

	<div class="flex items-center gap-2">
		<a
			href="https://github.com/yuramedia/diff"
			target="_blank"
			rel="noopener noreferrer"
			class="text-muted-foreground hover:text-foreground transition-colors text-xs hidden sm:inline-flex items-center gap-1"
		>
			GitHub
		</a>
		<ThemeToggle />
	</div>
</header>
