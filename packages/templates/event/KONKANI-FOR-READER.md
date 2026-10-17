# Konkani for a native reader: the event template

*Written on 7 October 2026, for the event page that `npx @susegad/cli create` makes. The writer is not a native Konkani reader. Every line below is a first draft. About half an hour of a Goan reader's time settles it.*

**What we need from you.** For each row, tell us "fine", or give the word you would use. The page shows these words as they are written now. Once a row is fine, add `'gom-Deva:<key>'` and `'gom-Latn:<key>'` to `REVIEWED` in `strings.js`; `unreviewed()` in the same file lists what is left.

**Who reads the page.** Goan visitors to the conclave site in Panjim, and the government team who will edit it. The register is plain and civic: neutral, warm, no religious phrasing (so "thank you" is never "Dev borem korum").

## Orthography followed

The same choices as the language switcher's draft (see the language switcher's Konkani strings).

- **Devanagari (`gom-Deva`):** the usage of the Goa Konkani Akademi, as I remember it: the neuter ending -चें (वचचें), the nasal marks as dots (कोंकणी). Not checked against a dictionary.
- **Romi (`gom-Latn`):** the common Roman-script spelling of Goa: x for श (Xonivar), nn for ण and in Konknni, -em for the neuter ending (vochem), no diacritics. Not checked against the Romi Konkani dictionary. Romi is not written to a strict rule of one letter per letter, so where I was unsure of the letters (a retroflex d or t), I wrote the plain one.

## What stays English, on purpose

- Proper nouns: Mandovi Conclave (written in Devanagari on the Devanagari page), Mandovi Riverside Hall, Riverfront Road, Kadamba, Ribandar, Susegad UI, and the names of people (each in its own script).
- Digits stay western. Dates and times are written by the library from the data (IST, 24-hour in the data), in the words below.
- "IST".

## The words

