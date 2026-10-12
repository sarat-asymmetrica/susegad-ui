// Quiet: bubble.css draws it, a hairline callout with a small tail, and the
// words flow as CSS text. No drawing, no layout script, no Pretext. Nothing moves.
export function mount(host) { host.removeAttribute('data-wait'); return { update() {}, restyle() {}, destroy() {} }; }
