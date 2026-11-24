// @ts-check
// Kino plugin: SeriesKao -- series, anime, doramas and movies in Spanish from serieskao.top.
// Home rows, a section of its own, categories (genres), search, details and episodes come from the site, whose covers are TMDB's (they load for Kino).
// A title's player is Embed69's: its page lists, per language, the hosts that carry the title. Those are opened here: VidHide and StreamWish with plain
// requests (./extractors), VOE with plain requests too and, when its host cannot be reached, through the hidden browser.

import { DEFAULT_SITE, GENRES, SEGMENT, parseCards, parsePager, parseTitle, parsePlayerId, parseLatestEpisodes, hasEpisodes, pageOf } from "./serieskao.js";
import * as embed69 from "./embed69.js";
import { makeReq, UA } from "./util/http.js";
import { makeStandardScreen } from "./std/index.js";
import { rankServers } from "./std/rank.js";
import { LOGO, LOGO_ASPECT } from "./logo.js";
import { searchWithTerms } from "./util/terms.js";
import { peek } from "./util/probe.js";
import { homeWithin } from "./util/home.js";

// Kino waits for every request a call left running before it delivers the call's answer (quickjs-kt joins the pending async work), so a Home that
// gave up on a slow row at its own budget was still held until that row's request ended, or retried: measured on users' devices Home ran 21-34 s
// with rows logged as "skipped: its source did not answer in time", and Kino threw the whole answer away at 20 s. Asking Kino to drop what a call
// leaves running (the prelude reads this flag after every call; Kino 0.9.55 and later, an older one ignores it) lets the answer leave at the budget.
globalThis.__kinoDropPendingFetches = true;


const CACHE_MS = 10 * 60 * 1000;
const RESOLVE_MS = 70000;
const CAPTURE_MS = 20000;
const MAX_CAPTURES = 1;
const MAX_COPIES = 8;
const HLS = "application/vnd.apple.mpegurl";

// ---- i18n ----

const STRINGS = {
  es: {
    news: "Novedades", movies: "Películas", series: "Series", anime: "Anime", doramas: "Doramas",
    recentMovies: "Películas recientes", recentSeries: "Series recientes", recentAnime: "Anime reciente", kids: "Infantil",
    latestEpisodes: "Últimos episodios", popularMovies: "Películas populares", popularSeries: "Series populares", popularAnime: "Anime popular",
    lat: "Latino", sub: "Subtitulado", cast: "Castellano", season: "Temporada", episode: "Episodio",
    heroText: "Series, anime y películas en español, con estrenos al día.",
    unavailable: "El servicio no está disponible en este momento.", noEpisodes: "Este título todavía no tiene episodios en el sitio.", noStreams: "Ningún servidor de este título abrió. Prueba más tarde.",
    statusLine: "Sitio: {host} · Listas guardadas: {n}", cacheCleared: "Caché vaciada.",
    needResolver: "Para reproducir, abre SeriesKao desde el menú e instala el motor de reproducción que te pedirá.",
  },
  en: {
    news: "What's new", movies: "Movies", series: "Series", anime: "Anime", doramas: "Doramas",
    recentMovies: "Recent movies", recentSeries: "Recent series", recentAnime: "Recent anime", kids: "Kids",
    latestEpisodes: "Latest episodes", popularMovies: "Popular movies", popularSeries: "Popular series", popularAnime: "Popular anime",
    lat: "Latino", sub: "Subtitled", cast: "Castilian", season: "Season", episode: "Episode",
    heroText: "Series, anime and movies in Spanish, with new releases.",
    unavailable: "The service is not available right now.", noEpisodes: "This title has no episodes on the site yet.", noStreams: "No server of this title opened. Try again later.",
    statusLine: "Site: {host} · Lists kept: {n}", cacheCleared: "Cache cleared.",
    needResolver: "To play, open SeriesKao from the menu and install the playback engine it asks for.",
  },
};
const t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};

// ---- helpers ----

