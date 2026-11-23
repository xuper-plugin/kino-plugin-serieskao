// src/serieskao.js
var DEFAULT_SITE = "https://serieskao.top";
var GENRES = [
  ["accion", "Acci\xF3n"],
  ["animacion", "Animaci\xF3n"],
  ["aventura", "Aventura"],
  ["belica", "B\xE9lica"],
  ["ciencia-ficcion", "Ciencia Ficci\xF3n"],
  ["comedia", "Comedia"],
  ["crimen", "Crimen"],
  ["documental", "Documental"],
  ["dorama", "Dorama"],
  ["drama", "Drama"],
  ["familia", "Familia"],
  ["fantasia", "Fantas\xEDa"],
  ["guerra", "Guerra"],
  ["historia", "Historia"],
  ["misterio", "Misterio"],
  ["romance", "Romance"],
  ["suspense", "Suspense"],
  ["terror", "Terror"],
  ["western", "Western"]
];
var NAMED_ENTITIES = { ndash: "\u2013", mdash: "\u2014", hellip: "\u2026", lsquo: "\u2018", rsquo: "\u2019", ldquo: "\u201C", rdquo: "\u201D", nbsp: " ", iexcl: "\xA1", iquest: "\xBF", laquo: "\xAB", raquo: "\xBB", aacute: "\xE1", eacute: "\xE9", iacute: "\xED", oacute: "\xF3", uacute: "\xFA", ntilde: "\xF1", Aacute: "\xC1", Eacute: "\xC9", Iacute: "\xCD", Oacute: "\xD3", Uacute: "\xDA", Ntilde: "\xD1", uuml: "\xFC" };
var decodeMore = (s) => s.replace(/&#([0-9]{1,7});/g, (m, n) => {
  const c = Number(n);
  return c > 0 && c <= 1114111 ? String.fromCodePoint(c) : m;
}).replace(/&#x([0-9a-f]{1,6});/gi, (m, h) => {
  const c = parseInt(h, 16);
  return c > 0 && c <= 1114111 ? String.fromCodePoint(c) : m;
}).replace(/&([a-z]+);/gi, (m, k) => NAMED_ENTITIES[k] ?? m);
var decode = (s) => decodeMore(String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " "));
var text = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
var SEGMENT = { m: "pelicula", s: "serie", a: "anime" };
var CODE = { pelicula: "m", serie: "s", anime: "a" };
function parseCards(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of String(html || "").split('<article class="card"').slice(1)) {
    const href = /href="\/(pelicula|serie|anime)\/([^"\/?#]+)"/.exec(c);
    if (!href || seen.has(href[1] + href[2])) continue;
    seen.add(href[1] + href[2]);
    const title = /<h\d class="card__title">([\s\S]*?)<\/h\d>/.exec(c);
    const img = /<img[^>]*?src="([^"]+)"/.exec(c);
    const year = /card__badge--year">\s*(\d{4})/.exec(c);
    const rating = /card__rating">[\s\S]*?<\/svg>\s*([\d.]+)/.exec(c);
    out.push({
      code: CODE[href[1]],
      slug: decodeURIComponent(href[2]),
      kind: href[1] === "pelicula" ? "movie" : "series",
      title: title ? text(title[1]) : href[2],
      year: year ? Number(year[1]) : void 0,
      poster: img ? img[1] : "",
      rating: rating ? Number(rating[1]) : void 0
    });
  }
  return out;
}
function parsePager(html) {
  const m = /pagination__info">[^<]*?(\d+)\s+de\s+(\d+)/.exec(String(html || ""));
  return m ? { page: Number(m[1]), pages: Number(m[2]) } : { page: 1, pages: 1 };
}
function parseTitle(html) {
  const h = String(html || "");
  const t2 = /<h1 class="detail-hero__title">([\s\S]*?)<\/h1>/.exec(h);
  if (!t2) return null;
  const desc = /<h2 class="detail-hero__desc">([\s\S]*?)<\/h2>/.exec(h);
  const meta = /detail-hero__meta">([\s\S]*?)<\/div>/.exec(h);
  const year = meta ? /<span>\s*(\d{4})\s*<\/span>/.exec(meta[1]) : null;
  const rate = /detail-hero__rating">[\s\S]*?<\/svg>\s*([\d.]+)/.exec(h);
  const poster = /detail-hero__poster">\s*<img[^>]*?src="([^"]+)"/.exec(h);
  const back = /detail-hero__bg">\s*<img[^>]*?src="([^"]+)"/.exec(h);
  const genres = [...new Set([...h.matchAll(/class="detail-hero__genre">\s*([^<]+?)\s*<\/a>/g)].map((m) => text(m[1])))];
  const bySeason = /* @__PURE__ */ new Map();
  for (const e of h.split('class="episode-item"').slice(1)) {
    const sm = /data-season="(\d+)"/.exec(e), em = /data-episode="(\d+)"/.exec(e);
    if (!sm || !em) continue;
    const name = /episode-item__title">([\s\S]*?)<\/span>/.exec(e);
    const season = Number(sm[1]);
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season).push({ season, number: Number(em[1]), title: name ? text(name[1]) : "" });
  }
  const seasons = [...bySeason.keys()].sort((a, b) => a - b).map((s) => ({ season: s, episodes: bySeason.get(s) }));
  return {
    title: text(t2[1]),
    overview: desc ? text(desc[1]) : "",
    year: year ? Number(year[1]) : void 0,
    rating: rate ? Number(rate[1]) : void 0,
    genres,
    poster: poster ? poster[1] : "",
    backdrop: back ? back[1] : "",
    seasons
  };
}
function parsePlayerId(html) {
  const m = /data-url="\/vidurl\/(tt\d+(?:-[0-9x]+)?)\/?"/.exec(String(html || "")) || /<iframe[^>]*src="\/vidurl\/(tt\d+(?:-[0-9x]+)?)\/?"/.exec(String(html || ""));
  return m ? m[1] : null;
}
var SLUG = String.raw`[^/?#\s]+`;
function pageOf(ref, site2 = DEFAULT_SITE) {
  let m = new RegExp(`^m:(${SLUG})$`).exec(ref);
  if (m) return `${site2}/pelicula/${encodeURIComponent(m[1])}`;
  m = new RegExp(String.raw`^e:([sa]):(${SLUG}):(\d+):(\d+)$`).exec(ref);
  return m ? `${site2}/${SEGMENT[m[1]]}/${encodeURIComponent(m[2])}/temporada/${m[3]}/capitulo/${m[4]}` : null;
}
function parseLatestEpisodes(html) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const c of String(html || "").split('<article class="episode-card"').slice(1)) {
    const href = /href="(?:https?:\/\/[^\/"]+)?\/(serie|anime)\/([^"\/?#]+)\/temporada\/\d+\/capitulo\/\d+"/.exec(c);
    if (!href || seen.has(href[2])) continue;
    seen.add(href[2]);
    const img = /<img[^>]*?src="([^"]+)"/.exec(c);
    const title = /<h\d class="episode-card__title">([\s\S]*?)<\/h\d>/.exec(c);
    const badge = /episode-card__badge">([^<]*)</.exec(c);
    out.push({ code: CODE[href[1]], slug: decodeURIComponent(href[2]), kind: "series", title: title ? text(title[1]) : href[2], poster: img ? img[1] : "", label: badge ? text(badge[1]) : "" });
  }
  return out;
}
var hasEpisodes = (html) => /\/temporada\/\d+\/capitulo\/\d+"/.test(String(html || ""));

// src/anubis.js
var API = "/.within.website/x/cmd/anubis/api/pass-challenge";
function anubisChallenge(html) {
  const m = /<script id="anubis_challenge"[^>]*>([\s\S]*?)<\/script>/.exec(String(html || ""));
  if (!m) return null;
  let j;
  try {
    j = JSON.parse(m[1]);
  } catch (_) {
    return null;
  }
  const c = j && j.challenge, r = j && j.rules;
  if (!c || typeof c.randomData !== "string" || typeof c.id !== "string" || !r) return null;
  const difficulty = Number(r.difficulty);
  if (!Number.isInteger(difficulty) || difficulty < 1 || difficulty > 6) return null;
  return { data: c.randomData, id: c.id, difficulty };
}
function solveAnubis(kino2, data, difficulty) {
  const zeros = "0".repeat(difficulty);
  for (let nonce = 0; nonce < 2e7; nonce++) {
    const hash = kino2.crypto.hash("sha256", data + nonce);
    if (hash.startsWith(zeros)) return { hash, nonce };
  }
  return null;
}
async function getThroughAnubis(kino2, req, url, opts) {
  const started = Date.now();
  let r = await req(url, opts);
  if (!r.ok) return null;
  let html = await r.text();
  const ch = anubisChallenge(html);
  if (!ch) return html;
  const sol = solveAnubis(kino2, ch.data, ch.difficulty);
  if (!sol) return html;
  const origin = new URL(url).origin;
  const elapsed = Math.max(1e3, Date.now() - started);
  const pass = `${origin}${API}?id=${encodeURIComponent(ch.id)}&response=${sol.hash}&nonce=${sol.nonce}&redir=${encodeURIComponent(url)}&elapsedTime=${elapsed}`;
  try {
    const rp = await req(pass, opts);
    if (rp && typeof rp.text === "function") await rp.text();
  } catch (_) {
  }
  const r2 = await req(url, opts);
  if (!r2 || !r2.ok) return html;
  return r2.text();
}

