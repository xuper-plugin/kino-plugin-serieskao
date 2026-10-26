import test from "node:test";
import assert from "node:assert/strict";
import { parseCards, parsePager, parseTitle, parsePlayerId, parseLatestEpisodes, hasEpisodes, pageOf } from "../src/serieskao.js";

const CARD = (href, title, year, type, rating = "7.3") => `<article class="card">
   <a href="/${href}" class="card__link">
      <figure class="card__poster">
         <img src="https://image.tmdb.org/t/p/w300/x.jpg" alt="${title}" loading="lazy" width="185" height="278" />
         <span class="card__rating"><svg width="10" height="10"><path d="M12 2z"/></svg> ${rating}</span>
         <div class="card__badges">
            <span class="card__badge card__badge--type">${type}</span>
            ${year ? `<span class="card__badge card__badge--year">${year}</span>` : ""}
         </div>
      </figure>
      <h2 class="card__title">${title}</h2>
   </a>
</article>`;

test("parseCards reads code, slug, kind, year, poster and rating", () => {
  const cards = parseCards(CARD("serie/las-hijas-Kl42uo", "Las hijas &amp; co", 2025, "SER") + CARD("pelicula/clayface-tZ92Wp", "Clayface", null, "PEL", "7.36") + CARD("anime/tank-chair-NP52wz", "Tank Chair", 2016, "ANI"));
  assert.equal(cards.length, 3);
  assert.deepEqual(cards[0], { code: "s", slug: "las-hijas-Kl42uo", kind: "series", title: "Las hijas & co", year: 2025, poster: "https://image.tmdb.org/t/p/w300/x.jpg", rating: 7.3 });
  assert.deepEqual([cards[1].code, cards[1].kind, cards[1].year, cards[1].rating], ["m", "movie", undefined, 7.36]);
  assert.deepEqual([cards[2].code, cards[2].kind], ["a", "series"]);
});

test("parseCards keeps a slug that starts with a dash and drops a title that appears twice", () => {
  const cards = parseCards(CARD("serie/-Gc1VL6", "Rara", 2020, "SER") + CARD("serie/-Gc1VL6", "Rara", 2020, "SER"));
  assert.equal(cards.length, 1);
  assert.equal(cards[0].slug, "-Gc1VL6");
});

test("parsePager reads the page and the page count, and 1 of 1 without a pager", () => {
  assert.deepEqual(parsePager('<span class="pagination__info">Página 2 de 147</span>'), { page: 2, pages: 147 });
  assert.deepEqual(parsePager("<html></html>"), { page: 1, pages: 1 });
});

const SERIES = `<section class="detail-hero">
   <div class="detail-hero__bg"><img src="https://image.tmdb.org/t/p/original/bg.jpg" alt="Blue Lights" /></div>
   <div class="container detail-hero__inner">
      <figure class="detail-hero__poster"><img src="https://image.tmdb.org/t/p/original/poster.jpg" alt="Blue Lights" /></figure>
      <div class="detail-hero__info">
         <h1 class="detail-hero__title">Blue Lights</h1>
         <div class="detail-hero__meta">
            <span class="detail-hero__type">Serie</span>
            <span>2023</span>
            <span class="detail-hero__rating"><svg width="12" height="12"><path d="M12 2z"/></svg> 7.562</span>
         </div>
         <h2 class="detail-hero__desc">Policías &amp; novatos en Belfast.</h2>
         <div class="detail-hero__genres">
            <a href="/generos/crimen" class="detail-hero__genre">Crimen</a>
            <a href="/generos/drama" class="detail-hero__genre">Drama</a>
         </div>
      </div>
   </div>
</section>
<div class="episodes-list hidden" id="season-1">
   <a href="/serie/blue-lights-g7rV8u/temporada/1/capitulo/1" class="episode-item"><span class="episode-item__number">1</span><span class="episode-item__title">El código</span></a>
   <a href="/serie/blue-lights-g7rV8u/temporada/1/capitulo/2" class="episode-item"><span class="episode-item__number">2</span><span class="episode-item__title">Lote &amp; más</span></a>
</div>
<div class="episodes-list hidden" id="season-2">
   <a href="/serie/blue-lights-g7rV8u/temporada/2/capitulo/1" class="episode-item"><span class="episode-item__number">1</span><span class="episode-item__title"></span></a>
</div>`;

