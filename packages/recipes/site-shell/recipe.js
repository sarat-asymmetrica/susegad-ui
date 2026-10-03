// The site-shell recipe, wired: a header with Tabs and a Menu, a Dialog
// ("Ask the house"), a Drawer (the rooms), a scroll section over the Paus
// scene, and a Kantar interlude between two steps of a small booking flow.
// Built from library parts only; this file adds no new theatre of its
// own, only the composition and the one small piece of state the Kantar
// interlude needs (site-shell.core.js's nextStep).
//
// `mountSiteShell(root)` wires the one thing the page's own markup can't
// do without a script: the booking flow's Kantar interlude. Everything
// else (Tabs, Menu, Dialog, Drawer, the scroll section) wires itself the
// moment its module is imported and its custom element upgrades — that is
// the whole point of the wave, proving the pieces need no glue.

import '../../core/index.js';
import '../../scenes/paus/index.js';
import '../../components/tabs/tabs.js';
import '../../components/action-menu/action-menu.js';
import '../../components/button/button.js';
import '../../components/link/link.js';
import '../../components/dialog/dialog.js';
import '../../components/drawer/drawer.js';
import '../../components/scroll-section/scroll-section.js';
import { runKantar } from '../../transitions/kantar/kantar.js';
import { STRINGS, nextStep } from './site-shell.core.js';

export { STRINGS };

/**
 * @param {ParentNode} root the element holding `#booking-step-1` /
 *   `#booking-step-2` and the "Confirm and hold" button
 * @param {{ holdMs?: number }} [opts] `holdMs`: how long the simulated
 *   hold takes; a prototype stand-in for a real request, per the charter's
 *   "the screen never runs ahead of the transport" rule — this recipe's
 *   transport is a seeded delay, never a promise resolved before the work
 *   it stands for would really be done.
 */
export function mountSiteShell(root, { holdMs = 1400 } = {}) {
  const stage = root.querySelector('#booking-stage');
  const confirmBtn = root.querySelector('#booking-confirm');
  if (!stage || !confirmBtn) return;

  const register = () => stage.closest('[data-register]')?.getAttribute('data-register')
    || document.documentElement.getAttribute('data-register') || 'warm';

  confirmBtn.addEventListener('click', async () => {
    confirmBtn.disabled = true;
    const work = new Promise(resolve => setTimeout(resolve, holdMs));
    await runKantar(stage, {
      work,
      lines: [STRINGS.waitingLine, 'Holding your dates…'],
      swap: () => showStep2(stage),
      register: register(),
      label: STRINGS.step2Heading,
    });
  });

  void nextStep; // the two-step walk itself lives in site-shell.core.js; kept here for callers who want it
}

function showStep2(stage) {
  const slot = stage.querySelector('#booking-step-slot');
  if (!slot) return;
  slot.replaceChildren();
  const s2 = document.createElement('div');
  s2.className = 'booking-step';
  s2.innerHTML = `
    <h3 tabindex="-1">${STRINGS.step2Heading}</h3>
    <p>${STRINGS.heldLine}</p>
  `;
  slot.append(s2);
  s2.querySelector('h3').focus();
}
