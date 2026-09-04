<script lang="ts">
	import { cn } from "$lib/utils.js";

	let {
		checked = $bindable(false),
		onCheckedChange,
		disabled = false,
		class: className = '',
		id,
		...restProps
	}: {
		checked?: boolean;
		onCheckedChange?: (checked: boolean) => void;
		disabled?: boolean;
		class?: string;
		id?: string;
		[key: string]: unknown;
	} = $props();

	function toggle(e: MouseEvent) {
		e.preventDefault();
		e.stopPropagation();
		if (disabled) return;
		checked = !checked;
		onCheckedChange?.(checked);
	}
</script>

<button
	type="button"
	role="switch"
	aria-checked={checked}
	{disabled}
	{id}
	onclick={toggle}
	class={cn(
		"relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
		checked ? "bg-indigo-600 dark:bg-indigo-500" : "bg-zinc-300 dark:bg-zinc-700",
		className
	)}
	{...restProps}
>
	<span
		class={cn(
			"pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-sm ring-0 transition duration-200 ease-in-out",
			checked ? "translate-x-4" : "translate-x-0"
		)}
	></span>
</button>
