// <sg-scroll-section>: a section whose content — most often a child
// <sg-scene>'s `progress` — advances with scroll, using CSS scroll-driven
// animations (`animation-timeline: view()`) where the browser has them, an
// IntersectionObserver-gated scroll loop otherwise (the Ghat plate's
// approach, ported as arithmetic: scroll-section.core.js's
// progressFromRect). Off screen, nothing runs at all (A4).
//
//   <sg-scroll-section>
//     <sg-scene name="paus" register="warm"></sg-scene>
//   </sg-scroll-section>
//
// Without JavaScript this is a plain <section>: its content shows at rest,
// nothing scroll-linked. In the quiet register and under reduced motion,
// the section never scrubs either — the charter's register table gives
// quiet a still scene, and reduced motion always wins — so the section's
// content (a scene, most often) is simply left at its own finished state.
// (A child <sg-scene> would show its own still regardless, since a scene's
// own motion resolves to 'still' in quiet too; this component additionally
// skips the scroll-tracking work entirely there, so nothing runs for no
// visible reason.)

import { SgElement, defineComponent } from '../../core/component.js';
import { progressFromRect, isNearViewport } from './scroll-section.core.js';

const VIEW_TIMELINE = typeof CSS !== 'undefined' && CSS.supports?.('animation-timeline: view()');

export class SgScrollSection extends SgElement {
  static observedAttributes = ['register'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  #io = null; #raf = 0; #near = false; #progress = 0; #scene = null; #scrollQueued = false;

  // Whether to scrub at all: the charter's register table gives quiet a
  // still scene, and reduced motion always wins, for every register. Note
  // this reads `this.register` directly, not `this.motion` — a component's
  // own resolveMotion('quiet') is 'state' (its transitions may still move,
  // under 200ms), which is a different question from whether a *scene*
  // inside it should be scroll-scrubbed at all.
  get #passive() { return this.register === 'quiet' || this.motion === 'still'; }

  #onScroll = () => {
    // The IntersectionObserver above is the efficient, usual path, but a
    // single very fast scroll (a big keyboard jump, a hard flick, a
    // programmatic scrollTo) can move the section from well below the
    // viewport to well above it between two paints, skipping the "near"
    // zone the observer would otherwise have caught. This is the backup:
    // rAF-throttled, and it only ever measures a rect, never draws.
    if (this.#passive || this.#scrollQueued) return;
    this.#scrollQueued = true;
    requestAnimationFrame(() => {
      this.#scrollQueued = false;
      if (!this.isConnected) return;
      const near = isNearViewport(this.getBoundingClientRect(), window.innerHeight);
      if (near !== this.#near) this.#nearChanged(near);
    });
  };

  connected() {
    this.style.setProperty('--sg-scroll-progress', '0');
    this.#scene = this.querySelector('sg-scene');
    // Quiet's and reduced motion's "no scrubbing, ever" are already known
    // synchronously from the register; settle that now rather than waiting
    // on the IntersectionObserver's first (inherently async) callback. The
    // observer is still set up regardless, so a later register change
    // (a page-level register switcher) is picked up correctly too.
    if (this.#passive) this.#showStill();
    if (typeof IntersectionObserver === 'undefined') return; // no-JS-equivalent environments: content stands as is
    this.#io = new IntersectionObserver(([e]) => this.#nearChanged(e.isIntersecting), { rootMargin: '50% 0px' });
    this.#io.observe(this);
    window.addEventListener('scroll', this.#onScroll, { passive: true });
  }

  disconnected() {
    this.#io?.disconnect();
    window.removeEventListener('scroll', this.#onScroll);
    this.#stopLoop();
  }

  /** The last progress this section computed, 0..1. */
  get progress() { return this.#progress; }

  #nearChanged(near) {
    this.#near = near;
    if (this.#passive) { this.#showStill(); return; }
    // Always settle progress to where the section really is right now, even
    // when the answer is "no longer near": a fast jump (a big keyboard
    // scroll, scrollTo()) can carry the section from well below the
    // viewport to well above it between two paints, skipping the near zone
    // entirely, and progress must still land on 1 (fully passed), not stay
    // wherever the loop last left it.
    this.#setProgress(progressFromRect(this.getBoundingClientRect(), window.innerHeight));
    if (near) this.#startLoop(); else this.#stopLoop();
  }

  #showStill() {
    this.#stopLoop();
    // Settle our own reported number without forcing the scene's `progress`
    // attribute to a specific value: the scene's own still (SKILL.md: quiet
    // and reduced motion both show a finished still on their own) already
    // does the right thing, and handing control back to it — rather than
    // pinning `progress="1"` — is both simpler and matches "remove the
    // attribute to hand the scene back to time".
    this.#progress = 1;
    this.style.setProperty('--sg-scroll-progress', '1');
    this.#scene?.removeAttribute('progress');
    this.#scene?.still?.();
    this.emit('sg-scroll-progress', { progress: 1 });
    this.update();
  }

  #startLoop() {
    if (this.#raf) return;
    const tick = () => {
      this.#raf = 0;
      if (!this.isConnected || !this.#near || this.#passive) return;
      const r = this.getBoundingClientRect();
      if (isNearViewport(r, window.innerHeight)) this.#setProgress(progressFromRect(r, window.innerHeight));
      this.#raf = requestAnimationFrame(tick);
    };
    this.#raf = requestAnimationFrame(tick);
  }
  #stopLoop() { if (this.#raf) { cancelAnimationFrame(this.#raf); this.#raf = 0; } }

  #setProgress(p) {
    this.#progress = p;
    this.style.setProperty('--sg-scroll-progress', String(p));
    if (this.#scene) this.#scene.setAttribute('progress', p.toFixed(3));
    this.emit('sg-scroll-progress', { progress: p });
    this.update();
  }

  state() {
    return { progress: this.#progress, motion: this.motion, visible: this.visible, viewTimeline: VIEW_TIMELINE };
  }
}

defineComponent('sg-scroll-section', SgScrollSection);
