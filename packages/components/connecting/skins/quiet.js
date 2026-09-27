// Quiet: a static dot and the words. The dot is drawn by connecting.css from the
// state attribute (a ring while connecting, filled when connected, struck through
// when offline), so it looks the same with or without JavaScript. Nothing moves.
export function mount() {
  return { update() {}, destroy() {} };
}
