/* ============================================================================
   availability.js: pure availability kernel.

   A booking occupies the nights [arrival, departure). The departure day of
   one stay is the arrival day of the next: the house turns over at 11:00 and
   opens at 14:00, so same-day changeover is allowed and no night is lost.

   Coquelicots' idea, kept: a day can be free as a *night* and still be
   blocked as an *arrival* or a *departure*, and the calendar says which.

   Ported unchanged in behaviour from the villa redesign; only comments differ.
   ========================================================================== */

import { toDay, fromDay, diffDays, eachDay, addDays } from "./dates.js";

/**
 * Build the set of occupied nights from active reservations.
 * `blocks` are {arrival, departure, kind} where kind is 'booking' | 'hold' | 'owner'.
 */
export function occupiedNights(blocks) {
  const map = new Map(); // iso -> kind
  for (const b of blocks) {
    for (const d of eachDay(b.arrival, b.departure)) {
      // a confirmed booking outranks a hold for display purposes
      const prev = map.get(d);
      if (!prev || rank(b.kind) > rank(prev)) map.set(d, b.kind);
    }
  }
  return map;
}
function rank(kind) { return kind === "booking" ? 3 : kind === "owner" ? 2 : 1; }

/**
 * Classify one calendar day for rendering.
 * Returns { night: 'free'|'taken'|'hold'|'owner'|'past'|'closed',
 *           arrivalOk, departureOk }
 */
export function classifyDay(iso, { occupied, today, window }) {
  const d = toDay(iso);
  const past = d < toDay(today) + window.minLeadDays;
  const closed = iso < window.openFrom || iso > window.openUntil;
  const kind = occupied.get(iso);
  let night = "free";
  if (kind) night = kind === "booking" ? "taken" : kind;
  if (closed) night = "closed";
  if (past) night = "past";
  const prevKind = occupied.get(addDays(iso, -1));
  // you can arrive on a day whose night is free; you can depart on a day
  // whose *previous* night is free (or yours). Past/closed block both.
  const arrivalOk = night === "free";
  const departureOk = !past && !closed && !prevKind && iso > window.openFrom;
  return { night, arrivalOk, departureOk };
}

/**
 * Validate a range against occupancy and the booking window.
 * Returns { ok, reasons[] }. Pure.
 */
export function validateRange(arrival, departure, { occupied, today, window }) {
  const reasons = [];
  const n = diffDays(arrival, departure);
  if (n <= 0) reasons.push("Departure must be after arrival.");
  if (arrival < window.openFrom) reasons.push(`The house opens for stays from ${window.openFrom}. Earlier dates are enquiries.`);
  if (departure > addDays(window.openUntil, 1)) reasons.push(`The calendar is open until ${window.openUntil}.`);
  if (toDay(arrival) < toDay(today) + window.minLeadDays) reasons.push(`Arrivals need at least ${window.minLeadDays} days' notice.`);
  if (n > 0) {
    const clash = eachDay(arrival, departure).find((d) => occupied.has(d));
    if (clash) reasons.push(`The night of ${clash} is already taken.`);
  }
  return { ok: reasons.length === 0, reasons };
}

/** The furthest departure reachable from an arrival without crossing a taken night. */
export function maxDepartureFrom(arrival, occupied, window, cap = 30) {
  let d = toDay(arrival);
  let out = arrival;
  for (let i = 0; i < cap; i++) {
    const night = fromDay(d);
    if (occupied.has(night) || night > window.openUntil) break;
    d++;
    out = fromDay(d);
  }
  return out;
}