| Key | English | Devanagari | Romi | Notes |
|---|---|---|---|---|
| `meta.title` | Mandovi Conclave 2026: AI for public services, Panjim | मांडवी कॉन्क्लेव्ह 2026: सरकारी सेवांखातीर एआय, पणजी | Mandovi Conclave 2026: sorkari sevankhatir AI, Panjim |  |
| `meta.description` | One day in Panjim for people who build, run and rely on public services. The agenda, the speakers and the venue. This is a sample page, so change every word. | पणजींत एक दीस, सरकारी सेवा घडोवपी, चलोवपी आनी तांचेर अवलंबून आशिल्ल्या लोकांखातीर. वेळापत्रक, उलोवपी आनी थळ. हें एक नमुनो पान, देखून सगळीं उतरां बदला. | Panjimta ek dis, sorkari sevam ghodovpi, chalovpi ani tancher avolombun asllea lokankhatir. Velapotrok, ulovpi ani thol. Hem ek namunno pan, dekhun sogllim utram bodla. | सरकारी सेवा / sorkari sevam is my word for "public services"; see hero.title. "नमुनो पान" is "sample page". |
| `skip` | Skip to the content | थेट मजकुराक वचचें | Thet mojkurak vochem | Read by a screen reader as the first link. "थेट" is "straight". Is there a shorter, more usual phrase? |
| `banner.text` | Doors open at 9:30 am on Saturday 21 November. Please bring your ticket, on your phone or on paper. | शेनवार 21 नोव्हेंबर, सकाळीं 9:30 वरांचेर दारां उगडटात. तुमचें तिकीट, फोनार वा कागदार, हाडात. | Sonvar 21 Novembr, sokallim 9:30 vorancher daram ugdat. Tumchem tikit, fonar va kagdar, hadat. | The line across the top of every page. The day and month are the library's (see "Days, months and the hours"). "वरांचेर" (at, for a time) is borrowed from ICU's own pattern and the writer is not sure of it; वाजतां is the other candidate. "हाडात" is "please bring" (polite). The banner goes by itself after 21 November. Its label ("सूचना") and the cross's name ("ही सूचना बंद करचीं") are in `susegad/components/banner/banner.strings.js`, with the same doubts: is सूचना the word on a Goan notice board, and is बंद करचीं the right verb? |
| `site.name` | Mandovi Conclave | मांडवी कॉन्क्लेव्ह | Mandovi Conclave |  |
| `hero.eyebrow` | Saturday 21 November 2026 · Panjim, Goa | शेनवार 21 नोव्हेंबर 2026 · पणजी, गोंय | Sonvar 21 Novembr 2026 · Panjim, Goem | The day and month are ICU's own forms (see "Days, months and the hours" below). They changed from शनिवार / Xonivar and Novembor, so that the page agrees with the dates the library prints. |
| `hero.title` | AI for public services, in practice | सरकारी सेवांखातीर एआय, प्रत्यक्ष वापरांत | Sorkari sevankhatir AI, protyoksh vaparant | Least sure. "Public services" as सरकारी सेवा (government services) is plainer than सार्वजनिक सेवा but narrower. "प्रत्यक्ष वापरांत" is "in actual use"; is there a more natural way to say "in practice"? |
| `hero.lede` | One day of short talks for the people who build, run and rely on public services. We look at what works, what does not, and what a person should always still decide. | सरकारी सेवा घडोवपी, चलोवपी आनी तांचेर अवलंबून आशिल्ल्या लोकांखातीर एका दिसाचीं ल्हान भाशणां. कितें चलता, कितें चलना आनी कितें मनशानूच सदांच थारावपाक जाय, तें आमी पळयतात. | Sorkari sevam ghodovpi, chalovpi ani tancher avolombun asllea lokankhatir eka disachim lhan bhaxonnam. Kitem chalta, kitem chalna ani kitem monxanuch sodanch tharavpak zai, tem ami polloitat. | "अवलंबून आशिल्ल्या" is "who depend on". "भाशणां" is "talks" (literally speeches); is there a lighter word for a short talk? "आमी पळयतात" is "we look at": is the verb form right? |
| `hero.posterAlt` | A desk at dawn in Goa: a laptop and a steel tumbler of tea below a barred window, with palms and a red-tiled house outside. | गोंयांतल्या पहांटेचो एक टेबल: लोखणाच्या सळ्यांच्या खिडकेच्या सकयल एक लॅपटॉप आनी चाहाचो स्टीलाचो ग्लास, भायर माडां आनी कवलां घातिल्लें घर. | Goemchea pahantecho ek table: lokhnnachea sollyanchea khidkechea sokoil ek laptop ani chahacho stilacho glas, bhayr madam ani kavlam ghatillem ghor. | Read aloud by a screen reader. Check every noun: लोखणाच्या सळ्यांची खिडकी (barred window), चाहाचो ग्लास (a tumbler of tea), कवलां (red clay tiles). |
| `hero.play` | Play the picture | चित्र चलोवचें | Chitr chalovchem | The button that makes the picture move. Is "चलोवचें" (make it run) natural for a picture, or would another verb do? |
| `hero.seeAgenda` | See the agenda | वेळापत्रक पळोवचें | Velapotrok pollovchem | वेळापत्रक is "timetable". The English "agenda" is a day plan, so I chose a timetable word. |
| `hero.findVenue` | Find the venue | थळ सोदचें | Thol sodchem | थळ is "place". Is it the word a Goan would use for where an event is held? |
| `time.to` | to | ते | te | Sits between two times: "सकाळीं 10:30 ते सकाळीं 11:15". Is "ते" right for "to" in Goan Konkani, or "पर्यंत / मेरेन" after the second time? If the last, the template needs a change in pages.mjs, tell me. |
| `time.ist` | IST | IST | IST | Kept as IST, which is how it is written on Indian timetables. Say if a Konkani abbreviation is used. |
| `time.istFull` | India Standard Time | भारतीय प्रमाण वेळ | Bharotiy pramann vel |  |
| `agenda.heading` | Agenda | वेळापत्रक | Velapotrok |  |
| `agenda.zone` | Every time here is India Standard Time (IST), the clock in Panjim. | हांगा दिल्ल्यो सगळ्यो वेळो भारतीय प्रमाण वेळेंत (IST) आसात: पणजींतल्या घड्याळाची वेळ. | Hanga dillyo sogllyo velo Bharotiy pramann velent (IST) asat: Panjimchea ghodyalachi vel. | Check "दिल्ल्यो" agrees with "वेळो" (plural). |
| `agenda.day` | Saturday 21 November | शेनवार 21 नोव्हेंबर | Sonvar 21 Novembr | See "Days, months and the hours" below. |
| `rooms.main` | Main hall | मुखेल सभागृह | Mukhel sobhagruh |  |
| `rooms.studio` | Studio room | स्टुडिओ खोली | Studio kholi | खोली (room) may be Hindi-leaning; कुडको is the other candidate. Which does a Goan say? |
| `rooms.foyer` | Foyer | लॉबी | Lobi | Borrowed "lobby". There may be no common Konkani word. |
| `tracks.services` | Public services | सरकारी सेवा | Sorkari sevam |  |
| `tracks.language` | Language and records | भास आनी नोंदी | Bhas ani nondi | नोंदी is "records" (entries). The English "records" means official records, so check नोंदी is not too informal. |
| `tracks.tools` | Open tools | मोकळीं साधनां | Moklim sadhnam | मोकळीं is "free, open". The English means open as in open-source. Is there a better word? |
| `organisers` | The organisers | आयोजक | Ayojok |  |
| `sessions.doors` | Doors open and registration | दारां उगडतात आनी नांव नोंद | Daram ugodtat ani nanv nond | नांव नोंद is "name entry", for registration. |
| `sessions.welcome` | Welcome, and why we are here | स्वागत, आनी आमी हांगा कित्याक | Swagat, ani ami hanga kityak |  |
| `sessions.forms` | Plain-language forms: a model that rewrites a form for the person filling it | सोप्या भाशेंतले अर्ज: अर्ज भरपी मनशाखातीर तो परत बरोवपी एक मॉडेल | Sopea bhaxentle arz: arz bhorpi monxakhatir to porot borovpi ek model | Session titles are long. "मॉडेल" is the borrowed word for an AI model. Check the sentence reads as one idea. |
| `sessions.records` | Reading handwritten records without losing the original | हातान बरयल्ल्यो नोंदी वाचप, मूळ पान जपून दवरून | Hatan borollyo nondi vachop, mul pan japun dovorun | Verb agreement: "बरयल्ल्यो नोंदी" (handwritten records). |
| `sessions.tea` | Tea and a sit down | चाह आनी विसांवो | Chah ani visanvo | Tea is चाह; "विसांवो" is rest. |
| `sessions.review` | What a model should not decide: human review in benefit claims | मॉडेलान कितें थारावचें न्हय: लाभाच्या मागण्यांत मनशाची तपासणी | Modelan kitem tharavchem nhoi: labhachea magnnyant monxachi tapasnni | Check "लाभाच्या मागण्यांत" for "benefit claims" (a claim for a welfare scheme). "तपासणी" is "checking". |
| `sessions.lunch` | Lunch | दनपारचें जेवण | Danparchem jevonn |  |
| `sessions.laptop` | Open tools for a small office: what runs on one laptop | ल्हान कार्यालयाखातीर मोकळीं साधनां: एका लॅपटॉपार कितें चलता | Lhan karyalayakhatir moklim sadhnam: eka laptopar kitem chalta |  |
| `sessions.konkani` | Konkani on screen and by voice: where we are and what is missing | पडद्यार आनी आवाजांत कोंकणी: आमी खंय पावल्यात आनी कितें उणें आसा | Padyar ani avazant Konknni: ami khoim pavlyat ani kitem unnem asa | Check "आमी खंय पावल्यात" (where we have reached) and "कितें उणें आसा" (what is missing). |
| `sessions.closing` | Questions, and closing | प्रस्न आनी समारोप | Prosn ani samarop | समारोप is formal ("closing ceremony"). A plainer "सोंपपाची वेळ" may suit. |
| `speakers.heading` | Speakers | उलोवपी | Ulovpi | उलोवपी is "those who speak". Is it better than वक्ते? |
| `speakers.asha.name` | Asha Naik | आशा नाईक | Asha Naik | A person's name, written in each script. The Devanagari spelling is mine; check the usual spelling of Naik. |
| `speakers.asha.role` | Service designer, a district e-services centre | सेवा डिझायनर, जिल्हा ई-सेवा केंद्र | Seva designer, zilla e-seva kendr | "डिझायनर" borrowed. "सेवा" is service. |
| `speakers.asha.line` | Rewrites government forms so the person filling one knows what each box is for. | दरेक खण कित्याखातीर आसा तें अर्ज भरपी मनशाक कळचें म्हणून सरकारी अर्ज परत बरयता. | Dorek khonn kityakhatir asa tem arz bhorpi monxak kollchem mhunn sorkari arz porot borayta. | "खण" is "box" on a form (a field). Is "खण" the word on Goan forms, or "रकानो"? |
| `speakers.rohan.name` | Rohan Kamat | रोहन कामत | Rohan Kamat | Name, in each script. |
| `speakers.rohan.role` | Records officer, a taluka office | नोंदी अधिकारी, तालुका कार्यालय | Nondi adhikari, taluka karyalay | The English is "records officer". "तालुका" as in a Goan taluka office. |
| `speakers.rohan.line` | Scans old registers and keeps the original page beside every reading of it. | जुने रजिस्टर स्कॅन करता आनी तांच्या दर वाचपा वांगडा मूळ पान दवरता. | Junem register scan korta ani tancha dor vachpa vangda mul pan dovorta. | "वांगडा" is "alongside". Check the sentence: "keeps the original page with every reading". |
| `speakers.sneha.name` | Sneha Fernandes | स्नेहा फर्नांडिस | Sneha Fernandes | Name, in each script. फर्नांडिस is the usual Goan Devanagari spelling as far as I know. |
| `speakers.sneha.role` | Policy researcher, a public-interest law clinic | धोरण संशोधक, लोकहित कायदा क्लिनिक | Dhoron sonxodhok, lokhit kayda clinic | "लोकहित कायदा क्लिनिक" is "public-interest law clinic". |
| `speakers.sneha.line` | Asks where a person must always be the one who decides. | खंय मनशानूच सदांच थारावपाक जाय हें विचारता. | Khoim monxanuch sodanch tharavpak zai hem vicharta. | The English: "Asks where a person must always be the one who decides." Check the verb and word order. |
| `speakers.vivek.name` | Vivek Dessai | विवेक देसाय | Vivek Dessai | Name, in each script. Dessai is written देसाय in Goa. |
| `speakers.vivek.role` | Developer, a small civic technology studio | डेव्हलपर, ल्हान नागरी तंत्रज्ञान स्टुडिओ | Developer, lhan nagri tontrogyan studio | "नागरी तंत्रज्ञान" is "civic technology". "नागरी" can mean "of a city". Is there a better word for civic? |
| `speakers.vivek.line` | Runs useful models on the laptops an office already owns. | कार्यालयाकडेन आदींच आशिल्ल्या लॅपटॉपांचेर उपेगी मॉडेल चलयता. | Karyalayakoden adinch asllea laptopancher upegi model chalayta. | "आदींच आशिल्ल्या" is "already there". Check it. |
| `speakers.maria.name` | Maria D’Costa | मारिया डिकॉस्ता | Maria D’Costa | Name, in each script. D'Costa in Devanagari is written differently by different families. Ask the person. |
| `speakers.maria.role` | Linguist, a Konkani language project | भाशा अभ्यासक, कोंकणी भास प्रकल्प | Bhaxa abhyasak, Konknni bhas proklop | The English is "linguist". I chose "भाशा अभ्यासक" (language scholar) because I do not know a plain word for linguist. |
| `speakers.maria.line` | Counts the words and spellings that tools still get wrong. | साधनां अजून चुकीचीं बरयतात तीं उतरां आनी स्पेलिंग मोजता. | Sadhnam azun chukichim borotat tim utram ani spelling mojta. | The sentence says: tools still write wrongly, the words and spellings she counts. Check the order. |
| `register.heading` | Register | नांव नोंद | Nanv nond | The heading of the registration form, and the link to it in the header. "नांव नोंद" is "name entry" (registering). Is there a more usual word for "register" for an event? |
| `register.lede` | Tell us who is coming and we will keep a place for you. | कोण कोण येता तें आमकां सांगात, आमी तुमच्या खातीर एक जागो दवरतले. | Kon kon yeta tem amkam sangat, ami tumchea khatir ek zago dovortole. | One line under the heading. "आमकां सांगात" is "tell us"; "एक जागो दवरतले" is "will keep a place". Check the future ending and whether "जागो" is the word for a seat. |
| `register.name` | Name | नांव | Nanv | The deck's word for "name" (the ticket's label). |
| `register.email` | Email address | ई-मेल पत्तो | E-mel patto | "पत्तो" for "address". Do Goans say "ई-मेल पत्तो", or "ई-मेल आयडी"? |
| `register.submit` | Register | नोंद करात | Nond korat | The button. "करात" is the polite command, as the deck uses it. Same worry as the heading. |
| `register.sample` | This sample form does not send anything. | हो नमुनो अर्ज कांयच धाडिना. | Ho namunno arz kainch dhadina. | Said under the form after a send. Not for a visitor to a finished site. "धाडिना" is "does not send"; is the negative form right? |
| `register.consent.fields` | your name and your email address | तुमचें नांव आनी ई-मेल पत्तो | tumchem nanv ani e-mel patto | What the form asks for, as it reads in "आमी … विचारतात".  |
| `register.consent.purpose` | confirm your place and send you the ticket and any change to this event | तुमच्या जागेची पक्कायकी करप आनी तिकीट तशेंच ह्या कार्यक्रमांतले बदल धाडप | tumchea zagechi pakkaikee korop ani tikit toxem hya karyokramantle bodol dhadop | Why, as it reads in "तीं आमी … खातीर वापरतात, आनी हेर कशाखातीरूय ना". The verb nouns (करप, धाडप) are written to fit before खातीर. "पक्कायकी" for "confirm" is a guess. |
| `register.consent.period` | 30 days after the event | कार्यक्रमा उपरांत 30 दिसां | karyokrama uprant 30 disam | How long, as it reads in "तीं … मेरेन दवरतात". "उपरांत" is "after". A placeholder: the site decides. |
| `venue.heading` | The venue | थळ | Thol | थळ, the same word as in hero.findVenue. |
| `venue.name` | Mandovi Riverside Hall | मांडवी रिव्हरसाईड हॉल | Mandovi Riverside Hall |  |
| `venue.address` | Riverfront Road, Panjim (Panaji), Goa 403001 | रिव्हरफ्रंट रोड, पणजी (पांजिम), गोंय 403001 | Riverfront Road, Panjim (Panaji), Goem 403001 | Panjim is written पणजी on the Devanagari page and Panjim on the Romi page, each with the other name beside it where the English gives two. |
| `venue.finding` | Finding it | तें सोदप | Tem sodop | Heading for the directions on the last few metres. |
| `venue.landmarks` | Behind the Old Secretariat, facing the river. Walk through the yellow gate with the blue tiles; the hall’s door is the second one on your left. Look for the banner. | जुन्या सचिवालयाच्या फाटल्यान, न्हंयेच्या मुखार. निळ्या कवलांचें पिवळें फाटक वलांडून भीतर वचात; सभागृहाचें दार तुमच्या दाव्या हाताक दुसरें. बॅनर पळोवचो. | Junea sochivalayachea fatlean, nhoimchea mukhar. Nilea kavlancho pivlem fatok volandun bhitor vochat; sobhagruhachem dar tumchea davea hatak dusrem. Banner pollovcho. | Least sure of this one, as it is a whole paragraph. Check "वलांडून भीतर वचात" (go in past), "दाव्या हाताक" (on your left) and "बॅनर". |
| `venue.mapApp` | Open in your maps app | तुमच्या नकाशा अॅपांत उगडचें | Tumchea nakxa appant ugodchem | नकाशा is the Marathi/Hindi form. A Goan may say नकासो. |
| `venue.mapWeb` | Open in a web map | वेब नकाशांत उगडचें | Web nakxant ugodchem | See venue.mapApp. |
| `venue.ways` | Getting there | थळाक कशें पावचें | Thollak koxem pavchem | Heading: how to get there. |
| `venue.bus.0` | By bus. | बसीन. | Basin. |  |
| `venue.bus.1` | Any bus to the Panjim Kadamba stand, then a ten-minute walk along the river. | पणजी कदंब बसस्थानकाक वतली खंयचीय बस, मागीर न्हंयेकडेन धा मिनटांची चाल. | Panjim Kadamba bussthanakak votli khoinchiy bus, magir nhoikoden dha minutanchi chal. | Check "वतली खंयचीय बस" (any bus going to) and "मागीर" (then). |
| `venue.ferry.0` | By ferry. | फेरीन. | Ferin. |  |
| `venue.ferry.1` | The Ribandar ferry lands about five minutes’ walk away. | रिबांदराची फेरी लागता थळा पासून सुमार पांच मिनटांची चाल. | Ribandarachi feri lagta thollapasun sumar panch minutanchi chal. | Ribandar is written रिबांदर. Check the Devanagari. |
| `venue.car.0` | By car. | कारीन. | Karin. |  |
| `venue.car.1` | There is a paid car park behind the hall. On a busy day, park at the Kadamba stand and walk. | सभागृहाच्या फाटल्यान पयशे दिवपाची कार पार्किंग आसा. गर्दी आशिल्ल्या दिसा कदंब स्टँडार गाडी पार्क करून चलत यात. | Sobhagruhachea fatlean poyxe divpachi car parking asa. Gordi asllea disa Kadamba standar gaddi park korun chalot yat. | Check "चलत यात" (come on foot). The English advice, to park at the Kadamba stand when it is busy, stays. |
| `venue.access` | Access | प्रवेशाच्यो सोयी | Provexachyo soyi | Heading for the step-free entrance, lift and toilet. |
| `venue.step.0` | Step-free entrance | पायऱ्यो नाशिल्लो प्रवेश | Pairyo nashillo provex | Spells out "no steps". Check "पायऱ्यो नाशिल्लो". |
| `venue.step.1` | Yes, through the side gate on Riverfront Road. No steps. | हय, रिव्हरफ्रंट रोडाचेर आशिल्ल्या कुशीच्या फाटकांतल्यान. पायऱ्यो ना. | Hoy, Riverfront Roddacher asllea kuxichea fatkantlean. Pairyo na. | हय is "yes". |
| `venue.lift.0` | Lift | लिफ्ट | Lift |  |
| `venue.lift.1` | One lift to the first floor, big enough for a wheelchair. | पयल्या मजल्यार वचपाक एक लिफ्ट, व्हीलचेअर मावपा इतली व्हडली. | Poylea mojlear vochpak ek lift, wheelchair mavpa itli vhodli. | Check "व्हीलचेअर मावपा इतली व्हडली" (big enough to take a wheelchair). |
| `venue.toilet.0` | Accessible toilet | सगळ्यांक वापरपाजोगें शौचालय | Soglleank vaparpajogem xouchalay | शौचालय is formal. "Accessible" as "वापरपाजोगें" (usable by everyone) is my reading. |
| `venue.toilet.1` | Ground floor, next to the foyer. | तळमजल्यार, लॉबीचे लागीं. | Tolmojlear, lobiche lagim. | "लागीं" is "next to". |
| `venue.river` | River | न्हंय | Nhoim |  |
| `venue.secretariat` | Old Secretariat | जुनें सचिवालय | Junem sochivalay | The English is "Old Secretariat". Is "जुनें सचिवालय" what Goans call it? |
| `venue.hall` | Hall | सभागृह | Sobhagruh |  |
| `venue.bus_stop` | Bus stop | बसथांबो | Bus thambo | Label on the little map. |
| `footer.sign` | A sample page from Susegad UI. Change every word before you publish. | Susegad UI चें एक नमुनो पान. प्रकाशीत करपा आदीं सगळीं उतरां बदला. | Susegad UI-chem ek namunno pan. Prokaxit korpa adim sogllim utram bodla. | Brand name stays in Roman. "नमुनो पान" is "sample page". "प्रकाशीत करपा आदीं" is "before publishing". |
| `footer.links` | On this page | ह्या पानांत | Hea panant |  |
| `footer.top` | Back to the top | वयर वचचें | Voir vochem | Link at the bottom that goes to the top. Check "वयर वचचें". |
| `footer.small` | Mandovi Conclave is a made-up event, so no real person or organisation is meant. | मांडवी कॉन्क्लेव्ह हो एक कल्पीत कार्यक्रम, देखून खंयच्याय खऱ्या मनशाक वा संस्थेक उद्देशून न्हय. | Mandovi Conclave ho ek kolpit karyakram, dekhun khoinchyay khorya monxak va sansthek uddexun nhoi. | Check "कल्पीत" (made-up), "संस्थेक" (organisation) and "उद्देशून" (meant for). |

