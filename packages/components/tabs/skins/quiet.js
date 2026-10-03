// Quiet: tabs.css already draws it, a hairline under the active tab with no
// travel (`sg-tabs[data-skin="quiet"] [aria-selected="true"]`). Nothing to
// mount.

export function mount() {
  return { update() {}, destroy() {} };
}
