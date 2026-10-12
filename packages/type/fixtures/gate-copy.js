// The copy the text gate (rung 4 of docs/GOAL-TEXT-TIER.md) lays into each drawn shape,
// one entry per use of "words in the world", in four languages: English (India), Konkani
// in Devanagari, Konkani in Romi, and Kannada. Plain data, no imports, so Node can load it.
//
// Every English string is copied word for word from the file named in `source`. Every other
// string is a first draft by a non-native writer, for a native reader to check (see READER
// at the bottom and README.md). The translations keep the English meaning and its length;
// none has been padded or trimmed to pass. Digits are ASCII, as in the event template.
//
// Language tags follow decision 0025: gom-Deva, gom-Latn; Kannada is plain kn.

export const COPY = {
  // The chalkboard outside the Taverna: a slotted heading and paragraph laid onto an arch.
  'tinto.board': {
    source: 'packages/scenes/tinto/world.html (the slotted words in each of its three sections; the same words are in demo.html)',
    shape: 'BOARD in packages/scenes/tinto/model.js, read through slateOf()',
    blocks: {
      'en-IN': [
        { tag: 'h2', text: 'Come for the rain' },
        { tag: 'p', text: 'Our lowest rate, June to September. The veranda stays dry and the paddy turns green.' },
      ],
      'gom-Deva': [
        { tag: 'h2', text: 'पावसाखातीर येयात' },
        { tag: 'p', text: 'आमचो सगळ्यांत कमी दर, जून थावन सप्टेंबर मेरेन. वरांडो सुको रावता आनी भाताचीं शेतां हिरवीं जातात.' },
      ],
      'gom-Latn': [
        { tag: 'h2', text: 'Pavsakhatir yeyat' },
        { tag: 'p', text: 'Amcho sogllyant kommi dor, Zun thavn Setembor meren. Varando suko ravta ani bhatachim xetam hirvim zatat.' },
      ],
      kn: [
        { tag: 'h2', text: 'ಮಳೆಗಾಲಕ್ಕೆ ಬನ್ನಿ' },
        { tag: 'p', text: 'ನಮ್ಮ ಅತಿ ಕಡಿಮೆ ದರ, ಜೂನ್‌ನಿಂದ ಸೆಪ್ಟೆಂಬರ್‌ವರೆಗೆ. ಜಗುಲಿ ಒಣಗಿರುತ್ತದೆ, ಭತ್ತದ ಗದ್ದೆ ಹಸಿರಾಗುತ್ತದೆ.' },
      ],
    },
  },

  // The shops' plaques: the hours label under each sign, and the detail card a press opens.
  // `labels` is the plaque text (SHOPS[].info), in the order mercado, padaria, taverna.
  'tinto.plaques': {
    source: 'SHOPS in packages/scenes/tinto/model.js (info and detail), laid out by packages/type/junctions.js',
    ids: ['mercado', 'padaria', 'taverna'],
    // Shop names are proper nouns, painted on the signs in the drawing. They stay as written
    // (Mercado, Padaria, Taverna) in every language: Goan shop signs are in Roman letters
    // whatever language the customer speaks, and poi and pão are the words the bakery uses.
    // A transliteration would put Devanagari or Kannada on a sign that is drawn in Roman,
    // and the screen-reader name would stop matching what a sighted visitor sees.
    signs: {
      'en-IN': ['Mercado', 'Padaria', 'Taverna'],
      'gom-Deva': ['Mercado', 'Padaria', 'Taverna'],
      'gom-Latn': ['Mercado', 'Padaria', 'Taverna'],
      kn: ['Mercado', 'Padaria', 'Taverna'],
    },
    labels: {
      'en-IN': ['Open 7 to 1', 'Poi at 6 and 4', 'Opens at 11'],
      'gom-Deva': ['7 ते 1 उगडें', 'पोई 6 आनी 4 वरां', '11 वरां उगडता'],
      'gom-Latn': ['Ugddem 7 te 1', 'Poi 6 ani 4 voram', '11 voram ugddta'],
      kn: ['7ರಿಂದ 1ರವರೆಗೆ ತೆರೆದಿದೆ', 'ಪೋಯಿ 6 ಮತ್ತು 4ಕ್ಕೆ', '11ಕ್ಕೆ ತೆರೆಯುತ್ತದೆ'],
    },
    details: {
      'en-IN': [
        'Fish before nine, vegetables all morning, and kokum and cashews in season. Closed on Sundays.',
        'Two bakes a day: poi and pão at six in the morning, and again at four for tea.',
        'Cashew feni, cold beer and fish curry rice, from eleven until late. The clock says two minutes to.',
      ],
      'gom-Deva': [
        'नव वरां आदीं मासळी, सगळी सकाळ भाजी, आनी हंगामांत आमसोलां आनी काजू. आयतारा बंद आसता.',
        'दिसाक दोन फावट ताजें: सकाळीं सा वरांक पोई आनी पांव, आनी चाय वेळार परत चारांक.',
        'काजू फेणी, थंड बियर आनी मासळीचें हुमण-भात, 11 वरांसावन रात मेरेन. घड्याळ म्हणटा, 11 जावपाक दोन मिनटां.',
      ],
      'gom-Latn': [
        'Nov voram adim mhasoli, sogli sokal bhaji, ani hongamant amsolam ani kaju. Aytara bond asta.',
        'Disak don favot tazem: sokallim sa voranc poi ani pav, ani chai velar porot charank.',
        'Kajuchi feni, thondd bear ani mhasolicho humon-bhat, 11 voranpasun rati meren. Ghoddeall mhonta, 11 zavpak don minttam.',
      ],
      kn: [
        'ಒಂಬತ್ತು ಗಂಟೆಗೆ ಮೊದಲು ಮೀನು, ಇಡೀ ಬೆಳಗ್ಗೆ ತರಕಾರಿ, ಕಾಲಕ್ಕೆ ತಕ್ಕಂತೆ ಪುನರ್ಪುಳಿ ಮತ್ತು ಗೋಡಂಬಿ. ಭಾನುವಾರ ಮುಚ್ಚಿರುತ್ತದೆ.',
        'ದಿನಕ್ಕೆ ಎರಡು ಬಾರಿ ಬೇಯಿಸುತ್ತಾರೆ: ಬೆಳಗ್ಗೆ ಆರಕ್ಕೆ ಪೋಯಿ ಮತ್ತು ಪಾವ್, ಮತ್ತೆ ಚಹಾ ಹೊತ್ತಿಗೆ ನಾಲ್ಕಕ್ಕೆ.',
        'ಗೋಡಂಬಿ ಫೆನಿ, ತಣ್ಣನೆಯ ಬಿಯರ್ ಮತ್ತು ಮೀನು ಸಾರು ಅನ್ನ, ಹನ್ನೊಂದರಿಂದ ತಡರಾತ್ರಿಯವರೆಗೆ. ಗಡಿಯಾರ ಹನ್ನೊಂದಕ್ಕೆ ಇನ್ನೂ ಎರಡು ನಿಮಿಷ ಎನ್ನುತ್ತದೆ.',
      ],
    },
  },

  // The words in the sky beside the banyan: each line stops where the canopy begins.
  'vad.sky': {
    source: 'packages/scenes/vad/world.html (the slotted words in its second section; the demo page has a shorter pair)',
    blocks: {
      'en-IN': [
        { tag: 'h2', text: 'Under the vad' },
        { tag: 'p', text: 'Every village has one: a banyan by the square, older than anyone can remember. Its roots come down from the branches and become new trunks, so the tree walks slowly outward, and its shade walks with it. The stone platform at its foot is where the news is passed on and the afternoon is slept through.' },
      ],
      'gom-Deva': [
        { tag: 'h2', text: 'वडा सकयल' },
        { tag: 'p', text: 'दर एका गांवांत एक आसता: चवकाजवळ एक वड, कोणाकूय याद ना इतलो जुनो. ताचीं मुळां फांट्यां थावन सकयल येतात आनी नवीं खोडां जातात, देखून झाड सावकाश भायर चलता आनी ताची सावळी ताचे वांगडा. ताच्या पांयाक आशिल्लो फातराचो पार थंय खबर एकामेकाक सांगतात आनी दनपार झोंपेंत वता.' },
      ],
      'gom-Latn': [
        { tag: 'h2', text: 'Vodda sokoil' },
        { tag: 'p', text: 'Dor eka gavant ek asta: chovkachea zovl ek vodd, konnakuiy yad na itlo zuno. Tachim mullam phantteam thavn sokoil yetat ani novim khoddam zatat, dekhun zhad savkas bhair chalta ani tachi savlli tachea vangdda. Tachea pangak asllolo phattracho par thoim khobor ekamekak sangtat ani donpar zhopent vota.' },
      ],
      kn: [
        { tag: 'h2', text: 'ಆಲದ ಮರದ ಕೆಳಗೆ' },
        { tag: 'p', text: 'ಪ್ರತಿ ಹಳ್ಳಿಯಲ್ಲೂ ಒಂದು ಇರುತ್ತದೆ: ಚೌಕದ ಬಳಿಯ ಆಲದ ಮರ, ಯಾರಿಗೂ ನೆನಪಿಲ್ಲದಷ್ಟು ಹಳೆಯದು. ಅದರ ಬೇರುಗಳು ಕೊಂಬೆಗಳಿಂದ ಇಳಿದು ಹೊಸ ಕಾಂಡಗಳಾಗುತ್ತವೆ; ಹೀಗೆ ಮರ ನಿಧಾನವಾಗಿ ಹೊರಗೆ ನಡೆಯುತ್ತದೆ, ಅದರ ನೆರಳೂ ಅದರ ಜೊತೆ ನಡೆಯುತ್ತದೆ. ಬುಡದಲ್ಲಿರುವ ಕಲ್ಲಿನ ಕಟ್ಟೆಯಲ್ಲಿ ಸುದ್ದಿ ಹಂಚಿಕೊಳ್ಳುತ್ತಾರೆ, ಮಧ್ಯಾಹ್ನ ನಿದ್ದೆಯಲ್ಲಿ ಕಳೆಯುತ್ತದೆ.' },
      ],
    },
  },

  // The paragraph marked data-flow, which wraps round the turning clay pot (matka).
  'veranda.matka': {
    source: 'packages/scenes/veranda/words.html (the <p data-flow> in the pane)',
    blocks: {
      'en-IN': [
        { tag: 'p', text: 'The clay pot on the seat is where the water is kept cool. It has stood there since before the roof was retiled, and it turns, slowly, when nobody is looking, so that every side of it gets the same share of the evening light.' },
      ],
      'gom-Deva': [
        { tag: 'p', text: 'बाकड्यार आशिल्ल्या मडक्यांत उदक थंड दवरतात. तें छप्पर परत शाकारपाच्या आदींपसून थंय आसा, आनी कोणूच पळयना तेन्ना तें सावकाश फिरता, जाका लागून ताची दरेक कूस सांजेच्या उजवाडाचो सारकोच वांटो घेता.' },
      ],
      'gom-Latn': [
        { tag: 'p', text: 'Bakddear asllea modkeant udok thondd dovortat. Tem chapor porot xakarpachea adinpasun thoim asa, ani konnuch polloyna tednna tem savkas phirta, zaka lagun tachi dorek kus sanzechea ujvaddacho sarkoch vanto ghetta.' },
      ],
      kn: [
        { tag: 'p', text: 'ಕಟ್ಟೆಯ ಮೇಲಿನ ಮಣ್ಣಿನ ಮಡಕೆಯಲ್ಲಿ ನೀರು ತಣ್ಣಗಿರುತ್ತದೆ. ಛಾವಣಿಗೆ ಹೊಸ ಹೆಂಚು ಹಾಕುವ ಮೊದಲಿನಿಂದಲೂ ಅದು ಅಲ್ಲೇ ಇದೆ; ಯಾರೂ ನೋಡದಿದ್ದಾಗ ಅದು ನಿಧಾನವಾಗಿ ತಿರುಗುತ್ತದೆ, ಹೀಗೆ ಅದರ ಪ್ರತಿ ಬದಿಗೂ ಸಂಜೆಯ ಬೆಳಕು ಸಮಾನವಾಗಿ ಸಿಗುತ್ತದೆ.' },
      ],
    },
  },
};