/**
 * The site's address: what the person typed in the settings ("Dirección del sitio") when it is a public https address, else the one this
 * version carries. A site that changes domain keeps working the day the person types the new one, with no plugin update.
 */
function site() {
  let raw = "";
  try { raw = String(kino.config.get("site") || "").trim(); } catch (_) { raw = ""; }
  if (!raw) return DEFAULT_SITE;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.origin : DEFAULT_SITE;
  } catch (_) { return DEFAULT_SITE; }
}

async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...(headers || {}) }, timeoutMs: 15000 });
  if (!r.ok) throw kino.error("unavailable", `SeriesKao ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}

async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + hash36(site()) + ":" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) { /* no cache */ }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v; // an empty answer may be a throttle or a hiccup: not kept
  try { kino.storage.set("c:" + hash36(site()) + ":" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS }); } catch (_) { /* a full storage only costs a refetch */ }
  return v;
}

const fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const hash36 = (s) => { let h = 5381; for (const ch of String(s)) h = ((h * 33) ^ ch.codePointAt(0)) >>> 0; return h.toString(36); };

const KIND_GENRE = { a: "Anime" };

function toItem(card, genreName) {
  const item = {
    id: "sk-" + (fold(card.slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "t") + "-" + hash36(card.code + card.slug),
    ref: card.code + ":" + card.slug, title: card.title, kind: card.kind,
  };
  if (card.poster) item.poster = card.poster;
  if (card.year) item.year = String(card.year);
  if (card.rating) item.rating = card.rating;
  const g = [KIND_GENRE[card.code], genreName].filter(Boolean);
  if (g.length) item.genres = g;
  return item;
}

// ---- the lists ----

const LISTS = {
  peliculas: { path: "/peliculas", titleKey: "recentMovies", genre: "peliculas" },
  populares: { path: "/peliculas/populares", titleKey: "popularMovies", genre: "peliculas" },
  series: { path: "/series", titleKey: "recentSeries", genre: "series", verify: true },
  seriesPop: { path: "/series/populares", titleKey: "popularSeries", genre: "series" },
  animes: { path: "/animes", titleKey: "recentAnime", genre: "anime", verify: true },
  animesPop: { path: "/animes/populares", titleKey: "popularAnime", genre: "anime" },
  infantil: { path: "/generos/familia", titleKey: "kids", genre: "infantil", verify: true },
};

/** `{ path, title, genre }` for a browse ref ("list:<name>" or "genre:<slug>"); null for anything else. */
function refOf(ref) {
  const m = /^(list|genre):([A-Za-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") { const l = LISTS[m[2]]; return l ? { ...l, title: t(l.titleKey) } : null; }
  const g = GENRES.find((x) => x[0] === m[2]);
  return g ? { path: "/generos/" + g[0], title: g[1], genre: g[0] === "dorama" ? "doramas" : undefined, genreName: g[1] } : null;
}

/** One page (from 1) of a list: the cards, and whether the pager says there is a next page. */
async function listPage(def, page) {
  const url = site() + def.path + (page > 1 ? "?page=" + page : "");
  // wrapped in an array so `cached` keeps nothing for a page without cards
  const r = await cached(`l:${def.path}:${page}`, async () => { const html = await getPage(url); const cards = parseCards(html); return cards.length ? [{ cards, pager: parsePager(html) }] : []; });
  const { cards, pager } = r[0] || { cards: [], pager: { page, pages: page } };
  return { cards, more: pager.page < pager.pages };
}

/** The new series the site lists before it has any episode would open an empty page: leave them out of a row (a page that cannot be read is kept). */
async function withEpisodes(cards) {
  const keep = await Promise.all(cards.map(async (c) => {
    if (c.kind === "movie") return true;
    try { return hasEpisodes(await getPage(`${site()}/${SEGMENT[c.code]}/${encodeURIComponent(c.slug)}`)); } catch (_) { return true; }
  }));
  return cards.filter((_, i) => keep[i]);
}

/** The home page's latest episodes, as a row of the series that just got one (a series with an episode always has something to play). */
async function latestRow() {
  const cards = await cached("latest", async () => parseLatestEpisodes(await getPage(site() + "/")));
  const items = cards.slice(0, 20).map((c) => ({ ...toItem(c), ...(c.label ? { badges: [c.label] } : {}) }));
  return items.length ? { id: "latest", title: t("latestEpisodes"), items, ref: "list:series", genre: "series" } : null;
}

const safeRow = async (id, fn) => { try { return await fn(); } catch (e) { kino.log("row " + id + ": " + (e && e.message)); return null; } };

async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const shown = def.verify ? await withEpisodes(cards.slice(0, 20)) : cards.slice(0, 20);
  const items = shown.map((c) => toItem(c, def.genreName));
  return items.length ? { id, title: def.title, items, ref, genre: genre || def.genre || "series" } : null;
}

// ---- exports ----

/** The Home's rows, each tagged (LISTS' `genre`) with the type Kino files it under: Series, Películas, Anime (the newest first), Infantil (the site's Familia genre). */
export const HOME_ROWS = [["latest"], ["series", "list:series"], ["peliculas", "list:peliculas"], ["animes", "list:animes"], ["infantil", "list:infantil"], ["dorama", "genre:dorama", "doramas"], ["seriesPop", "list:seriesPop"], ["populares", "list:populares"]];

/** The type tag each Home row carries, by row id (what Kino reads to shelve its titles). */
export const homeRowTags = () => Object.fromEntries(HOME_ROWS.map(([id, ref, genre]) => [id, genre || (ref ? refOf(ref).genre : "series") || "series"]));

export async function home() {
  return homeWithin(HOME_ROWS.map(([id, ref, genre]) => () => safeRow(id, () => (ref ? rowOf(id, ref, genre) : latestRow()))));
}

export async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map((c) => toItem(c, def.genreName)), next: more ? String(page + 1) : undefined };
}

/** Search uses the site's own results page (`/search?s=`): the same cards a listing has. */
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${site()}/search?s=${encodeURIComponent(q)}`)));
  const kindOnly = within && /^\/peliculas/.test(within.path) ? "movie" : within && /^\/(series|animes)/.test(within.path) ? "series" : null;
  return cards.filter((c) => !kindOnly || c.kind === kindOnly).slice(0, 40).map((c) => toItem(c));
}

