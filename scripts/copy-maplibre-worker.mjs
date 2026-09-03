/**
 * Put MapLibre's worker somewhere the browser can actually fetch it.
 *
 * MapLibre works out where its worker lives from `import.meta.url`:
 *
 *     function defaultWorkerUrl() {
 *       const moduleUrl = import.meta.url;
 *       if (!/^https?:/.test(moduleUrl)) return "";
 *       ...
 *     }
 *
 * Once Next has bundled the library that is no longer an http(s) URL, so the
 * function returns an empty string, the worker is never created, and MapLibre
 * says nothing about it. Every GeoJSON source is parsed into tiles inside that
 * worker — so without it, fills, lines, circles and symbols all render nothing,
 * while raster basemap tiles and DOM markers carry on working perfectly. That
 * combination is exactly what a broken map looked like here: satellite imagery
 * and animal pins, and not one field boundary.
 *
 * So the worker is copied into `public/` and pointed at explicitly. Both files
 * are needed — the worker imports the shared chunk as a sibling — and they are
 * copied at build time rather than committed, so they can never drift from the
 * version in `node_modules`.
 */
import { copyFile, mkdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const from = join(root, "node_modules", "maplibre-gl", "dist");
const to = join(root, "public", "maplibre");

// The worker imports the shared chunk by relative path, so both have to sit
// beside each other under the same directory.
const FILES = ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"];

const { version } = JSON.parse(
  await readFile(join(root, "node_modules", "maplibre-gl", "package.json"), "utf8"),
);

await mkdir(to, { recursive: true });
for (const f of FILES) {
  await copyFile(join(from, f), join(to, f));
}
console.log(`maplibre worker ${version} → public/maplibre/ (${FILES.length} files)`);
