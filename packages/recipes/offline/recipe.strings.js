// The offline page's words, by language (decision 0025, core/strings.js). English is the base.
// The Konkani is a draft for a native reader. The page cannot say much, and it must say that the fault is not the visitor's.
//
// The two lists are true only for what the worker keeps: `works1` and `works2` name the event page and the
// ticket (README, "Where the ticket comes in"). A site that keeps more or less changes these words to match.

export const BY_LANG = {
  en: {
    title: 'No connection right now',
    lede: 'We cannot reach the internet from here. Nothing you did caused this, and it often passes on its own.',
    worksHeading: 'Still here for you',
    works1: 'The event page, if you have opened it before.',
    works2: 'Your ticket, if you have opened it before.',
    notHeading: 'Waiting for a connection',
    not1: 'Pages you have not opened yet.',
    not2: 'Registering, and anything that needs us to answer.',
    not3: 'Maps, and live updates.',
    retry: 'Try again',
    back: 'Back',
  },
  'gom-Deva': {
    title: 'सध्या जोडणी ना', // No connection right now
    lede: 'हांगासकयल्यान इंटरनेट पावना. तुमच्या हातांतल्यान कांयच चुकलें ना; तें आपशीच सुदारता.', // We cannot reach the internet from here. Nothing you did caused this, and it often passes on its own.
    worksHeading: 'अजून तुमच्या खातीर आसा', // Still here for you
    works1: 'कार्यक्रमाचें पान, तुमी आदीं उगडिल्लें आसल्यार.', // The event page, if you have opened it before.
    works2: 'तुमचें तिकीट, तुमी आदीं उगडिल्लें आसल्यार.', // Your ticket, if you have opened it before.
    notHeading: 'जोडणीची वाट पळयतां', // Waiting for a connection
    not1: 'तुमी अजून उगडून पळयल्लीं ना तीं पानां.', // Pages you have not opened yet.
    not2: 'नांव नोंद, आनी आमी जाप दिवपाक जाय तें सगळें.', // Registering, and anything that needs us to answer.
    not3: 'नकाशे, आनी थेट खबरो.', // Maps, and live updates.
    retry: 'परत यत्न करात', // Try again
    back: 'फाटीं', // Back
  },
  'gom-Latn': {
    title: 'Sodhya jodonni na', // No connection right now
    lede: 'Hangasokoylean internet pavna. Tumchea hatantlean kainch chukllem na; tem apxich sudharta.', // We cannot reach the internet from here. Nothing you did caused this, and it often passes on its own.
    worksHeading: 'Ajun tumchea khatir asa', // Still here for you
    works1: 'Karyokromachem pan, tumi adim ugdillem asalear.', // The event page, if you have opened it before.
    works2: 'Tumchem tikit, tumi adim ugdillem asalear.', // Your ticket, if you have opened it before.
    notHeading: 'Jodonnichi vat polloitat', // Waiting for a connection
    not1: 'Tumi ajun ugdun pollyalim na tim panam.', // Pages you have not opened yet.
    not2: 'Nanv nond, ani ami zap divpak zai tem sogllem.', // Registering, and anything that needs us to answer.
    not3: 'Nokaxe, ani thet khobro.', // Maps, and live updates.
    retry: 'Porot yatn korat', // Try again
    back: 'Phatim', // Back
  },
};

/** The Konkani keys a native reader has checked, as '<tag>:<key>'. Empty today. */
export const REVIEWED = new Set();
