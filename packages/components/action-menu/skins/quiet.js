// Quiet: action-menu.css draws it (a ruled list, a hairline between items). The
// skin adds nothing; action-menu.js does the keyboard work regardless of register.

export function mount() {
  return { update() {}, destroy() {} };
}