## The consent notice

The registration form carries the library's consent notice (`susegad/components/consent/consent.strings.js`): a heading, six short lines and a box. Its Konkani is a first draft by the same writer. The doubts for the notice are the long line on withdrawing consent, which a reader may want split in two, and "ताचेवयचिना" for "without it". The banner's own doubts are the verb in "ही सूचना बंद करचीं" and the order of "{date} परत". The notice's three values (`register.consent.*` above) are the site's own words and are the rows above. Its contact, site name and complaint line are left as visible [placeholders] on purpose: a site fills them in, and a legal reader reads the notice before the site goes live. The notice names no law and no body.

## Days, months and the hours

The library prints the day, the month and the part of the day itself (`susegad/core/intl.kok.js`), so there is one set of words for the whole page. They are ICU's own forms, read on 8 October 2026, except the four parts of the day. **Draft, for a native reader; change a word in the table at the top of that file.** There is no ending on a date (not 21 नोव्हेंबराक): the sentence around it does the work.

A time is written as the part of the day, then the clock: **सांजे 7:00** (Romi **sanje 7:00**). A date is **शेनवार 21 नोव्हेंबर** (**Sonvar 21 Novembr**). The agenda's times and the page's date use these, so `time.am` and `time.pm` are no longer keys.

| Day | Devanagari | Romi | Notes |
|---|---|---|---|
| Sunday | आयतार | Aitar | |
| Monday | सोमार | Somar | |
| Tuesday | मंगळार | Mongllar | The double l is ICU's way of writing ळ. Mongllar or Mongolar? |
| Wednesday | बुधवार | Budhvar | |
| Thursday | बिरेस्तार | Birestar | भीरेस्तार in Goan speech? |
| Friday | शुक्रार | Sukrar | |
| Saturday | शेनवार | Sonvar | Was शनिवार / Xonivar. शनिवार is the Marathi and Hindi word; ICU has शेनवार. Which does a Goan write? |

