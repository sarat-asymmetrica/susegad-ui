// The proposal's own words: what the page adds around the Markdown. Shared by
// the page builder (proposal.page.js) and the live page (proposal.js).

/** Every word the page adds around the Markdown. Kathakar edits these. */
export const STRINGS = {
  for: 'For',
  from: 'From',
  date: 'Date',
  holds: 'Holds until',
  keep: 'Print or save a signed copy',
  signed: (option, name) => `Signed${name ? ` by ${name}` : ''}${option ? ` for option ${option}` : ''}. Print or save this page to keep a copy.`,
  unsigned: 'Not signed yet.',
};
