// Home snapshot (std 1.8.0): writes home/<tab>.json for every tab of this plugin's standard screen, from its own live
// loadTab, run in Node with the kit's kino (sdk/kino-shim.mjs). The GitHub Action .github/workflows/home-snapshot.yml runs it
// every 6 hours; the screen reads the files first and scrapes the site only when a file is missing, broken or over 24 h old.
// A tab that comes back empty or fails keeps its previous file. Exit 1 only when no tab could be written or kept.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createKino } from "../sdk/kino-shim.mjs";

const ROOT = new URL("../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("kino-plugin.json", ROOT), "utf8"));
const { kino } = createKino(manifest, { lang: "es-CO", device: "phone" });
globalThis.kino = kino;

const plugin = await import(new URL("src/plugin.js", ROOT).href);
const std = await import(new URL("src/std/index.js", ROOT).href);
// The standard screen is made on the first screen() call; its gate (resolver missing) does not matter here.
try { await plugin.screen({ state: {}, device: "phone", installed: {} }); } catch (_) { /* the source is set before any await */ }
const source = std.snapshotSource();
if (!source) { console.error("no standard screen (std 1.8.0) in this plugin"); process.exit(1); }

/** Unchanged rows and a file under this age are left alone, so the repository gets a commit only when the Home changed. */
const KEEP_MS = 12 * 60 * 60 * 1000;
const dir = new URL("home/", ROOT);
mkdirSync(dir, { recursive: true });
let usable = 0;
for (const t of source.tabs) {
  const file = new URL(encodeURIComponent(t.id) + ".json", dir);
  const old = existsSync(file) ? (() => { try { return JSON.parse(readFileSync(file, "utf8")); } catch (_) { return null; } })() : null;
  try {
    const page = await source.loadTab(t.id);
    const rows = (page && Array.isArray(page.rows) ? page.rows : []).filter((r) => r && Array.isArray(r.items) && r.items.length > 0);
    if (rows.length === 0) { console.log(`${t.id}: empty answer, previous file kept`); if (old) usable++; continue; }
    usable++;
    if (old && JSON.stringify(old.rows) === JSON.stringify(rows) && Date.now() - Number(old.at) < KEEP_MS) { console.log(`${t.id}: unchanged`); continue; }
    writeFileSync(file, JSON.stringify({ v: std.SNAPSHOT_VERSION, tab: t.id, at: Date.now(), rows }) + "\n");
    console.log(`${t.id}: ${rows.length} rows, ${rows.reduce((n, r) => n + r.items.length, 0)} titles`);
  } catch (e) {
    console.log(`${t.id}: failed (${(e && e.code) || "error"}: ${String((e && e.message) || e).slice(0, 160)}), previous file kept`);
    if (old) usable++;
  }
}
process.exit(usable > 0 ? 0 : 1);
