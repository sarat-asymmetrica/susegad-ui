// The postcard page's kit (rung 2a), pure and light enough for the page to import: the words it adds and the one thing it reads
// from the address. Kept apart from postcard-page.core.js, which builds the page's markup at build time.

/**
 * Words the kit adds (rung 2a). Kathakar's words (19 Oct).
 *   hold.line   said under the finished picture shown after Save picture (press and hold)
 */
export const KIT_WORDS = {
  hold: { line: 'If nothing was saved, press and hold the picture and choose to save it.' }, // Kathakar, 19 Oct
};

/**
 * The scene a link asks for: `?scene=<id>`, honoured only when the id is one of the page's own scenes. Nothing else is
 * read from the address, and anything else (no id, a bogus one, a prototype key, an id twice) falls back.
 * @param {string} search  location.search
 * @param {{ name: string }[]} scenes
 * @param {string} fallback
 */
export function sceneFromQuery(search, scenes, fallback) {
  const ids = new URLSearchParams(search).getAll('scene');
  return ids.length === 1 && scenes.some(s => s.name === ids[0]) ? ids[0] : fallback;
}
