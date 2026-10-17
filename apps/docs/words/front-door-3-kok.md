# The home page in Konkani: Devanagari and Romi

Kathakar, 8 October 2026, for `batch/door`. The home page in three languages (decision 0025: one address per language, `/`, `/gom-deva/`, `/gom-latn/`). The English and the keys are in `front-door-3.md` beside this file; this file gives the two Konkani columns for the strings the home page shows.

**Every Konkani line here is a first draft by a writer who is not a native Konkani reader.** None of it is reviewed. Each page that shows it carries the draft note (`lang.draft`, below). Nothing here goes into a `REVIEWED` set until a Goan reader has said it is fine.

Conventions, the same as the reviewer pack's (6 October):

- **Devanagari (`gom-Deva`):** the Goa Konkani Akademi's usage as I know it: the neuter ending -चें, nasal marks as dots.
- **Romi (`gom-Latn`):** common Goan Roman spelling: x for श, nn for ण, -em for the neuter ending, no diacritics.
- **Buttons and links** use the library's existing form, the verbal noun in -चें (बंद करचें, चित्र चलोवचें, थळ सोदचें), so the site sounds like its own components.
- **Source** says where a string comes from. "strings.table" is `packages/core/strings.table.js`; "event" is `packages/templates/event/strings.js`; "pack" is `docs/reviews/2026-10-06-konkani-for-reader.md`. **New** means I wrote it for this page, and it needs the reader most.
- Proper names stay in Latin letters in both columns: Susegad UI, Claude, Sarat, Asymmetrica, Rafe, Activa, GitHub, MIT, CC BY 4.0, JavaScript. I have not guessed how anyone spells their own name in Devanagari.
- **Kept in English, on purpose,** with `lang="en-IN"` on the element: the install command and its npm note, the registry descriptions in Newest, and the rare fallbacks (no JavaScript, storage off, copy failed). A missing Konkani key falls back to English in the library too, so this matches how it already behaves.

---

## 1. The header

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `skip` | Skip to main content | थेट मजकुराक वचचें | Thet mojkurak vochem | event (`skip`) |
| `brand.name` | Susegad UI, home | Susegad UI, मुखेल पान | Susegad UI, mukhel pan | New. मुखेल from strings.table (`mainNav`) |
| `nav.label` | Sections | विभाग | Vibhag | New. विभाग as in the pack's speakers lines |
| `nav.start` | Start here | हांगासून सुरू करचें | Hangasun suru korchem | New |
| `nav.scenes` | Scenes | चित्रां | Chitram | New. चित्र from event (`play`) |
| `nav.components` | Components | घटक | Ghotok | New |
| `nav.recipes` | Recipes | रेसिपी | Resipi | New, borrowed |
| `nav.foundations` | Foundations | बुन्याद | Bunead | New |
| `nav.pencil-box` | Pencil box | पेन्सिलीची पेटी | Pensilichi peti | New |
| `trust.nav` | Accessibility | सुलभताय | Sulobhtay | New |
| `nav.github` | GitHub | GitHub | GitHub | name |

The Accessibility, Handoff and Browsers pages stay in English. Their links on a Konkani page carry `hreflang="en"`, so a screen reader can say the page it opens is in English.

### The View control

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `view.button` | View | रूप | Rup | New |
| `view.button.name` | View: {register} register, {theme} theme | रूप: {register}, {theme} | Rup: {register}, {theme} | New. Starts with the visible word, for 2.5.3 |
| `view.panel.title` | How this site looks | ही सायट कशी दिसता | Hi sayt koxi dista | New. सायट as in strings.table (`siteFooter`) |
| `view.register.legend` | Register | भाव | Bhav | New |
| `view.register.intro` | The same pieces, in three moods. | तेच घटक, तीन भावांनी. | Tech ghotok, tin bhavanim. | New |
| `view.register.quiet` | Quiet | शांत | Xant | New |
| `view.register.quiet.hint` | Plain lines and little movement. | साद्यो रेगो, हालचाल उणी. | Sadeo rego, halchal unni. | New. उणें from event (`konkani` session) |
| `view.register.warm` | Warm | उबदार | Ubdar | New |
| `view.register.warm.hint` | Drawn by hand, moving gently. | हातान काडिल्लें, सावकास हालता. | Hatan kaddillem, savkas halta. | New. हातान from event (`records`) |
| `view.register.playful` | Playful | खेळकार | Khellkar | New |
| `view.register.playful.hint` | Bright colours, and things answer a tap. | गडद रंग, आनी स्पर्शाक जाप दिता. | Godd rong, ani sporxak zap dita. | New |
| `view.theme.legend` | Theme | थीम | Theme | New, borrowed |
| `view.theme.light` | Light | उजवाड | Uzvadd | New |
| `view.theme.dark` | Dark | काळोख | Kallokh | New |
| `view.theme.system` | Match device | डिव्हायसा प्रमाणें | Device pormonnem | New |
| `view.close` | Close | बंद करचें | Bond korchem | strings.table (`close`) |

