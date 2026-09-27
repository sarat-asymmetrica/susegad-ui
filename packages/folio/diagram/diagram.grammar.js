// Diagram grammar v1: reading the source. Pure and tiny, with no layout, so
// Folio's Markdown can check a diagram's lines (with their line numbers) even
// when nothing is built. diagram.core.js lays out and describes what this reads.
//
//   parse(src) → { title, direction, nodes, edges, groups, errors: [{ line, message }] }
//
// The grammar, one statement per line:
//
//   title: How a booking travels
//   direction: right            (or down)
//   Portal = Booking portal     a node's label (ids are the names you type)
//   group Casa Exemplo: Owner, Caretaker
//   Guest -> Portal: books a stay       an arrow, with a label
//   > The guest picks dates and pays a deposit.   prose for the step above
//   Portal => Owner: asks to hold       a flow: an arrow with things moving along it
//   Owner <-> Caretaker: talk           both ways
//   Guest -- Owner                      a plain line
//   # a comment
//
// Every diagram has a text alternative made from the same source, so what a
// screen reader hears and what the picture shows cannot drift apart.

/** Every word the diagram adds. Kathakar owns these. */
export const STRINGS = {
  untitled: 'Diagram',
  readAsText: 'Read the diagram as text',
  parts: n => `${n} ${n === 1 ? 'part' : 'parts'}`,
  links: n => `${n} ${n === 1 ? 'connection' : 'connections'}`,
  arrow: (a, b) => `${a} to ${b}`,
  flow: (a, b) => `${a} sends to ${b}`,
  both: (a, b) => `${a} and ${b}, both ways`,
  line: (a, b) => `${a} is linked with ${b}`,
  in: g => `in ${g}`,
  prev: 'Previous step',
  next: 'Next step',
  overview: 'All steps shown. Use Next step to go through them one at a time.',
  stepOf: (k, n) => `Step ${k} of ${n}.`,
  steps: 'Steps',
  errDesc: 'A description line (starting with >) must follow an arrow.',
  errSelf: 'An arrow needs two different ends.',
  errGroup: (id, g) => `${id} is already in the group ${g}.`,
  errDir: 'Direction is right or down.',
  errEnds: 'An arrow needs a name at each end, like Guest -> Portal.',
  errChain: 'Write one connection per line: A -> B, then B -> C on the next line.',
};

const OPS = { '->': 'arrow', '=>': 'flow', '<->': 'both', '--': 'line' };
const ARROW = /<->|->|=>|--/;
const unquote = s => s.trim().replace(/^"(.*)"$/, '$1').trim();

/**
 * Read the line grammar. Lines it cannot read are reported in `errors` with
 * their line number, and everything else is still used.
 * @param {string} src
 */
export function parse(src = '') {
  const m = { title: '', direction: 'right', nodes: [], edges: [], groups: [], errors: [] };
  const byId = new Map();
  const node = id => {
    id = unquote(id);
    if (!byId.has(id)) { const n = { id, label: id, group: null }; byId.set(id, n); m.nodes.push(n); }
    return byId.get(id);
  };
  let describing = false; // true while the lines since the last arrow are its description
  String(src).split(/\r?\n/).forEach((raw, i) => {
    const line = i + 1, t = raw.trim();
    if (!t || t.startsWith('#')) return;
    let x;
    if ((x = /^>\s*(.*)$/.exec(t))) {
      const e = m.edges.at(-1);
      if (describing) e.desc = e.desc ? `${e.desc} ${x[1]}` : x[1];
      else m.errors.push({ line, message: STRINGS.errDesc });
      return;
    }
    describing = false;
    if ((x = /^title\s*:\s*(.+)$/i.exec(t))) { m.title = x[1].trim(); return; }
    if ((x = /^direction\s*:?\s*(\S+)$/i.exec(t))) {
      const d = x[1].toLowerCase();
      if (d === 'right' || d === 'down') { m.direction = d; m.directionSet = true; } else m.errors.push({ line, message: STRINGS.errDir });
      return;
    }
    if ((x = /^group\s+(.+?)\s*:\s*(.+)$/i.exec(t))) {
      const g = { name: unquote(x[1]), members: [] };
      for (const id of x[2].split(',').map(unquote).filter(Boolean)) {
        const n = node(id);
        if (n.group) { m.errors.push({ line, message: STRINGS.errGroup(n.id, n.group) }); continue; }
        n.group = g.name; g.members.push(n.id);
      }
      m.groups.push(g);
      return;
    }
    if ((x = /^(.+?)\s*(<->|->|=>|--)\s*(.+?)(?:\s*:\s*(.*))?$/.exec(t))) {
      // a stray arrow mark at either end ("A -->", "A <- B") means the arrow was mistyped
      if (/[<>=-]$/.test(x[1].trim()) || /^[<>=-]/.test(x[3].trim())) { m.errors.push({ line, message: STRINGS.errEnds }); return; }
      if (ARROW.test(x[3])) { m.errors.push({ line, message: STRINGS.errChain }); return; }
      if (unquote(x[1]) === unquote(x[3])) { m.errors.push({ line, message: STRINGS.errSelf }); return; }
      const a = node(x[1]), b = node(x[3]);
      m.edges.push({ from: a.id, to: b.id, kind: OPS[x[2]], label: (x[4] ?? '').trim(), desc: '', line });
      describing = true;
      return;
    }
    // an arrow with nothing on one side ("A ->", "-> B") is a mistake, not a box called "A ->"
    if (ARROW.test(t)) { m.errors.push({ line, message: STRINGS.errEnds }); return; }
    if ((x = /^(.+?)\s*=\s*(.+)$/.exec(t))) { node(x[1]).label = unquote(x[2]); return; }
    node(t);
  });
  return m;
}
