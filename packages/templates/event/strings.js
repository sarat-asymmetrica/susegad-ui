// Every word on the event page, by language, and the facts the pages share.
// Edit this file, then run `node pages.mjs` to write the three pages again.
//
// The Konkani below is a draft by a non-native writer, for a native Goan reader to
// check. Until someone has, every Konkani key counts as unreviewed: see REVIEWED at
// the bottom, and KONKANI-FOR-READER.md beside this file, which sets each key
// next to its English so a reader can check it in one sitting. The English each
// Konkani entry stands for is in the comment beside it.
// A Konkani entry that still reads [TODO gom-Deva some.key] has not been written
// yet: it stays visible on the page so nobody publishes it by mistake.
// Names of people are written in each script too, so they are keys like any other.

/** The pages: where each one lives (the prefix scheme of decision 0025) and what it is called. */
export const LANGS = [
  { tag: 'en-IN', folder: '' },
  { tag: 'gom-Deva', folder: 'gom-deva' },
  { tag: 'gom-Latn', folder: 'gom-latn' },
];

/** The address the site will have. hreflang needs absolute addresses, so replace this with your own. */
export const SITE = 'https://conclave.example.in';

/** The look the pages start in. quiet, warm or playful; a visitor can try another with ?register=warm. */
export const REGISTER = 'quiet';

/** Where the hall is. The two map links are made from these. */
export const VENUE = { lat: 15.4989, lng: 73.8278 };

/** The day, as it is on the clock in Panjim. Times are IST, 24-hour. */
export const DAY = '2026-11-21';

/** The announcement at the top of every page. It goes by itself after its last day (an IST date), so it cannot outlive the event. */
export const BANNER = { id: 'doors', until: DAY };

/** The ticket's time: the day, and when the doors open (the first session on the schedule below), as the clock reads in Panjim. */
export const TICKET_AT = `${DAY}T09:30`;

/**
 * The folder the site is served from, ending in a slash. The offline worker covers it, and the offline pages address
 * their files from it, because the worker shows them at whatever address was asked for. Change it if the site lives
 * in a folder, then run node pages.mjs. The worker's version is not set by hand: pages.mjs makes it from a hash of every
 * file the worker keeps, so any change to a page, a style, a script, a font or a picture gives visitors the new files on
 * their next visit after the worker has updated.
 */
export const SCOPE = '/';

/** The event in no language: a ticket belongs to it by this, so it is still the visitor's ticket on every language's page. */
export const EVENT_ID = 'mandovi-conclave';

/** The sessions, in order. Their words are in COPY[tag].sessions[id]; `speaker` points at COPY[tag].speakers. */
export const SCHEDULE = [
  { id: 'doors', start: '09:30', end: '10:00', kind: 'break', room: 'foyer' },
  { id: 'welcome', start: '10:00', end: '10:30', room: 'main', who: 'organisers' },
  { id: 'forms', start: '10:30', end: '11:15', room: 'main', track: 'services', speaker: 'asha' },
  { id: 'records', start: '10:30', end: '11:15', room: 'studio', track: 'language', speaker: 'rohan' },
  { id: 'tea', start: '11:15', end: '11:45', kind: 'break', room: 'foyer' },
  { id: 'review', start: '11:45', end: '12:30', room: 'main', track: 'services', speaker: 'sneha' },
  { id: 'lunch', start: '12:30', end: '13:30', kind: 'break', room: 'foyer' },
  { id: 'laptop', start: '13:30', end: '14:15', room: 'studio', track: 'tools', speaker: 'vivek' },
  { id: 'konkani', start: '14:15', end: '15:00', room: 'main', track: 'language', speaker: 'maria' },
  { id: 'closing', start: '15:00', end: '15:30', room: 'main', who: 'organisers' },
];

/** Speakers, in the order they appear. */
export const SPEAKERS = ['asha', 'rohan', 'sneha', 'vivek', 'maria'];

