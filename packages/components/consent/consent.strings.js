// The consent notice's own words, by language (decision 0025, core/strings.js). English is the base.
// The Konkani is a draft that
// waits for a native reader, and the whole notice waits for a legal read before a site goes live.
//
// The notice names what is collected, why, for how long, whom to ask and how to withdraw. It says
// "your details", not "personal data", and "write to", not "exercise your rights". It names no law and
// no body: the complaint line is the site's own (`complain`), left as a visible placeholder.
//
// Function entries get the site's values; a value the site has not given is shown as a visible
// [placeholder] (the `blank` table), so no site publishes the sample by mistake. Every placeholder is in English,
// in every language, and is marked lang="en": it is for the site builder, who fills it in, not for a visitor, so
// it has no Konkani (the deck's draft Konkani complaint placeholder is dropped on the owner's ruling). The keys:
//
//   heading             "What we do with your details"
//   collect(fields)     "We ask for your name and your email address."
//   why(purpose)        "We use them to confirm your place, and for nothing else."
//   howLong(period)     "We keep them until 30 days after the event, then we delete them."
//   ask(contact)        "To ask what we hold, to correct it, or to have it deleted, write to …"
//   withdraw            how to take consent back, and what taking it back does not undo
//   complain            the site's own line on where to complain; a placeholder until it is filled
//   checkbox(site)      the label of the (never pre-ticked) box
//   needed              said when the form is sent without the tick
//   blank.*             the placeholders for a value the site has not given

export const BY_LANG = {
  en: {
    heading: 'What we do with your details',
    collect: fields => `We ask for ${fields}.`,
    why: purpose => `We use them to ${purpose}, and for nothing else.`,
    howLong: period => `We keep them until ${period}, then we delete them.`,
    ask: contact => `To ask what we hold, to correct it, or to have it deleted, write to ${contact}.`,
    withdraw: 'You can take back your consent at any time by writing to the same address. Taking it back will not undo anything we did before you wrote, and we will tell you if it changes what we can do for you.',
    complain: '[complaint line: the site fills this in, naming where a visitor can complain if they are not satisfied]',
    checkbox: site => `I have read this, and I agree that ${site} may use my details in this way.`,
    needed: 'Please tick the box if you are happy to go on. We cannot use your details without it.',
    // for the builder, not the visitor: shown in square brackets until the site fills the value in
    blank: {
      fields: '[fields: what the form asks for]',
      purpose: '[purpose: why you need them]',
      period: '[period: how long you keep them]',
      contact: '[contact: the site fills in a real address]',
      site: '[site name]',
    },
  },
  'gom-Deva': {
    heading: 'तुमच्या तपशीलांचें आमी कितें करतात', // What we do with your details
    collect: fields => `आमी ${fields} विचारतात.`, // We ask for {fields}.
    why: purpose => `तीं आमी ${purpose} खातीर वापरतात, आनी हेर कशाखातीरूय ना.`, // We use them to {purpose}, and for nothing else.
    howLong: period => `तीं ${period} मेरेन दवरतात, मागीर काडून उडयतात.`, // We keep them until {period}, then we delete them.
    ask: contact => `आमचेकडेन कितें आसा तें विचारपाक, सुदारपाक वा काडून उडोवपाक, ${contact} वयर बरयात.`, // To ask what we hold, to correct it, or to have it deleted, write to {contact}.
    withdraw: 'तुमी केन्नाय बी त्याच पत्त्यार बरयून तुमची संमती परत घेवं येता. परत घेतल्या आदीं जें जालें तें उणें जावचें ना, आनी तुमच्या खातीर आमी कितें करूं शकतात तें बदलता जाल्यार, आमी सांगतले.', // You can take back your consent at any time by writing to the same address. …
    checkbox: site => `म्हज्या तपशीलांचो ${site} हांगा सांगिल्ल्या तरेन वापर करपाक म्हजी संमती आसा. हें हांव वाचलें.`, // I have read this, and I agree that {site} may use my details in this way.
    needed: 'पुडें वचपाक खूशी आसल्यार, खण टिक करात. ताचेवयचिना आमी तुमचे तपशील वापरूं शकना.', // Please tick the box if you are happy to go on. We cannot use your details without it.
  },
  'gom-Latn': {
    heading: 'Tumchea topxilanchem ami kitem kortat', // What we do with your details
    collect: fields => `Ami ${fields} vichartat.`, // We ask for {fields}.
    why: purpose => `Tim ami ${purpose} khatir vapartat, ani her kaxakhatirui na.`, // We use them to {purpose}, and for nothing else.
    howLong: period => `Tim ${period} meren dovortat, magir kadun udoitat.`, // We keep them until {period}, then we delete them.
    ask: contact => `Amchekden kitem asa tem vicharpak, sudharpak va kadun udovpak, ${contact} voir boroyat.`, // To ask what we hold, to correct it, or to have it deleted, write to {contact}.
    withdraw: 'Tumi kennai bi tyach pattyar boroyun tumchi sommoti porot ghevn yeta. Porot ghetlea adim jem zalem tem unem zavchem na, ani tumchea khatir ami kitem korun xokta tem bodolta zalear, ami sangtele.', // You can take back your consent at any time by writing to the same address. …
    checkbox: site => `Mhajea topxilancho ${site} hanga sangillea taren vapar korpak mhaji sommoti asa. Hem hanv vachlem.`, // I have read this, and I agree that {site} may use my details in this way.
    needed: 'Pudem vachpak khuxi asalear, khonn tik korat. Tachevoichina ami tumche topxil vapru xokna.', // Please tick the box if you are happy to go on. We cannot use your details without it.
  },
};

/** The Konkani keys a native reader has checked, as '<tag>:<key>'. Empty today; nothing here is checked yet. */
export const REVIEWED = new Set();
