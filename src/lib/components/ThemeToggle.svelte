<script lang="ts">
	import { Sun, Moon } from 'lucide-svelte';
	import { appState } from '$lib/state.svelte';
	import { Button } from '$lib/components/ui/button';

	function toggleTheme() {
		appState.theme = appState.theme === 'dark' ? 'light' : 'dark';
		if (typeof document !== 'undefined') {
			document.documentElement.classList.toggle('dark', appState.theme === 'dark');
			localStorage.setItem('diff-theme', appState.theme);
		}
	}
</script>

<Button variant="ghost" size="icon" onclick={toggleTheme} class="h-9 w-9 rounded-lg">
	{#if appState.theme === 'dark'}
		<Sun class="h-4 w-4" />
	{:else}
		<Moon class="h-4 w-4" />
	{/if}
	<span class="sr-only">Toggle theme</span>
</Button>
