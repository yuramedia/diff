# Subtitle & Text Diff Tool

An advanced, privacy-first subtitle and text comparison tool built with Svelte 5 and Vite. Compare subtitles (SRT, ASS, SSA, VTT) and plain text with customizable cleaning filters, side-by-side / unified diffs, and MKV subtitle extraction.

🌐 **Live Demo:** [https://diff.yuramedia.com](https://diff.yuramedia.com)  
📦 **Repository:** [https://github.com/yuramedia/diff](https://github.com/yuramedia/diff)

---

## ✨ Features

- **Side-by-Side & Unified Diffs:** Clear visual diffing powered by `diff2html` and `diff`.
- **Subtitle Awareness:** Built-in normalization filters for timestamps, ASS/SSA override tags (`{\an8}`, `{\b1}`, etc.), styling, speaker prefixes, and line numbers.
- **MKV Subtitle Extraction:** Direct client-side parsing and subtitle extraction from Matroska (`.mkv`) files.
- **Instant Dual Editor:** Quick side-by-side paste or file drop with live word/line counters and instant swapping.
- **Export Capabilities:** Export comparisons as HTML, unified patch (`.diff`), or high-resolution PNG images.
- **100% Client-Side & Private:** All processing and subtitle parsing happen locally in your browser. No data leaves your device.
- **Responsive & Accessible:** Dark/light mode theme support, keyboard navigation between changes, and responsive layout.

---

## 🚀 Tech Stack

- **Framework:** [Svelte 5](https://svelte.dev/) (Runes) + [SvelteKit](https://kit.svelte.dev/)
- **Styling:** [Tailwind CSS v4](https://tailwindcss.com/) + [Bits UI](https://bits-ui.com/)
- **Icons:** [Lucide Svelte](https://lucide.dev/)
- **Package Manager / Runtime:** [Bun](https://bun.sh/)
- **Deployment:** GitHub Pages via GitHub Actions

---

## 🛠️ Local Development

### Prerequisites

Ensure you have [Bun](https://bun.sh/) installed.

```bash
# Clone the repository
git clone https://github.com/yuramedia/diff.git
cd diff

# Install dependencies
bun install

# Start development server
bun run dev

# Run type check
bun run check

# Build for production
bun run build
```

---

## 📄 License

MIT © [yuramedia](https://github.com/yuramedia)