// src/embed69.js
var SITE = "https://embed69.org";
function decryptLink(kino2, keyHex, b64) {
  const raw = atob(b64);
  let ivHex = "";
  for (let i = 0; i < 16; i++) ivHex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  return kino2.crypto.decrypt("aes-256-cbc", { key: keyHex, keyEncoding: "hex", iv: ivHex, ivEncoding: "hex", data: btoa(raw.slice(16)) });
}
var quoted = (html, name) => {
  const m = new RegExp(name + "\\s*=\\s*'([^']*)'").exec(html);
  return m ? m[1] : null;
};
function serversOf(kino2, html) {
  const data = /let\s+dataLink\s*=\s*(\[.+\]);/.exec(html);
  const challenge = quoted(html, "LINK_CHALLENGE"), salt = quoted(html, "LINK_SALT");
  if (!data || !challenge || salt == null) return [];
  let langs;
  try {
    langs = JSON.parse(data[1]);
  } catch (_) {
    return [];
  }
  const keyHex = kino2.crypto.hash("sha256", challenge + salt);
  const rows = [];
  for (const l of langs) {
    for (const e of l && l.sortedEmbeds || []) {
      if (!e || e.servername === "download" || typeof e.link !== "string") continue;
      try {
        rows.push({ lang: String(l.video_language || ""), server: String(e.servername || ""), url: decryptLink(kino2, keyHex, e.link).replace(/`/g, "").trim() });
      } catch (_) {
      }
    }
  }
  return rows;
}
async function servers(kino2, req, id, fallbackUrl) {
  const urls = [`${SITE}/f/${id}`];
  if (fallbackUrl) urls.push(fallbackUrl);
  for (const url of urls) {
    let html;
    try {
      html = await getThroughAnubis(kino2, req, url, { headers: url.startsWith(SITE) ? {} : { Referer: new URL(url).origin + "/" } });
    } catch (_) {
      continue;
    }
    if (html == null) continue;
    const rows = serversOf(kino2, html);
    if (rows.length) return rows;
  }
  return [];
}

// src/util/http.js
var UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";
var REQUEST_MS = 8e3;
var MIN_MS = 1500;
function makeReq(kino2, { deadline }) {
  const req = async (url, opts = {}) => {
    const left = deadline - Date.now();
    if (left < MIN_MS) throw kino2.error("timeout", "no time left for " + new URL(url).hostname);
    return kino2.fetch(url, { headers: { "User-Agent": UA, ...opts.headers || {} }, method: opts.method, body: opts.body, timeoutMs: Math.min(REQUEST_MS, left) });
  };
  req.left = () => Math.max(0, deadline - Date.now());
  return req;
}

// src/std/model.js
var MAX_SLIDES = 5;
var MAX_RAILS = 8;
var MAX_RAIL_ITEMS = 20;
var MAX_SLIDE_TEXT = 160;
var HTTPS = /^https:\/\//;
function cardOf(item) {
  const out = { id: item.id, ref: item.ref, title: item.title, kind: item.kind };
  if (item.poster && HTTPS.test(item.poster)) out.poster = item.poster;
  if (item.backdrop && HTTPS.test(item.backdrop)) out.backdrop = item.backdrop;
  if (item.badges) out.badges = item.badges;
  if (item.rating !== void 0) out.rating = item.rating;
  if (item.year !== void 0) out.year = item.year;
  if (item.ids && item.ids.tmdb) out.ids = { tmdb: item.ids.tmdb };
  if (item.lang) out.lang = item.lang;
  if (item.adult === true) out.adult = true;
  return out;
}
var slidesOf = (rows) => pickSlides(rows, (item) => item.backdrop);
var posterSlidesOf = (rows) => pickSlides(rows, (item) => item.poster);
function slideText(overview, item = {}) {
  const text2 = typeof overview === "string" ? overview.trim() : "";
  if (text2 === "") return [item.year, item.rating ? "\u2605 " + item.rating : null].filter(Boolean).join(" \xB7 ");
  return text2.length <= MAX_SLIDE_TEXT ? text2 : `${text2.slice(0, MAX_SLIDE_TEXT - 1).trimEnd()}\u2026`;
}
function pickSlides(rows, pictureOf) {
  const out = [];
  const seen = /* @__PURE__ */ new Set();
  for (const row of rows) {
    for (const item of row.items || []) {
      if (out.length >= MAX_SLIDES) return out;
      const image = pictureOf(item);
      if (item.adult === true || seen.has(item.id) || !image || !HTTPS.test(image)) continue;
      seen.add(item.id);
      out.push({ id: item.id, ref: item.ref, kind: item.kind, title: item.title, image, text: slideText(item.overview, item) });
    }
  }
  return out;
}
var uniform = (items) => items.every((i) => i.backdrop) ? items : items.map(({ backdrop, ...rest }) => rest);
function railsOf(rows) {
  return rows.filter((r) => !r.hidden && r.items && r.items.length > 0).slice(0, MAX_RAILS).map((r) => ({
    id: r.id,
    title: r.title,
    ...r.titleEn ? { titleEn: r.titleEn } : {},
    ...r.ref ? { ref: r.ref } : {},
    items: uniform(r.items.slice(0, MAX_RAIL_ITEMS).map(cardOf))
  }));
}
function tabOf(page) {
  const rows = page && Array.isArray(page.rows) ? page.rows : [];
  const rails = railsOf(rows);
  if (rails.length === 0) return null;
  return { slides: slidesOf(rows), posterSlides: posterSlidesOf(rows), rails };
}
function playedKey(ref) {
  const m = /^(?:m|s|e):(\d{1,10})(?::|$)/.exec(String(ref || ""));
  return m ? `t:${m[1]}` : String(ref || "");
}
function recentOf(keys, tabs) {
  if (keys.length === 0) return [];
  const byKey = /* @__PURE__ */ new Map();
  for (const data of tabs) {
    for (const rail2 of data.rails) {
      for (const card of rail2.items) {
        const ks = [card.ref];
        if (card.ids && card.ids.tmdb) ks.push(`t:${card.ids.tmdb}`);
        for (const k of ks) if (!byKey.has(k)) byKey.set(k, card);
      }
    }
  }
  const out = [];
  const used = /* @__PURE__ */ new Set();
  for (const key of keys) {
    const card = byKey.get(key);
    if (card && !used.has(card.id)) {
      used.add(card.id);
      out.push(card);
    }
  }
  return out;
}

// src/std/strings.js
var WORDS = {
  watch: ["Ver", "Watch"],
  info: ["M\xE1s informaci\xF3n", "More info"],
  recent: ["Continuar viendo", "Continue watching"],
  search: ["Buscar", "Search"],
  searchHint: ["Buscar en {name}", "Search {name}"],
  failed: ["No se pudo cargar esta secci\xF3n. Revisa tu conexi\xF3n e int\xE9ntalo de nuevo.", "This section could not be loaded. Check your connection and try again."],
  retry: ["Reintentar", "Retry"],
  empty: ["A\xFAn no hay nada aqu\xED.", "Nothing here yet."],
  back: ["Atr\xE1s", "Back"],
  close: ["Cerrar", "Close"],
  settings: ["Ajustes", "Settings"],
  resultsTitle: ["Resultados: {q}", "Results: {q}"],
  resultsIn: ["En {name}", "In {name}"],
  resultsSearching: ["Buscando en {name}\u2026", "Searching {name}\u2026"],
  resultsFailed: ["{name} no respondi\xF3 esta vez.", "{name} did not answer this time."],
  noResults: ["No encontramos nada con esas palabras en tus plugins.", "Nothing in your plugins matched those words."],
  supportTv: ["Si te gusta mi trabajo, escan\xE9alo y ap\xF3yame", "If you like my work, scan it and support me"],
  support: ["Si te gusta mi trabajo, ap\xF3yame", "If you like my work, support me"],
  gateTitle: ["Necesitas el motor de reproducci\xF3n", "You need the playback engine"],
  gateText: [
    "{name} reproduce a trav\xE9s de Kino Resolver (gratis). Inst\xE1lalo una vez y sirve para este y para otros plugins de sitios.",
    "{name} plays through Kino Resolver (free). Install it once and it works here and in other site plugins."
  ],
  gateInstall: ["Instalar Kino Resolver", "Install Kino Resolver"]
};
var fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => vars && vars[k] != null ? String(vars[k]) : m);
function twin(key, field = "text", vars) {
  const [es, en] = WORDS[key];
  const pick = (i) => vars && Object.fromEntries(Object.entries(vars).map(([k, v]) => [k, Array.isArray(v) ? v[i] : v]));
  return { [field]: fill(es, pick(0)), [field + "En"]: fill(en, pick(1)) };
}
var STRING_KEYS = Object.keys(WORDS);

// src/std/view.js
var SUPPORT_URL = "https://ko-fi.com/xuperplugins";
var RESOLVER_REPO = "xuper-plugin/kino-plugin-kino-resolver";
var POLL_MS = 1500;
function brand(cfg) {
  return {
    type: "Row",
    key: "brand",
    gap: 12,
    crossAxisAlignment: "center",
    children: [
      ...cfg.logo ? [{ type: "Image", key: "logo", url: cfg.logo, aspect: cfg.logoAspect || "1:1", fit: "contain", h: 32, alt: cfg.name, altEn: cfg.nameEn || cfg.name }] : [],
      { type: "Text", key: "name", style: "h4", text: cfg.name, textEn: cfg.nameEn || cfg.name }
    ]
  };
}
var tabBar = (tabs, active) => ({
  type: "TabBar",
  key: "tabs",
  divider: false,
  value: active,
  onChanged: "tab",
  tabs: tabs.map((t2) => ({ value: t2.id, label: t2.label, labelEn: t2.labelEn || t2.label }))
});
var iconButton = (key, icon, word, onPressed) => ({ type: "IconButton", key, icon, ...twin(word, "labelText"), ...twin(word, "tooltip"), onPressed });
var searchOpenOps = (tabsInBar) => [
  { hide: "close" },
  { hide: "brand" },
  { hide: "searchButton" },
  { hide: "settingsButton" },
  ...tabsInBar ? [{ hide: "tabs" }] : [],
  { show: "closeSearch" },
  { show: "q" },
  { focus: "q" }
];
var searchClosedOps = (tabsInBar) => [
  { hide: "closeSearch" },
  { hide: "q" },
  { clear: "q" },
  { show: "close" },
  { show: "brand" },
  { show: "searchButton" },
  { show: "settingsButton" },
  ...tabsInBar ? [{ show: "tabs" }] : []
];
var leaveButton = (cfg) => cfg.backArrow ? iconButton("close", "arrow_back", "back", { go: { close: true } }) : iconButton("close", "close", "close", { go: { close: true } });
function supportNode(device) {
  if (device === "tv") return { type: "QrImage", key: "donate", value: SUPPORT_URL, size: "large", ...twin("supportTv", "labelText") };
  return { type: "ElevatedButton", key: "donate", icon: "heart", ...twin("support", "labelText"), onPressed: { go: { url: { href: SUPPORT_URL } } } };
}
var bar = ({ leading, title, actions = [] }) => ({ type: "AppBar", mergeWithKinoBar: true, dense: true, divider: false, leading, title, actions });
var railSkeleton = (n) => ({
  type: "Column",
  key: "skel" + n,
  gap: 8,
  children: [
    { type: "Skeleton", shape: "line", width: 120 },
    { type: "Row", gap: 12, sizes: ["compact"], children: [1, 2, 3].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}c${i}`, flex: 1 })) },
    { type: "Row", gap: 12, sizes: ["medium", "expanded"], children: [1, 2, 3, 4, 5, 6].map((i) => ({ type: "Skeleton", shape: "card", key: `sk${n}w${i}`, flex: 1 })) }
  ]
});
var heroSkeleton = () => ({ type: "Skeleton", key: "heroSkeleton", shape: "block", height: { compact: 200, expanded: 320 } });
var titleOf = (s) => ({ ref: s.ref, kind: s.kind, id: s.id, title: s.title });
var withHeaders = (headers) => headers ? { headers } : {};
var slideNode = (s, headers) => ({
  type: "heroCard",
  key: "slide-" + s.id,
  h: { compact: 200, expanded: 240 },
  ...s.logo ? { logo: s.logo } : {},
  title: s.title,
  text: s.text,
  image: s.image,
  ...withHeaders(headers),
  buttons: [
    { type: "ElevatedButton", key: "watch-" + s.id, ...twin("watch", "labelText"), icon: "play", onPressed: { go: { play: titleOf(s) } } },
    { type: "TextButton", key: "info-" + s.id, ...twin("info", "labelText"), onPressed: { go: { title: titleOf(s) } } }
  ]
});
var hero = (slides, headers) => slides.length === 1 ? slideNode(slides[0], headers) : {
  type: "PageView",
  key: "hero" + slides.length,
  autoPlayMs: 6e3,
  children: slides.map((s) => slideNode(s, headers))
};
var rail = (r, key, words, headers) => ({
  type: "titleRail",
  key,
  ...words || { title: r.title, titleEn: r.titleEn || r.title },
  ...r.ref ? { ref: r.ref } : {},
  items: r.items,
  ...withHeaders(headers)
});
function browseView(cfg, { tab, data, recent, pending, failed, searching = false, device = "phone", own = null, ownActions = [] }) {
  const tv = device === "tv";
  const tabs = own ? [cfg.tabs[0]] : cfg.tabs;
  const active = tabs.some((t2) => t2.id === tab) ? tab : tabs[0].id;
  const withTabs = tabs.length > 1;
  const body = [];
  const ownBlocks = own && !Array.isArray(own) && Array.isArray(own.blocks) ? own.blocks : null;
  if (ownBlocks) {
  } else if (own) {
    body.push(...own);
  } else if (data) {
    const h = cfg.imageHeaders;
    if (data.slides.length > 0) body.push(hero(data.slides, h));
    if (recent.length > 0) body.push(rail({ items: recent }, "recent", twin("recent", "title"), h));
    for (const r of data.rails) body.push(rail(r, "rail-" + String(r.id).replace(/[^A-Za-z0-9_-]/g, "_"), null, h));
    if (data.rails.length === 0) body.push({ type: "Text", key: "empty", ...twin("empty"), color: "muted" });
  } else if (failed) {
    body.push({ type: "MaterialBanner", key: "loadFailed", role: "error", ...twin("failed"), action: { ...twin("retry", "label"), onTap: "retry" } });
  } else {
    body.push(heroSkeleton(), railSkeleton(1), railSkeleton(2), railSkeleton(3));
  }
  const isBanner = (n) => !!n && (n.type === "heroCard" || n.key === "heroSkeleton" || n.type === "PageView" && String(n.key).startsWith("hero"));
  const banner = body.length > 0 && isBanner(body[0]) ? body.shift() : null;
  const tabsInBar = tv && withTabs;
  const appBar = bar({
    leading: leaveButton(cfg),
    title: { type: "Row", key: "titleRow", gap: tabsInBar ? 24 : 8, crossAxisAlignment: "center", children: [
      { ...iconButton("closeSearch", "arrow_back", "back", { ui: searchClosedOps(tabsInBar), event: "searchClosed" }), hidden: true },
      brand(cfg),
      ...tabsInBar ? [tabBar(tabs, active)] : [],
      {
        type: "TextField",
        key: "q",
        hidden: true,
        flex: 1,
        kind: "search",
        maxLength: 200,
        ...twin("searchHint", "hintText", { name: [cfg.name, cfg.nameEn || cfg.name] }),
        onSubmitted: "search",
        trailingIcon: "search",
        ...twin("search", "trailingLabel"),
        onTrailingTap: "search"
      }
    ] },
    actions: [
      // barSearch: false (std 1.7.0): the plugin draws its own search field in its page instead of the bar's icon.
      ...cfg.barSearch ? [iconButton("searchButton", "search", "search", { ui: searchOpenOps(tabsInBar), event: "searchOpened" })] : [],
      // std 1.9.0: the page's own bar buttons (page.actions), before the settings gear.
      ...Array.isArray(ownActions) ? ownActions : [],
      iconButton("settingsButton", "settings", "settings", "openSettings")
    ]
  });
  return {
    type: "Scaffold",
    ...searching ? { onBack: { ui: searchClosedOps(tabsInBar), event: "searchClosed" } } : {},
    appBar,
    body: { type: "Column", key: "page", children: [
      ...withTabs && !tv ? [{ type: "Column", key: "tabsRow", padding: { compact: 0, expanded: 24 }, children: [tabBar(tabs, active)] }] : [],
      { type: "SingleChildScrollView", key: "browse-" + active, flex: 1, children: ownBlocks ? ownBlocks.filter((b) => b && Array.isArray(b.nodes) && b.nodes.length).flatMap((b, i) => b.edge ? b.nodes : [{ type: "Column", key: "block-" + i, padding: { compact: 12, expanded: 24 }, gap: 16, crossAxisAlignment: "stretch", children: b.nodes }]) : [...banner ? [banner] : [], { type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] }
    ] },
    ...pending ? { every: { ms: POLL_MS, event: "tick" } } : {}
  };
}
function resultsView(cfg, { q, order, names, pending, found, device = "phone" }) {
  const body = [];
  let shown = 0;
  order.forEach((repo, i) => {
    const name = [names[repo] || repo, names[repo] || repo];
    if (pending.includes(repo)) {
      body.push({ type: "Column", key: "wait-" + i, gap: 8, children: [{ type: "Text", key: "waitText-" + i, color: "muted", ...twin("resultsSearching", "text", { name }) }, railSkeleton(i)] });
      return;
    }
    const r = found.get(repo);
    if (!r || !r.ok) {
      body.push({ type: "Text", key: "failed-" + i, color: "muted", ...twin("resultsFailed", "text", { name }) });
      return;
    }
    if (!r.items.length) return;
    shown++;
    body.push(rail({ items: r.items }, "found-" + i, twin("resultsIn", "title", { name }), cfg.imageHeaders));
  });
  if (!pending.length && shown === 0 && order.some((r) => {
    const x = found.get(r);
    return x && x.ok;
  })) body.unshift({ type: "Text", key: "noResults", ...twin("noResults") });
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: { type: "Text", key: "resultsTitle", style: "h4", ...twin("resultsTitle", "text", { q }) } }),
    body: { type: "SingleChildScrollView", key: "results-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: body }] },
    ...pending.length ? { every: { ms: 1500, event: "tick" } } : {}
  };
}
function settingsView(cfg, device = "phone") {
  return {
    type: "Scaffold",
    appBar: bar({ leading: iconButton("back", "arrow_back", "back", "back"), title: brand(cfg) }),
    body: { type: "SingleChildScrollView", key: "settings-page", children: [{ type: "Column", padding: { compact: 12, expanded: 24 }, gap: 16, children: [
      ...cfg.hasSettings ? [{ type: "settings", key: "form" }, { type: "Divider", key: "supportDivider" }] : [],
      supportNode(device)
    ] }] }
  };
}
function gateView(cfg, device = "phone") {
  const name = [cfg.name, cfg.nameEn || cfg.name];
  return {
    type: "Scaffold",
    appBar: bar({ leading: leaveButton(cfg), title: brand(cfg) }),
    body: { type: "Column", key: "gate", mainAxisAlignment: "center", crossAxisAlignment: "center", padding: 24, gap: 16, children: [
      { type: "Text", key: "gateTitle", style: "h3", ...twin("gateTitle") },
      { type: "Text", key: "gateText", style: "p", ...twin("gateText", "text", { name }) },
      { type: "ElevatedButton", key: "installResolver", ...twin("gateInstall", "labelText"), onPressed: { go: { installPlugin: { repo: RESOLVER_REPO } } } },
      supportNode(device)
    ] }
  };
}

