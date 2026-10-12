// The words of a bubble, apart from its drawing: the kinds and tails it knows and the caption a screen reader gets. Pure and tiny, so the quiet register
// (the element and a one-line skin) never loads the geometry or the drawing code.

export const KINDS = ['speech', 'thought', 'shout'];
export const TAILS = ['bottom-left', 'bottom', 'bottom-right', 'top-left', 'top', 'top-right', 'left', 'right', 'none'];

/** What the speaker is doing, for the caption a screen reader gets when the page gives only a name. {speaker} is replaced. */
export const STRINGS = { speech: '{speaker} says', thought: '{speaker} thinks', shout: '{speaker} shouts' };

/** The tail's name, or 'bottom-left' for one that is not a tail. */
export const tailOf = t => (TAILS.includes(t) ? t : 'bottom-left');
export const kindOf = k => (KINDS.includes(k) ? k : 'speech');

/** The figcaption words for a speaker the page named but did not caption. A `label` of the page's own wins. */
export function captionFor(kind, speaker, label) {
  if (label) return label;
  return speaker ? STRINGS[kindOf(kind)].replace('{speaker}', speaker) : '';
}
