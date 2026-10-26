// Embed69 (https://embed69.org/f/<imdb>[-<s>x<ee>]): per language, the hosts that carry the title. Their links are AES-256-CBC encrypted and the key
// comes from a small proof of work whose challenge, difficulty and salt sit in the page (adapted from the Kino plugins "Embed 69" and "SoloLatino", same author).

const SITE = "https://embed69.org";
const MAX_DIFFICULTY = 4;
const POW_CAP = 100000;

export function solvePow(kino, challenge, difficulty, cap = POW_CAP) {
  const zeros = "0".repeat(difficulty);
  for (let n = 0; n <= cap; n++) if (kino.crypto.hash("sha256", challenge + n).startsWith(zeros)) return n;
  return null;
}

/** A link is base64 of 16 IV bytes followed by the AES-256-CBC ciphertext. */
export function decryptLink(kino, keyHex, b64) {
  const raw = atob(b64);
  let ivHex = "";
  for (let i = 0; i < 16; i++) ivHex += raw.charCodeAt(i).toString(16).padStart(2, "0");
  return kino.crypto.decrypt("aes-256-cbc", { key: keyHex, keyEncoding: "hex", iv: ivHex, ivEncoding: "hex", data: btoa(raw.slice(16)) });
}

const quoted = (html, name) => { const m = new RegExp(name + "\\s*=\\s*'([^']*)'").exec(html); return m ? m[1] : null; };

/** The decrypted servers of a page's HTML: `[{ lang: "LAT"|"SUB"|"CAST", server, url }]`; [] when the page carries none. */
export function serversOf(kino, html) {
  const data = /let\s+dataLink\s*=\s*(\[.+\]);/.exec(html);
  const challenge = quoted(html, "POW_CHALLENGE"), salt = quoted(html, "POW_SALT");
  const difficulty = Number((/POW_DIFFICULTY\s*=\s*(\d+)/.exec(html) || [])[1]);
  if (!data || !challenge || salt == null || !Number.isInteger(difficulty) || difficulty > MAX_DIFFICULTY) return [];
  let langs;
  try { langs = JSON.parse(data[1]); } catch (_) { return []; }
  const n = solvePow(kino, challenge, difficulty);
  if (n == null) return [];
  const keyHex = kino.crypto.hash("sha256", challenge + n + salt);
  const rows = [];
  for (const l of langs) {
    for (const e of (l && l.sortedEmbeds) || []) {
      if (!e || e.servername === "download" || typeof e.link !== "string") continue;
      try { rows.push({ lang: String(l.video_language || ""), server: String(e.servername || ""), url: decryptLink(kino, keyHex, e.link) }); } catch (_) { /* a link that does not decrypt is skipped */ }
    }
  }
  return rows;
}

/**
 * The servers of a title by its player id (`tt…` or `tt…-<s>x<ee>`): Embed69's own page first and, when that answers nothing, the same
 * page as the title's site serves it (`fallbackUrl`, which carries the same links behind the same proof of work).
 */
export async function servers(kino, req, id, fallbackUrl) {
  const urls = [`${SITE}/f/${id}`];
  if (fallbackUrl) urls.push(fallbackUrl);
  for (const url of urls) {
    let r;
    try { r = await req(url, { headers: url.startsWith(SITE) ? {} : { Referer: new URL(url).origin + "/" } }); } catch (_) { continue; }
    if (!r.ok) continue;
    const rows = serversOf(kino, await r.text());
    if (rows.length) return rows;
  }
  return [];
}