// TEST FIXTURE, NOT CONTENT. Never ship this text, and never add it to COPY.
// It is a Kannada board that is honestly too long for the arch: the kind of fuller notice a
// real shop might chalk up. The text gate must report that it escapes BOARD at the smallest
// legible size (boardSizes() in packages/scenes/tinto/model.js); if it does not, the gate has
// no teeth. Same two blocks as 'tinto.board', so the gate treats it as a replacement for kn.
export const OVERFLOW = {
  'tinto.board': {
    lang: 'kn',
    note: 'Test fixture designed to overflow the Taverna board. Not content.',
    blocks: [
      { tag: 'h2', text: 'ಮಳೆಗಾಲದ ವಿಶೇಷ ದರದಲ್ಲಿ ನಮ್ಮ ಅತಿಥಿಗೃಹಕ್ಕೆ ಬನ್ನಿ' },
      { tag: 'p', text: 'ಜೂನ್‌ನಿಂದ ಸೆಪ್ಟೆಂಬರ್‌ವರೆಗೆ ನಮ್ಮ ಅತಿ ಕಡಿಮೆ ದರ ಇರುತ್ತದೆ, ಮತ್ತು ಆ ದಿನಗಳಲ್ಲಿ ಉಪಾಹಾರ, ಮಧ್ಯಾಹ್ನದ ಊಟ ಮತ್ತು ಸಂಜೆಯ ಚಹಾ ಕೂಡ ಸೇರಿರುತ್ತದೆ. ಜಗುಲಿ ಒಣಗಿರುತ್ತದೆ, ಭತ್ತದ ಗದ್ದೆ ಹಸಿರಾಗುತ್ತದೆ, ಮತ್ತು ಮಳೆ ನೋಡುತ್ತಾ ಕುಳಿತುಕೊಳ್ಳಲು ಎಲ್ಲರಿಗೂ ಜಾಗವಿದೆ. ಕೊಠಡಿ ಕಾದಿರಿಸಲು ಮುಂಚಿತವಾಗಿ ನಮಗೆ ತಿಳಿಸಿ.' },
    ],
  },
};

