import { defineConfig } from "vitest/config";

// Konfiguracja testow jednostkowych (Vitest) - oddzielona od vite.config.ts,
// aby uniknac wtyczek PWA/Svelte podczas testow czystej logiki TS.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.{test,spec}.ts"]
  }
});
