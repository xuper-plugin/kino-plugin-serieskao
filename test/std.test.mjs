// The standard screen (src/std): the bar, the inline search, the settings page, the hero, the native title pages and the gate.
import test from "node:test";
import assert from "node:assert/strict";
import { makeStandardScreen } from "../src/std/index.js";

const RESOLVER = "xuper-plugin/kino-plugin-kino-resolver";
const KOFI = "https://ko-fi.com/xuperplugins";
const LOGO = "data:image/png;base64,AAAA";

function fakeKino() {
  const m = new Map();
  return { storage: { get: (k) => (m.has(k) ? m.get(k) : null), set: (k, v) => m.set(k, v), remove: (k) => m.delete(k) }, log() {} };
}

const item = (n, extra = {}) => ({
  id: "i" + n, ref: "m:" + n, title: "Title " + n, kind: "movie", poster: "https://img/p" + n + ".jpg",
  backdrop: "https://img/b" + n + ".jpg", overview: "Overview " + n, ...extra,
});

function make(over = {}) {
  return makeStandardScreen({
    kino: fakeKino(), name: "SeriesKao", logo: LOGO, logoAspect: "1:1", needsResolver: true, hasSettings: true,
    loadTab: async () => ({ rows: [{ id: "r1", title: "Estrenos", ref: "browse:new", items: [item(1), item(2), item(3)] }] }),
    ...over,
  });
}

const installed = { [RESOLVER]: {} };

/** Every node of a tree, depth first. */
function nodes(tree, out = []) {
  if (Array.isArray(tree)) { for (const t of tree) nodes(t, out); return out; }
  if (!tree || typeof tree !== "object") return out;
  if (typeof tree.type === "string") out.push(tree);
  for (const v of Object.values(tree)) if (v && typeof v === "object") nodes(v, out);
  return out;
}

/** open, then ticks until nothing is pending: the screen state with the tab loaded. */
async function loaded(s, device = "phone") {
  let state = { ...(await s.screenEvent({ name: "open", state: {}, device, route: { name: "main" } })).state };
  for (let i = 0; i < 10 && state.pending && state.pending.length; i++) {
    const r = await s.screenEvent({ name: "tick", state, device });
    state = { ...state, ...(r ? r.state : {}) };
  }
  return state;
}

test("bar has logo, name, search and settings", async () => {
  const s = make();
  const tree = await s.screen({ state: {}, device: "phone", installed });
  assert.equal(tree.appBar.mergeWithKinoBar, true);
  assert.equal(tree.appBar.title.type, "Row");
  const kids = tree.appBar.title.children;
  assert.ok(kids.some((n) => n.type === "Image" && n.url === LOGO));
  assert.ok(kids.some((n) => n.type === "Text" && n.text === "SeriesKao"));
  assert.deepEqual(tree.appBar.actions.map((a) => a.icon), ["search", "settings"]);
  assert.equal(tree.floatingActionButton, undefined);
});

test("bar without a logo still has the name", async () => {
  const tree = await make({ logo: null }).screen({ state: {}, device: "phone", installed });
  const kids = tree.appBar.title.children;
  assert.ok(!kids.some((n) => n.type === "Image"));
  assert.ok(kids.some((n) => n.type === "Text" && n.text === "SeriesKao"));
});

test("search swaps the bar", async () => {
  const s = make();
  assert.deepEqual(await s.screenEvent({ name: "openSearch", state: {} }), { state: { searching: true } });
  const tree = await s.screen({ state: { searching: true }, device: "phone", installed });
  assert.equal(tree.appBar.title.type, "TextField");
  assert.equal(tree.appBar.title.kind, "search");
  assert.equal(tree.appBar.title.onSubmitted, "search");
  assert.equal(tree.appBar.leading.icon, "arrow_back");
  assert.equal(tree.appBar.leading.onPressed, "closeSearch");
  assert.deepEqual(await s.screenEvent({ name: "closeSearch", state: { searching: true } }), { state: { searching: false } });
});

test("search goes to Kino's search", async () => {
  const s = make();
  assert.deepEqual(await s.screenEvent({ name: "search", value: "  dune ", state: { searching: true } }),
    { go: { search: { q: "dune" } }, state: { searching: false } });
  assert.deepEqual(await s.screenEvent({ name: "search", value: "   ", state: { searching: true } }), { state: { searching: false } });
  assert.deepEqual(await s.screenEvent({ name: "search", value: null, state: { searching: true, inputs: { q: "alien" } } }),
    { go: { search: { q: "alien" } }, state: { searching: false } });
  const long = await s.screenEvent({ name: "search", value: "x".repeat(300), state: {} });
  assert.equal(long.go.search.q.length, 200);
});

