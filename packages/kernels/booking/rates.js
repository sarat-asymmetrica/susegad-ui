/* ============================================================================
   rates.js: the rate card as data. One file to change when the owner decides.

   These are illustrative figures for a fictional house (Casa Exemplo), not a
   real rate card. Kept plausible so the UI, the price table and the tests all
   have something realistic to work against.

   Epistemic status, band by band:
     - launch, shoulder, peak: a first guess at the *ranges*; the
       weekday/weekend split inside each range is a placeholder and is
       flagged `provisional` so the UI can say so.
     - late (Feb–Mar): held at shoulder and flagged provisional.
     - GST: 18% applies above ₹7,500/night (settled). Whether the card is
       inclusive or exclusive is NOT settled: `gst.inclusive` is the switch,
       and the UI prints which mode is live rather than implying.
     - deposit: a placeholder, to be confirmed and printed on the booking page.

   Ported unchanged in behaviour from the villa redesign; only comments differ.
   ========================================================================== */

export const RATES = {
  currency: "INR",
  /** Nights are priced by the band the night falls in. Bands are [from, to]
      inclusive, as MM-DD, and may wrap the year end. */
  bands: [
    { id: "launch",   label: "Launch & monsoon", from: "04-01", to: "09-30", weekday: 12000, weekend: 16000, minNights: 3, provisional: true,  tone: "free" },
    { id: "shoulder", label: "Shoulder",         from: "10-01", to: "12-19", weekday: 20000, weekend: 26000, minNights: 3, provisional: true,  tone: "free" },
    { id: "peak",     label: "Christmas week",   from: "12-20", to: "01-05", weekday: 40000, weekend: 48000, minNights: 4, provisional: true,  tone: "peak" },
    { id: "shoulder", label: "Shoulder",         from: "01-06", to: "01-31", weekday: 20000, weekend: 26000, minNights: 3, provisional: true,  tone: "free" },
    { id: "late",     label: "Late season",      from: "02-01", to: "03-31", weekday: 20000, weekend: 26000, minNights: 3, provisional: true,  tone: "free" },
  ],
  gst: { rate: 0.18, threshold: 7500, inclusive: false },
  deposit: { amount: 15000, releaseDaysAfterCheckout: 7, provisional: true },
  guests: { max: 6 },
  /** Booking window. Arrivals before `openFrom` are enquiries, not bookings,
      because registration is still in progress. */
  window: { openFrom: "2026-10-15", openUntil: "2027-06-30", minLeadDays: 2, maxNights: 21 },
  checkIn: "14:00",
  checkOut: "11:00",
};

/** Find the band a date falls in. Pure. */
export function bandFor(iso, rates = RATES) {
  const mmdd = iso.slice(5);
  for (const b of rates.bands) {
    if (b.from <= b.to) { if (mmdd >= b.from && mmdd <= b.to) return b; }
    else if (mmdd >= b.from || mmdd <= b.to) return b; // wraps the year end
  }
  return null;
}
