// The words several components share, by language (decision 0025). English is
// the base. Konkani is written by Kathakar and must be read by a native
// speaker before it ships: a key is checked only when it is in REVIEWED as
// '<tag>:<key>'. Until then `unreviewed()` lists it, and a missing key falls
// back to English.

export const BY_LANG = {
  en: {
    language: 'Language',
    close: 'Close',
    dismiss: 'Dismiss',
    menu: 'Menu',
    mainNav: 'Main navigation',
    siteFooter: 'Site footer',
    copy: 'Copy',
    copied: 'Copied',
    previous: 'Previous',
    next: 'Next',
    loading: 'Loading',
    lastChosen: 'Last chosen',
    openLarger: alt => `${alt}, open larger`,
    aPhotograph: caption => `${caption}, a photograph`,
  },
  // Written by Kathakar, not a native reader. Every entry here waits for one
  // (docs/reviews/2026-10-06-konkani-for-reader.md lists them with the doubts).
  // Devanagari follows the Goa Konkani Akademi's usage; Romi follows the common
  // Roman-script spelling of Goa (x for sh, nn for the nasal in Konknni).
  'gom-Deva': {
    language: 'भास',
    close: 'बंद करचें',
    dismiss: 'सोडून दिवचें',
    menu: 'मेनू',
    mainNav: 'मुखेल',
    siteFooter: 'सायटीचो सकयलो भाग',
    copy: 'नकल करचें',
    copied: 'नकल जाली',
    previous: 'फाटलें',
    next: 'फुडलें',
    loading: 'लोड जायत आसा',
    lastChosen: 'फाटल्या खेपेक वेंचिल्लें',
    openLarger: alt => `${alt}, व्हड करून उगडचें`,
    aPhotograph: caption => `फोटो: ${caption}`,
  },
  'gom-Latn': {
    language: 'Bhas',
    close: 'Bond korchem',
    dismiss: 'Sodun divchem',
    menu: 'Menu',
    mainNav: 'Mukhel',
    siteFooter: 'Sayticho sokoylo bhag',
    copy: 'Nokol korchem',
    copied: 'Nokol zali',
    previous: 'Fatlem',
    next: 'Fudlem',
    loading: 'Lod zaiat asa',
    lastChosen: 'Fatlya khepek venchillem',
    openLarger: alt => `${alt}, vhodd korun ugodchem`,
    aPhotograph: caption => `Foto: ${caption}`,
  },
};

/** '<tag>:<key>' for every entry a native reader has checked. Empty today. */
export const REVIEWED = new Set();
