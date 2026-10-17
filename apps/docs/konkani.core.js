// The home page in Konkani, Devanagari and Romi (decision 0025: one address per language, /, /gom-deva/, /gom-latn/).
//
// EVERY LINE HERE IS A FIRST DRAFT by a writer who is not a native Konkani reader (apps/docs/words/front-door-3-kok.md,
// Kathakar, 8 October 2026). None of it is reviewed, and every page that shows it carries the draft note, in Konkani and
// then in English. Nothing goes into a REVIEWED set until a Goan reader has said it is fine.
//
// Pure: strings in, HTML out. Proper names stay in Latin letters in both columns. What the deck keeps in English on
// purpose (the install command and its npm note, the registry descriptions, the rare fallbacks, "Three ideas", the
// licence) is written with lang="en-IN" so a screen reader switches voice.

export const LANGS = ['gom-Deva', 'gom-Latn'];
/** Where each language's home page lives, relative to the site root (decision 0025's prefix scheme). */
export const HOME_PATH = { 'en-IN': '', 'gom-Deva': 'gom-deva/', 'gom-Latn': 'gom-latn/' };
export const LANG_NAME = { 'en-IN': 'English', 'gom-Deva': 'कोंकणी', 'gom-Latn': 'Konknni' };

const i = lang => (lang === 'gom-Deva' ? 0 : 1);

