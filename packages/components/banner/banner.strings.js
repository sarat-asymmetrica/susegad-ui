// The banner's own words, by language (decision 0025, core/strings.js). English is the base.
// The Konkani is a draft and waits for a native reader:
// the dismiss verb and its gender, and the order of "back {date}", are the open questions.
// The keys (a function entry gets the values shown):
//
//   label              "Announcement"                       the region's accessible name
//   dismiss            "Dismiss this announcement"          the cross button's accessible name
//   announced(message) "Announcement: Closed for the monsoon"  said once, when the banner first appears
//   back(date)         "Back 1 October"                     the line a back="" date adds

export const BY_LANG = {
  en: {
    label: 'Announcement',
    dismiss: 'Dismiss this announcement',
    announced: message => `Announcement: ${message}`,
    back: date => `Back ${date}`,
  },
  'gom-Deva': {
    label: 'सूचना', // Announcement
    dismiss: 'ही सूचना बंद करचीं', // Dismiss this announcement
    announced: message => `सूचना: ${message}`, // Announcement: {message}
    back: date => `${date} परत`, // Back {date}
  },
  'gom-Latn': {
    label: 'Suchona', // Announcement
    dismiss: 'Hi suchona bond korchi', // Dismiss this announcement
    announced: message => `Suchona: ${message}`, // Announcement: {message}
    back: date => `${date} porot`, // Back {date}
  },
};

/** The Konkani keys a native reader has checked, as '<tag>:<key>'. Empty today; nothing here is checked yet. */
export const REVIEWED = new Set();