Announced when a choice changes. {register} and {theme} are the Konkani option names above.

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `view.announce.register` | Register set to {register} | आतां {register} भाव | Atam {register} bhav | New. आतां from pack (`now`) |
| `view.announce.theme` | Theme set to {theme} | आतां {theme} थीम | Atam {theme} theme | New |
| `view.announce.theme.system` | Theme now matches this device | थीम आतां डिव्हायसा प्रमाणें | Theme atam device pormonnem | New |

`view.nojs` and `view.storage-off` stay in English on the Konkani pages, with `lang="en-IN"`.

### The language switcher

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `lang.label` | Language | भास | Bhas | strings.table (`language`) |
| `lang.en` | English | English | English | lang docs |
| `lang.gom-Deva` | कोंकणी | कोंकणी | कोंकणी | lang docs |
| `lang.gom-Latn` | Konknni | Konknni | Konknni | lang docs |
| `lang.last` | Last chosen | फाटल्या खेपेक वेंचिल्लें | Fatlya khepek venchillem | strings.table (`lastChosen`) |

Each language's name is written in its own script on every page, as the lang docs ask.

### The draft note

There is no Konkani draft note anywhere in the library yet; the lang demo pages show it in English. On a page that is all Konkani, a reader should meet the note in Konkani first. So this one is new, and I suggest showing the English straight after it with `lang="en-IN"`, so the note never depends on the line it is warning about.

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `lang.draft` | The Konkani on this page is a first draft. A native reader has not checked it yet. | ह्या पानाचेर कोंकणी हो पयलो मसुदो. मायभास कोंकणी आशिल्ल्या वाचप्यान तो अजून तपासूंक ना. | Hea panacher Konknni ho poilo masudo. Maibhas Konknni asllea vachpean to azun tapasunk na. | New |
| `lang.draft.short` | Draft, awaiting a native reader | मसुदो: कोंकणी वाचप्याची वाट पळयता | Masudo: Konknni vachpeachi vatt polloita | New |

---

## 2. The hero

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `hero.kicker` | a front-end library, drawn in code in Goa | गोंयांत कोडान काडिल्ली एक फ्रंट-एंड लायब्ररी | Goyant kodan kaddilli ek front-end library | New |
| `hero.title` | Susegad UI | Susegad UI | Susegad UI | name |
| `hero.gloss` | Konkani, from the Portuguese *sossegado*. | कोंकणी उतर, पुर्तुगेज <i>sossegado</i> वयल्यान. | Konknni utor, Purtugez <i>sossegado</i> voilean. | New. The Portuguese word stays in Latin, with `lang="pt"` |
| `hero.lede.1` | Susegad UI is a library for interfaces and documents that are beautiful and comfortable at the same time. | Susegad UI ही इंटरफेस आनी कागदपत्रांखातीर एक लायब्ररी: सोबीत, आनी तेच वेळार वापरपाक सुखाची. | Susegad UI hi interface ani kagodpotrankhatir ek library: sobit, ani tech vellar vaparpak sukhachi. | New |
| `hero.lede.2` | It grew out of a sketchbook of code-drawn studies of Goa and India, and it keeps their craft: drawings that host your words, show something real and answer the person using them. | गोंय आनी भारताचीं कोडान काडिल्लीं चित्रां आशिल्ल्या एका स्केचबुकांतल्यान ती वाडली, आनी तांचें कसब तिणें सांबाळ्ळां: तुमचीं उतरां धरपी, कितेंय खरें दाखोवपी आनी वापरप्याक जाप दिवपी चित्रां. | Goem ani Bharotachim kodan kaddillim chitram asllea eka sketchbookantlean ti vaddli, ani tanchem kosob tinnem sambhallam: tumchim utram dhorpi, kiteim khorem dakhovpi ani vaparpeak zap divpi chitram. | New. उतरां from event (`footer.sign`) |
| `hero.lede.3` | Every piece comes in three registers, ships with the prompt you could give an AI agent to make it, and keeps its keyboard and screen reader support in a plain core underneath. | दरेक घटक तीन भावांनी मेळटा, तो करपाक एआय एजंटाक दिवंक जाता तो प्रॉम्प्ट ताचे वांगडा येता, आनी ताचो कीबोर्ड आनी स्क्रीन रीडराचो आदार सकयल एका साद्या गाभ्यांत आसता. | Dorek ghotok tin bhavanim mellta, to korpak AI agentak divunk zata to prompt tache vangdda yeta, ani tacho keyboard ani screen readeracho adhar sokoil eka sadea gabhyant asta. | New. एआय / AI as event (`meta.title`) |
| `hero.caption` | Susegad: the unhurried contentment of a Goan afternoon. | सुशेगाद: गोंयांतल्या दनपारचें निवांत समाधान. | Susegad: Goemchea danparchem nivant somadhan. | New. दनपार from event (`time.pm`, `lunch`) |