export const COPY = {
  'en-IN': {
    meta: {
      title: 'Mandovi Conclave 2026: AI for public services, Panjim',
      description: 'One day in Panjim for people who build, run and rely on public services. The agenda, the speakers and the venue. This is a sample page, so change every word.',
    },
    skip: 'Skip to the content',
    banner: {
      text: 'Doors open at 9:30 am on Saturday 21 November. Please bring your ticket, on your phone or on paper.',
    },
    site: {
      name: 'Mandovi Conclave',
    },
    hero: {
      eyebrow: 'Saturday 21 November 2026 · Panjim, Goa',
      title: 'AI for public services, in practice',
      lede: 'One day of short talks for the people who build, run and rely on public services. We look at what works, what does not, and what a person should always still decide.',
      posterAlt: 'A desk at dawn in Goa: a laptop and a steel tumbler of tea below a barred window, with palms and a red-tiled house outside.',
      play: 'Play the picture',
      seeAgenda: 'See the agenda',
      findVenue: 'Find the venue',
    },
    time: {
      am: 'am',
      pm: 'pm',
      to: 'to',
      ist: 'IST',
      istFull: 'India Standard Time',
    },
    agenda: {
      heading: 'Agenda',
      zone: 'Every time here is India Standard Time (IST), the clock in Panjim.',
      day: 'Saturday 21 November',
    },
    rooms: {
      main: 'Main hall',
      studio: 'Studio room',
      foyer: 'Foyer',
    },
    tracks: {
      services: 'Public services',
      language: 'Language and records',
      tools: 'Open tools',
    },
    organisers: 'The organisers',
    sessions: {
      doors: 'Doors open and registration',
      welcome: 'Welcome, and why we are here',
      forms: 'Plain-language forms: a model that rewrites a form for the person filling it',
      records: 'Reading handwritten records without losing the original',
      tea: 'Tea and a sit down',
      review: 'What a model should not decide: human review in benefit claims',
      lunch: 'Lunch',
      laptop: 'Open tools for a small office: what runs on one laptop',
      konkani: 'Konkani on screen and by voice: where we are and what is missing',
      closing: 'Questions, and closing',
    },
    speakers: {
      heading: 'Speakers',
      asha: {
        name: 'Asha Naik',
        role: 'Service designer, a district e-services centre',
        line: 'Rewrites government forms so the person filling one knows what each box is for.',
      },
      rohan: {
        name: 'Rohan Kamat',
        role: 'Records officer, a taluka office',
        line: 'Scans old registers and keeps the original page beside every reading of it.',
      },
      sneha: {
        name: 'Sneha Fernandes',
        role: 'Policy researcher, a public-interest law clinic',
        line: 'Asks where a person must always be the one who decides.',
      },
      vivek: {
        name: 'Vivek Dessai',
        role: 'Developer, a small civic technology studio',
        line: 'Runs useful models on the laptops an office already owns.',
      },
      maria: {
        name: 'Maria D’Costa',
        role: 'Linguist, a Konkani language project',
        line: 'Counts the words and spellings that tools still get wrong.',
      },
    },
    // The registration form. The notice beside it is the consent notice's own words.
    register: {
      heading: 'Register',
      lede: 'Tell us who is coming and we will keep a place for you.',
      name: 'Name',
      email: 'Email address',
      submit: 'Register',
      sample: 'This sample form does not send anything.',
      // shown only where JavaScript is off, because the form does nothing without it (written by the builder, for Kathakar; the Konkani pages read it in English until it has Konkani)
      noscript: 'Registering needs JavaScript. Please turn it on and reload this page.',
      // what the consent notice says; the contact, the site name and the complaint line are left for the site, and show as [placeholders]
      consent: {
        fields: 'your name and your email address',
        purpose: 'confirm your place and send you the ticket and any change to this event',
        period: '30 days after the event',
      },
    },
    venue: {
      heading: 'The venue',
      name: 'Mandovi Riverside Hall',
      address: 'Riverfront Road, Panjim (Panaji), Goa 403001',
      finding: 'Finding it',
      landmarks: 'Behind the Old Secretariat, facing the river. Walk through the yellow gate with the blue tiles; the hall’s door is the second one on your left. Look for the banner.',
      mapApp: 'Open in your maps app',
      mapWeb: 'Open in a web map',
      ways: 'Getting there',
      bus: ['By bus.', 'Any bus to the Panjim Kadamba stand, then a ten-minute walk along the river.'],
      ferry: ['By ferry.', 'The Ribandar ferry lands about five minutes’ walk away.'],
      car: ['By car.', 'There is a paid car park behind the hall. On a busy day, park at the Kadamba stand and walk.'],
      access: 'Access',
      step: ['Step-free entrance', 'Yes, through the side gate on Riverfront Road. No steps.'],
      lift: ['Lift', 'One lift to the first floor, big enough for a wheelchair.'],
      toilet: ['Accessible toilet', 'Ground floor, next to the foyer.'],
      river: 'River',
      secretariat: 'Old Secretariat',
      hall: 'Hall',
      bus_stop: 'Bus stop',
    },
    footer: {
      sign: 'A sample page from Susegad UI. Change every word before you publish.',
      links: 'On this page',
      top: 'Back to the top',
      small: 'Mandovi Conclave is a made-up event, so no real person or organisation is meant.',
    },
  },

  // Konkani in Devanagari (Goa Konkani Akademi usage). Draft by a non-native writer, for a native reader to check.
  'gom-Deva': {
    meta: {
      title: 'मांडवी कॉन्क्लेव्ह 2026: सरकारी सेवांखातीर एआय, पणजी', // Mandovi Conclave 2026: AI for public services, Panjim
      description: 'पणजींत एक दीस, सरकारी सेवा घडोवपी, चलोवपी आनी तांचेर अवलंबून आशिल्ल्या लोकांखातीर. वेळापत्रक, उलोवपी आनी थळ. हें एक नमुनो पान, देखून सगळीं उतरां बदला.', // One day in Panjim for people who build, run and rely on public services. The agenda, the speakers and the venue. This is a sample page, so change every word.
    },
    skip: 'थेट मजकुराक वचचें', // Skip to the content
    banner: {
      text: 'शेनवार 21 नोव्हेंबर, सकाळीं 9:30 वरांचेर दारां उगडटात. तुमचें तिकीट, फोनार वा कागदार, हाडात.', // Doors open at 9:30 am on Saturday 21 November. Please bring your ticket, on your phone or on paper.
    },
    site: {
      name: 'मांडवी कॉन्क्लेव्ह', // Mandovi Conclave
    },
    hero: {
      eyebrow: 'शेनवार 21 नोव्हेंबर 2026 · पणजी, गोंय', // Saturday 21 November 2026 · Panjim, Goa
      title: 'सरकारी सेवांखातीर एआय, प्रत्यक्ष वापरांत', // AI for public services, in practice
      lede: 'सरकारी सेवा घडोवपी, चलोवपी आनी तांचेर अवलंबून आशिल्ल्या लोकांखातीर एका दिसाचीं ल्हान भाशणां. कितें चलता, कितें चलना आनी कितें मनशानूच सदांच थारावपाक जाय, तें आमी पळयतात.', // One day of short talks for the people who build, run and rely on public services. We look at what works, what does not, and what a person should always still decide.
      posterAlt: 'गोंयांतल्या पहांटेचो एक टेबल: लोखणाच्या सळ्यांच्या खिडकेच्या सकयल एक लॅपटॉप आनी चाहाचो स्टीलाचो ग्लास, भायर माडां आनी कवलां घातिल्लें घर.', // A desk at dawn in Goa: a laptop and a steel tumbler of tea below a barred window, with palms and a red-tiled house outside.
      play: 'चित्र चलोवचें', // Play the picture
      seeAgenda: 'वेळापत्रक पळोवचें', // See the agenda
      findVenue: 'थळ सोदचें', // Find the venue
    },
    // No am or pm here: a Konkani clock says the part of the day (सकाळीं, दनपारां, सांजे, राती), which pages.mjs takes from susegad/core/intl.kok.js.
    time: {
      to: 'ते', // to
      ist: 'IST', // IST
      istFull: 'भारतीय प्रमाण वेळ', // India Standard Time
    },
    agenda: {
      heading: 'वेळापत्रक', // Agenda
      zone: 'हांगा दिल्ल्यो सगळ्यो वेळो भारतीय प्रमाण वेळेंत (IST) आसात: पणजींतल्या घड्याळाची वेळ.', // Every time here is India Standard Time (IST), the clock in Panjim.
      day: 'शेनवार 21 नोव्हेंबर', // Saturday 21 November
    },
    rooms: {
      main: 'मुखेल सभागृह', // Main hall
      studio: 'स्टुडिओ खोली', // Studio room
      foyer: 'लॉबी', // Foyer
    },
    tracks: {
      services: 'सरकारी सेवा', // Public services
      language: 'भास आनी नोंदी', // Language and records
      tools: 'मोकळीं साधनां', // Open tools
    },
    organisers: 'आयोजक', // The organisers
    sessions: {
      doors: 'दारां उगडतात आनी नांव नोंद', // Doors open and registration
      welcome: 'स्वागत, आनी आमी हांगा कित्याक', // Welcome, and why we are here
      forms: 'सोप्या भाशेंतले अर्ज: अर्ज भरपी मनशाखातीर तो परत बरोवपी एक मॉडेल', // Plain-language forms: a model that rewrites a form for the person filling it
      records: 'हातान बरयल्ल्यो नोंदी वाचप, मूळ पान जपून दवरून', // Reading handwritten records without losing the original
      tea: 'चाह आनी विसांवो', // Tea and a sit down
      review: 'मॉडेलान कितें थारावचें न्हय: लाभाच्या मागण्यांत मनशाची तपासणी', // What a model should not decide: human review in benefit claims
      lunch: 'दनपारचें जेवण', // Lunch
      laptop: 'ल्हान कार्यालयाखातीर मोकळीं साधनां: एका लॅपटॉपार कितें चलता', // Open tools for a small office: what runs on one laptop
      konkani: 'पडद्यार आनी आवाजांत कोंकणी: आमी खंय पावल्यात आनी कितें उणें आसा', // Konkani on screen and by voice: where we are and what is missing
      closing: 'प्रस्न आनी समारोप', // Questions, and closing
    },
    speakers: {
      heading: 'उलोवपी', // Speakers
      asha: {
        name: 'आशा नाईक', // Asha Naik
        role: 'सेवा डिझायनर, जिल्हा ई-सेवा केंद्र', // Service designer, a district e-services centre
        line: 'दरेक खण कित्याखातीर आसा तें अर्ज भरपी मनशाक कळचें म्हणून सरकारी अर्ज परत बरयता.', // Rewrites government forms so the person filling one knows what each box is for.
      },
      rohan: {
        name: 'रोहन कामत', // Rohan Kamat
        role: 'नोंदी अधिकारी, तालुका कार्यालय', // Records officer, a taluka office
        line: 'जुने रजिस्टर स्कॅन करता आनी तांच्या दर वाचपा वांगडा मूळ पान दवरता.', // Scans old registers and keeps the original page beside every reading of it.
      },
      sneha: {
        name: 'स्नेहा फर्नांडिस', // Sneha Fernandes
        role: 'धोरण संशोधक, लोकहित कायदा क्लिनिक', // Policy researcher, a public-interest law clinic
        line: 'खंय मनशानूच सदांच थारावपाक जाय हें विचारता.', // Asks where a person must always be the one who decides.
      },
      vivek: {
        name: 'विवेक देसाय', // Vivek Dessai
        role: 'डेव्हलपर, ल्हान नागरी तंत्रज्ञान स्टुडिओ', // Developer, a small civic technology studio
        line: 'कार्यालयाकडेन आदींच आशिल्ल्या लॅपटॉपांचेर उपेगी मॉडेल चलयता.', // Runs useful models on the laptops an office already owns.
      },
      maria: {
        name: 'मारिया डिकॉस्ता', // Maria D’Costa
        role: 'भाशा अभ्यासक, कोंकणी भास प्रकल्प', // Linguist, a Konkani language project
        line: 'साधनां अजून चुकीचीं बरयतात तीं उतरां आनी स्पेलिंग मोजता.', // Counts the words and spellings that tools still get wrong.
      },
    },
    // The registration form. Draft, for a native reader: see KONKANI-FOR-READER.md.
    register: {
      heading: 'नांव नोंद', // Register
      lede: 'कोण कोण येता तें आमकां सांगात, आमी तुमच्या खातीर एक जागो दवरतले.', // Tell us who is coming and we will keep a place for you.
      name: 'नांव', // Name
      email: 'ई-मेल पत्तो', // Email address
      submit: 'नोंद करात', // Register
      sample: 'हो नमुनो अर्ज कांयच धाडिना.', // This sample form does not send anything.
      consent: {
        fields: 'तुमचें नांव आनी ई-मेल पत्तो', // your name and your email address
        purpose: 'तुमच्या जागेची पक्कायकी करप आनी तिकीट तशेंच ह्या कार्यक्रमांतले बदल धाडप', // confirm your place and send you the ticket and any change to this event
        period: 'कार्यक्रमा उपरांत 30 दिसां', // 30 days after the event
      },
    },
    venue: {
      heading: 'थळ', // The venue
      name: 'मांडवी रिव्हरसाईड हॉल', // Mandovi Riverside Hall
      address: 'रिव्हरफ्रंट रोड, पणजी (पांजिम), गोंय 403001', // Riverfront Road, Panjim (Panaji), Goa 403001
      finding: 'तें सोदप', // Finding it
      landmarks: 'जुन्या सचिवालयाच्या फाटल्यान, न्हंयेच्या मुखार. निळ्या कवलांचें पिवळें फाटक वलांडून भीतर वचात; सभागृहाचें दार तुमच्या दाव्या हाताक दुसरें. बॅनर पळोवचो.', // Behind the Old Secretariat, facing the river. Walk through the yellow gate with the blue tiles; the hall’s door is the second one on your left. Look for the banner.
      mapApp: 'तुमच्या नकाशा अॅपांत उगडचें', // Open in your maps app
      mapWeb: 'वेब नकाशांत उगडचें', // Open in a web map
      ways: 'थळाक कशें पावचें', // Getting there
      bus: ['बसीन.', 'पणजी कदंब बसस्थानकाक वतली खंयचीय बस, मागीर न्हंयेकडेन धा मिनटांची चाल.'], // By bus. | Any bus to the Panjim Kadamba stand, then a ten-minute walk along the river.
      ferry: ['फेरीन.', 'रिबांदराची फेरी लागता थळा पासून सुमार पांच मिनटांची चाल.'], // By ferry. | The Ribandar ferry lands about five minutes’ walk away.
      car: ['कारीन.', 'सभागृहाच्या फाटल्यान पयशे दिवपाची कार पार्किंग आसा. गर्दी आशिल्ल्या दिसा कदंब स्टँडार गाडी पार्क करून चलत यात.'], // By car. | There is a paid car park behind the hall. On a busy day, park at the Kadamba stand and walk.
      access: 'प्रवेशाच्यो सोयी', // Access
      step: ['पायऱ्यो नाशिल्लो प्रवेश', 'हय, रिव्हरफ्रंट रोडाचेर आशिल्ल्या कुशीच्या फाटकांतल्यान. पायऱ्यो ना.'], // Step-free entrance | Yes, through the side gate on Riverfront Road. No steps.
      lift: ['लिफ्ट', 'पयल्या मजल्यार वचपाक एक लिफ्ट, व्हीलचेअर मावपा इतली व्हडली.'], // Lift | One lift to the first floor, big enough for a wheelchair.
      toilet: ['सगळ्यांक वापरपाजोगें शौचालय', 'तळमजल्यार, लॉबीचे लागीं.'], // Accessible toilet | Ground floor, next to the foyer.
      river: 'न्हंय', // River
      secretariat: 'जुनें सचिवालय', // Old Secretariat
      hall: 'सभागृह', // Hall
      bus_stop: 'बसथांबो', // Bus stop
    },
    footer: {
      sign: 'Susegad UI चें एक नमुनो पान. प्रकाशीत करपा आदीं सगळीं उतरां बदला.', // A sample page from Susegad UI. Change every word before you publish.
      links: 'ह्या पानांत', // On this page
      top: 'वयर वचचें', // Back to the top
      small: 'मांडवी कॉन्क्लेव्ह हो एक कल्पीत कार्यक्रम, देखून खंयच्याय खऱ्या मनशाक वा संस्थेक उद्देशून न्हय.', // Mandovi Conclave is a made-up event, so no real person or organisation is meant.
    },
  },

  // Konkani in Romi (common Goan Roman spelling: x for श, nn for ण and in Konknni, -em endings, no diacritics).
  // Draft by a non-native writer, for a native reader to check.
  'gom-Latn': {
    meta: {
      title: 'Mandovi Conclave 2026: sorkari sevankhatir AI, Panjim', // Mandovi Conclave 2026: AI for public services, Panjim
      description: 'Panjimta ek dis, sorkari sevam ghodovpi, chalovpi ani tancher avolombun asllea lokankhatir. Velapotrok, ulovpi ani thol. Hem ek namunno pan, dekhun sogllim utram bodla.', // One day in Panjim for people who build, run and rely on public services. The agenda, the speakers and the venue. This is a sample page, so change every word.
    },
    skip: 'Thet mojkurak vochem', // Skip to the content
    banner: {
      text: 'Sonvar 21 Novembr, sokallim 9:30 vorancher daram ugdat. Tumchem tikit, fonar va kagdar, hadat.', // Doors open at 9:30 am on Saturday 21 November. Please bring your ticket, on your phone or on paper.
    },
    site: {
      name: 'Mandovi Conclave', // Mandovi Conclave
    },
    hero: {
      eyebrow: 'Sonvar 21 Novembr 2026 · Panjim, Goem', // Saturday 21 November 2026 · Panjim, Goa
      title: 'Sorkari sevankhatir AI, protyoksh vaparant', // AI for public services, in practice
      lede: 'Sorkari sevam ghodovpi, chalovpi ani tancher avolombun asllea lokankhatir eka disachim lhan bhaxonnam. Kitem chalta, kitem chalna ani kitem monxanuch sodanch tharavpak zai, tem ami polloitat.', // One day of short talks for the people who build, run and rely on public services. We look at what works, what does not, and what a person should always still decide.
      posterAlt: 'Goemchea pahantecho ek table: lokhnnachea sollyanchea khidkechea sokoil ek laptop ani chahacho stilacho glas, bhayr madam ani kavlam ghatillem ghor.', // A desk at dawn in Goa: a laptop and a steel tumbler of tea below a barred window, with palms and a red-tiled house outside.
      play: 'Chitr chalovchem', // Play the picture
      seeAgenda: 'Velapotrok pollovchem', // See the agenda
      findVenue: 'Thol sodchem', // Find the venue
    },
    // No am or pm here: a Konkani clock says the part of the day (sokallim, donparam, sanje, rati), which pages.mjs takes from susegad/core/intl.kok.js.
    time: {
      to: 'te', // to
      ist: 'IST', // IST
      istFull: 'Bharotiy pramann vel', // India Standard Time
    },
    agenda: {
      heading: 'Velapotrok', // Agenda
      zone: 'Hanga dillyo sogllyo velo Bharotiy pramann velent (IST) asat: Panjimchea ghodyalachi vel.', // Every time here is India Standard Time (IST), the clock in Panjim.
      day: 'Sonvar 21 Novembr', // Saturday 21 November
    },
    rooms: {
      main: 'Mukhel sobhagruh', // Main hall
      studio: 'Studio kholi', // Studio room
      foyer: 'Lobi', // Foyer
    },
    tracks: {
      services: 'Sorkari sevam', // Public services
      language: 'Bhas ani nondi', // Language and records
      tools: 'Moklim sadhnam', // Open tools
    },
    organisers: 'Ayojok', // The organisers
    sessions: {
      doors: 'Daram ugodtat ani nanv nond', // Doors open and registration
      welcome: 'Swagat, ani ami hanga kityak', // Welcome, and why we are here
      forms: 'Sopea bhaxentle arz: arz bhorpi monxakhatir to porot borovpi ek model', // Plain-language forms: a model that rewrites a form for the person filling it
      records: 'Hatan borollyo nondi vachop, mul pan japun dovorun', // Reading handwritten records without losing the original
      tea: 'Chah ani visanvo', // Tea and a sit down
      review: 'Modelan kitem tharavchem nhoi: labhachea magnnyant monxachi tapasnni', // What a model should not decide: human review in benefit claims
      lunch: 'Danparchem jevonn', // Lunch
      laptop: 'Lhan karyalayakhatir moklim sadhnam: eka laptopar kitem chalta', // Open tools for a small office: what runs on one laptop
      konkani: 'Padyar ani avazant Konknni: ami khoim pavlyat ani kitem unnem asa', // Konkani on screen and by voice: where we are and what is missing
      closing: 'Prosn ani samarop', // Questions, and closing
    },
    speakers: {
      heading: 'Ulovpi', // Speakers
      asha: {
        name: 'Asha Naik', // Asha Naik
        role: 'Seva designer, zilla e-seva kendr', // Service designer, a district e-services centre
        line: 'Dorek khonn kityakhatir asa tem arz bhorpi monxak kollchem mhunn sorkari arz porot borayta.', // Rewrites government forms so the person filling one knows what each box is for.
      },
      rohan: {
        name: 'Rohan Kamat', // Rohan Kamat
        role: 'Nondi adhikari, taluka karyalay', // Records officer, a taluka office
        line: 'Junem register scan korta ani tancha dor vachpa vangda mul pan dovorta.', // Scans old registers and keeps the original page beside every reading of it.
      },
      sneha: {
        name: 'Sneha Fernandes', // Sneha Fernandes
        role: 'Dhoron sonxodhok, lokhit kayda clinic', // Policy researcher, a public-interest law clinic
        line: 'Khoim monxanuch sodanch tharavpak zai hem vicharta.', // Asks where a person must always be the one who decides.
      },
      vivek: {
        name: 'Vivek Dessai', // Vivek Dessai
        role: 'Developer, lhan nagri tontrogyan studio', // Developer, a small civic technology studio
        line: 'Karyalayakoden adinch asllea laptopancher upegi model chalayta.', // Runs useful models on the laptops an office already owns.
      },
      maria: {
        name: 'Maria D’Costa', // Maria D’Costa
        role: 'Bhaxa abhyasak, Konknni bhas proklop', // Linguist, a Konkani language project
        line: 'Sadhnam azun chukichim borotat tim utram ani spelling mojta.', // Counts the words and spellings that tools still get wrong.
      },
    },
    // The registration form. Draft, for a native reader: see KONKANI-FOR-READER.md.
    register: {
      heading: 'Nanv nond', // Register
      lede: 'Kon kon yeta tem amkam sangat, ami tumchea khatir ek zago dovortole.', // Tell us who is coming and we will keep a place for you.
      name: 'Nanv', // Name
      email: 'E-mel patto', // Email address
      submit: 'Nond korat', // Register
      sample: 'Ho namunno arz kainch dhadina.', // This sample form does not send anything.
      consent: {
        fields: 'tumchem nanv ani e-mel patto', // your name and your email address
        purpose: 'tumchea zagechi pakkaikee korop ani tikit toxem hya karyokramantle bodol dhadop', // confirm your place and send you the ticket and any change to this event
        period: 'karyokrama uprant 30 disam', // 30 days after the event
      },
    },
    venue: {
      heading: 'Thol', // The venue
      name: 'Mandovi Riverside Hall', // Mandovi Riverside Hall
      address: 'Riverfront Road, Panjim (Panaji), Goem 403001', // Riverfront Road, Panjim (Panaji), Goa 403001
      finding: 'Tem sodop', // Finding it
      landmarks: 'Junea sochivalayachea fatlean, nhoimchea mukhar. Nilea kavlancho pivlem fatok volandun bhitor vochat; sobhagruhachem dar tumchea davea hatak dusrem. Banner pollovcho.', // Behind the Old Secretariat, facing the river. Walk through the yellow gate with the blue tiles; the hall’s door is the second one on your left. Look for the banner.
      mapApp: 'Tumchea nakxa appant ugodchem', // Open in your maps app
      mapWeb: 'Web nakxant ugodchem', // Open in a web map
      ways: 'Thollak koxem pavchem', // Getting there
      bus: ['Basin.', 'Panjim Kadamba bussthanakak votli khoinchiy bus, magir nhoikoden dha minutanchi chal.'], // By bus. | Any bus to the Panjim Kadamba stand, then a ten-minute walk along the river.
      ferry: ['Ferin.', 'Ribandarachi feri lagta thollapasun sumar panch minutanchi chal.'], // By ferry. | The Ribandar ferry lands about five minutes’ walk away.
      car: ['Karin.', 'Sobhagruhachea fatlean poyxe divpachi car parking asa. Gordi asllea disa Kadamba standar gaddi park korun chalot yat.'], // By car. | There is a paid car park behind the hall. On a busy day, park at the Kadamba stand and walk.
      access: 'Provexachyo soyi', // Access
      step: ['Pairyo nashillo provex', 'Hoy, Riverfront Roddacher asllea kuxichea fatkantlean. Pairyo na.'], // Step-free entrance | Yes, through the side gate on Riverfront Road. No steps.
      lift: ['Lift', 'Poylea mojlear vochpak ek lift, wheelchair mavpa itli vhodli.'], // Lift | One lift to the first floor, big enough for a wheelchair.
      toilet: ['Soglleank vaparpajogem xouchalay', 'Tolmojlear, lobiche lagim.'], // Accessible toilet | Ground floor, next to the foyer.
      river: 'Nhoim', // River
      secretariat: 'Junem sochivalay', // Old Secretariat
      hall: 'Sobhagruh', // Hall
      bus_stop: 'Bus thambo', // Bus stop
    },
    footer: {
      sign: 'Susegad UI-chem ek namunno pan. Prokaxit korpa adim sogllim utram bodla.', // A sample page from Susegad UI. Change every word before you publish.
      links: 'Hea panant', // On this page
      top: 'Voir vochem', // Back to the top
      small: 'Mandovi Conclave ho ek kolpit karyakram, dekhun khoinchyay khorya monxak va sansthek uddexun nhoi.', // Mandovi Conclave is a made-up event, so no real person or organisation is meant.
    },
  },
};

