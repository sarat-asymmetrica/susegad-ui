// The clean twin: no canvas text at all.
export function draw(g) {
  g.beginPath();
  g.arc(10, 10, 5, 0, Math.PI * 2);
  g.fill();
}