// src/std/metaCache.js
var KEY = "meta3";
var MAX = 160;
var CONCURRENCY = 3;
var OVERVIEW_MAX = 160;
var HTTPS2 = /^https:\/\//;
function makeMetaCache({ kino: kino2, titleOf: titleOf2 = (c) => c.title, typeOf = (c) => c.kind === "series" ? "series" : "movie", tmdbPictures = false, clock = { now: () => Date.now() } }) {
  const usable = () => {
    try {
      return typeof kino2.meta === "function" && kino2.meta.byTitle === true;
    } catch (_) {
      return false;
    }
  };
  let book = null;
  function read() {
    if (book) return book;
    try {
      const o = JSON.parse(kino2.storage.get(KEY) || "null");
      book = o && typeof o === "object" && !Array.isArray(o) ? o : {};
    } catch (_) {
      book = {};
    }
    return book;
  }
  function write() {
    try {
      const ids = Object.keys(book);
      if (ids.length > MAX) for (const id of ids.slice(0, ids.length - MAX)) delete book[id];
      kino2.storage.set(KEY, JSON.stringify(book));
    } catch (_) {
    }
  }
  function known(id) {
    const e = read()[id];
    if (!e) return {};
    return {
      ...e.t > 0 ? { tmdb: e.t } : {},
      ...e.l && HTTPS2.test(e.l) ? { logo: e.l } : {},
      ...e.p && HTTPS2.test(e.p) ? { poster: e.p } : {},
      ...e.b && HTTPS2.test(e.b) ? { backdrop: e.b } : {},
      ...typeof e.o === "string" && e.o ? { overview: e.o } : {}
    };
  }
  const asked = (id) => Object.hasOwn(read(), id);
  function dress(cards) {
    return cards.map((c) => {
      const k = known(c.id);
      const poster = tmdbPictures && k.poster ? k.poster : null;
      if (!k.tmdb && !poster) return c;
      return { ...c, ...k.tmdb && !(c.ids && c.ids.tmdb) ? { ids: { ...c.ids || {}, tmdb: k.tmdb } } : {}, ...poster ? { poster } : {} };
    });
  }
  async function fill2(cards, budgetMs) {
    if (!usable()) return 0;
    const b = read();
    const end = clock.now() + budgetMs;
    let count = 0;
    let stop = false;
    const seen = /* @__PURE__ */ new Set();
    const todo = cards.filter((c) => {
      if (!c || typeof c.id !== "string" || seen.has(c.id) || Object.hasOwn(b, c.id) || c.ids && c.ids.tmdb && c.noLogo) return false;
      seen.add(c.id);
      return true;
    });
    let next = 0;
    const str = (v, max) => typeof v === "string" ? v.slice(0, max) : "";
    const worker = async () => {
      while (!stop && next < todo.length && clock.now() < end) {
        const c = todo[next++];
        const year = c.year !== void 0 ? { year: c.year } : {};
        try {
          const a = await kino2.meta({ type: typeOf(c), title: titleOf2(c), ...year });
          b[c.id] = {
            t: a && a.ids && Number.isInteger(a.ids.tmdb) ? a.ids.tmdb : 0,
            l: str(a && a.logo, 2048),
            p: str(a && a.poster, 2048),
            b: str(a && a.backdrop, 2048),
            o: str(a && a.overview, OVERVIEW_MAX)
          };
          count++;
        } catch (e) {
          if (e && e.code === "rate_limited") stop = true;
        }
      }
    };
    await Promise.all(Array.from({ length: CONCURRENCY }, worker));
    if (count > 0) write();
    return count;
  }
  return { known, asked, dress, fill: fill2, usable, tmdbPictures };
}

