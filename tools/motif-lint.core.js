// The motif tier lint's pure core (docs/requests/2026-10-02-lighter-gate.md, C).
//
// lintMotifs(registry, { heroNames }) -> { findings: [{ item, rule, text }] }
//
//   registry    the registry index: { items: [...] } or a bare array; each item carries
//               name and optionally motif: { origin, tier, gloss, clientLed, communityLead }
//   heroNames   the item names the home page mounts as its hero (read from the front door)
//
// Rules (the lighter-gate request, C row 5):
//   1  a motif's tier must be everyday | regional | sacred
//   2  sacred needs clientLed: true or communityLead: true, or it fails
//   3  regional needs a gloss that names where it comes from (the origin's own words
//      appearing in the gloss is the checkable form)
//   4  the home hero must be origin: goa
//
// No finding says what to change; the owner confirms the tiers, the lint only holds
// the line.

const TIERS = new Set(['everyday', 'regional', 'sacred']);

function normalise(registry) {
  if (Array.isArray(registry)) return registry;
  if (registry && Array.isArray(registry.items)) return registry.items;
  throw new TypeError('lintMotifs: registry must be an array of items or { items }');
}

/** Does a gloss name where the motif comes from? The origin's own words, or the
 * adjectival form a gloss naturally uses ("goa" named as "Goan"), case-insensitively. */
export function glossNamesOrigin(gloss, origin) {
  if (!gloss || !origin) return false;
  const g = gloss.toLowerCase();
  const o = String(origin).toLowerCase().trim();
  if (!o) return false;
  if (g.includes(o)) return true;
  // adjectival: "goa" -> "goan", "tamil nadu" -> "tamil"
  const head = o.split(/\s+/)[0].replace(/a$/, 'an');
  return head.length >= 3 && g.includes(head);
}

export function lintMotifs(registry, { heroNames = [] } = {}) {
  const items = normalise(registry);
  const byName = new Map(items.map(i => [i.name, i]));
  const findings = [];
  for (const item of items) {
    const m = item.motif;
    if (!m) continue; // shared infrastructure may carry no motif at all
    if (!TIERS.has(m.tier)) {
      findings.push({ item: item.name, rule: 'unknown tier', text: `tier is ${JSON.stringify(m.tier)}; use everyday, regional or sacred` });
      continue;
    }
    if (m.tier === 'sacred' && !m.clientLed && !m.communityLead) {
      findings.push({ item: item.name, rule: 'sacred needs a lead', text: 'tier sacred needs clientLed: true or communityLead: true (the community or client leads the work)' });
    }
    if (m.tier === 'regional' && !glossNamesOrigin(m.gloss, m.origin)) {
      findings.push({ item: item.name, rule: 'regional needs a gloss that names its home', text: `origin ${JSON.stringify(m.origin)} is not named in the gloss ${JSON.stringify(m.gloss)}` });
    }
  }
  for (const h of heroNames) {
    const item = byName.get(h) ?? byName.get(`scene-${h}`);
    if (!item) findings.push({ item: h, rule: 'hero not on the shelf', text: 'the home hero must be a registry item' });
    else if (item.motif?.origin !== 'goa') findings.push({ item: h, rule: 'the hero must be goa', text: `the home hero's motif origin is ${JSON.stringify(item.motif?.origin)}, not "goa"` });
  }
  return findings;
}
