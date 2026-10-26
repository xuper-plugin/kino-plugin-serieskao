// Parsers for serieskao.top: listing cards, a title's own page (movie, series or anime with its episodes) and the player an episode or movie carries.

/** The address the plugin carries; the person can replace it in the settings when the site moves (`site()` in plugin.js). */
export const DEFAULT_SITE = "https://serieskao.top";

/** Genres of the site's listings (slug, Spanish name). */
export const GENRES = [
  ["accion", "Acción"], ["animacion", "Animación"], ["aventura", "Aventura"], ["belica", "Bélica"], ["ciencia-ficcion", "Ciencia Ficción"],
  ["comedia", "Comedia"], ["crimen", "Crimen"], ["documental", "Documental"], ["dorama", "Dorama"], ["drama", "Drama"],
  ["familia", "Familia"], ["fantasia", "Fantasía"], ["guerra", "Guerra"], ["historia", "Historia"], ["misterio", "Misterio"],
  ["romance", "Romance"], ["suspense", "Suspense"], ["terror", "Terror"], ["western", "Western"],
];

const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#0?39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&nbsp;/g, " ");
const text = (s) => decode(String(s || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();

/** The path segment of each kind of title on the site, and the one-letter code a ref carries for it. */
export const SEGMENT = { m: "pelicula", s: "serie", a: "anime" };
const CODE = { pelicula: "m", serie: "s", anime: "a" };

/** The cards of a listing: `{ code: "m"|"s"|"a", slug, kind: "movie"|"series", title, year, poster, rating }`. */
export function parseCards(html) {
  const out = [];
  const seen = new Set();
  for (const c of String(html || "").split('<article class="card"').slice(1)) {
    const href = /href="\/(pelicula|serie|anime)\/([^"\/?#]+)"/.exec(c);
    if (!href || seen.has(href[1] + href[2])) continue;
    seen.add(href[1] + href[2]);
    const title = /<h\d class="card__title">([\s\S]*?)<\/h\d>/.exec(c);
    const img = /<img[^>]*?src="([^"]+)"/.exec(c);
    const year = /card__badge--year">\s*(\d{4})/.exec(c);
    const rating = /card__rating">[\s\S]*?<\/svg>\s*([\d.]+)/.exec(c);
    out.push({
      code: CODE[href[1]], slug: decodeURIComponent(href[2]), kind: href[1] === "pelicula" ? "movie" : "series",
      title: title ? text(title[1]) : href[2], year: year ? Number(year[1]) : undefined, poster: img ? img[1] : "", rating: rating ? Number(rating[1]) : undefined,
    });
  }
  return out;
}

/** `{ page, pages }` from the pager's "Página 1 de 147"; `pages` is 1 when there is no pager. */
export function parsePager(html) {
  const m = /pagination__info">[^<]*?(\d+)\s+de\s+(\d+)/.exec(String(html || ""));
  return m ? { page: Number(m[1]), pages: Number(m[2]) } : { page: 1, pages: 1 };
}

/** A title's page: overview, year, genres, rating, cover and, for a series or anime, its seasons and episodes. */
export function parseTitle(html) {
  const h = String(html || "");
  const t = /<h1 class="detail-hero__title">([\s\S]*?)<\/h1>/.exec(h);
  if (!t) return null;
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
    title: text(t[1]), overview: desc ? text(desc[1]) : "", year: year ? Number(year[1]) : undefined, rating: rate ? Number(rate[1]) : undefined,
    genres, poster: poster ? poster[1] : "", backdrop: back ? back[1] : "", seasons,
  };
}

/** The player address of an episode or movie page: the IMDb id with, for an episode, its `SxEE` ("tt14466018-1x01") or, for an anime, its absolute number ("tt0988824-001"); null when there is none. */
export function parsePlayerId(html) {
  const m = /data-url="\/vidurl\/(tt\d+(?:-[0-9x]+)?)\/?"/.exec(String(html || "")) || /<iframe[^>]*src="\/vidurl\/(tt\d+(?:-[0-9x]+)?)\/?"/.exec(String(html || ""));
  return m ? m[1] : null;
}

const SLUG = String.raw`[^/?#\s]+`;

/** The page address of a movie ("m:<slug>") or an episode ("e:<s|a>:<slug>:<season>:<episode>"); null for any other ref. */
export function pageOf(ref, site = DEFAULT_SITE) {
  let m = new RegExp(`^m:(${SLUG})$`).exec(ref);
  if (m) return `${site}/pelicula/${encodeURIComponent(m[1])}`;
  m = new RegExp(String.raw`^e:([sa]):(${SLUG}):(\d+):(\d+)$`).exec(ref);
  return m ? `${site}/${SEGMENT[m[1]]}/${encodeURIComponent(m[2])}/temporada/${m[3]}/capitulo/${m[4]}` : null;
}

/** The home page's "Últimos Episodios": one card per series with an episode just added, `{ code, slug, kind: "series", title, poster, label: "T1 E5" }`. */
export function parseLatestEpisodes(html) {
  const out = [];
  const seen = new Set();
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

/** Whether a title's page lists at least one episode (the site also catalogues new series that have none yet). */
export const hasEpisodes = (html) => /\/temporada\/\d+\/capitulo\/\d+"/.test(String(html || ""));