// src/std/index.js
var TAB_KEY = "browseTab";
var SNAP_PREFIX = "browse1:";
var SNAP_TTL_MS = 7 * 24 * 3600 * 1e3;
var SNAP_MAX = 20 * 1024;
var SNAPS_TOTAL = 96 * 1024;
var RECENT_KEY = "recent1";
var RECENT_MAX = 12;
var Q_MAX = 200;
var META_TICK_MS = 3e3;
var META_TICK_CARDS = 24;
var INFLIGHT_KEY = "std:inflight";
var INFLIGHT_STALE_MS = 18e3;
var MAX_META_TICKS = 10;
var DEFAULT_TABS = [{ id: "inicio", label: "Inicio", labelEn: "Home" }];
var SNAPSHOT_VERSION = 1;
var SNAPSHOT_MAX_AGE_MS = 24 * 60 * 60 * 1e3;
var SNAPSHOT_TIMEOUT_MS = 8e3;
var snapshotUrl = (repo, tab) => "https://raw.githubusercontent.com/" + repo + "/main/home/" + encodeURIComponent(tab) + ".json";
function snapshotRows(text2, tab, now = Date.now()) {
  let o;
  try {
    o = JSON.parse(String(text2));
  } catch (_) {
    return null;
  }
  if (!o || o.v !== SNAPSHOT_VERSION || o.tab !== tab || !Array.isArray(o.rows) || o.rows.length === 0) return null;
  const at = Number(o.at);
  if (!Number.isFinite(at) || now - at > SNAPSHOT_MAX_AGE_MS || at - now > 60 * 60 * 1e3) return null;
  return o.rows;
}
var lastSource = null;
function makeStandardScreen({ kino: kino2, name, nameEn, logo = null, logoAspect = "1:1", needsResolver, hasSettings, tabs, loadTab, homeKey = null, titleOf: titleOf2, typeOf, tmdbPictures = false, imageHeaders = null, searchHere = null, page = null, barSearch = true, backArrow = true, snapshot = null }) {
  const cfg = { name, nameEn, logo, logoAspect, imageHeaders, hasSettings: !!hasSettings, barSearch: barSearch !== false, backArrow: backArrow !== false, tabs: Array.isArray(tabs) && tabs.length > 0 ? tabs : DEFAULT_TABS };
  const TAB_IDS = cfg.tabs.map((t2) => t2.id);
  lastSource = { tabs: cfg.tabs, loadTab, titleOf: titleOf2, typeOf };
  async function fromSnapshot(tab) {
    if (typeof snapshot !== "string" || !/^[\w.-]+\/[\w.-]+$/.test(snapshot)) return null;
    try {
      const r = await kino2.fetch(snapshotUrl(snapshot, tab), { timeoutMs: SNAPSHOT_TIMEOUT_MS });
      if (!r || !r.ok) return null;
      const rows = snapshotRows(await r.text(), tab);
      return rows ? { rows } : null;
    } catch (_) {
      return null;
    }
  }
  const meta = makeMetaCache({ kino: kino2, titleOf: titleOf2, typeOf, tmdbPictures });
  function slidesFromMeta(rails) {
    const out = [];
    for (const r of rails) {
      for (const c of r.items) {
        if (out.length >= MAX_SLIDES) return out;
        const k = meta.known(c.id);
        if (!k.backdrop || c.adult === true || out.some((x) => x.id === c.id)) continue;
        out.push({ id: c.id, ref: c.ref, kind: c.kind, title: c.title, image: k.backdrop, text: slideText(k.overview, c), ...k.logo ? { logo: k.logo } : {} });
      }
    }
    return out;
  }
  const enrich = (data) => {
    if (!data) return data;
    const own = data.slides.map((s) => {
      const k = meta.known(s.id);
      const image = tmdbPictures && k.backdrop ? k.backdrop : null;
      return k.logo || image ? { ...s, ...k.logo ? { logo: k.logo } : {}, ...image ? { image } : {} } : s;
    });
    const learned = own.length > 0 ? [] : slidesFromMeta(data.rails);
    return {
      // The site's own backdrops, else TMDB's, else the posters: every plugin has a hero.
      slides: own.length > 0 ? own : learned.length > 0 ? learned : data.posterSlides || [],
      rails: data.rails.map((r) => ({ ...r, items: meta.dress(r.items) }))
    };
  };
  const metaTicks = /* @__PURE__ */ new Map();
  const found = /* @__PURE__ */ new Map();
  const SOURCES_PER_TICK = 3;
  const asFound = (a, index) => ({
    ok: !!(a && a.ok),
    items: a && a.ok && Array.isArray(a.items) ? a.items.filter((x) => x && x.id && x.ref && x.title).slice(0, 40).map((x) => ({ ...x, id: ("p" + index + "~" + x.id).slice(0, 128), origin: a.repo })) : []
  });
  const memo = /* @__PURE__ */ new Map();
  const log = (...a) => {
    try {
      kino2.log("[std]", ...a);
    } catch (_) {
    }
  };
  const get = (k) => {
    try {
      return kino2.storage.get(k);
    } catch (_) {
      return null;
    }
  };
  const set = (k, v, opts) => {
    try {
      kino2.storage.set(k, v, opts);
    } catch (_) {
    }
  };
  function readSnap(tab) {
    try {
      const o = JSON.parse(get(SNAP_PREFIX + tab) || "null");
      return o && Date.now() - o.at < SNAP_TTL_MS && o.data && Array.isArray(o.data.rails) ? o.data : null;
    } catch (_) {
      return null;
    }
  }
  const snapMax = Math.min(SNAP_MAX, Math.floor(SNAPS_TOTAL / TAB_IDS.length));
  function writeSnap(tab, data) {
    for (let per = 10; per >= 3; per -= 2) {
      const slim = { slides: data.slides, posterSlides: data.posterSlides || [], rails: data.rails.map((r) => ({ ...r, items: r.items.slice(0, per) })) };
      const text2 = JSON.stringify({ at: Date.now(), data: slim });
      if (text2.length <= snapMax) {
        set(SNAP_PREFIX + tab, text2, { ttlMs: SNAP_TTL_MS });
        return;
      }
    }
  }
  function homeSeed(tab) {
    if (!homeKey || tab !== TAB_IDS[0]) return null;
    try {
      const o = JSON.parse(get(homeKey) || "null");
      return o && Array.isArray(o.rows) && o.rows.length ? tabOf({ rows: o.rows }) : null;
    } catch (_) {
      return null;
    }
  }
  const stored = () => {
    const t2 = get(TAB_KEY);
    return TAB_IDS.includes(t2) ? t2 : null;
  };
  function dataOf(tab) {
    if (memo.has(tab)) return memo.get(tab).data;
    const snap = readSnap(tab) || homeSeed(tab);
    if (snap) {
      memo.set(tab, { data: snap, whole: false });
      return snap;
    }
    return null;
  }
  const readKeys = () => {
    try {
      const a = JSON.parse(get(RECENT_KEY) || "[]");
      return Array.isArray(a) ? a.filter((k) => typeof k === "string") : [];
    } catch (_) {
      return [];
    }
  };
  function notePlayed(ref) {
    try {
      const key = playedKey(ref);
      if (key === "" || key.startsWith("x|")) return;
      const keys = readKeys();
      if (keys[0] === key) return;
      set(RECENT_KEY, JSON.stringify([key, ...keys.filter((k) => k !== key)].slice(0, RECENT_MAX)));
    } catch (_) {
    }
  }
  const tabFromArgs = (route) => {
    const a = route && route.args && typeof route.args === "object" ? route.args : {};
    return TAB_IDS.includes(a.tab) ? a.tab : null;
  };
  function needed(tab) {
    return memo.get(tab) && memo.get(tab).whole ? [] : [tab];
  }
  function screen2(ctx) {
    const c = ctx || {};
    const device = c.device || "phone";
    if (needsResolver && !(c.installed && c.installed[RESOLVER_REPO])) return gateView(cfg, device);
    if (c.route && c.route.name === "settings") return settingsView(cfg, device);
    if (searchHere && c.route && c.route.name === "results") {
      const st0 = c.state && typeof c.state === "object" ? c.state : {};
      return resultsView(cfg, {
        q: String(st0.rq || ""),
        order: Array.isArray(st0.rorder) ? st0.rorder : [],
        names: st0.rnames || {},
        pending: Array.isArray(st0.rpending) ? st0.rpending : [],
        found,
        device
      });
    }
    const st = c.state && typeof c.state === "object" ? c.state : {};
    const tab = TAB_IDS.includes(st.tab) ? st.tab : tabFromArgs(c.route) ?? stored() ?? TAB_IDS[0];
    const data = enrich(dataOf(tab));
    const loaded = TAB_IDS.map((t2) => memo.get(t2)).filter(Boolean).map((m) => m.data);
    const pending = Array.isArray(st.pending) && st.pending.length > 0;
    const searching = st.searching === true;
    if (page) {
      const tree = browseView(cfg, {
        tab: TAB_IDS[0],
        data: null,
        recent: [],
        pending: false,
        failed: false,
        searching,
        device,
        own: page.view({ ...c, state: st }) || [],
        ownActions: page.actions ? page.actions({ ...c, state: st }) || [] : []
      });
      const every = page.every ? page.every({ ...c, state: st }) : null;
      return every ? { ...tree, every } : tree;
    }
    return browseView(cfg, { tab, data, recent: meta.dress(recentOf(readKeys(), loaded)), pending, failed: !!(st.failed && st.failed[tab]), searching, device });
  }
  function cutShort() {
    try {
      const o = JSON.parse(get(INFLIGHT_KEY) || "null");
      if (!o || typeof o.tab !== "string") return null;
      if (Date.now() - Number(o.at) < INFLIGHT_STALE_MS) return null;
      kino2.storage.remove(INFLIGHT_KEY);
      return o.tab;
    } catch (_) {
      return null;
    }
  }
  async function load(tab) {
    set(INFLIGHT_KEY, JSON.stringify({ tab, at: Date.now() }));
    let page2;
    try {
      page2 = await fromSnapshot(tab) || await loadTab(tab);
    } finally {
      try {
        kino2.storage.remove(INFLIGHT_KEY);
      } catch (_) {
      }
    }
    const data = tabOf(page2);
    if (data) {
      memo.set(tab, { data, whole: true });
      writeSnap(tab, data);
    }
    return data !== null;
  }
  const events = {
    async open(ev) {
      if (page) {
        let patch = {};
        try {
          patch = (page.open ? await page.open(ev) : {}) || {};
        } catch (e) {
          log("page open", e && e.code || "error");
        }
        return { state: { ...patch, tab: TAB_IDS[0], pending: [], failed: null } };
      }
      return events.openTabs(ev);
    },
    openTabs({ route, state, device }) {
      const tab = tabFromArgs(route) ?? (TAB_IDS.includes(state.tab) ? state.tab : stored() ?? TAB_IDS[0]);
      for (const t2 of TAB_IDS) dataOf(t2);
      return { state: { tab, pending: needed(tab), failed: null } };
    },
    tab({ value, arg, state }) {
      const tab = TAB_IDS.includes(value) ? value : TAB_IDS.includes(arg) ? arg : null;
      if (!tab) return null;
      set(TAB_KEY, tab);
      dataOf(tab);
      const failed = { ...state.failed || {} };
      delete failed[tab];
      const pending = [tab, ...Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : []];
      return { state: { tab, pending: memo.get(tab) && memo.get(tab).whole ? pending.slice(1) : pending, failed } };
    },
    retry({ state }) {
      const tab = TAB_IDS.includes(state.tab) ? state.tab : TAB_IDS[0];
      const queued = Array.isArray(state.pending) ? state.pending.filter((t2) => t2 !== tab) : [];
      return { state: { failed: null, pending: [tab, ...queued] } };
    },
    async tick({ state, route }) {
      if (searchHere && route && route.name === "results") {
        const rp = Array.isArray(state.rpending) ? state.rpending : [];
        if (rp.length === 0) return null;
        const batch = rp.slice(0, SOURCES_PER_TICK);
        const order = Array.isArray(state.rorder) ? state.rorder : [];
        let answers = [];
        try {
          answers = await searchHere.searchIn(String(state.rq || ""), batch);
        } catch (e) {
          log("results", (e && e.code || "error") + " " + String(e && e.message || "").slice(0, 200));
        }
        for (const repo of batch) {
          const a = (Array.isArray(answers) ? answers : []).find((x) => x && x.repo === repo);
          found.set(repo, asFound(a, order.indexOf(repo)));
        }
        return { state: { rpending: rp.slice(SOURCES_PER_TICK) } };
      }
      const pending = Array.isArray(state.pending) ? state.pending : [];
      if (pending.length === 0) return null;
      const [next, ...rest] = pending;
      const failed = { ...state.failed || {} };
      if (next.startsWith("meta:")) {
        const tab = next.slice(5);
        const m = memo.get(tab);
        if (!m) return { state: { pending: rest } };
        const ask = (x) => ({ id: x.id, title: x.title, kind: x.kind, ...x.year !== void 0 ? { year: x.year } : {} });
        const noOwnSlides = m.data.slides.length === 0;
        const cards = [...m.data.slides.map(ask), ...m.data.rails.flatMap((r) => r.items.slice(0, noOwnSlides ? MAX_SLIDES * 3 : 6).map(ask))].filter((c) => !meta.asked(c.id)).slice(0, META_TICK_CARDS);
        const count = await meta.fill(cards, META_TICK_MS);
        const ticks = (metaTicks.get(tab) || 0) + 1;
        metaTicks.set(tab, ticks);
        const again = noOwnSlides && count > 0 && ticks < MAX_META_TICKS && slidesFromMeta(m.data.rails).length < MAX_SLIDES && cards.some((c) => !meta.asked(c.id));
        return { state: { pending: again ? [next, ...rest] : rest } };
      }
      if (cutShort() === next) {
        log("tab", next, "cut short by Kino last time");
        failed[next] = true;
        return { state: { pending: rest, failed } };
      }
      try {
        const ok = await load(next);
        if (!ok) failed[next] = true;
        else delete failed[next];
        if (ok && meta.usable()) rest.unshift("meta:" + next);
      } catch (e) {
        log("tab", e && e.code || "error");
        failed[next] = true;
      }
      return { state: { pending: rest, failed } };
    },
    // The words go to Kino's own search, with this plugin as the source; the bar is put back as it was, locally.
    // The search button's own event (after its local ops): while searching, the tree declares onBack, so Back closes the box.
    searchOpened() {
      return { state: { searching: true } };
    },
    // The box was closed (its arrow, or Back through onBack, already ran the local ops): the flag and the ops go, so the next
    // tree declares no onBack and draws the bar's defaults.
    searchClosed() {
      return { state: { searching: false, ui: null } };
    },
    async search({ value, state, device }) {
      const typed = value && typeof value === "object" ? value.q : value;
      const raw = typed != null && String(typed).trim() !== "" ? typed : state.inputs && state.inputs.q;
      const q = String(raw == null ? "" : raw).trim().slice(0, Q_MAX);
      if (!q) return null;
      const closed = searchClosedOps(device === "tv" && TAB_IDS.length > 1);
      if (searchHere) {
        let sources = [];
        try {
          sources = await searchHere.sources() || [];
        } catch (e) {
          log("sources", e && e.code || "error");
        }
        const order = sources.map((x) => x.repo).filter((r) => typeof r === "string");
        found.clear();
        return { route: { push: "results" }, ui: closed, state: {
          searching: false,
          ui: null,
          rq: q,
          rorder: order,
          rnames: Object.fromEntries(sources.map((x) => [x.repo, String(x.name || x.repo)])),
          rpending: order
        } };
      }
      return { go: { search: { q } }, ui: closed, state: { searching: false, ui: null } };
    },
    openSettings() {
      return { route: { push: "settings" }, state: { fromBrowse: true } };
    },
    back({ state, route }) {
      if (route && route.name === "settings" && !state.fromBrowse) return { close: true };
      return { route: { pop: true }, state: { fromBrowse: false } };
    }
  };
  async function screenEvent2(ev) {
    const e = ev || {};
    const name2 = e.name != null ? e.name : e.event;
    const own = page && page.events && typeof name2 === "string" && Object.hasOwn(page.events, name2) && !Object.hasOwn(events, name2) ? page.events[name2] : null;
    if (own) return await own({ ...e, state: e.state || {} }) ?? null;
    const handler = typeof name2 === "string" && name2 !== "openTabs" && Object.hasOwn(events, name2) ? events[name2] : null;
    return handler ? await handler({ ...e, state: e.state || {} }) ?? null : null;
  }
  return { screen: screen2, screenEvent: screenEvent2, notePlayed };
}

