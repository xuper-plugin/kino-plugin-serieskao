# Changelog

## 0.1.3

- Home (and every call) leaves at its own budget: Kino waits for every request a call left running before it delivers the answer, so a Home that skipped a slow row was still held until that request ended or retried (measured on users' devices: Home ran 21-34 s with rows logged as skipped, and Kino threw the answer away at 20 s). The plugin now asks Kino to drop what a call leaves running (`globalThis.__kinoDropPendingFetches = true`, read by Kino 0.9.55 and later; an older Kino ignores it), with a test (`test/dropFetches.test.mjs`).

## 0.1.2

- Home answers inside Kino's 20 s. Measured on users' devices (TV boxes and sticks) Home ran 21-26 s and Kino threw the whole answer away: the rows were asked with `Promise.all`, so the slowest site (each request may wait 15 s) decided. Now the rows are asked together and the ones that answer inside 11 s are shown; slow ones go on filling the cache for the next opening, and the last Home that worked is kept (12 h) for when none answers in time (`src/util/home.js`, tests in `test/home.test.mjs`).

## 0.1.1

- The site lists its newest series before they have any episode, and they came first in "Series recientes": opening one ended in "no episodes". Those rows now leave out a series whose page lists no episode, a new row "Últimos episodios" (the site's own latest episodes, so always something to play) comes first, and a title without episodes says so plainly.
  / El sitio lista sus series más nuevas antes de que tengan episodios, y salían primero en «Series recientes»: abrir una terminaba en «no hay episodios». Esas filas ahora dejan fuera una serie cuya página no lista episodios, una fila nueva «Últimos episodios» (los últimos del propio sitio, así que siempre hay algo que reproducir) va primero, y un título sin episodios lo dice claro.

## 0.1.0

- First version: a section of its own with five tabs (news, series, movies, anime, doramas), the home rows, the 19 genres of the site with their paged lists, search (also inside a list), a movie's page, seasons and episodes and downloads. Players are Embed69's: per language, StreamWish, VidHide and VOE, the first that opens plays and the rest wait in the player's Servidor menu. When Kino knows the series by its title, the episodes also carry its stills and synopses.
  / Primera versión: sección propia con cinco pestañas (novedades, series, películas, anime y doramas), las filas de inicio, los 19 géneros del sitio con sus listas por páginas, búsqueda (también dentro de una lista), ficha de película, temporadas y episodios y descargas. Los reproductores son los de Embed69: por idioma, StreamWish, VidHide y VOE; abre el primero que funcione y los demás quedan en el menú Servidor del reproductor. Cuando Kino conoce la serie por su título, los episodios traen además su imagen y sinopsis.
