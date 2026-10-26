# SeriesKao para Kino

Plugin de [Kino](https://github.com/kinotvapp/kino-light) para ver **series, anime, doramas y películas** en español de
[serieskao.top](https://serieskao.top/).

> Plugin no oficial. El catálogo y los videos pertenecen a serieskao.top y a los servidores donde están alojados; este plugin solo los
> lista y abre dentro de Kino.

## Instalar

En Kino: **Ajustes ▸ Plugins ▸ Agregar**, y pega:

```
xuper-plugin/kino-plugin-serieskao
```

Kino pide dos permisos en rojo: *abrir páginas web ocultas para encontrar el video* y *reproducir video desde cualquier servidor que
indique*. Hacen falta para VOE, que arma su dirección con JavaScript, y para las direcciones de video que cambian de dominio.

## Qué trae

- **Una sección propia** («SeriesKao») con cinco pestañas —*Novedades*, *Series*, *Películas*, *Anime* y *Doramas*— y un destacado.
- **Inicio** con series, películas y anime recientes, doramas, y series y películas populares.
- **Categorías**: los 19 géneros del sitio, cada uno con su lista por páginas.
- **Búsqueda** (también dentro de una lista), **ficha** con sinopsis, géneros y nota, **temporadas y episodios**, y **descarga**.
  Si Kino conoce la serie por su título, los episodios traen también su imagen y su sinopsis.
- **Ajustes ▸ SeriesKao**: idioma preferido (latino, castellano o subtitulado) y vaciar la caché.
- Las carátulas son las de TMDB que usa el sitio.

## Servidores

La página de cada capítulo o película lleva el reproductor de **Embed69** (la ruta `/vidurl/<imdb>[-<t>x<ee>]` del sitio). Su página lista, por
idioma, los servidores que tienen el título, con los enlaces cifrados (AES-256-CBC) con una clave que sale de una pequeña prueba de trabajo que
la propia página describe. Kino abre el primero que funcione y deja los demás en el menú **Servidor** del reproductor:

| Servidor | Cómo se abre |
| --- | --- |
| StreamWish y VidHide | peticiones normales, sin navegador |
| VOE | peticiones normales y, si su servidor no se alcanza, el navegador oculto de Kino (`kino.browser`) |

Se pide primero a `embed69.org` y, si no contesta nada, la misma página que el sitio sirve en `/vidurl`.

## Límites

- Que haya o no un título depende del sitio, no del plugin.
- Un enlace que el servidor ya borró se salta; si no queda ninguno, el mensaje dice que no abrió ningún servidor.

## Desarrollo

```
npm test            # pruebas sin red
npm run validate    # compila plugin.js y valida el manifiesto con el kit
node sdk/run.mjs ./plugin.js home
node sdk/run.mjs ./plugin.js resolve 'e:s:blue-lights-g7rV8u:1:1'
```

Licencia Apache-2.0 (ver `LICENSE` y `NOTICE`).