export const search = (arg) => searchWithTerms(arg, searchOne);

// ---- the plugin's own section, categories and details ----

export async function section({ tab } = {}) {
  const tabs = [{ id: "novedades", label: t("news") }, { id: "series", label: t("series") }, { id: "peliculas", label: t("movies") }, { id: "anime", label: t("anime") }, { id: "doramas", label: t("doramas") }];
  const chosen = tabs.some((x) => x.id === tab) ? tab : "novedades";
  let rows = [];
  if (chosen === "novedades") rows = await Promise.all([safeRow("latest", latestRow), safeRow("series", () => rowOf("series", "list:series")), safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")), safeRow("animes", () => rowOf("animes", "list:animes"))]);
  else if (chosen === "series") rows = await Promise.all([safeRow("series", () => rowOf("series", "list:series")), safeRow("seriesPop", () => rowOf("seriesPop", "list:seriesPop"))]);
  else if (chosen === "peliculas") rows = await Promise.all([safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")), safeRow("populares", () => rowOf("populares", "list:populares")), safeRow("terror", () => rowOf("terror", "genre:terror", "peliculas")), safeRow("accion", () => rowOf("accion", "genre:accion", "peliculas"))]);
  else if (chosen === "anime") rows = await Promise.all([safeRow("animes", () => rowOf("animes", "list:animes")), safeRow("animesPop", () => rowOf("animesPop", "list:animesPop"))]);
  else rows = [await safeRow("dorama", () => rowOf("dorama", "genre:dorama", "doramas"))];
  rows = rows.filter(Boolean);
  const answer = { tabs, tab: chosen, rows };
  const first = rows.flatMap((r) => r.items).find((i) => i.poster);
  if (first) answer.hero = { title: first.title, text: t("heroText"), image: first.poster };
  return answer;
}

/**
 * One backdrop per Categorías tile: a well-known title of the genre, its TMDB image path at w780 (each checked with a
 * request to image.tmdb.org: 200, image/jpeg). Static on purpose: `categories()` asks nothing of the network. Keys are the
 * site's own slugs; a slug not listed gets no art (Kino draws its plain tile). Kino draws a tile's picture from `art`.
 */
const TILE_ART_SIZE = "w780";
const GENRE_ART = {
  accion: "/gqrnQA6Xppdl8vIb2eJc58VC1tW.jpg", // Mad Max: Fury Road
  animacion: "/qcSHGC5BfoqBoP99PzDIERYG5Qm.jpg", // The Simpsons
  aventura: "/yUOFocKDW7MCC5isx4FK8A68QFp.jpg", // Lost
  belica: "/bdD39MpSVhKjxarTxLSfX6baoMP.jpg", // Saving Private Ryan
  "ciencia-ficcion": "/9P4IIMYY3HifqeruZq0ZZ9g7YUi.jpg", // Stranger Things
  comedia: "/l0qVZIpXtIo7km9u5Yqh0nKPOr5.jpg", // Friends
  crimen: "/xGexTKCJDkl12dTW4YCBDXWb1AD.jpg", // Money Heist
  documental: "/sW7VOrkHKYIeV9PaYc5IqGU2XK8.jpg", // My Octopus Teacher
  dorama: "/29jWaRhKtey1efp5G7Fu97NAmzz.jpg", // Moving (Korean drama)
  drama: "/jP0Rhj9OTPDAwQlHQwOLFDdeE8t.jpg", // Grey's Anatomy
  familia: "/iJgNOTSBNrC90U2xyYq9ln0b35o.jpg", // Paddington 2
  fantasia: "/oiwc338EoBgS4sEI2ixAny4KQKg.jpg", // The Fellowship of the Ring
  guerra: "/bdD39MpSVhKjxarTxLSfX6baoMP.jpg", // Saving Private Ryan
  historia: "/m4MGxxEgAMqIX9x8MCg5pYeyYjU.jpg", // The King's Speech
  misterio: "/4HWAQu28e2yaWrtupFPGFkdNU7V.jpg", // Knives Out
  romance: "/zdXnJqBaGFVtLoPNuMeKfEYUViZ.jpg", // The Notebook
  suspense: "/iWak7wT0j6ycCc8lKr4NBz9c7n5.jpg", // Gone Girl
  terror: "/nHRUtBwFNnNN70vcQ7lAsjc2T6S.jpg", // A Quiet Place
  western: "/x4biAVdPVCghBlsVIzB6NmbghIz.jpg", // The Good, the Bad and the Ugly
};
const tileArt = (table, slug) => (table[slug] ? "https://image.tmdb.org/t/p/" + TILE_ART_SIZE + table[slug] : undefined);
const withArt = (tile, art) => (art ? { ...tile, art } : tile);

export async function categories() {
  return GENRES.map(([slug, name]) => (withArt({ id: "g-" + slug, title: name, ref: "genre:" + slug }, tileArt(GENRE_ART, slug))));
}

function slugOf(ref, code) {
  const m = new RegExp(`^${code}:([^/?#\\s:]+)$`).exec(String(ref || ""));
  return m ? m[1] : null;
}

const titlePage = (code, slug) => cached("p:" + code + slug, async () => { const p = parseTitle(await getPage(`${site()}/${SEGMENT[code]}/${encodeURIComponent(slug)}`)); return p ? [p] : []; }).then((r) => r[0] || null);

/** A title's own page: synopsis, genres, rating and the wide picture, from the site. */
export async function details(ref) {
  const slug = slugOf(ref, "m");
  if (!slug) return null;
  const p = await titlePage("m", slug);
  if (!p) return null;
  const out = { overview: p.overview || undefined, genres: p.genres.length ? p.genres : undefined, poster: p.poster || undefined, backdrop: p.backdrop || undefined, year: p.year ? String(p.year) : undefined, rating: p.rating };
  for (const k of Object.keys(out)) if (out[k] === undefined) delete out[k];
  return out;
}

/** What Kino knows of a series by its title (stills and synopses the site's list does not carry); null when it does not know, or on any failure. */
async function knownEpisodes(p) {
  try {
    if (typeof kino.meta !== "function" || kino.meta.byTitle !== true || !p.title) return null;
    const m = await kino.meta({ type: "series", title: p.title, ...(p.year ? { year: p.year } : {}), lang: kino.lang });
    return m && Array.isArray(m.episodes) ? m.episodes : null;
  } catch (_) { return null; }
}

export async function episodes(ref) {
  const code = /^a:/.test(String(ref || "")) ? "a" : "s";
  const slug = slugOf(ref, code);
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const p = await titlePage(code, slug);
  const list = p ? p.seasons.flatMap((s) => s.episodes) : [];
  if (!list.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const known = await knownEpisodes(p);
  const byKey = new Map((known || []).map((e) => [e.season + "x" + e.number, e]));
  const series = { title: p.title || undefined, poster: p.poster || undefined, backdrop: p.backdrop || undefined, overview: p.overview || undefined, genres: p.genres.length ? p.genres : undefined, year: p.year ? String(p.year) : undefined, rating: p.rating };
  for (const k of Object.keys(series)) if (series[k] === undefined) delete series[k];
  return {
    series,
    episodes: list.map((e) => {
      const extra = byKey.get(e.season + "x" + e.number);
      const ep = { season: e.season, number: e.number, ref: `e:${code}:${slug}:${e.season}:${e.number}`, title: e.title || (extra && extra.title) || `${t("episode")} ${e.number}` };
      if (extra && extra.still) ep.still = extra.still;
      if (extra && extra.overview) ep.overview = extra.overview;
      return ep;
    }),
  };
}

// ---- resolve ----

const LANG_NAME = { LAT: "lat", SUB: "sub", CAST: "cast", ESP: "cast" };
const SERVER_NAME = { vidhide: "VidHide", streamwish: "StreamWish", voe: "VOE", filemoon: "Filemoon", mixdrop: "MixDrop", streamtape: "StreamTape" };

/** Every server of a title, in the order to try them: the preferred language first, then the ones opened with plain requests. */
async function serversOf(pageUrl, req) {
  const id = parsePlayerId(await getPage(pageUrl, { Referer: site() + "/" }));
  if (!id) return [];
  // Embed69's own page first; the site serves the very same page under /vidurl when Embed69 answers nothing
  const rows = (await embed69.servers(kino, req, id, `${site()}/vidurl/${id}/`)).filter((s) => s.url);
  let pref = "lat";
  try { pref = String(kino.config.get("audio") || "lat"); } catch (_) { pref = "lat"; }
  const lang = (s) => LANG_NAME[s.lang.toUpperCase()] || "sub";
  // The person's language first; within it, the hoster kino-resolver ranks best (its rank call: how well each one plays,
  // from the playback audit), so one resolver update re-orders every plugin. An older resolver: the order the site gave.
  const langRank = (s) => (lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3);
  return (await rankServers(kino, rows, (s) => s.url, langRank)).slice(0, MAX_COPIES);
}

async function open(server, req, budget) {
  // The shared kino-resolver does the extraction (its provider door); capture is the fallback for gate hosts
  // (filemoon, doodstream) and for when the resolver is not installed.
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: server.url, referer: site() + "/" });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      if (Array.isArray(s.headers)) { for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value); }
      const out = { url: s.url, mime: s.kind === "hls" ? HLS : (/\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS), headers };
      if (res.subtitles && res.subtitles.length) out.subtitles = res.subtitles;
      return out;
    }
    if (res && res.error === "dead") return null; // a dead host: don't spend a capture on it
  } catch (_) { /* provider_missing / failed: the hidden browser may still reach it */ }
  if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
  budget.captures -= 1;
  const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: site() + "/" } });
  const media = (page && page.media) || [];
  const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
  if (!best) return null;
  return { captured: true, url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}

