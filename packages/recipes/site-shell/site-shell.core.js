// The site-shell recipe: the pure core. Runs in Node.
//
// A tiny two-step booking flow (dates, then held), just enough state to
// prove the Kantar interlude sits between two real steps rather than a
// timer of its own. Everything else on the page (Tabs, Menu, Dialog,
// Drawer, the scroll section) is already wired and already tested by its
// own component; this recipe adds no new behaviour for them, only the
// composition.

export const STRINGS = {
  step1Heading: 'Your dates',
  step2Heading: 'Held for you',
  confirmLabel: 'Confirm and hold',
  waitingLine: 'Checking the calendar for 12 to 16 November…',
  heldLine: 'Held for 20 minutes. Enter your details to finish.',
};

export const STEPS = ['dates', 'held'];

/** The step after `step`, or the same step if there is none (a two-step flow: nowhere to go from "held"). */
export function nextStep(step) {
  const i = STEPS.indexOf(step);
  return i >= 0 && i < STEPS.length - 1 ? STEPS[i + 1] : step;
}

/** Whether `step` is the flow's first step (the one a fresh visitor sees). */
export const isFirstStep = step => STEPS.indexOf(step) === 0;
