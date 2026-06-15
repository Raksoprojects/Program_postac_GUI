/**
 * Generator ikon PWA (PNG 192 i 512) ze zrodlowego SVG.
 *
 * Uruchamianie (z katalogu glownego projektu):
 *   npm install --save-dev sharp
 *   node tools/icons/generate-icons.mjs
 *   npm uninstall sharp
 *
 * sharp NIE jest stala zaleznoscia (ikony sa juz wygenerowane i wersjonowane);
 * instalujemy go tylko na czas regeneracji. Wynik trafia do public/
 * (icon-192.png, icon-512.png) - sciezki zgodne z manifestem w vite.config.ts.
 */
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const svgPath = resolve(here, "icon-source.svg");
const publicDir = resolve(here, "../../public");

const svg = readFileSync(svgPath);

const sizes = [192, 512];

for (const size of sizes) {
  const out = resolve(publicDir, `icon-${size}.png`);
  await sharp(svg, { density: 384 })
    .resize(size, size)
    .png({ compressionLevel: 9 })
    .toFile(out);
  console.log(`OK icon-${size}.png`);
}