| Month | Devanagari | Romi | Notes |
|---|---|---|---|
| January | जानेवारी | Janer | |
| February | फेब्रुवारी | Febrer | |
| March | मार्च | Mars | |
| April | एप्रील | Abril | |
| May | मे | Mai | |
| June | जून | Jun | |
| July | जुलय | Julai | जुलै (Marathi, Hindi) reads more familiar. Which? |
| August | ऑगस्ट | Agost | |
| September | सप्टेंबर | Setembr | |
| October | ऑक्टोबर | Otubr | |
| November | नोव्हेंबर | Novembr | Was Novembor in Romi. |
| December | डिसेंबर | Dezembr | |

| Part of the day | Hours | Devanagari | Romi | Notes |
|---|---|---|---|---|
| Morning | 4:00 to 11:59 | सकाळीं | sokallim | |
| Afternoon | 12:00 to 15:59 | दनपारां | donparam | Was danparam in Romi. |
| Evening | 16:00 to 19:59 | सांजे | sanje | |
| Night | 20:00 to 3:59 | राती | rati | These four bands are ICU's. A Goan reader may draw them differently: many would call 5 pm सांजे, and 12:30 दनपार. |

## The ticket and the offline page

Both are in the library, not in `strings.js` (`susegad/components/ticket/ticket.strings.js` and `susegad/recipes/offline/recipe.strings.js`), and both are a first draft for a native reader. `ticket.local` is the newest line. {id} is the ticket's eight-character id.

