// The ticket's own words, by language (decision 0025, core/strings.js). English is the base.
// The Konkani is a draft for a native reader. The keys (a function entry gets the values shown):
//
//   heading        "Your ticket"
//   name, event    the labels of the name and the event
//   time           "Time (IST)": the label of the time; the zone is in the label, the value is date and clock
//   id             "Ticket id"
//   qrAlt(id)      the picture's name; true only while the code holds the id and nothing else
//   qrBeside       what to do at the door, and with a code that will not scan
//   save, saved, saveFailed    the save-as-picture button and what it says after
//   offline        what opening the page again without a connection does
//   done           the one line that ends the registration; said once, with the id read slowly
//   local          "kept on this device only, nothing sent to a server"
//   forget, forgot the control that removes the ticket from this device, and what is said after it: not in the deck;
//                  plain English by the builder, flagged for Kathakar, and read in English (marked lang="en") until written

export const BY_LANG = {
  en: {
    heading: 'Your ticket',
    name: 'Name',
    event: 'Event',
    time: 'Time (IST)',
    id: 'Ticket id',
    qrAlt: id => `QR code for ticket ${id}. It holds the ticket id and nothing else.`,
    qrBeside: 'Show this code at the door. If it will not scan, read out the ticket id beside it.',
    save: 'Save as picture',
    saved: 'Saved. Look for it in your downloads or photos.',
    saveFailed: 'The picture did not save. Try again, or take a screenshot of this page.',
    offline: 'After you have opened this page once, it opens again without a connection.',
    done: 'You are on the list. See you there.',
    local: 'This ticket is kept on this device only. Nothing was sent to a server.',
    forget: 'Forget this ticket',
    forgot: 'Forgotten. The ticket is no longer on this device.',
  },
  'gom-Deva': {
    heading: 'तुमचें तिकीट', // Your ticket
    name: 'नांव', // Name
    event: 'कार्यक्रम', // Event
    time: 'वेळ (IST)', // Time (IST)
    id: 'तिकिटाचो क्रमांक', // Ticket id
    qrAlt: id => `तिकीट ${id} खातीर क्यूआर कोड. ताका तिकिटाचो क्रमांक सोडल्यार कांयच ना.`, // QR code for ticket {id}. It holds the ticket id and nothing else.
    qrBeside: 'दारांत हो कोड दाखयात. स्कॅन जालो ना जाल्यार, वयलो क्रमांक वाचून सांगात.', // Show this code at the door. If it will not scan, read out the ticket id beside it.
    save: 'चित्र म्हणून सांबाळचें', // Save as picture
    saved: 'सांबाळ्ळें. डाउनलोड वा फोटोंत पळयात.', // Saved. Look for it in your downloads or photos.
    saveFailed: 'चित्र सांबाळूक जालें ना. परत यत्न करात, वा ह्या पानाचो स्क्रीनशॉट काडात.', // The picture did not save. Try again, or take a screenshot of this page.
    offline: 'हें पान एकदां उगडल्यार, परत जोडणी बगर उगडटलें.', // After you have opened this page once, it opens again without a connection.
    done: 'तुमचें नांव यादींत आसा. थंय भेटूंया.', // You are on the list. See you there.
    local: 'हें तिकीट फकत ह्याच उपकरणार सांबाळ्ळां. सर्व्हराक कांयच धाडलें ना.', // This ticket is kept on this device only. Nothing was sent to a server.
  },
  'gom-Latn': {
    heading: 'Tumchem tikit', // Your ticket
    name: 'Nanv', // Name
    event: 'Karyokrom', // Event
    time: 'Vel (IST)', // Time (IST)
    id: 'Tikitacho kromank', // Ticket id
    qrAlt: id => `Tikit ${id} khatir kyuar kod. Taka tikitacho kromank sodlear kainch na.`, // QR code for ticket {id}. It holds the ticket id and nothing else.
    qrBeside: 'Daranty ho kod dakhoyat. Skan zalo na zalear, voilo kromank vachun sangat.', // Show this code at the door. If it will not scan, read out the ticket id beside it.
    save: 'Chitr mhunn sambollchem', // Save as picture
    saved: 'Sambollem. Download va fotont polloyat.', // Saved. Look for it in your downloads or photos.
    saveFailed: 'Chitr sambolk zalem na. Porot yatn korat, va hya panacho skrinxot kadat.', // The picture did not save. Try again, or take a screenshot of this page.
    offline: 'Hem pan ekdam ugdolear, porot jodonni bogor ugdotlem.', // After you have opened this page once, it opens again without a connection.
    done: 'Tumchem nanv yadint asa. Thoim bhetum ya.', // You are on the list. See you there.
    local: 'Hem tikit phokot hyach upkoronar sambollam. Serverak kainch dhadlem na.', // This ticket is kept on this device only. Nothing was sent to a server.
  },
};

/** The Konkani keys a native reader has checked, as '<tag>:<key>'. Empty today. */
export const REVIEWED = new Set();
