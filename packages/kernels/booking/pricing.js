/* ============================================================================
   pricing.js: pure quote kernel.

   quote(arrival, departure) -> a full breakdown a guest could check by hand:
   every night with its band and rate, the subtotal, GST in the mode the
   card is set to, the deposit, and the minimum-night rule that applies.

   No I/O, no clock, no store. Availability is someone else's job
   (availability.js); this only prices a range.

   Ported unchanged in behaviour from the villa redesign; only comments differ.
   ========================================================================== */

import { RATES, bandFor } from "./rates.js";
import { eachDay, diffDays, isWeekendNight, isValidISO } from "./dates.js";

/** Rupees, Indian grouping: 224000 -> '2,24,000'. Pure, no Intl dependence. */
export function inr(n) {
  const s = String(Math.round(Math.abs(n)));
  if (s.length <= 3) return (n < 0 ? "-" : "") + s;
  const last3 = s.slice(-3);
  const rest = s.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ",");
  return (n < 0 ? "-" : "") + rest + "," + last3;
}
export const rupees = (n) => "₹" + inr(n);

export function nightlyRate(iso, rates = RATES) {
  const b = bandFor(iso, rates);
  if (!b) return null;
  return { band: b, rate: isWeekendNight(iso) ? b.weekend : b.weekday, weekend: isWeekendNight(iso) };
}

/**
 * Price a stay. Returns { ok, reasons, nights, subtotal, gst, total, deposit,
 * minNights, bands }. `ok` is false when the range itself is malformed or
 * breaks a minimum-night rule; availability is checked elsewhere.
 */
export function quote(arrival, departure, rates = RATES) {
  const reasons = [];
  if (!isValidISO(arrival) || !isValidISO(departure)) {
    return { ok: false, reasons: ["Dates are not valid."], nights: [], subtotal: 0, gst: 0, total: 0, deposit: rates.deposit.amount, minNights: 0, bands: [] };
  }
  const n = diffDays(arrival, departure);
  if (n <= 0) reasons.push("Departure must be after arrival.");
  const nights = n > 0 ? eachDay(arrival, departure).map((date) => {
    const r = nightlyRate(date, rates);
    return { date, band: r?.band.id ?? "unpriced", label: r?.band.label ?? "Unpriced", rate: r?.rate ?? 0, weekend: r?.weekend ?? false, tone: r?.band.tone ?? "free", provisional: r?.band.provisional ?? true };
  }) : [];

  const bands = [...new Set(nights.map((x) => x.band))];
  const minNights = nights.reduce((m, x) => Math.max(m, bandFor(x.date, rates)?.minNights ?? 0), 0);
  if (n > 0 && n < minNights) {
    const peak = nights.some((x) => x.band === "peak");
    reasons.push(peak ? `The Christmas band has a ${minNights}-night minimum.` : `This band has a ${minNights}-night minimum.`);
  }
  if (n > rates.window.maxNights) reasons.push(`Stays are capped at ${rates.window.maxNights} nights; write to us for longer.`);
  if (nights.some((x) => x.rate === 0)) reasons.push("Part of this stay is not priced yet.");

  const gross = nights.reduce((s, x) => s + x.rate, 0);
  let subtotal, gst, total;
  const taxable = nights.length && (gross / Math.max(nights.length, 1)) > rates.gst.threshold;
  if (rates.gst.inclusive) {
    total = gross;
    gst = taxable ? Math.round(gross - gross / (1 + rates.gst.rate)) : 0;
    subtotal = total - gst;
  } else {
    subtotal = gross;
    gst = taxable ? Math.round(gross * rates.gst.rate) : 0;
    total = subtotal + gst;
  }

  return {
    ok: reasons.length === 0,
    reasons,
    arrival, departure,
    nightCount: Math.max(n, 0),
    nights, bands, minNights,
    subtotal, gst, total,
    gstMode: rates.gst.inclusive ? "inclusive" : "exclusive",
    gstRate: rates.gst.rate,
    deposit: rates.deposit.amount,
    provisional: nights.some((x) => x.provisional),
  };
}

/** The lowest nightly figure on the card, for "from ₹…" copy. */
export function fromRate(rates = RATES) {
  return Math.min(...rates.bands.map((b) => b.weekday));
}
