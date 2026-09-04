import adapter from "@sveltejs/adapter-static";
import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

declare const process: { env: Record<string, string | undefined> };

export default defineConfig({
    plugins: [
        tailwindcss(),
        sveltekit({
            compilerOptions: {
                runes: ({ filename }) => (filename.split(/[/\\]/).includes("node_modules") ? undefined : true)
            },
            adapter: adapter({
                pages: "build",
                assets: "build",
                fallback: "404.html",
                precompress: false,
                strict: true
            }),
            paths: {
                base: (process.env.BASE_PATH || "") as "" | `/${string}`
            }
        })
    ]
});
