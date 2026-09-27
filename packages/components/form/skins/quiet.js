// Form, quiet skin: the states are words and nothing else ("Sending.", "Sent.",
// or why it could not send), set in the form's own status line (form.css).
// Nothing is drawn and nothing moves.

export function mount(el) {
  return { update() { el.querySelector('.sg-form-art')?.replaceChildren(); }, destroy() {} };
}
