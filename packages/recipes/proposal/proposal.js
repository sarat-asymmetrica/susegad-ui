// The proposal's live parts: the price tables, the timeline, the signature, the
// cover scene's stamp, and a way to keep a signed copy. Everything here only
// adds to a page that already reads, prints and can be signed on paper.

import './price-table.js';
import './timeline.js';
import '../../components/signature/signature.js';
import { STRINGS } from './proposal.core.js';

export { STRINGS };

/** Once someone chooses an option and signs, say so, and offer to print or save the signed page. */
function keepSigned(doc = document) {
  const keep = doc.querySelector('.proposal-keep');
  const sig = doc.querySelector('.proposal sg-signature');
  if (!keep || !sig) return;
  const said = keep.querySelector('[role=status]');
  const name = sig.querySelector('input:not([type=hidden])');
  const update = () => {
    const option = doc.querySelector('.folio-signature__options input:checked')?.value ?? '';
    const signed = sig.method || name?.value.trim();
    sig.toggleAttribute('data-drawn', sig.method === 'drawn'); // print keeps a drawn signature's pad
    said.textContent = signed ? STRINGS.signed(option, name?.value.trim()) : STRINGS.unsigned;
  };
  keep.hidden = false;
  keep.querySelector('button').addEventListener('click', () => print());
  doc.addEventListener('change', update);
  sig.addEventListener('sg-signature', update);
  update();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => keepSigned(), { once: true });
  else keepSigned();
}