// [Devanagari, Romi] for every string the Konkani home page and its header show.
const T = {
  skip: ['थेट मजकुराक वचचें', 'Thet mojkurak vochem'],
  brand: ['Susegad UI, मुखेल पान', 'Susegad UI, mukhel pan'],
  navLabel: ['विभाग', 'Vibhag'],
  'nav.showcase': ['प्रदर्शन', 'Prodorxon'],
  'nav.for-teams': ['पंगडां खातीर', 'Pongddam khatir'],
  'nav.developers': ['डेव्हलपर', 'Developer'],
  'nav.start': ['हांगासून सुरू करचें', 'Hangasun suru korchem'],
  'nav.scenes': ['चित्रां', 'Chitram'],
  'nav.components': ['घटक', 'Ghotok'],
  'nav.recipes': ['रेसिपी', 'Resipi'],
  'nav.foundations': ['बुन्याद', 'Bunead'],
  'nav.accessibility': ['सुलभताय', 'Sulobhtay'],
  'nav.pencil-box': ['पेन्सिलीची पेटी', 'Pensilichi peti'],
  'view.button': ['रूप', 'Rup'],
  'view.title': ['ही सायट कशी दिसता', 'Hi sayt koxi dista'],
  'view.register': ['भाव', 'Bhav'],
  'view.intro': ['तेच घटक, तीन भावांनी.', 'Tech ghotok, tin bhavanim.'],
  'view.quiet': ['शांत', 'Xant'],
  'view.quiet.hint': ['साद्यो रेगो, हालचाल उणी.', 'Sadeo rego, halchal unni.'],
  'view.warm': ['उबदार', 'Ubdar'],
  'view.warm.hint': ['हातान काडिल्लें, सावकास हालता.', 'Hatan kaddillem, savkas halta.'],
  'view.playful': ['खेळकार', 'Khellkar'],
  'view.playful.hint': ['गडद रंग, आनी स्पर्शाक जाप दिता.', 'Godd rong, ani sporxak zap dita.'],
  'view.theme': ['थीम', 'Theme'],
  'view.light': ['उजवाड', 'Uzvadd'],
  'view.dark': ['काळोख', 'Kallokh'],
  'view.auto': ['डिव्हायसा प्रमाणें', 'Device pormonnem'],
  'view.close': ['बंद करचें', 'Bond korchem'],
  'view.name': ['रूप', 'Rup'],
  'lang.label': ['भास', 'Bhas'],
  'draft.long': [
    'ह्या पानाचेर कोंकणी हो पयलो मसुदो. मायभास कोंकणी आशिल्ल्या वाचप्यान तो अजून तपासूंक ना.',
    'Hea panacher Konknni ho poilo masudo. Maibhas Konknni asllea vachpean to azun tapasunk na.',
  ],
  'draft.short': ['मसुदो: कोंकणी वाचप्याची वाट पळयता', 'Masudo: Konknni vachpeachi vatt polloita'],
  'hero.kicker': ['गोंयांत कोडान काडिल्ली एक फ्रंट-एंड लायब्ररी', 'Goyant kodan kaddilli ek front-end library'],
  'hero.gloss': ['कोंकणी उतर, पुर्तुगेज {i} वयल्यान.', 'Konknni utor, Purtugez {i} voilean.'],
  'hero.lede': [
    'Susegad UI ही इंटरफेस आनी कागदपत्रांखातीर एक लायब्ररी: सोबीत, आनी तेच वेळार वापरपाक सुखाची. गोंय आनी भारताचीं कोडान काडिल्लीं चित्रां आशिल्ल्या एका स्केचबुकांतल्यान ती वाडली, आनी तांचें कसब तिणें सांबाळ्ळां: तुमचीं उतरां धरपी, कितेंय खरें दाखोवपी आनी वापरप्याक जाप दिवपी चित्रां. दरेक घटक तीन भावांनी मेळटा, तो करपाक एआय एजंटाक दिवंक जाता तो प्रॉम्प्ट ताचे वांगडा येता, आनी ताचो कीबोर्ड आनी स्क्रीन रीडराचो आदार सकयल एका साद्या गाभ्यांत आसता.',
    'Susegad UI hi interface ani kagodpotrankhatir ek library: sobit, ani tech vellar vaparpak sukhachi. Goem ani Bharotachim kodan kaddillim chitram asllea eka sketchbookantlean ti vaddli, ani tanchem kosob tinnem sambhallam: tumchim utram dhorpi, kiteim khorem dakhovpi ani vaparpeak zap divpi chitram. Dorek ghotok tin bhavanim mellta, to korpak AI agentak divunk zata to prompt tache vangdda yeta, ani tacho keyboard ani screen readeracho adhar sokoil eka sadea gabhyant asta.',
  ],
  'hero.caption': ['सुशेगाद: गोंयांतल्या दनपारचें निवांत समाधान.', 'Susegad: Goemchea danparchem nivant somadhan.'],
  'hero.start': ['बांदपाक सुरू करचें', 'Bandpak suru korchem'],
  'hero.scenes': ['चित्रां पळोवचीं', 'Chitram pollovchim'],
  'hero.installLead': ['वा कमांड लायनीसावन पुराय सायट करची:', 'Va command lainisavn purai sayt korchi:'],
  'hero.copy': ['नकल करचें', 'Nokol korchem'],
  'hero.copyName': ['नकल करचें: कमांड', 'Nokol korchem: command'],
  'hero.copied': ['नकल जाली', 'Nokol zali'],
  'hero.copiedAnnounce': ['कमांडीची नकल जाली', 'Commandichi nokol zali'],
  'inside.title': ['भितर कितें आसा', 'Bhitor kitem asa'],
  'inside.intro1': ['दरेक घटकाक स्वताचें पान आसा, ताचो प्रॉम्प्ट आनी ताची इन्स्टॉल ओळ धरून.', 'Dorek ghotokak svotachem pan asa, tacho prompt ani tachi install oll dhorun.'],
  'inside.intro2': ['यादयेंत दरेकाचें थीर चित्र दिसता; पान उगडल्यार तें चलता.', 'Yadient dorekachem thir chitr dista; pan ugodlear tem chalta.'],
  'inside.scenes': ['काम करपी चित्रां, ह्या कोलमा भशेन: दरेक ठिपक्या भोंवतणीं एकूच अखंड रेग.', 'Kam korpi chitram, hea kolama bhaxen: dorek thipkea bhonvtonnim ekuch okhond reg.'],
  'inside.components': ['सकयल कीबोर्ड आनी स्क्रीन रीडराचो आदार, वयर दरेक भावाचें वेगळें रूप.', 'Sokoil keyboard ani screen readeracho adhar, voir dorek bhavachem vegllem rup.'],
  'inside.recipes': ['खऱ्या कामाखातीर एकठांय केल्ले घटक, हंगामाच्या पट्ट्ये सकयल एक बुकिंग भशेन.', 'Khorea kamakhatir ekthaim kelle ghotok, hongamachea pottye sokoil ek booking bhaxen.'],
  'inside.foundations': ['दरेक घटक जाचेर उबो आसा तें. इंजीन ह्या झेंडवाचीं ल्हान फुलां एक एक करून मांडता.', 'Dorek ghotok jacher ubo asa tem. Engine hea zendvachim lhan fulam ek ek korun manddta.'],
  'inside.toy': ['नांवा वयल्यान फूल फुलोवचें', 'Nanva voilean ful fulovchem'],
  'newest.title': ['सगळ्यांत नवें', 'Sogllyant novem'],
  'newest.meta': ['{kind} · {date} सावन लायब्ररींत', '{kind} · {date} savn librarint'],
  'newest.empty': ['नवे घटक लायब्ररींत आयले की हांगा दिसतले.', 'Nove ghotok librarint ayle ki hanga distele.'],
  'kind.scene': ['चित्र', 'Chitr'],
  'kind.component': ['घटक', 'Ghotok'],
  'kind.recipe': ['रेसिपी', 'Resipi'],
  'kind.template': ['साचो', 'Sacho'],
  'kind.package': ['बुन्याद', 'Bunead'],
  'foot.sig': ['Claude आनी Sarat हांणी केलें, Asymmetrica, गोंय, 2026', 'Claude ani Sarat hannim kelem, Asymmetrica, Goem, 2026'],
  'foot.rafe': ['{a}Rafe खातीर{/a}, जाणें आमकां आपली Activa उसणी दिली आनी जो नुस्तें धरूंक गेलो.', '{a}Rafe-khatir{/a}, jannem amkam apli Activa usnni dili ani jo nustem dhorunk gelo.'],
  'foot.src': ['कोड, प्रॉम्प्ट आनी चित्रां {a}GitHub{/a} चेर उक्तीं आसात. तुमकां जाय तें घेयात.', 'Kod, prompt ani chitram {a}GitHub{/a}-cher uktim asat. Tumkam zai tem gheyat.'],
  'foot.licence': ['कोड MIT परवान्याखाला; दस्तावेज CC BY 4.0 खाला.', 'Kod MIT porvanneakhala; dostavej CC BY 4.0 khala.'],
  'foot.privacy': ['हें पान दुसऱ्या कोणाच्याच सर्वराक कांयच मागना, आनी तुमचीं सेटिंगां फकत तुमच्याच ब्राउझरांत दवरता.', 'Hem pan dusrea konnachyach servorak kaimch magona, ani tumchim settingam fokot tumchyach browserant dovorta.'],
  'trust.foot': ['सुलभताय आनी ब्राउझर', 'Sulobhtay ani browser'],
};

