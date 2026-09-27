// Quiet: the ruled drop zone in file-drop.css is the whole look. No picture,
// nothing moves; dragging a file over changes the rule from dashed to solid.

export function mount() {
  return { update() {}, restyle() {}, destroy() {} };
}
