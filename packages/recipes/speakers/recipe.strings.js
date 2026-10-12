// The speakers recipe's own words, by language (decision 0025, core/strings.js). English is the
// base; Konkani is written by Kathakar and waits for a native reader. A key left out shows the
// English, marked lang="en". The keys:
//
//   shown(n)   "Showing 7 speakers"   the count, read once when the track filter changes
//   empty      "No speaker is on that track yet. Try another track, or clear them all."
//              written into .sg-speakers-empty when the page left it blank
//
// The speakers' own words (names, roles, talk titles, the track names) are the page's, in whatever
// language the author writes them.

export const BY_LANG = {
  en: {
    shown: n => (n === 1 ? 'Showing 1 speaker' : `Showing ${n} speakers`),
    empty: 'No speaker is on that track yet. Try another track, or clear them all.',
  },
  // Written by Kathakar, not a native reader; every entry waits for one.
  'gom-Deva': {
    shown: n => (n === 1 ? '1 उलोवपो दाखयला' : `${n} उलोवपी दाखयल्यात`),
    empty: 'ह्या विभागांत अजून कोणूच उलोवपी ना. दुसरो विभाग वेंचात, वा सगळ्यांची निवड काडून उडयात.',
  },
  'gom-Latn': {
    shown: n => (n === 1 ? '1 ulovpo dakhoilo' : `${n} ulovpi dakhoilyat`),
    empty: 'Ha vibhagant ajun konuch ulovpi na. Dusro vibhag venchat, va sogllyanchi nivod kadun udoyat.',
  },
};