### The call to action

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `hero.cta.start` | Start building | बांदपाक सुरू करचें | Bandpak suru korchem | New |
| `hero.cta.scenes` | Browse the scenes | चित्रां पळोवचीं | Chitram pollovchim | New. पळोवचें from event (`seeAgenda`), plural to agree with चित्रां |
| `hero.install.lead` | Or make a whole site from the command line: | वा कमांड लायनीसावन पुराय सायट करची: | Va command lainisavn purai sayt korchi: | New |
| `hero.install.code` | `npx @susegad/cli create my-site` | (unchanged) | (unchanged) | code |
| `hero.install.copy` | Copy | नकल करचें | Nokol korchem | strings.table (`copy`) |
| `hero.install.copy.name` | Copy the command | नकल करचें: कमांड | Nokol korchem: command | New. Starts with the visible words, for 2.5.3 |
| `hero.install.copied` | Copied | नकल जाली | Nokol zali | strings.table (`copied`) |
| `hero.install.copied.announce` | Copied the command | कमांडीची नकल जाली | Commandichi nokol zali | New |
| `hero.install.npm-note` | (see the English deck) | English, `lang="en-IN"` | English, `lang="en-IN"` | kept in English: it is temporary, and it is about npm |

---

## 3. What is inside

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `inside.title` | What is inside | भितर कितें आसा | Bhitor kitem asa | New. भितर from event (`landmarks`) |
| `inside.intro.1` | Every piece has a page of its own, with its prompt and its install line. | दरेक घटकाक स्वताचें पान आसा, ताचो प्रॉम्प्ट आनी ताची इन्स्टॉल ओळ धरून. | Dorek ghotokak svotachem pan asa, tacho prompt ani tachi install oll dhorun. | New |
| `inside.intro.2` | The indexes show a still of each; the drawing runs when you open it. | यादयेंत दरेकाचें थीर चित्र दिसता; पान उगडल्यार तें चलता. | Yadient dorekachem thir chitr dista; pan ugodlear tem chalta. | New. यादी from pack |

The four cards. Titles are the nav words above.

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `inside.scenes` | Drawings that do a job, like this kolam: one unbroken line round every dot. | काम करपी चित्रां, ह्या कोलमा भशेन: दरेक ठिपक्या भोंवतणीं एकूच अखंड रेग. | Kam korpi chitram, hea kolama bhaxen: dorek thipkea bhonvtonnim ekuch okhond reg. | New |
| `inside.components` | Keyboard and screen reader support underneath, a skin for each register on top. | सकयल कीबोर्ड आनी स्क्रीन रीडराचो आदार, वयर दरेक भावाचें वेगळें रूप. | Sokoil keyboard ani screen readeracho adhar, voir dorek bhavachem vegllem rup. | New |
| `inside.recipes` | Pieces put together for real work, like a booking under its season ribbon. | खऱ्या कामाखातीर एकठांय केल्ले घटक, हंगामाच्या पट्ट्ये सकयल एक बुकिंग भशेन. | Khorea kamakhatir ekthaim kel'le ghotok, hongamachea pottye sokoil ek booking bhaxen. | New |
| `inside.foundations` | What every piece stands on. The engine lays out this marigold, floret by floret. | दरेक घटक जाचेर उबो आसा तें. इंजीन ह्या झेंडवाचीं ल्हान फुलां एक एक करून मांडता. | Dorek ghotok jacher ubo asa tem. Engine hea zendvachim lhan fulam ek ek korun manddta. | New. झेंडू / zendu from the bloom docs |
| `inside.foundations.toy` | Grow one from a name | नांवा वयल्यान फूल फुलोवचें | Nanva voilean ful fulovchem | New |