const labelOf = (s) => `${t(LANG_NAME[s.lang.toUpperCase()] || "sub")} · ${SERVER_NAME[s.server.toLowerCase()] || s.server}`;

/** `ref` is a movie ("m:<slug>"), an episode ("e:<s|a>:<slug>:<season>:<ep>") or one of their other servers ("c:<ref>@<i>"). */
// ---- the screen: the standard xuper-plugin screen (src/std) ----

/** True when the shared kino-resolver is installed (a cheap door probe; only provider_missing means "not installed"). */
async function resolverInstalled() {
  try { await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" }); return true; }
  catch (e) { return (e && e.code) !== "provider_missing"; }
}

// SeriesKao delegates every hoster to kino-resolver (the hidden-browser capture is only a fallback for a few gate hosts), so
// it does not play without it: the screen is the install gate while it is missing, and resolve() refuses.
let std = null;
const standard = () => (std ??= makeStandardScreen({ snapshot: "xuper-plugin/kino-plugin-serieskao",
  kino, name: "SeriesKao", logo: LOGO, logoAspect: LOGO_ASPECT, needsResolver: true, hasSettings: true,
  tabs: [
    { id: "inicio", label: "Inicio", labelEn: "Home" },
    { id: "peliculas", label: "Películas", labelEn: "Movies" },
    { id: "series", label: "Series", labelEn: "Series" },
  ],
  // Inicio is the Home rows; Películas and Series are the section's own tabs of the same name.
  loadTab: async (tab) => ({ rows: tab === "peliculas" || tab === "series" ? (await section({ tab })).rows : await home() }),
}));

export async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}

