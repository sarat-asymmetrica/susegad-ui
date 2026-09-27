/** Pure: where the dot sits for a seed. */
export function model({ seed = 1 } = {}) {
  return { x: 160 + (seed % 7) * 4, y: 100, r: 36 };
}