/**
 * The Konkani keys a native reader has checked, as '<tag>:<key>' (the same idea as REVIEWED in
 * susegad/core/strings.table.js). Empty today: add 'gom-Deva:hero.title' and 'gom-Latn:hero.title'
 * once a reader has said they are fine. unreviewed() lists what is left.
 */
export const REVIEWED = new Set();

/** The Konkani keys nobody has checked yet, per language, as dotted paths (venue.bus.0 for the first word of a pair). */
export function unreviewed(copy = COPY, reviewed = REVIEWED) {
  const walk = (o, tag, path = []) => Object.entries(o).flatMap(([k, v]) => typeof v === 'string' ? [[...path, k].join('.')] : Array.isArray(v) ? v.map((_, i) => [...path, k, i].join('.')) : walk(v, tag, [...path, k]));
  return Object.fromEntries(Object.entries(copy).filter(([tag]) => tag.startsWith('gom')).map(([tag, c]) => [tag, walk(c, tag).filter(k => !reviewed.has(`${tag}:${k}`))]));
}

/** How many entries still wait for words, per language. The CLI and the check read this. */
export function unwritten(copy = COPY) {
  const count = (o, n = 0) => Object.values(o).reduce((sum, v) => sum + (typeof v === 'string' ? +/^\[TODO /.test(v) : Array.isArray(v) ? v.filter(s => /^\[TODO /.test(s)).length : count(v)), n);
  return Object.fromEntries(Object.entries(copy).map(([tag, c]) => [tag, count(c)]));
}