The kolam keeps its own name, कोलम / kolam, rather than रांगोळी. It is the Tamil threshold drawing the scene is named for, and the scene's gloss says so.

---

## 4. Newest

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `newest.title` | Newest | सगळ्यांत नवें | Sogllyant novem | New |
| `newest.item.meta` | {Kind}, added {date} | {Kind} · {date} सावन लायब्ररींत | {Kind} · {date} savn librarint | New. Built to avoid gender agreement with each kind |
| `newest.item.line` | {description} | English, `lang="en-IN"` | English, `lang="en-IN"` | the registry has only English |
| `newest.empty` | The newest pieces will show here as they join the library. | नवे घटक लायब्ररींत आयले की हांगा दिसतले. | Nove ghotok librarint ayle ki hanga distele. | New |

`{Kind}`, singular:

| Kind | English | Devanagari | Romi |
|---|---|---|---|
| scene | Scene | चित्र | Chitr |
| component | Component | घटक | Ghotok |
| recipe | Recipe | रेसिपी | Resipi |
| template | Template | साचो | Sacho |
| package, surface | Foundation | बुन्याद | Bunead |

`{date}` is day, month, year, like the event template's "शनिवार 21 नोव्हेंबर 2026" / "Xonivar 21 Novembor 2026", without the weekday. The months:

| Month | Devanagari | Romi |
|---|---|---|
| 1 | जानेवारी | Janer |
| 2 | फेब्रुवारी | Febrer |
| 3 | मार्च | Mars |
| 4 | एप्रील | Abril |
| 5 | मे | Mai |
| 6 | जून | Jun |
| 7 | जुलय | Julai |
| 8 | ऑगस्ट | Agost |
| 9 | सप्टेंबर | Setembor |
| 10 | ऑक्टोबर | Otubor |
| 11 | नोव्हेंबर | Novembor |
| 12 | डिसेंबर | Dezembor |

नोव्हेंबर and Novembor come from the event template. The other twenty-two are new. If the builder can use `Intl.DateTimeFormat('gom', { month: 'long' })` and the browser has Konkani data, compare its months with this table and tell the reader which differ.

---

## 5. The footer

| Key | English | Devanagari | Romi | Source |
|---|---|---|---|---|
| `foot.sig` | made by Claude with Sarat, Asymmetrica, Goa, 2026 | Claude आनी Sarat हांणी केलें, Asymmetrica, गोंय, 2026 | Claude ani Sarat hannim kelem, Asymmetrica, Goem, 2026 | New. गोंय / Goem from event (`hero.eyebrow`) |
| `foot.rafe` | <a>For Rafe</a>, who lent us his Activa and went fishing. | <a>Rafe खातीर</a>, जाणें आमकां आपली Activa उसणी दिली आनी जो नुस्तें धरूंक गेलो. | <a>Rafe-khatir</a>, jannem amkam apli Activa usnni dili ani jo nustem dhorunk gelo. | New |
| `foot.src` | The code, the prompts and the drawings are open on GitHub. Take what you like. | कोड, प्रॉम्प्ट आनी चित्रां GitHub चेर उक्तीं आसात. तुमकां जाय तें घेयात. | Kod, prompt ani chitram GitHub-cher uktim asat. Tumkam zai tem gheyat. | New. "तुमकां जाय" from pack |
| `foot.licence` | MIT licensed code; documentation under CC BY 4.0. | कोड MIT परवान्याखाला; दस्तावेज CC BY 4.0 खाला. | Kod MIT porvanneakhala; dostavej CC BY 4.0 khala. | New |
| `foot.privacy` | This page makes no requests to anyone else's servers and keeps your settings only in your own browser. | हें पान दुसऱ्या कोणाच्याच सर्वराक कांयच मागना, आनी तुमचीं सेटिंगां फकत तुमच्याच ब्राउझरांत दवरता. | Hem pan dusrea konnachyach servorak kaimch magona, ani tumchim settingam fokot tumchyach browserant dovorta. | New |
| `trust.foot` | Accessibility and browsers | सुलभताय आनी ब्राउझर | Sulobhtay ani browser | New |