// src/std/rank.js
async function scoresFromResolver(kino2, urls) {
  if (!Array.isArray(urls) || urls.length === 0) return null;
  try {
    const r = await kino2.plugins.call("resolver", "rank", { urls: urls.slice(0, 64).map(String) });
    const s = r && Array.isArray(r.scores) ? r.scores : null;
    return s && s.length === Math.min(urls.length, 64) ? s : null;
  } catch (_) {
    return null;
  }
}
async function rankServers(kino2, list, urlOf, groupOf = () => 0) {
  const scores = await scoresFromResolver(kino2, list.map(urlOf));
  return list.map((x, i) => ({ x, i, g: groupOf(x), s: scores && i < scores.length ? scores[i] : 0 })).sort((a, b) => a.g - b.g || b.s - a.s || a.i - b.i).map((o) => o.x);
}

// src/logo.js
var LOGO = "data:image/png;base64,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";
var LOGO_ASPECT = "1:1";

// src/util/terms.js
function searchTerms(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
  const out = [];
  const add = (s) => {
    const v = String(s || "").trim();
    if (v.length >= 2 && !out.some((x) => norm(x) === norm(v))) out.push(v);
  };
  add(q);
  if (arg && typeof arg === "object") {
    add(arg.originalTitle);
    for (const a of Array.isArray(arg.altTitles) ? arg.altTitles : []) add(a);
  }
  add(q.split(/\s*[:\-–—]\s*/)[0]);
  return out.slice(0, 4);
}
async function searchWithTerms(arg, one) {
  for (const q of searchTerms(arg)) {
    const found = await one(arg && typeof arg === "object" ? { ...arg, q } : q);
    if (found.length) return found;
  }
  return [];
}