test("settings page: Kino's form when the plugin has settings, donate always", async () => {
  const s = make();
  assert.deepEqual(await s.screenEvent({ name: "openSettings", state: {} }), { route: { push: "settings" }, state: { fromBrowse: true } });
  const page = await s.screen({ state: {}, route: { name: "settings" }, device: "phone", installed });
  const all = nodes(page);
  assert.ok(all.some((n) => n.type === "settings"));
  assert.ok(all.some((n) => n.onPressed && n.onPressed.go && n.onPressed.go.url && n.onPressed.go.url.href === KOFI));

  const bare = nodes(await make({ hasSettings: false }).screen({ state: {}, route: { name: "settings" }, device: "phone", installed }));
  assert.ok(!bare.some((n) => n.type === "settings"));
  assert.ok(bare.some((n) => n.onPressed && n.onPressed.go && n.onPressed.go.url && n.onPressed.go.url.href === KOFI));

  const tv = nodes(await s.screen({ state: {}, route: { name: "settings" }, device: "tv", installed }));
  assert.ok(tv.some((n) => n.type === "QrImage" && n.value === KOFI));
});

test("settings page back: pops when pushed from the bar, closes when opened on its own", async () => {
  const s = make();
  const popped = await s.screenEvent({ name: "back", state: { fromBrowse: true }, route: { name: "settings" } });
  assert.deepEqual(popped.route, { pop: true });
  assert.deepEqual(await s.screenEvent({ name: "back", state: {}, route: { name: "settings" } }), { close: true });
});

test("cards and slides open Kino's own title page", async () => {
  const s = make();
  const state = await loaded(s);
  const tree = await s.screen({ state, device: "phone", installed });
  const all = nodes(tree);
  const rail = all.find((n) => n.type === "titleRail");
  assert.ok(rail, "a titleRail");
  assert.equal(rail.items.length, 3);
  assert.equal(rail.ref, "browse:new");
  assert.equal(rail.onTap, undefined);
  assert.ok(!all.some((n) => n.onPressed && n.onPressed.go && n.onPressed.go.screen), "no go.screen anywhere");
  const slide = all.find((n) => n.type === "heroCard");
  const [watch, info] = slide.buttons;
  assert.deepEqual(watch.onPressed.go.play, { ref: "m:1", kind: "movie", id: "i1", title: "Title 1" });
  assert.deepEqual(info.onPressed.go.title, { ref: "m:1", kind: "movie", id: "i1", title: "Title 1" });
});

test("hero key carries the number of slides; one slide is a lone heroCard", async () => {
  const s = make();
  const tree = await s.screen({ state: await loaded(s), device: "phone", installed });
  assert.ok(nodes(tree).some((n) => n.type === "PageView" && n.key === "hero3"));

  const one = make({ loadTab: async () => ({ rows: [{ id: "r1", title: "Uno", items: [item(1)] }] }) });
  const t1 = await one.screen({ state: await loaded(one), device: "phone", installed });
  assert.ok(!nodes(t1).some((n) => n.type === "PageView"));
  assert.ok(nodes(t1).some((n) => n.type === "heroCard"));
});

test("gate only when the plugin needs the resolver and it is missing", async () => {
  const gate = nodes(await make().screen({ state: {}, device: "phone", installed: {} }));
  assert.ok(gate.some((n) => n.onPressed && n.onPressed.go && n.onPressed.go.installPlugin && n.onPressed.go.installPlugin.repo === RESOLVER));
  assert.ok(gate.some((n) => n.onPressed && n.onPressed.go && n.onPressed.go.url && n.onPressed.go.url.href === KOFI));

  const free = await make({ needsResolver: false }).screen({ state: {}, device: "phone", installed: {} });
  assert.deepEqual(free.appBar.actions.map((a) => a.icon), ["search", "settings"]);
});

test("tabs: a TabBar with every tab; none for a single tab", async () => {
  const two = make({ tabs: [{ id: "peliculas", label: "Películas", labelEn: "Movies" }, { id: "series", label: "Series", labelEn: "Series" }] });
  const bar = nodes(await two.screen({ state: {}, device: "phone", installed })).find((n) => n.type === "TabBar");
  assert.deepEqual(bar.tabs.map((t) => t.value), ["peliculas", "series"]);
  assert.ok(!nodes(await make().screen({ state: {}, device: "phone", installed })).some((n) => n.type === "TabBar"));
});

test("TV: search and settings in the bar, no floating button", async () => {
  const tree = await make().screen({ state: {}, device: "tv", installed });
  assert.deepEqual(tree.appBar.actions.map((a) => a.icon), ["search", "settings"]);
  assert.equal(tree.floatingActionButton, undefined);
});

test("every user text has its English twin", async () => {
  const s = make();
  const trees = [
    await s.screen({ state: await loaded(s), device: "phone", installed }),
    await s.screen({ state: { searching: true }, device: "phone", installed }),
    await s.screen({ state: {}, route: { name: "settings" }, device: "tv", installed }),
    await s.screen({ state: {}, device: "phone", installed: {} }),
  ];
  for (const n of trees.flatMap((t) => nodes(t))) {
    for (const f of ["labelText", "hintText", "tooltip"]) if (typeof n[f] === "string") assert.equal(typeof n[f + "En"], "string", `${n.type}.${f}En`);
    if (n.type === "Text" && n.key !== "name") assert.equal(typeof n.textEn, "string", `Text "${n.text}" has textEn`);
  }
});