test("parseTitle reads a series page and its seasons", () => {
  const p = parseTitle(SERIES);
  assert.equal(p.title, "Blue Lights");
  assert.equal(p.year, 2023);
  assert.equal(p.rating, 7.562);
  assert.equal(p.overview, "Policías & novatos en Belfast.");
  assert.deepEqual(p.genres, ["Crimen", "Drama"]);
  assert.equal(p.poster, "https://image.tmdb.org/t/p/original/poster.jpg");
  assert.equal(p.backdrop, "https://image.tmdb.org/t/p/original/bg.jpg");
  assert.deepEqual(p.seasons.map((s) => [s.season, s.episodes.length]), [[1, 2], [2, 1]]);
  assert.deepEqual(p.seasons[0].episodes[1], { season: 1, number: 2, title: "Lote & más" });
});

test("parseTitle of a movie has no seasons and no year when the page omits it", () => {
  const p = parseTitle(SERIES.slice(0, SERIES.indexOf('<div class="episodes-list')).replace("<span>2023</span>", ""));
  assert.equal(p.year, undefined);
  assert.deepEqual(p.seasons, []);
});

test("parseTitle is null without a title", () => assert.equal(parseTitle("<html></html>"), null));

test("parsePlayerId takes the IMDb id, with the episode when there is one", () => {
  assert.equal(parsePlayerId('<div data-url="/vidurl/tt14466018-1x01/"></div>'), "tt14466018-1x01");
  assert.equal(parsePlayerId('<iframe id="player-iframe" src="/vidurl/tt34890576/" frameborder="0">'), "tt34890576");
  assert.equal(parsePlayerId('<div data-url="/vidurl/tt0988824-001/"></div>'), "tt0988824-001"); // an anime episode is numbered from the start
  assert.equal(parsePlayerId('<div data-url="https://embed69.org/uqlink.php?id=abc"></div>'), null); // only the site's own player counts
  assert.equal(parsePlayerId("<html></html>"), null);
});

test("pageOf builds the page of a movie and of an episode, and nothing else", () => {
  assert.equal(pageOf("m:clayface-tZ92Wp"), "https://serieskao.top/pelicula/clayface-tZ92Wp");
  assert.equal(pageOf("e:s:blue-lights-g7rV8u:2:3"), "https://serieskao.top/serie/blue-lights-g7rV8u/temporada/2/capitulo/3");
  assert.equal(pageOf("e:a:tank-chair-NP52wz:1:12"), "https://serieskao.top/anime/tank-chair-NP52wz/temporada/1/capitulo/12");
  assert.equal(pageOf("s:blue-lights-g7rV8u"), null);
  assert.equal(pageOf("e:x:slug:1:1"), null);
  assert.equal(pageOf("m:../etc"), null);
});

const LATEST = `<article class="episode-card">
   <a href="https://serieskao.top/serie/doctor-x-ytSHp1/temporada/1/capitulo/5"><figure class="episode-card__poster"><img src="https://image.tmdb.org/t/p/original/a.jpg" alt="x" /><span class="episode-card__badge">T1 E5</span></figure><h3 class="episode-card__title">Doctor X &amp; Co</h3></a>
</article>
<article class="episode-card">
   <a href="/anime/tougen-anki/temporada/2/capitulo/4"><figure class="episode-card__poster"><img src="https://image.tmdb.org/t/p/original/b.jpg" alt="y" /><span class="episode-card__badge">T2 E4</span></figure><h3 class="episode-card__title">Tougen Anki</h3></a>
</article>
<article class="episode-card">
   <a href="https://serieskao.top/serie/doctor-x-ytSHp1/temporada/1/capitulo/4"><h3 class="episode-card__title">Doctor X again</h3></a>
</article>`;

test("parseLatestEpisodes gives one card per series, with the site's own or a relative address", () => {
  const cards = parseLatestEpisodes(LATEST);
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], { code: "s", slug: "doctor-x-ytSHp1", kind: "series", title: "Doctor X & Co", poster: "https://image.tmdb.org/t/p/original/a.jpg", label: "T1 E5" });
  assert.deepEqual([cards[1].code, cards[1].slug, cards[1].label], ["a", "tougen-anki", "T2 E4"]);
});

test("hasEpisodes tells a series with episodes from one the site lists with none", () => {
  assert.equal(hasEpisodes('<a href="/serie/x/temporada/1/capitulo/1" class="episode-item">'), true);
  assert.equal(hasEpisodes("<section class=\"detail-hero\"></section>"), false);
});