const MONTHS = [
  ['जानेवारी', 'फेब्रुवारी', 'मार्च', 'एप्रील', 'मे', 'जून', 'जुलय', 'ऑगस्ट', 'सप्टेंबर', 'ऑक्टोबर', 'नोव्हेंबर', 'डिसेंबर'],
  ['Janer', 'Febrer', 'Mars', 'Abril', 'Mai', 'Jun', 'Julai', 'Agost', 'Setembor', 'Otubor', 'Novembor', 'Dezembor'],
];

/** One string in `lang`. A missing key is a bug in this file, so it throws instead of showing nothing. */
export function tr(lang, key) {
  const row = T[key];
  if (!row) throw new Error(`konkani.core.js: no string called "${key}"`);
  return row[i(lang)];
}

/** The strings the shell needs to announce and rename the View button in Konkani: option names and the two announce stems. */
export const shellStrings = lang => ({
  button: tr(lang, 'view.button'),
  registers: { quiet: tr(lang, 'view.quiet'), warm: tr(lang, 'view.warm'), playful: tr(lang, 'view.playful') },
  themes: { auto: tr(lang, 'view.auto'), light: tr(lang, 'view.light'), dark: tr(lang, 'view.dark') },
  // "Register set to {register}" and "Theme set to {theme}", as the deck words them
  announceRegister: name => (lang === 'gom-Deva' ? `आतां ${name} भाव` : `Atam ${name} bhav`),
  announceTheme: (value, name) => (value === 'auto' ? (lang === 'gom-Deva' ? 'थीम आतां डिव्हायसा प्रमाणें' : 'Theme atam device pormonnem') : (lang === 'gom-Deva' ? `आतां ${name} थीम` : `Atam ${name} theme`)),
  copied: tr(lang, 'hero.copied'),
});

