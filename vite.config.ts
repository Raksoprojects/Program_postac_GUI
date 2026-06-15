import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { VitePWA } from "vite-plugin-pwa";

// Repozytorium PROJEKTOWE (Raksoprojects/Program_postac_GUI) -> GitHub Pages
// serwuje aplikacje pod sciezka /Program_postac_GUI/, wiec base musi ja zawierac.
// Gdyby kod trafil do repozytorium typu "user page" (raksoprojects.github.io),
// nalezy zmienic base z powrotem na '/'.
export default defineConfig({
  base: "/Program_postac_GUI/",
  plugins: [
    svelte(),
    VitePWA({
      registerType: "autoUpdate",
      includeAssets: ["favicon.svg", "icon-192.png", "icon-512.png"],
      manifest: {
        name: "Karta Postaci WFRP 4ed",
        short_name: "Karta WFRP",
        description: "Interaktywna karta postaci Warhammer Fantasy Roleplay 4ed",
        theme_color: "#2b2622",
        background_color: "#1a1714",
        display: "standalone",
        orientation: "portrait-primary",
        lang: "pl",
        icons: [
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png"
          },
          {
            src: "icon-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "maskable"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png"
          },
          {
            src: "icon-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        // Pusta karta PDF (~12 MB) jest potrzebna tylko przy eksporcie - nie
        // precache'ujemy jej, lecz cache'ujemy "w locie" przy pierwszym uzyciu.
        globPatterns: ["**/*.{js,css,html,svg,png,json,woff2}"],
        globIgnores: ["**/empty_card.pdf"],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.endsWith(".pdf"),
            handler: "CacheFirst",
            options: {
              cacheName: "wfrp-pdf",
              expiration: { maxEntries: 4, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] }
            }
          }
        ]
      }
    })
  ],
  build: {
    target: "es2020",
    sourcemap: false
  }
});