// src/util/probe.js
var PEEK_BYTES = 2048;
async function peek(kino2, out, ms = 6e3) {
  try {
    const r = await kino2.fetch(out.url, { headers: { Range: `bytes=0-${PEEK_BYTES - 1}`, ...out.headers || {} }, timeoutMs: ms, maxBytes: PEEK_BYTES });
    return r.ok || r.status === 401 || r.status === 403 || r.status === 416 ? "ok" : "dead";
  } catch (e) {
    if (e && (e.code === "host_not_allowed" || e.code === "too_large")) return "ok";
    return e && e.code === "timeout" ? "slow" : "dead";
  }
}

// src/util/home.js
var BUDGET_MS = 11e3;
var KEEP_MS = 12 * 60 * 60 * 1e3;
var MAX_CHARS = 60 * 1024;
function keep(key, rows) {
  try {
    for (let per = 20; per >= 4; per -= 4) {
      const text2 = JSON.stringify({ at: Date.now(), rows: rows.map((r) => ({ ...r, items: Array.isArray(r.items) ? r.items.slice(0, per) : r.items })) });
      if (text2.length <= MAX_CHARS) {
        kino.storage.set(key, text2, { ttlMs: KEEP_MS });
        return;
      }
    }
  } catch (_) {
  }
}
function kept(key) {
  try {
    const o = JSON.parse(kino.storage.get(key) || "null");
    return o && Date.now() - o.at < KEEP_MS && Array.isArray(o.rows) && o.rows.length ? o.rows : null;
  } catch (_) {
    return null;
  }
}
async function homeWithin(jobs, { key = "home:last", budgetMs = BUDGET_MS } = {}) {
  const out = jobs.map(() => null);
  let done = false;
  const all = Promise.all(jobs.map((job, i) => Promise.resolve().then(job).then((row) => {
    out[i] = row;
  }, () => {
  }))).then(() => {
    done = true;
  });
  const end = Date.now() + budgetMs;
  while (!done && Date.now() < end) await Promise.race([all, kino.sleep(Math.min(250, Math.max(1, end - Date.now())))]);
  const rows = out.filter(Boolean);
  if (rows.length) {
    keep(key, rows);
    return rows;
  }
  return kept(key) || [];
}

// src/std/catalog.js
var CATALOG_MAX = 40;
var OVERVIEW_MAX2 = 300;
var HTTPS3 = /^https:\/\//;
function catalogItems(found) {
  const out = [];
  const list = Array.isArray(found) ? found : found && Array.isArray(found.items) ? found.items : [];
  for (const it of list) {
    if (out.length >= CATALOG_MAX) break;
    if (!it || typeof it.id !== "string" || !it.id || typeof it.ref !== "string" || !it.ref || typeof it.title !== "string" || !it.title) continue;
    const item = { id: it.id, ref: it.ref, title: it.title, kind: typeof it.kind === "string" && it.kind ? it.kind : "movie" };
    if (typeof it.poster === "string" && HTTPS3.test(it.poster)) item.poster = it.poster;
    if (typeof it.backdrop === "string" && HTTPS3.test(it.backdrop)) item.backdrop = it.backdrop;
    if (it.year !== void 0 && it.year !== null && String(it.year)) item.year = String(it.year);
    if (typeof it.overview === "string" && it.overview.trim()) item.overview = it.overview.trim().slice(0, OVERVIEW_MAX2);
    const tmdb = it.ids && Number.isInteger(it.ids.tmdb) ? it.ids.tmdb : Number.isInteger(it.tmdb) ? it.tmdb : 0;
    if (tmdb > 0) item.tmdb = tmdb;
    out.push(item);
  }
  return out;
}
function catalogQuery(arg) {
  const q = String(arg && arg.q || "").trim().slice(0, 200);
  const type = arg && (arg.type === "movie" || arg.type === "series") ? arg.type : "any";
  return { q, type, season: 0, episode: 0, tmdbId: 0, year: 0, originalTitle: "", altTitles: [], cursor: null };
}
function catalogDoor(search2) {
  return async (arg) => {
    const query = catalogQuery(arg);
    if (!query.q) return [];
    return catalogItems(await search2(query));
  };
}