/** "7 October 2026" as day, month, year in `lang` (no weekday, no comma). */
export function kokDate(iso, lang) {
  const [y, m, d] = String(iso).slice(0, 10).split('-').map(Number);
  return `${d} ${MONTHS[i(lang)][m - 1]} ${y}`;
}

const esc = s => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** The draft note: Konkani first, then the English straight after it, so the warning never depends on the line it warns about. */
export const draftNote = (lang, englishNote) => `<p class="draft-note" id="draft-note" role="note"><span lang="${lang}">${esc(tr(lang, 'draft.long'))}</span> <span lang="en-IN">${esc(englishNote)}</span></p>`;

/**
 * A card of Newest in Konkani: the kind and the date in Konkani, the registry's own line in English with lang="en-IN".
 * @param {Array<{ type: string, title: string, description: string, joined: string, href: string }>} items `href` is ready to use
 */
export function kokNewest(items, lang, sentencesOf) {
  const kind = t => tr(lang, `kind.${t === 'surface' ? 'package' : t}`);
  if (!items.length) return `<p class="note">${esc(tr(lang, 'newest.empty'))}</p>`;
  return `<ul class="new-list" role="list">
        ${items.map(it => `<li class="new-item">
          <h3 class="new-title"><a href="${esc(it.href)}" hreflang="en" lang="en-IN">${esc(it.title)}</a></h3>
          <p class="new-meta">${esc(tr(lang, 'newest.meta').replace('{kind}', kind(it.type)).replace('{date}', kokDate(it.joined, lang)))}</p>
          <p lang="en-IN">${esc(sentencesOf(it.description))}</p>
        </li>`).join('\n        ')}
      </ul>`;
}

/** The lede, whole (on a phone the call to action comes before it, so nothing is left out). */
const ledeHtml = lang => esc(tr(lang, 'hero.lede'));

/** `{a}text{/a}` and `{i}` in a string as an anchor and an italic Portuguese word. */
const marked = (s, { href = '', pt = 'sossegado' } = {}) => esc(s)
  .replace('{a}', `<a href="${esc(href)}"${/^https?:/.test(href) ? ' rel="noopener"' : ''}>`).replace('{/a}', '</a>')
  .replace('{i}', `<i lang="pt">${pt}</i>`);

/**
 * The home page's main content in `lang`.
 * @param {{ lang: string, up: string, doors: Array<{ type: string, count: number, art?: string, picture?: string }>, techniques: number, newest: string, ideas: string }} c
 *   `up` is the way back to the site root ('../'); `doors[i].picture` is ready-made <picture> markup; `ideas` is the English
 *   Three ideas section, already carrying lang="en-IN"
 */
