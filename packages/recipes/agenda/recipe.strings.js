// The agenda's own words, by language (decision 0025, core/strings.js). English is the base.
// Konkani is written by Kathakar and waits for a native reader (docs/reviews/2026-10-06-konkani-for-reader.md).
// A key left out of a Konkani table shows the English and marks it lang="en" so a screen reader says it
// in English, not in Konkani's voice. The keys (a function entry gets the values shown):
//
//   now(until)            "Now on stage, until 11:15 am"        a session that is on
//   breakNow(until)       "On now, until 11:45 am"              a break that is on
//   next(when)            "Next, at 2 pm"                       the soonest session still to come
//   at(clock)             "at 2 pm"                             `when` for today
//   tomorrowAt(clock)     "tomorrow at 10 am"                   `when` for tomorrow
//   onDayAt(day, clock)   "Sun 15 Nov at 10 am"                 `when` for a later day (the day is core-intl's English)
//   finished              "Finished"                            read aloud for a past session
//   before(day, clock)    "The agenda starts Sat 14 Nov, at 9:30 am IST."
//   on(n)                 "2 sessions are on stage now."
//   between               "Between sessions."
//   after                 "That was the last session."
//
// Times ("9:30 am") and the day words ("Sat 14 Nov") still come from core/intl.core.js in English.

export const BY_LANG = {
  en: {
    now: until => (until ? `Now on stage, until ${until}` : 'Now on stage'),
    breakNow: until => (until ? `On now, until ${until}` : 'On now'),
    next: when => `Next, ${when}`,
    at: clock => `at ${clock}`,
    tomorrowAt: clock => `tomorrow at ${clock}`,
    onDayAt: (day, clock) => `${day} at ${clock}`,
    finished: 'Finished',
    before: (day, clock) => `The agenda starts ${day}, at ${clock} IST.`,
    on: n => (n === 1 ? 'One session is on stage now.' : `${n} sessions are on stage now.`),
    between: 'Between sessions.',
    after: 'That was the last session.',
  },
  // Written by Kathakar, not a native reader; every entry waits for one. The times and day words inside
  // these sentences stay as core/intl.core.js formats them (English), so the Konkani is written to read
  // acceptably around "9:30 am" and "Sat 14 Nov": the clock comes just before "वेळार" (at the time of).
  'gom-Deva': {
    now: until => (until ? `आतां स्टेजार, ${until} मेरेन` : 'आतां स्टेजार'),
    breakNow: until => (until ? `आतां चलता, ${until} मेरेन` : 'आतां चलता'),
    next: when => `फुडलें, ${when}`,
    at: clock => `${clock} वेळार`,
    tomorrowAt: clock => `फाल्यां ${clock} वेळार`,
    onDayAt: (day, clock) => `${day}, ${clock} वेळार`,
    finished: 'सोंपलें',
    before: (day, clock) => `वेळापत्रक ${day}, ${clock} IST वेळार सुरू जाता.`,
    on: n => (n === 1 ? 'एक सत्र आतां स्टेजार आसा.' : `${n} सत्रां आतां स्टेजार आसात.`),
    between: 'सत्रां मदीं.',
    after: 'तें शेवटलें सत्र आशिल्लें.',
  },
  'gom-Latn': {
    now: until => (until ? `Atam stejar, ${until} meren` : 'Atam stejar'),
    breakNow: until => (until ? `Atam choltam, ${until} meren` : 'Atam choltam'),
    next: when => `Fudlem, ${when}`,
    at: clock => `${clock} velar`,
    tomorrowAt: clock => `Falyam ${clock} velar`,
    onDayAt: (day, clock) => `${day}, ${clock} velar`,
    finished: 'Somplem',
    before: (day, clock) => `Velapotrok ${day}, ${clock} IST velar suru zata.`,
    on: n => (n === 1 ? 'Ek satr atam stejar asa.' : `${n} satram atam stejar asat.`),
    between: 'Satram modim.',
    after: 'Tem xevtlem satr asllem.',
  },
};