| Key | English | Devanagari | Romi | Notes |
|---|---|---|---|---|
| `ticket.heading` | Your ticket | तुमचें तिकीट | Tumchem tikit |  |
| `ticket.name` | Name | नांव | Nanv |  |
| `ticket.event` | Event | कार्यक्रम | Karyokrom | A feast might say फेस्त and a tiatr तियात्र; a site can set its own word. |
| `ticket.time` | Time (IST) | वेळ (IST) | Vel (IST) |  |
| `ticket.id` | Ticket id | तिकिटाचो क्रमांक | Tikitacho kromank | क्रमांक (number) rather than आयडी. Which do Goans say? |
| `ticket.qrAlt` | QR code for ticket {id}. It holds the ticket id and nothing else. | तिकीट {id} खातीर क्यूआर कोड. ताका तिकिटाचो क्रमांक सोडल्यार कांयच ना. | Tikit {id} khatir kyuar kod. Taka tikitacho kromank sodlear kainch na. |  |
| `ticket.qrBeside` | Show this code at the door. If it will not scan, read out the ticket id beside it. | दारांत हो कोड दाखयात. स्कॅन जालो ना जाल्यार, वयलो क्रमांक वाचून सांगात. | Daranty ho kod dakhoyat. Skan zalo na zalear, voilo kromank vachun sangat. | "वयलो" is "above": write the word that fits where the number sits (above or beside the code). |
| `ticket.save` | Save as picture | चित्र म्हणून सांबाळचें | Chitr mhunn sambollchem | "सांबाळचें" is "to keep". "जतन करप" is the other candidate. |
| `ticket.saved` | Saved. Look for it in your downloads or photos. | सांबाळ्ळें. डाउनलोड वा फोटोंत पळयात. | Sambollem. Download va fotont polloyat. | The ending is the polite "पळयात"; the deck had the plain one. |
| `ticket.saveFailed` | The picture did not save. Try again, or take a screenshot of this page. | चित्र सांबाळूक जालें ना. परत यत्न करात, वा ह्या पानाचो स्क्रीनशॉट काडात. | Chitr sambolk zalem na. Porot yatn korat, va hya panacho skrinxot kadat. |  |
| `ticket.offline` | After you have opened this page once, it opens again without a connection. | हें पान एकदां उगडल्यार, परत जोडणी बगर उगडटलें. | Hem pan ekdam ugdolear, porot jodonni bogor ugdotlem. | "जोडणी" for "connection" is a guess. |
| `ticket.done` | You are on the list. See you there. | तुमचें नांव यादींत आसा. थंय भेटूंया. | Tumchem nanv yadint asa. Thoim bhetum ya. | "भेटूंया" is a guess at the friendly "see you there". |
| `ticket.local` | This ticket is kept on this device only. Nothing was sent to a server. | हें तिकीट फकत ह्याच उपकरणार सांबाळ्ळां. सर्व्हराक कांयच धाडलें ना. | Hem tikit phokot hyach upkoronar sambollam. Serverak kainch dhadlem na. | NEW. "उपकरण" for "device" may be heavy: would Goans say "फोन" or "मोबाईल"? "फकत" is "only". |
| `offline.title` | No connection right now | सध्या जोडणी ना | Sodhya jodonni na |  |
| `offline.lede` | We cannot reach the internet from here. Nothing you did caused this, and it often passes on its own. | हांगासकयल्यान इंटरनेट पावना. तुमच्या हातांतल्यान कांयच चुकलें ना; तें आपशीच सुदारता. | Hangasokoylean internet pavna. Tumchea hatantlean kainch chukllem na; tem apxich sudharta. | The first half is the least sure line: a reader might simply say "इंटरनेट मेळना". |
| `offline.worksHeading` | Still here for you | अजून तुमच्या खातीर आसा | Ajun tumchea khatir asa |  |
| `offline.works1` | The event page, if you have opened it before. | कार्यक्रमाचें पान, तुमी आदीं उगडिल्लें आसल्यार. | Karyokromachem pan, tumi adim ugdillem asalear. |  |
| `offline.works2` | Your ticket, if you have opened it before. | तुमचें तिकीट, तुमी आदीं उगडिल्लें आसल्यार. | Tumchem tikit, tumi adim ugdillem asalear. |  |
| `offline.notHeading` | Waiting for a connection | जोडणीची वाट पळयतां | Jodonnichi vat polloitat | "वाट पळयतां" is "are waiting". |
| `offline.not1` | Pages you have not opened yet. | तुमी अजून उगडून पळयल्लीं ना तीं पानां. | Tumi ajun ugdun pollyalim na tim panam. |  |
| `offline.not2` | Registering, and anything that needs us to answer. | नांव नोंद, आनी आमी जाप दिवपाक जाय तें सगळें. | Nanv nond, ani ami zap divpak zai tem sogllem. |  |
| `offline.not3` | Maps, and live updates. | नकाशे, आनी थेट खबरो. | Nokaxe, ani thet khobro. |  |
| `offline.retry` | Try again | परत यत्न करात | Porot yatn korat |  |
| `offline.back` | Back | फाटीं | Phatim |  |

## What I changed in the English

Nothing needed it: it is plain, sentence case, has no em dashes and no urgency, and the sample content is marked as a sample (the footer says so twice). One thing to decide, for the owner: the page's agenda recipe still writes "Now on stage, until 11:15 am" and "Next, at 2 pm" in English on a Konkani page (the template's README says so). That waits for the recipe's own Konkani words.
