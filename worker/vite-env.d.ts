// The Worker is bundled by Vite (@cloudflare/vite-plugin), which expands import.meta.glob at build time.
interface ImportMeta {
  glob<T>(pattern: string, options: { import: "default" }): Record<string, () => Promise<T>>;
}
