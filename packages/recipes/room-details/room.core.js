// Room details: the pure half. The words, rupee formatting, availability as a
// badge, and the load state machine. Runs in Node.

/** Every word a guest reads or hears. Kathakar owns these. */
export const STRINGS = {
  label: 'the room details',
  failed: 'We couldn’t load the room details. Check your connection and try again.',
  retry: 'Try again',
  perNight: 'a night',
  perWeek: 'a week',
  included: 'Included',
  sleeps: n => `Sleeps ${n}`,
  beds: ({ double = 0, single = 0 }) => [
    double && `${double} double ${double === 1 ? 'bed' : 'beds'}`,
    single && `${single} single ${single === 1 ? 'bed' : 'beds'}`,
  ].filter(Boolean).join(' and '),
  // a whole house is one thing to book: it is available or it is not, never "1 room left"
  left: (n, { whole = false } = {}) => (n === 0 ? 'Fully booked' : whole || n > 3 ? 'Available' : `${n} ${n === 1 ? 'room' : 'rooms'} left`),
  book: 'Choose your dates',
  askOther: 'Ask about other dates',
};

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
/** Rupees with Indian digit grouping: 3200 → ₹3,200, 125000 → ₹1,25,000, 12500000 → ₹1,25,00,000. */
export const rupees = n => inr.format(Math.round(n));

/** Availability as a badge: the words carry the meaning, the tone backs them up. */
export function availability(left, { whole = false } = {}) {
  const n = Math.max(0, left | 0);
  return { text: STRINGS.left(n, { whole }), tone: n === 0 ? 'neutral' : whole || n > 3 ? 'success' : 'warning', bookable: n > 0 };
}
/** A room is booked whole when it says so, or when it is let by the week. */
export const isWhole = room => room.whole ?? room.per === 'week';

/**
 * The load machine. Only the latest request may settle it, so a slow answer
 * to an old request never overwrites a newer one.
 * States: idle, loading, loaded, failed. Events: load, loaded, failed.
 */
export const initial = { phase: 'idle', request: 0, room: null, error: null };

export function reduce(state, event) {
  switch (event.type) {
    case 'load':
      return { ...state, phase: 'loading', request: event.request, error: null };
    case 'loaded':
      if (event.request !== state.request || state.phase !== 'loading') return state;
      return { ...state, phase: 'loaded', room: event.room, error: null };
    case 'failed':
      if (event.request !== state.request || state.phase !== 'loading') return state;
      return { ...state, phase: 'failed', error: event.error ?? 'failed' };
    default:
      return state;
  }
}

/**
 * What the page should show for a state: plain data, no DOM.
 * The skeleton is busy while loading and stays busy (hidden) on failure, so it
 * never announces an arrival that did not happen.
 */
export function view(state) {
  const { phase, room } = state;
  const shown = phase === 'loaded' && room;
  return {
    skeleton: { busy: !shown, hidden: phase === 'failed' },
    error: phase === 'failed' ? STRINGS.failed : null,
    room: shown ? {
      name: room.name,
      summary: room.summary,
      sleeps: STRINGS.sleeps(room.sleeps),
      beds: STRINGS.beds(room.beds),
      price: rupees(room.rate),
      per: room.per === 'week' ? STRINGS.perWeek : STRINGS.perNight,
      included: room.included,
      badge: availability(room.left, { whole: isWhole(room) }),
      action: availability(room.left, { whole: isWhole(room) }).bookable ? STRINGS.book : STRINGS.askOther,
    } : null,
  };
}