I suggest the licence line also shows in English, with `lang="en-IN"`, after the Konkani: a licence is a legal statement, and the English is the one that counts.

---

## Not covered here

- **The "Three ideas" section.** It is on the home page but was not in this slice. On the Konkani pages it should either be left out or shown in English with `lang="en-IN"` on the section. Half a page in each language would read worse than either.
- **The page's meta title and description.** Title: "Susegad UI" in all three. Description: use `hero.lede.1`.

---

## For the reviewer pack

Same format as `docs/reviews/2026-10-06-konkani-for-reader.md`. Add this section to it under the heading "8 October: the home page".

**One thing to judge first: the section names.** The library's kinds (Scenes, Components, Recipes, Foundations) become the navigation, the cards and the Newest line, so whatever word a reader picks for each shows up in about five places. I chose चित्रां / Chitram for Scenes (they are drawings), घटक / Ghotok for Components, रेसिपी / Resipi (borrowed) for Recipes, and बुन्याद / Bunead for Foundations. If any of these sounds wrong to a Goan reader, or if an engineer in Panjim would just say "components", the English word in Konkani letters is a fair answer too.

### Least sure of

1. **`nav.recipes` रेसिपी / Resipi.** In the library a recipe is pieces put together for a job, not cooking. The borrowed word carries the joke the English does, but a Konkani reader may hear only food. The other choice I considered was तयार जुळणी (ready assemblies), which is long for a nav.
2. **`nav.foundations` बुन्याद / Bunead, and `Template` साचो / Sacho.** बुन्याद comes from Persian through Marathi; I am not sure Goan Konkani uses it. पांयो (footings) may be more natural. साचो is a mould; I am not sure it stretches to "a starter site".
3. **The register names, शांत / Xant, उबदार / Ubdar, खेळकार / Khellkar.** उबदार is Marathi (ऊबदार), and I do not know the Konkani word for "warm" in the sense of a warm welcome. खेळकार / Khellkar is my form, from खेळ (play); it may not be a real word. These three are the library's best trick, so they matter.
4. **`hero.caption`, निवांत समाधान / nivant somadhan, for "unhurried contentment".** Susegad is itself the Konkani word for this, so the gloss cannot use it. निवांत may be more Marathi than Konkani. घायकूत नाशिल्लें सूख (happiness without hurry) is the other option.
5. **`lang.draft`, the draft note.** मायभास कोंकणी आशिल्लो वाचपी is my phrase for "a native reader" (a reader whose mother tongue is Konkani). मसुदो is "draft". The short form "मसुदो: कोंकणी वाचप्याची वाट पळयता" (draft: waiting for a Konkani reader) personifies the draft and may read oddly. This note is on every Konkani page, so it should be the first row the reader checks.
6. **The Romi months, apart from Novembor.** Janer, Febrer, Mars, Abril, Mai, Jun, Julai, Agost, Setembor, Otubor and Dezembor follow the Portuguese-derived forms I have seen in Romi print, with the -or ending the event template's "Novembor" uses. Spellings vary (Setembr, Otubr); please give the ones you would print.
7. **`foot.rafe`, उसणी दिली / usnni dili, for "lent".** And whether "नुस्तें धरूंक गेलो" is how a Goan says "went fishing", or whether "नुस्तें मारूंक" is more natural.
8. **`view.theme.light` उजवाड / Uzvadd and `dark` काळोख / Kallokh,** for a screen's light and dark themes. A Goan engineer may expect "लायट" and "डार्क". थीम / Theme is borrowed for the same reason.
9. **`newest.item.meta`, "{date} सावन लायब्ररींत" / "{date} savn librarint",** meaning "in the library since {date}". I built it this way to avoid making the verb agree with each kind's gender. Check that सावन reads as "since" here.
10. **Romi spellings I am unsure of in general:** `dista` against `disota`, `mellta`, `kaddilli`, `manddta`, `kel'le` (with the apostrophe), `librarint`, `lainisavn`. If the reader follows one Romi convention throughout, I will respell all of them to match.
