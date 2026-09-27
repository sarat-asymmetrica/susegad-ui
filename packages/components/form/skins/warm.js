// Form, warm skin: while the work is pending a Loader shows beside the submit
// button with the same words, and when it is done a Stamp lands: "Sent", and
// the answer's short detail if it has one. Both are drawn inside the form's aria-hidden art box, because
// the form's own status line has already said the words once. A failure
// draws nothing here: its words stay in the status line, and a Toast says it.

import { STRINGS } from '../form.core.js';

const STAMP_TONES = ['accent', 'success', 'warning', 'danger', 'info', 'neutral'];

export function mount(el) {
  let shown = null;
  const art = () => el.querySelector('.sg-form-art');
  return {
    async update(s) {
      if (s.state === shown) return;
      shown = s.state;
      const box = art();
      if (!box) return;
      if (s.state === 'sending') {
        await import('../../loader/loader.js');
        if (shown !== 'sending') return;
        const loader = document.createElement('sg-loader');
        loader.setAttribute('label', s.words);
        box.replaceChildren(loader);
      } else if (s.state === 'sent') {
        await import('../../stamp/stamp.js');
        if (shown !== 'sent') return;
        const stamp = document.createElement('sg-stamp');
        stamp.setAttribute('tone', STAMP_TONES.includes(s.tone) ? s.tone : 'success');
        // the words below say what happened; the stamp is their picture, so it is no live region (role="none")
        stamp.setAttribute('role', 'none');
        const p = document.createElement('p');
        p.className = 'sg-stamp-words';
        const word = document.createElement('strong');
        word.textContent = s.stamp || STRINGS.stamp;
        p.append(word);
        // a stamp carries a word and, at most, one short line; the full message stays in the words below it
        if (s.detail) { const line = document.createElement('span'); line.textContent = s.detail; p.append(' ', line); }
        stamp.append(p);
        box.replaceChildren(stamp);
      } else {
        box.replaceChildren();
      }
    },
    destroy() { art()?.replaceChildren(); },
  };
}