export async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}

// ---- resolve ----

export async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base, site());
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  if (!(await resolverInstalled())) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers = await serversOf(pageUrl, req);
  if (!servers.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const deliver = (i, out) => {
    const s = servers[i];
    const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...(out.headers || {}) }, label: labelOf(s) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    if (out.durationMs) stream.durationMs = out.durationMs;
    if (only == null) {
      const others = servers.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers[j]) }));
    }
    return stream;
  };
  let slow = null;
  const failures = [];
  for (const i of only != null ? [only] : servers.map((_, k) => k)) {
    const s = servers[i];
    if (!s) continue;
    try {
      const out = await open(s, req, budget);
      if (!out) { failures.push(`${s.server}: no stream`); continue; }
      if (!out.captured) {
        const answer = await peek(kino, { url: out.url, headers: { "User-Agent": UA, ...(out.headers || {}) } });
        // A slow CDN is kept as the last resort: the next server is tried, and only if none answers is this one played.
        if (answer === "slow") { if (!slow) slow = { i, out }; failures.push(`${s.server}: slow`); continue; }
        if (answer !== "ok") { failures.push(`${s.server}: address does not answer`); continue; }
      }
      return deliver(i, out);
    } catch (e) {
      failures.push(`${s.server}: ${(e && e.code) || ""} ${(e && e.message) || e}`.trim());
    }
  }
  if (slow) {
    kino.log(`resolve ${base}: only a slow server answered (${failures.join("; ")})`);
    return deliver(slow.i, slow.out);
  }
  kino.log(`resolve ${base} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}

// ---- Ajustes ▸ SeriesKao ----

export async function settingsStatus() {
  let n = 0;
  try { n = kino.storage.keys().filter((k) => k.startsWith("c:")).length; } catch (_) { /* no storage */ }
  return { info: t("statusLine").replace("{host}", new URL(site()).hostname).replace("{n}", String(n)) };
}

export async function action(key) {
  if (key === "clearCache") {
    try { for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k); } catch (_) { /* nothing to clear */ }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}

// std 1.7.0: the catalog door -- the author's other plugins (Da-Video) find titles here through Kino, and Kino opens and
// plays what they find in this plugin, with its own resolve.
import { catalogDoor } from "./std/catalog.js";
export const proto_catalog_search = catalogDoor(search);
