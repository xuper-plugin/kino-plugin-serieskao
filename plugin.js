var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

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
var decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
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
  const seasons = [];
  for (const p of h.split('<div class="episodes-list').slice(1)) {
    const season = /id="season-(\d+)"/.exec(p);
    if (!season) continue;
    const eps = [];
    for (const e of p.split('<a href="/').slice(1)) {
      const link = /^(?:serie|anime)\/[^"\/]+\/temporada\/(\d+)\/capitulo\/(\d+)"/.exec(e);
      if (!link) continue;
      const name = /episode-item__title">([\s\S]*?)<\/span>/.exec(e);
      eps.push({ season: Number(link[1]), number: Number(link[2]), title: name ? text(name[1]) : "" });
    }
    if (eps.length) seasons.push({ season: Number(season[1]), episodes: eps });
  }
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

// src/embed69.js
var SITE = "https://embed69.org";
var MAX_DIFFICULTY = 4;
var POW_CAP = 1e5;
function solvePow(kino2, challenge, difficulty, cap = POW_CAP) {
  const zeros = "0".repeat(difficulty);
  for (let n = 0; n <= cap; n++) if (kino2.crypto.hash("sha256", challenge + n).startsWith(zeros)) return n;
  return null;
}
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
  const challenge = quoted(html, "POW_CHALLENGE"), salt = quoted(html, "POW_SALT");
  const difficulty = Number((/POW_DIFFICULTY\s*=\s*(\d+)/.exec(html) || [])[1]);
  if (!data || !challenge || salt == null || !Number.isInteger(difficulty) || difficulty > MAX_DIFFICULTY) return [];
  let langs;
  try {
    langs = JSON.parse(data[1]);
  } catch (_) {
    return [];
  }
  const n = solvePow(kino2, challenge, difficulty);
  if (n == null) return [];
  const keyHex = kino2.crypto.hash("sha256", challenge + n + salt);
  const rows = [];
  for (const l of langs) {
    for (const e of l && l.sortedEmbeds || []) {
      if (!e || e.servername === "download" || typeof e.link !== "string") continue;
      try {
        rows.push({ lang: String(l.video_language || ""), server: String(e.servername || ""), url: decryptLink(kino2, keyHex, e.link) });
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
    let r;
    try {
      r = await req(url, { headers: url.startsWith(SITE) ? {} : { Referer: new URL(url).origin + "/" } });
    } catch (_) {
      continue;
    }
    if (!r.ok) continue;
    const rows = serversOf(kino2, await r.text());
    if (rows.length) return rows;
  }
  return [];
}

// src/extractors/vidhide.js
var vidhide_exports = {};
__export(vidhide_exports, {
  HOSTS: () => HOSTS,
  extract: () => extract
});

// src/util/unpack.js
var ALPHA = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
var toNum = (s, radix) => [...s].reduce((n, ch) => n * radix + ALPHA.indexOf(ch), 0);
function unpack(source) {
  const m = /}\s*\(\s*'((?:\\'|[^'])*)'\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*'((?:\\'|[^'])*)'\.split\('\|'\)/.exec(source || "");
  if (!m) return null;
  const payload = m[1].replace(/\\'/g, "'");
  const radix = Number(m[2]);
  const keys = m[4].split("|");
  if (radix < 2 || radix > 62) return null;
  return payload.replace(/\b[0-9a-zA-Z]+\b/g, (w) => {
    const i = toNum(w, radix);
    return Number.isInteger(i) && i >= 0 && keys[i] ? keys[i] : w;
  });
}

// src/extractors/shared.js
var HLS_MIME = "application/vnd.apple.mpegurl";
function fileM3u8(text2, base) {
  const m = /\bfile\s*:\s*["']([^"']+\.m3u8[^"']*)["']/.exec(text2 || "");
  return m ? absolute(m[1], base) : null;
}
function hlsKey(text2, keys, base) {
  for (const k of keys) {
    const m = new RegExp(`["']${k}["']\\s*:\\s*["']([^"']+)["']`).exec(text2 || "");
    if (m) return absolute(m[1].replace(/\\\//g, "/"), base);
  }
  return null;
}
function absolute(href, base) {
  try {
    return new URL(href, base).href;
  } catch (_) {
    return null;
  }
}
function findIn(html, pick) {
  return pick(html) || pick(unpack(html) || "") || null;
}
function miss(kino2, server, reason) {
  if (kino2 && typeof kino2.log === "function") kino2.log("[serieskao]", server, reason);
  return null;
}
async function pageText(req, url, headers, kino2, server) {
  const r = await req(url, { headers });
  return r.ok ? r.text() : miss(kino2, server || "embed", "status " + r.status);
}
var LANG_CODES = [
  [/^(español|espanol|spanish|castellano|latino|spa|esp?)\b/i, "es"],
  [/^(english|inglés|ingles|eng?)\b/i, "en"],
  [/^(portugu[eê]s|portuguese|pt)\b/i, "pt"],
  // never a bare "por": "Por defecto" is not Portuguese
  [/^(fran[cç]ais|french|franc[eé]s|fre|fra|fr)\b/i, "fr"],
  [/^(italiano|italian|ita|it)\b/i, "it"],
  [/^(deutsch|german|alem[aá]n|ger|deu|de)\b/i, "de"]
];
function langCode(label) {
  const s = String(label || "").trim();
  for (const [re, code] of LANG_CODES) if (re.test(s)) return code;
  return null;
}
function captionTracks(text2, base) {
  const m = /["']?\btracks["']?\s*:\s*\[([\s\S]*?)\]/.exec(text2 || "");
  if (!m) return [];
  const out = [];
  for (const [obj] of m[1].matchAll(/\{[^{}]*\}/g)) {
    const field = (k) => (new RegExp(`["']?${k}["']?\\s*:\\s*["']([^"']*)["']`).exec(obj) || [])[1] || "";
    const kind = field("kind").toLowerCase();
    if (kind && kind !== "captions" && kind !== "subtitles") continue;
    const file = field("file");
    const format = (/\.(vtt|srt)(?:[?#]|$)/i.exec(file) || [])[1];
    const label = field("label");
    const lang = langCode(label);
    const url = format && lang ? absolute(file, base) : null;
    if (!url || out.some((t2) => t2.url === url)) continue;
    out.push({ lang, url, label, format: format.toLowerCase() });
  }
  return out;
}
function durationMsOf(text2) {
  const re = /(?<![-\w])duration["']?\s*:\s*["']?(\d+(?:\.\d+)?)(?![\d.])(?!\s*m?s\b)/g;
  for (const m of String(text2 || "").matchAll(re)) {
    const ms = Math.round(Number(m[1]) * 1e3);
    if (ms >= 6e4) return ms;
  }
  return null;
}
function pageExtras(html, base) {
  const unpacked = unpack(html) || "";
  const subs = captionTracks(html, base);
  const subtitles = subs.length ? subs : captionTracks(unpacked, base);
  const durationMs = durationMsOf(html) || durationMsOf(unpacked);
  return { ...subtitles.length ? { subtitles } : {}, ...durationMs ? { durationMs } : {} };
}

// src/extractors/vidhide.js
var HOSTS = ["vidhide.com", "vidhidepro.com", "vidhideplus.com", "vidhidefast.com", "dintezuvio.com", "minochinos.com", "filelions.to", "morencius.com"];
async function extract(embedUrl, req, kino2) {
  const u = new URL(embedUrl);
  const html = await pageText(req, embedUrl, { Referer: u.origin + "/" }, kino2, "vidhide");
  if (html == null) return null;
  const url = findIn(html, (t2) => hlsKey(t2, ["hls4", "hls2"], u.origin) || fileM3u8(t2, u.origin));
  if (!url) return miss(kino2, "vidhide", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { Referer: u.origin + "/", Origin: u.origin }, ...pageExtras(html, u.origin) };
}

// src/extractors/voe.js
var voe_exports = {};
__export(voe_exports, {
  HOSTS: () => HOSTS2,
  decodeVoe: () => decodeVoe,
  extract: () => extract2
});
var HOSTS2 = ["voe.sx"];
var JUNK = ["@$", "^^", "~@", "%?", "*~", "!!", "#&"];
var rot13 = (s) => s.replace(/[a-z]/gi, (c) => {
  const b = c <= "Z" ? 65 : 97;
  return String.fromCharCode((c.charCodeAt(0) - b + 13) % 26 + b);
});
function decodeVoe(enc) {
  let s = rot13(enc);
  for (const j of JUNK) s = s.split(j).join("");
  s = atob(s);
  s = [...s].map((c) => String.fromCharCode(c.charCodeAt(0) - 3)).join("");
  s = [...s].reverse().join("");
  return JSON.parse(decodeURIComponent(escape(atob(s))));
}
var redirectOf = (html) => (/window\.location\.href\s*=\s*'([^']+)'/.exec(html) || [])[1] || null;
var humanCheck = (html) => /altcha|Confirm you(?:'|&#0?39;|’)re human/i.test(html);
async function extract2(embedUrl, req, kino2) {
  const log = (...a) => {
    if (kino2) kino2.log("[voe]", ...a);
  };
  const first = await req(embedUrl, { headers: { Referer: embedUrl } });
  if (!first.ok) {
    log("embed", first.status);
    return null;
  }
  let html = first.text();
  const next = redirectOf(html);
  if (next) {
    try {
      const r = await req(next, { headers: { Referer: embedUrl } });
      if (!r.ok) {
        log("player", r.status);
        return null;
      }
      html = r.text();
    } catch (e) {
      if (e && e.code === "host_not_allowed") {
        log("rotating host not reachable here");
        return void 0;
      }
      throw e;
    }
  }
  if (humanCheck(html)) {
    log("human check");
    return null;
  }
  const j = /<script type="application\/json">\s*\["([^"]+)"\]/.exec(html);
  if (j) {
    try {
      const d = decodeVoe(j[1]);
      const url = d.source || d.direct_access_url;
      if (url) return { url, mime: /\.mp4(?:[?#]|$)/.test(url) ? "video/mp4" : HLS_MIME, headers: { Referer: embedUrl } };
    } catch (_) {
    }
  }
  const h = /'hls'\s*:\s*'([^']+)'/.exec(html) || /(https?:\/\/[^"'\s]+\.mp4[^"'\s]*)/.exec(html);
  if (!h) {
    log("no stream in page");
    return null;
  }
  return { url: h[1], mime: /\.mp4(?:[?#]|$)/.test(h[1]) ? "video/mp4" : HLS_MIME, headers: { Referer: embedUrl } };
}

// src/extractors/streamwish.js
var streamwish_exports = {};
__export(streamwish_exports, {
  HOSTS: () => HOSTS3,
  extract: () => extract3
});

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

// src/extractors/streamwish.js
var HOSTS3 = ["embedwish.com", "hlswish.com", "streamwish.com", "streamwish.to", "strwish.com", "wishembed.com", "filelions.com", "hglink.to", "vibuxer.com"];
async function extract3(embedUrl, req, kino2) {
  const u = new URL(embedUrl);
  if (u.hostname === "hglink.to") u.hostname = "vibuxer.com";
  const referer = u.origin + "/";
  const html = await pageText(req, u.href, { Referer: referer }, kino2, "streamwish");
  if (html == null) return null;
  const url = findIn(html, (t2) => hlsKey(t2, ["hls4", "hls2", "hls3"], u.origin) || fileM3u8(t2, u.origin));
  if (!url) return miss(kino2, "streamwish", "no playlist in page");
  return { url, mime: HLS_MIME, headers: { "User-Agent": UA, Referer: referer }, ...pageExtras(html, u.origin) };
}

// src/extractors/index.js
var TABLE = { vidhide: vidhide_exports, streamwish: streamwish_exports, voe: voe_exports };
function extractorFor(embedUrl) {
  let host;
  try {
    host = new URL(embedUrl).hostname.replace(/^www\./, "");
  } catch (_) {
    return null;
  }
  for (const [name, mod] of Object.entries(TABLE)) {
    if (mod.HOSTS.some((h) => host === h || host.endsWith("." + h))) return { name, extract: mod.extract };
  }
  return null;
}
var HOSTS4 = Object.values(TABLE).flatMap((m) => m.HOSTS);

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
async function playable(kino2, out, ms = 6e3) {
  try {
    const r = await kino2.fetch(out.url, { headers: { ...out.headers || {} }, timeoutMs: ms });
    return r.ok || r.status === 401 || r.status === 403;
  } catch (e) {
    return !!(e && e.code === "host_not_allowed");
  }
}

// src/plugin.js
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
    noEpisodes: "No se encontraron episodios de esta serie.",
    noStreams: "Ning\xFAn servidor de este t\xEDtulo abri\xF3. Prueba m\xE1s tarde.",
    statusLine: "Sitio: {host} \xB7 Listas guardadas: {n}",
    cacheCleared: "Cach\xE9 vaciada."
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
    noEpisodes: "No episodes found for this series.",
    noStreams: "No server of this title opened. Try again later.",
    statusLine: "Site: {host} \xB7 Lists kept: {n}",
    cacheCleared: "Cache cleared."
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
  series: { path: "/series", titleKey: "recentSeries", genre: "series" },
  seriesPop: { path: "/series/populares", titleKey: "popularSeries", genre: "series" },
  animes: { path: "/animes", titleKey: "recentAnime", genre: "anime" },
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
  const items = cards.slice(0, 20).map((c) => toItem(c, def.genreName));
  return items.length ? { id, title: def.title, items, ref, genre: genre || def.genre || "series" } : null;
}
async function home() {
  return (await Promise.all([
    safeRow("series", () => rowOf("series", "list:series")),
    safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")),
    safeRow("animes", () => rowOf("animes", "list:animes")),
    safeRow("dorama", () => rowOf("dorama", "genre:dorama", "doramas")),
    safeRow("seriesPop", () => rowOf("seriesPop", "list:seriesPop")),
    safeRow("populares", () => rowOf("populares", "list:populares"))
  ])).filter(Boolean);
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
  if (chosen === "novedades") rows = await Promise.all([safeRow("series", () => rowOf("series", "list:series")), safeRow("peliculas", () => rowOf("peliculas", "list:peliculas")), safeRow("animes", () => rowOf("animes", "list:animes"))]);
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
  const cost = (s) => !extractorFor(s.url) ? 2 : /vidhide/i.test(s.server) ? 1 : 0;
  const rank = (s) => (lang(s) === pref ? 0 : lang(s) === "lat" ? 1 : lang(s) === "cast" ? 2 : 3) * 3 + cost(s);
  return rows.map((s, i) => ({ ...s, i })).sort((a, b) => rank(a) - rank(b) || a.i - b.i).slice(0, MAX_COPIES);
}
async function open(server, req, budget) {
  const ex = extractorFor(server.url);
  if (ex) {
    const out = await ex.extract(server.url, req, kino);
    if (out !== void 0) return out;
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
async function resolve(ref) {
  const m = /^c:(.+)@(\d+)$/.exec(String(ref || ""));
  const base = m ? m[1] : String(ref || "");
  const only = m ? Number(m[2]) : null;
  const pageUrl = pageOf(base, site());
  if (!pageUrl) throw kino.error("not_found", "unknown ref: " + ref);
  const req = makeReq(kino, { deadline: Date.now() + RESOLVE_MS });
  const servers2 = await serversOf2(pageUrl, req);
  if (!servers2.length) throw kino.error("not_found", "no servers on " + pageUrl, { userMessage: t("noStreams") });
  const budget = { captures: MAX_CAPTURES };
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
      if (!out.captured && !await playable(kino, { url: out.url, headers: { "User-Agent": UA, ...out.headers || {} } })) {
        failures.push(`${s.server}: address does not answer`);
        continue;
      }
      const stream = { url: out.url, mime: out.mime, headers: { "User-Agent": UA, ...out.headers || {} }, label: labelOf(s) };
      if (out.subtitles) stream.subtitles = out.subtitles;
      if (out.durationMs) stream.durationMs = out.durationMs;
      if (only == null) {
        const others = servers2.map((_, j) => j).filter((j) => j !== i);
        if (others.length) stream.alternatives = others.map((j) => ({ ref: `c:${base}@${j}`, label: labelOf(servers2[j]) }));
      }
      return stream;
    } catch (e) {
      failures.push(`${s.server}: ${e && e.code || ""} ${e && e.message || e}`.trim());
    }
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
export {
  action,
  browse,
  categories,
  details,
  episodes,
  home,
  resolve,
  search,
  section,
  settingsStatus
};