// src/plugin.js
globalThis.__kinoDropPendingFetches = true;
var CACHE_MS = 10 * 60 * 1e3;
var RESOLVE_MS = 7e4;
var CAPTURE_MS = 2e4;
var MAX_CAPTURES = 1;
var MAX_COPIES = 8;
var HLS = "application/vnd.apple.mpegurl";
var STRINGS = {
  es: {
    news: "Novedades",
    movies: "Pel\xEDculas",
    series: "Series",
    anime: "Anime",
    doramas: "Doramas",
    recentMovies: "Pel\xEDculas recientes",
    recentSeries: "Series recientes",
    recentAnime: "Anime reciente",
    latestEpisodes: "\xDAltimos episodios",
    popularMovies: "Pel\xEDculas populares",
    popularSeries: "Series populares",
    popularAnime: "Anime popular",
    lat: "Latino",
    sub: "Subtitulado",
    cast: "Castellano",
    season: "Temporada",
    episode: "Episodio",
    heroText: "Series, anime y pel\xEDculas en espa\xF1ol, con estrenos al d\xEDa.",
    unavailable: "El servicio no est\xE1 disponible en este momento.",
    noEpisodes: "Este t\xEDtulo todav\xEDa no tiene episodios en el sitio.",
    noStreams: "Ning\xFAn servidor de este t\xEDtulo abri\xF3. Prueba m\xE1s tarde.",
    statusLine: "Sitio: {host} \xB7 Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada.",
    needResolver: "Para reproducir, abre SeriesKao desde el men\xFA e instala el motor de reproducci\xF3n que te pedir\xE1."
  },
  en: {
    news: "What's new",
    movies: "Movies",
    series: "Series",
    anime: "Anime",
    doramas: "Doramas",
    recentMovies: "Recent movies",
    recentSeries: "Recent series",
    recentAnime: "Recent anime",
    latestEpisodes: "Latest episodes",
    popularMovies: "Popular movies",
    popularSeries: "Popular series",
    popularAnime: "Popular anime",
    lat: "Latino",
    sub: "Subtitled",
    cast: "Castilian",
    season: "Season",
    episode: "Episode",
    heroText: "Series, anime and movies in Spanish, with new releases.",
    unavailable: "The service is not available right now.",
    noEpisodes: "This title has no episodes on the site yet.",
    noStreams: "No server of this title opened. Try again later.",
    statusLine: "Site: {host} \xB7 Lists kept: {n}",
    cacheCleared: "Cache cleared.",
    needResolver: "To play, open SeriesKao from the menu and install the playback engine it asks for."
  }
};
var t = (key) => {
  const lang = String(kino.lang || "").toLowerCase().startsWith("es") ? "es" : "en";
  return STRINGS[lang][key] || STRINGS.es[key] || key;
};
function site() {
  let raw = "";
  try {
    raw = String(kino.config.get("site") || "").trim();
  } catch (_) {
    raw = "";
  }
  if (!raw) return DEFAULT_SITE;
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:/i.test(raw) ? raw : "https://" + raw);
    return u.protocol === "https:" && u.hostname.includes(".") ? u.origin : DEFAULT_SITE;
  } catch (_) {
    return DEFAULT_SITE;
  }
}
async function getPage(url, headers) {
  const r = await kino.fetch(url, { headers: { "User-Agent": UA, "Accept-Language": "es-MX,es;q=0.9", ...headers || {} }, timeoutMs: 15e3 });
  if (!r.ok) throw kino.error("unavailable", `SeriesKao ${r.status} ${url}`, { userMessage: t("unavailable") });
  return r.text();
}
async function cached(key, fn) {
  try {
    const raw = kino.storage.get("c:" + hash36(site()) + ":" + key);
    const e = raw ? JSON.parse(raw) : null;
    if (e && Date.now() - e.at < CACHE_MS) return e.v;
  } catch (_) {
  }
  const v = await fn();
  if (Array.isArray(v) && !v.length) return v;
  try {
    kino.storage.set("c:" + hash36(site()) + ":" + key, JSON.stringify({ at: Date.now(), v }), { ttlMs: CACHE_MS });
  } catch (_) {
  }
  return v;
}
var fold = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
var hash36 = (s) => {
  let h = 5381;
  for (const ch of String(s)) h = (h * 33 ^ ch.codePointAt(0)) >>> 0;
  return h.toString(36);
};
var KIND_GENRE = { a: "Anime" };
function toItem(card, genreName) {
  const item = {
    id: "sk-" + (fold(card.slug).replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 90) || "t") + "-" + hash36(card.code + card.slug),
    ref: card.code + ":" + card.slug,
    title: card.title,
    kind: card.kind
  };
  if (card.poster) item.poster = card.poster;
  if (card.year) item.year = String(card.year);
  if (card.rating) item.rating = card.rating;
  const g = [KIND_GENRE[card.code], genreName].filter(Boolean);
  if (g.length) item.genres = g;
  return item;
}
var LISTS = {
  peliculas: { path: "/peliculas", titleKey: "recentMovies", genre: "peliculas" },
  populares: { path: "/peliculas/populares", titleKey: "popularMovies", genre: "peliculas" },
  series: { path: "/series", titleKey: "recentSeries", genre: "series", verify: true },
  seriesPop: { path: "/series/populares", titleKey: "popularSeries", genre: "series" },
  animes: { path: "/animes", titleKey: "recentAnime", genre: "anime", verify: true },
  animesPop: { path: "/animes/populares", titleKey: "popularAnime", genre: "anime" }
};
function refOf(ref) {
  const m = /^(list|genre):([A-Za-z0-9-]+)$/.exec(String(ref || ""));
  if (!m) return null;
  if (m[1] === "list") {
    const l = LISTS[m[2]];
    return l ? { ...l, title: t(l.titleKey) } : null;
  }
  const g = GENRES.find((x) => x[0] === m[2]);
  return g ? { path: "/generos/" + g[0], title: g[1], genre: g[0] === "dorama" ? "doramas" : void 0, genreName: g[1] } : null;
}
async function listPage(def, page) {
  const url = site() + def.path + (page > 1 ? "?page=" + page : "");
  const r = await cached(`l:${def.path}:${page}`, async () => {
    const html = await getPage(url);
    const cards2 = parseCards(html);
    return cards2.length ? [{ cards: cards2, pager: parsePager(html) }] : [];
  });
  const { cards, pager } = r[0] || { cards: [], pager: { page, pages: page } };
  return { cards, more: pager.page < pager.pages };
}
async function withEpisodes(cards) {
  const keep2 = await Promise.all(cards.map(async (c) => {
    if (c.kind === "movie") return true;
    try {
      return hasEpisodes(await getPage(`${site()}/${SEGMENT[c.code]}/${encodeURIComponent(c.slug)}`));
    } catch (_) {
      return true;
    }
  }));
  return cards.filter((_, i) => keep2[i]);
}
async function latestRow() {
  const cards = await cached("latest", async () => parseLatestEpisodes(await getPage(site() + "/")));
  const items = cards.slice(0, 20).map((c) => ({ ...toItem(c), ...c.label ? { badges: [c.label] } : {} }));
  return items.length ? { id: "latest", title: t("latestEpisodes"), items, ref: "list:series", genre: "series" } : null;
}
var safeRow = async (id, fn) => {
  try {
    return await fn();
  } catch (e) {
    kino.log("row " + id + ": " + (e && e.message));
    return null;
  }
};
async function rowOf(id, ref, genre) {
  const def = refOf(ref);
  const { cards } = await listPage(def, 1);
  const shown = def.verify ? await withEpisodes(cards.slice(0, 20)) : cards.slice(0, 20);
  const items = shown.map((c) => toItem(c, def.genreName));
  return items.length ? { id, title: def.title, items, ref, genre: genre || def.genre || "series" } : null;
}
async function home() {
  return homeWithin([
    () => safeRow("latest", latestRow),
    () => safeRow("series", () => rowOf("series", "list:series")),
    () => safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")),
    () => safeRow("animes", () => rowOf("animes", "list:animes")),
    () => safeRow("dorama", () => rowOf("dorama", "genre:dorama", "doramas")),
    () => safeRow("seriesPop", () => rowOf("seriesPop", "list:seriesPop")),
    () => safeRow("populares", () => rowOf("populares", "list:populares"))
  ]);
}
async function browse(ref, cursor) {
  const def = refOf(ref);
  if (!def) return { items: [] };
  const page = cursor ? Math.max(1, parseInt(cursor, 10) || 1) : 1;
  const { cards, more } = await listPage(def, page);
  return { items: cards.map((c) => toItem(c, def.genreName)), next: more ? String(page + 1) : void 0 };
}
async function searchOne(arg) {
  const q = String((typeof arg === "string" ? arg : arg && arg.q) || "").trim();
  const within = typeof arg === "object" && arg && arg.within ? refOf(arg.within) : null;
  if (q.length < 2) return [];
  const cards = await cached("s:" + q.toLowerCase(), async () => parseCards(await getPage(`${site()}/search?s=${encodeURIComponent(q)}`)));
  const kindOnly = within && /^\/peliculas/.test(within.path) ? "movie" : within && /^\/(series|animes)/.test(within.path) ? "series" : null;
  return cards.filter((c) => !kindOnly || c.kind === kindOnly).slice(0, 40).map((c) => toItem(c));
}
var search = (arg) => searchWithTerms(arg, searchOne);
async function section({ tab } = {}) {
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
async function categories() {
  return GENRES.map(([slug, name]) => ({ id: "g-" + slug, title: name, ref: "genre:" + slug }));
}
function slugOf(ref, code) {
  const m = new RegExp(`^${code}:([^/?#\\s:]+)$`).exec(String(ref || ""));
  return m ? m[1] : null;
}
var titlePage = (code, slug) => cached("p:" + code + slug, async () => {
  const p = parseTitle(await getPage(`${site()}/${SEGMENT[code]}/${encodeURIComponent(slug)}`));
  return p ? [p] : [];
}).then((r) => r[0] || null);
async function details(ref) {
  const slug = slugOf(ref, "m");
  if (!slug) return null;
  const p = await titlePage("m", slug);
  if (!p) return null;
  const out = { overview: p.overview || void 0, genres: p.genres.length ? p.genres : void 0, poster: p.poster || void 0, backdrop: p.backdrop || void 0, year: p.year ? String(p.year) : void 0, rating: p.rating };
  for (const k of Object.keys(out)) if (out[k] === void 0) delete out[k];
  return out;
}
async function knownEpisodes(p) {
  try {
    if (typeof kino.meta !== "function" || kino.meta.byTitle !== true || !p.title) return null;
    const m = await kino.meta({ type: "series", title: p.title, ...p.year ? { year: p.year } : {}, lang: kino.lang });
    return m && Array.isArray(m.episodes) ? m.episodes : null;
  } catch (_) {
    return null;
  }
}
async function episodes(ref) {
  const code = /^a:/.test(String(ref || "")) ? "a" : "s";
  const slug = slugOf(ref, code);
  if (!slug) throw kino.error("not_found", "unknown ref: " + ref);
  const p = await titlePage(code, slug);
  const list = p ? p.seasons.flatMap((s) => s.episodes) : [];
  if (!list.length) throw kino.error("not_found", "no episodes for " + slug, { userMessage: t("noEpisodes") });
  const known = await knownEpisodes(p);
  const byKey = new Map((known || []).map((e) => [e.season + "x" + e.number, e]));
  const series = { title: p.title || void 0, poster: p.poster || void 0, backdrop: p.backdrop || void 0, overview: p.overview || void 0, genres: p.genres.length ? p.genres : void 0, year: p.year ? String(p.year) : void 0, rating: p.rating };
  for (const k of Object.keys(series)) if (series[k] === void 0) delete series[k];
  return {
    series,
    episodes: list.map((e) => {
      const extra = byKey.get(e.season + "x" + e.number);
      const ep = { season: e.season, number: e.number, ref: `e:${code}:${slug}:${e.season}:${e.number}`, title: e.title || extra && extra.title || `${t("episode")} ${e.number}` };
      if (extra && extra.still) ep.still = extra.still;
      if (extra && extra.overview) ep.overview = extra.overview;
      return ep;
    })
  };
}
var LANG_NAME = { LAT: "lat", SUB: "sub", CAST: "cast", ESP: "cast" };
var SERVER_NAME = { vidhide: "VidHide", streamwish: "StreamWish", voe: "VOE", filemoon: "Filemoon", mixdrop: "MixDrop", streamtape: "StreamTape" };
async function serversOf2(pageUrl, req) {
  const id = parsePlayerId(await getPage(pageUrl, { Referer: site() + "/" }));
  if (!id) return [];
  const rows = (await servers(kino, req, id, `${site()}/vidurl/${id}/`)).filter((s) => s.url);
  let pref = "lat";
  try {
    pref = String(kino.config.get("audio") || "lat");
  } catch (_) {
    pref = "lat";
  }
  const lang = (s) => LANG_NAME[s.lang.toUpperCase()] || "sub";
  const langRank = (s) => lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3;
  return (await rankServers(kino, rows, (s) => s.url, langRank)).slice(0, MAX_COPIES);
}
async function open(server, req, budget) {
  try {
    const res = await kino.plugins.call("resolver", "resolve", { url: server.url, referer: site() + "/" });
    const s = (res && Array.isArray(res.streams) ? res.streams : []).find((x) => x && x.url);
    if (s) {
      const headers = {};
      if (s.referer) headers.Referer = s.referer;
      if (Array.isArray(s.headers)) {
        for (const h of s.headers) if (h && h.name) headers[h.name] = String(h.value);
      }
      const out = { url: s.url, mime: s.kind === "hls" ? HLS : /\.mp4(\?|$)/i.test(s.url) ? "video/mp4" : HLS, headers };
      if (res.subtitles && res.subtitles.length) out.subtitles = res.subtitles;
      return out;
    }
    if (res && res.error === "dead") return null;
  } catch (_) {
  }
  if (!kino.browser || typeof kino.browser.capture !== "function" || budget.captures <= 0) return null;
  budget.captures -= 1;
  const page = await kino.browser.capture(server.url, { timeoutMs: CAPTURE_MS, match: "\\.m3u8|\\.mp4", headers: { Referer: site() + "/" } });
  const media = page && page.media || [];
  const best = media.find((x) => /m3u8/i.test(x.url)) || media[0];
  if (!best) return null;
  return { captured: true, url: best.url, mime: best.mime || (/\.mp4/i.test(best.url) ? "video/mp4" : HLS), headers: best.headers || { Referer: server.url } };
}
var labelOf = (s) => `${t(LANG_NAME[s.lang.toUpperCase()] || "sub")} \xB7 ${SERVER_NAME[s.server.toLowerCase()] || s.server}`;
async function resolverInstalled() {
  try {
    await kino.plugins.call("resolver", "normalizeHost", { url: "https://probe.invalid/" });
    return true;
  } catch (e) {
    return (e && e.code) !== "provider_missing";
  }
}
var std = null;
var standard = () => std ?? (std = makeStandardScreen({
  snapshot: "xuper-plugin/kino-plugin-serieskao",
  kino,
  name: "SeriesKao",
  logo: LOGO,
  logoAspect: LOGO_ASPECT,
  needsResolver: true,
  hasSettings: true,
  tabs: [
    { id: "inicio", label: "Inicio", labelEn: "Home" },
    { id: "peliculas", label: "Pel\xEDculas", labelEn: "Movies" },
    { id: "series", label: "Series", labelEn: "Series" }
  ],
  // Inicio is the Home rows; Películas and Series are the section's own tabs of the same name.
  loadTab: async (tab) => ({ rows: tab === "peliculas" || tab === "series" ? (await section({ tab })).rows : await home() })
}));
async function screen(ctx) {
  await null;
  return standard().screen(ctx && typeof ctx === "object" ? ctx : {});
}
async function screenEvent(ev) {
  await null;
  return standard().screenEvent(ev && typeof ev === "object" ? ev : {});
}
async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base, site());
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  if (!await resolverInstalled()) throw kino.error("unavailable", "resolver missing", { userMessage: t("needResolver") });
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers2 = await serversOf2(pageUrl, req);
  if (!servers2.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
  const deliver = (i, out) => {
    const s = servers2[i];
    const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: labelOf(s) };
    if (out.subtitles) stream.subtitles = out.subtitles;
    if (out.durationMs) stream.durationMs = out.durationMs;
    if (only == null) {
      const others = servers2.map((_, j) => j).filter((j) => j !== i);
      if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers2[j]) }));
    }
    return stream;
  };
  let slow = null;
  const failures = [];
  for (const i of only != null ? [only] : servers2.map((_, k) => k)) {
    const s = servers2[i];
    if (!s) continue;
    try {
      const out = await open(s, req, budget);
      if (!out) {
        failures.push(`${s.server}: no stream`);
        continue;
      }
      if (!out.captured) {
        const answer = await peek(kino, { url: out.url, headers: { "User-Agent": UA, ...out.headers || {} } });
        if (answer === "slow") {
          if (!slow) slow = { i, out };
          failures.push(`${s.server}: slow`);
          continue;
        }
        if (answer !== "ok") {
          failures.push(`${s.server}: address does not answer`);
          continue;
        }
      }
      return deliver(i, out);
    } catch (e) {
      failures.push(`${s.server}: ${e && e.code || ""} ${e && e.message || e}`.trim());
    }
  }
  if (slow) {
    kino.log(`resolve ${base}: only a slow server answered (${failures.join("; ")})`);
    return deliver(slow.i, slow.out);
  }
  kino.log(`resolve ${base} failed: ${failures.join("; ")}`);
  throw kino.error("not_found", "no server opened for " + pageUrl, { userMessage: t("noStreams") });
}
async function settingsStatus() {
  let n = 0;
  try {
    n = kino.storage.keys().filter((k) => k.startsWith("c:")).length;
  } catch (_) {
  }
  return { info: t("statusLine").replace("{host}", new URL(site()).hostname).replace("{n}", String(n)) };
}
async function action(key) {
  if (key === "clearCache") {
    try {
      for (const k of kino.storage.keys()) if (k.startsWith("c:")) kino.storage.remove(k);
    } catch (_) {
    }
    return { message: t("cacheCleared") };
  }
  return { message: "" };
}
var proto_catalog_search = catalogDoor(search);
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  proto_catalog_search,
  resolve,
  screen,
  screenEvent,
  search,
  section,
  settingsStatus
};