// The native-reader flag (kathakar A5). Every non-English string above is a draft that no
// native reader has checked. The release does not wait for a reader (the owner's ruling),
// but nothing here counts as reviewed until a name and a date are written in `reviewedBy`.
export const READER = {
  status: 'unreviewed',
  needs: {
    'gom-Deva': { reader: 'a native Goan Konkani reader, Devanagari', reviewedBy: null, covers: 'every gom-Deva string in COPY' },
    'gom-Latn': { reader: 'a native Goan Konkani reader, Romi', reviewedBy: null, covers: 'every gom-Latn string in COPY (the Romi spelling is also a house-style question, see strings.js in the event template)' },
    kn: { reader: 'a native Kannada reader, ideally a coastal (Karavali) one for the Goa setting', reviewedBy: null, covers: 'every kn string in COPY, and the OVERFLOW fixture, which is never shown' },
  },
  doubts: [
    'gom-Latn "Vodda sokoil" and gom-Deva "वडा सकयल": the spelling and case of vad (banyan) in Romi.',
    'gom-Deva "पोई 6 आनी 4 वरां": whether "वरां" alone reads as o\'clock on a plaque, or wants "वरांक".',
    'gom-Latn: the Romi spelling of sibilants and retroflexes (xakarpachea, ghoddeall, ujvaddacho) against the house Romi.',
    'kn "ಪೋಯಿ" and "ಪಾವ್": how a Kannada reader writes the Goan breads; "ಪುನರ್ಪುಳಿ" for kokum.',
    'kn "ಜೂನ್‌ನಿಂದ": the zero-width non-joiner (U+200C) is deliberate and must survive any editor; the shaper should not join across it.',
    'veranda.matka: "the seat" is rendered as a bench (बाकडो) and a platform (ಕಟ್ಟೆ), the nearest Goan and Kannada veranda seats.',
  ],
};
