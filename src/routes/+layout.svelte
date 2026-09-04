<script lang="ts">
	import 'diff2html/bundles/css/diff2html.min.css';
	import '../app.css';
	import { appState } from '$lib/state.svelte';
	import { onMount } from 'svelte';

	let { children } = $props();

	onMount(() => {
		// Restore theme
		try {
			const saved = localStorage.getItem('diff-theme');
			if (saved === 'light' || saved === 'dark') {
				appState.theme = saved;
			}
		} catch {
			// Ignore localStorage access errors in private browsing
		}
	});

	// Watch for theme changes at top-level
	$effect(() => {
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('dark', appState.theme === 'dark');
		}
	});
</script>

<svelte:head>
	<title>diff — subtitle comparison tool</title>
	<meta name="description" content="Highly configurable subtitle comparison tool. Compare ASS, SRT, VTT, TXT, and MKV subtitle files with advanced filtering options." />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<link rel="preconnect" href="https://fonts.googleapis.com" />
	<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin="anonymous" />
	<link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />
</svelte:head>

<div class="min-h-screen flex flex-col bg-background transition-colors duration-300">
	{@render children()}
</div>
