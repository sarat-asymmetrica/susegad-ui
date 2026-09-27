// Shared by the warm and playful skins: a pillar post box beside the words,
// with a letter waiting over the slot. Drag a file over the zone and the
// letter lifts to the slot; when files are really kept it is posted, and when
// they are turned away it shakes its head. Nothing moves otherwise. WAAPI, so
// getAnimations() can pause it; reduced motion shows the states without motion.

const NS = 'http://www.w3.org/2000/svg';
let uid = 0;

const BOX = `
  <path class="sg-post-base" d="M26,128h68v8h-68z"/>
  <path class="sg-post-body" d="M34,58v70h52v-70"/>
  <path class="sg-post-cap" d="M30,58c0-22 13-34 30-34s30,12 30,34z"/>
  <path class="sg-post-band" d="M30,58h60v7h-60z"/>
  <rect class="sg-post-slot" x="44" y="72" width="32" height="4.5" rx="1.5"/>
  <path class="sg-post-shade" d="M74,66v62h12v-62z"/>
  <path class="sg-post-plate" d="M47,92h26v18h-26z"/>
  <path class="sg-post-rules" d="M51,98h18M51,104h12"/>`;
const LETTER = `
  <rect class="sg-post-paper" x="-17" y="-11" width="34" height="22" rx="1.5"/>
  <path class="sg-post-flap" d="M-17,-10L0,2L17,-10"/>
  <rect class="sg-post-stamp" x="9" y="-8" width="6" height="7"/>`;

export function mountPost(host, ctx, { thunk = false } = {}) {
  const zone = host.querySelector('.sg-file-drop-zone');
  const svg = document.createElementNS(NS, 'svg');
  const id = `sgpost${++uid}`;
  svg.setAttribute('class', 'sg-file-drop-art sg-post');
  svg.setAttribute('viewBox', '0 0 120 140');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  // the letter is only drawn above the slot: below it, it is inside the box
  svg.innerHTML = `<defs><clipPath id="${id}"><rect x="0" y="0" width="120" height="74"/></clipPath></defs>
    <g class="sg-post-box">${BOX}</g>
    <g clip-path="url(#${id})"><g class="sg-post-letter" transform="translate(60 13)"><g class="sg-post-lift">${LETTER}</g></g></g>
    ${thunk ? '<path class="sg-post-thunk" d="M20,122l-8,-3M18,114l-9,-7M100,122l8,-3M102,114l9,-7" opacity="0"/>' : ''}`;
  (zone ?? host).prepend(svg);
  const letter = svg.querySelector('.sg-post-lift'), box = svg.querySelector('.sg-post-box'), marks = svg.querySelector('.sg-post-thunk');
  let seq = 0, hover = false;
  const still = () => ctx.motion === 'still';
  const play = (el, k, o) => (still() ? null : el.animate(k, { fill: 'forwards', ...o }));

  return {
    update(s) {
      if (s.hover !== hover) {
        hover = s.hover;
        // lift towards the slot and tilt, as if about to be posted
        play(letter, hover ? [{ transform: 'none' }, { transform: 'translateY(36px) rotate(-6deg)' }] : [{ transform: 'translateY(36px) rotate(-6deg)' }, { transform: 'none' }],
          { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.3, 1)' });
        svg.classList.toggle('sg-post-open', hover);
      }
      if (s.seq === seq) return;
      seq = s.seq;
      if (s.last === 'added') {
        // posted: through the slot and gone, then a fresh letter comes back into view
        const fall = thunk
          ? [{ transform: 'translateY(36px) rotate(-6deg)', opacity: 1, offset: 0 }, { transform: 'translateY(82px) rotate(0deg)', opacity: 1, offset: 0.55, easing: 'cubic-bezier(0.5, 0, 0.9, 0.4)' }, { transform: 'translateY(82px)', opacity: 0, offset: 0.6 }, { transform: 'none', opacity: 0, offset: 0.8 }, { transform: 'none', opacity: 1, offset: 1 }]
          : [{ transform: hover ? 'translateY(36px) rotate(-6deg)' : 'none', opacity: 1, offset: 0 }, { transform: 'translateY(80px) rotate(0deg)', opacity: 1, offset: 0.6 }, { transform: 'translateY(80px)', opacity: 0, offset: 0.62 }, { transform: 'none', opacity: 0, offset: 0.8 }, { transform: 'none', opacity: 1, offset: 1 }];
        play(letter, fall, { duration: thunk ? 820 : 900, easing: 'ease-in-out' });
        if (thunk) {
          play(box, [{ transform: 'none' }, { transform: 'scale(1.04, 0.96)', offset: 0.55 }, { transform: 'scale(0.99, 1.01)', offset: 0.75 }, { transform: 'none' }], { duration: 820, delay: 0, fill: 'none' });
          if (marks) play(marks, [{ opacity: 0 }, { opacity: 0, offset: 0.5 }, { opacity: 0.8, offset: 0.6 }, { opacity: 0 }], { duration: 820, fill: 'none' });
        }
      } else if (s.last === 'turned-away') {
        play(letter, [{ transform: 'none' }, { transform: 'translateX(-4px) rotate(-4deg)' }, { transform: 'translateX(4px) rotate(4deg)' }, { transform: 'translateX(-2px)' }, { transform: 'none' }], { duration: 420, fill: 'none' });
      }
    },
    restyle() {},
    destroy() { svg.remove(); },
  };
}