export function kokMain(c) {
  const { lang, up } = c;
  const door = d => {
    const key = { scene: 'scenes', component: 'components', recipe: 'recipes', package: 'foundations' }[d.type];
    return `<li class="door door-${d.type}">
          <div class="door-art${d.picture ? '' : ' door-art-plain'}" aria-hidden="true">${d.picture ?? ''}</div>
          <h3 class="door-title"><a href="${up}${key}" hreflang="en">${esc(tr(lang, `nav.${key}`))}</a> <span class="door-count">${d.count}</span></h3>
          <p class="door-line">${esc(tr(lang, `inside.${key}`))}</p>${d.type === 'package' ? `
          <p class="door-toy"><a href="${up}templates#bloom" hreflang="en">${esc(tr(lang, 'inside.toy'))}</a></p>` : ''}
        </li>`;
  };
  return `    ${draftNote(lang, c.englishNote)}
    <section class="mast" aria-labelledby="title">
      <div class="mast-text">
        <p class="kicker">${esc(tr(lang, 'hero.kicker'))}</p>
        <h1 id="title">Susegad <span class="h1-ui">UI</span></h1>
        <p class="gloss">${marked(tr(lang, 'hero.gloss'))}</p>
        <p class="lede">${ledeHtml(lang)}</p>
        <p class="cta">
          <a class="btn btn-solid btn-lg" href="${up}start" hreflang="en">${esc(tr(lang, 'hero.start'))}</a>
          <a class="btn btn-lg" href="${up}scenes" hreflang="en">${esc(tr(lang, 'hero.scenes'))}</a>
        </p>
        <div class="hero-install">
          <p class="hero-install-lead" id="install-lead">${esc(tr(lang, 'hero.installLead'))}</p>
          <p class="install" aria-labelledby="install-lead"><code id="hero-cmd" lang="en-IN">npx @susegad/cli create my-site</code> <button class="copy" type="button" data-copy-text="npx @susegad/cli create my-site" data-announce="${esc(tr(lang, 'hero.copiedAnnounce'))}" aria-label="${esc(tr(lang, 'hero.copyName'))}">${esc(tr(lang, 'hero.copy'))}</button></p>${c.npmNote ?? ''}
        </div>
      </div>
      <figure class="mast-art" id="mast-art">
        <div class="mast-frame" data-frame="proscenium">
          <div class="mast-border" data-slot="border" aria-hidden="true"></div>
          <sg-scene class="mast-stage" id="mast-stage" name="kantar" hero="true" lang="en-IN" label="A tiatr stage: a painted proscenium, footlights, the band in the pit and a red velvet curtain"></sg-scene>
        </div>
        <figcaption class="mast-line" id="mast-line"><span class="mast-ul">${esc(tr(lang, 'hero.caption'))}</span></figcaption>
      </figure>
    </section>

    <section class="library" id="library" aria-labelledby="library-title">
      <div class="section-head">
        <h2 id="library-title" class="section-title">${esc(tr(lang, 'inside.title'))}</h2>
        <p class="section-intro">${esc(tr(lang, 'inside.intro1'))} ${esc(tr(lang, 'inside.intro2'))}</p>
      </div>
      <ul class="doors" role="list">
        ${c.doors.map(door).join('\n        ')}
        <li class="door door-small">
          <div class="door-art door-art-plain" aria-hidden="true"></div>
          <h3 class="door-title"><a href="${up}pencil-box" hreflang="en">${esc(tr(lang, 'nav.pencil-box'))}</a> <span class="door-count">${c.techniques}</span></h3>
        </li>
      </ul>
    </section>

    <section class="newest" aria-labelledby="newest-title">
      <h2 id="newest-title" class="section-title">${esc(tr(lang, 'newest.title'))}</h2>
      ${c.newest}
    </section>

${c.ideas}
`;
}

/** The footer in `lang`: the licence line stays in English after the Konkani, because the English is the one that counts. */
export function kokFoot({ lang, up, github, englishLicence, englishPrivacy }) {
  return `  <footer class="foot wrap">
    <p class="sig">${esc(tr(lang, 'foot.sig'))}</p>
    <p class="for">${marked(tr(lang, 'foot.rafe'), { href: `${up}for-rafe` }).replace('<a href', '<a hreflang="en" href')}</p>
    <p class="src-line">${marked(tr(lang, 'foot.src'), { href: github })}</p>
    <p class="foot-links"><a href="${up}accessibility" hreflang="en">${esc(tr(lang, 'trust.foot'))}</a> <span aria-hidden="true">·</span> <a href="${up}handoff" hreflang="en" lang="en-IN">Handoff</a></p>
    <p>${esc(tr(lang, 'foot.licence'))} <span lang="en-IN">${esc(englishLicence)}</span> ${esc(tr(lang, 'foot.privacy'))}</p>
  </footer>`;
}
