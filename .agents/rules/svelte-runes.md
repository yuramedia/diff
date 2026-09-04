# Svelte 5 Runes Rules & Conventions

This project exclusively utilizes **Svelte 5 Runes**. Do not use Svelte 3/4 legacy reactive statements or declarations.

---

## 1. Reactive State (`$state`)

- Use `$state()` for primitive values, objects, sets, and maps:
    ```typescript
    let fileA = $state<string | null>(null);
    let files = $state(new Map<string, TrackItem>());
    ```
- For deeply reactive nested objects, `$state()` creates deep proxies in Svelte 5.
- Mutate properties directly without reassigning the parent object:
    ```typescript
    // Correct in Svelte 5:
    appState.options.stripTags = true;
    ```

## 2. Derived State (`$derived`)

- Use `$derived(...)` for single expressions:
    ```typescript
    const hasFiles = $derived(appState.files.size > 0);
    const fileA = $derived(appState.fileA ? appState.files.get(appState.fileA) : null);
    ```
- Use `$derived.by(() => { ... })` when complex logic, loops, or early returns are required.
- Do NOT use `$:` reactive declarations.

## 3. Component Props (`$props`)

- Use the `$props()` rune to declare component props:
    ```typescript
    interface Props {
        title?: string;
        disabled?: boolean;
        onchange?: (val: string) => void;
    }
    let { title = "Default", disabled = false, onchange }: Props = $props();
    ```
- Do NOT use `export let propName`.

## 4. Two-Way Bindings (`$bindable`)

- Declare two-way bindable props using `$bindable()`:
    ```typescript
    let { value = $bindable("") }: { value?: string } = $props();
    ```
- When using `WithElementRef` in component libraries or UI primitives:
    - Always allow `ref?: E | null` so consumers can safely bind `let myRef = $state<HTMLElement | null>(null)`.

## 5. Event Handling

- Use standard HTML attribute event listeners:
    - `onclick={() => ...}` (NOT `on:click`)
    - `onkeydown={(e) => ...}` (NOT `on:keydown`)
    - `onchange={(e) => ...}` (NOT `on:change`)

## 6. Snippets (`{#snippet ...}`)

- Use `{#snippet name(args)}...{/snippet}` instead of `<slot>` for templates and component slots.
