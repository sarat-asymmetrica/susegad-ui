import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parse, layout, describe, textWidth, wrap, labelClashes, pathClashes, STRINGS } from './diagram.core.js';
import { inkPath, inkBox, inkHead, head } from './diagram.ink.js';
import { renderDiagram } from './render.js';

const BOOKING = `title: How a booking travels
# the portal is the one people see
Portal = Booking portal
group Casa Exemplo: Owner, Caretaker
Guest -> Portal: books a stay
> The guest picks dates
> and pays a deposit.
Portal => Owner: asks to hold
Owner -> Caretaker: readies the house
Owner -> Guest: confirms`;

const overlap = (a, b) => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

test('parse: title, labels, groups, arrows of every kind, and prose for a step', () => {
  const m = parse(`${BOOKING}\nCaretaker <-> Owner\nGuest -- Caretaker\n"Night watch" -> Owner: rings`);
  assert.equal(m.title, 'How a booking travels');
  assert.equal(m.direction, 'right');
  assert.deepEqual(m.nodes.map(n => n.id), ['Portal', 'Owner', 'Caretaker', 'Guest', 'Night watch']);
  assert.equal(m.nodes[0].label, 'Booking portal');
  assert.deepEqual(m.groups, [{ name: 'Casa Exemplo', members: ['Owner', 'Caretaker'] }]);
  assert.equal(m.nodes.find(n => n.id === 'Owner').group, 'Casa Exemplo');
  assert.deepEqual(m.edges.map(e => e.kind), ['arrow', 'flow', 'arrow', 'arrow', 'both', 'line', 'arrow']);
  assert.deepEqual(m.edges[0], { from: 'Guest', to: 'Portal', kind: 'arrow', label: 'books a stay', desc: 'The guest picks dates and pays a deposit.', line: 5 });
  assert.equal(m.edges[5].label, '');
  assert.deepEqual(m.errors, []);
});

test('parse: direction, and each problem reported with its line while the rest is kept', () => {
  assert.equal(parse('direction: down\nA -> B').direction, 'down');
  assert.equal(parse('direction down').directionSet, true);
  const m = parse('> nothing to describe\nA -> A\ndirection: sideways\ngroup One: A\ngroup Two: A\nA -> B\nC\n> after a plain node');
  assert.deepEqual(m.errors.map(e => e.line), [1, 2, 3, 5, 8]);
  assert.equal(m.errors[1].message, STRINGS.errSelf);
  assert.equal(m.edges.length, 1);
  assert.deepEqual(m.nodes.map(n => n.id), ['A', 'B', 'C']);
});

test('text measuring and wrapping', () => {
  assert.ok(textWidth('Booking portal') > textWidth('Guest'));
  assert.ok(textWidth('WWW') > textWidth('iii') * 2);
  assert.deepEqual(wrap('the long way round to the caretaker', 16), ['the long way', 'round to the', 'caretaker']);
  assert.deepEqual(wrap(''), ['']);
});

test('layout: arrows run forward, boxes never overlap, everything is inside the picture', () => {
  for (const direction of ['right', 'down']) {
    const L = layout(parse(BOOKING), { direction });
    const rank = new Map(L.nodes.map(n => [n.id, n.rank]));
    assert.equal(rank.get('Guest'), 0, 'the story starts where it starts');
    assert.ok(rank.get('Portal') < rank.get('Owner') && rank.get('Owner') < rank.get('Caretaker'));
    for (let i = 0; i < L.nodes.length; i++) for (let j = i + 1; j < L.nodes.length; j++) assert.ok(!overlap(L.nodes[i], L.nodes[j]), `${L.nodes[i].id} / ${L.nodes[j].id}`);
    for (const b of [...L.nodes, ...L.groups]) assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= L.width && b.y + b.h <= L.height);
    for (const e of L.edges) for (const [x, y] of e.samples) assert.ok(x >= 0 && y >= 0 && x <= L.width && y <= L.height);
    // rightward diagrams grow along x, downward along y
    const g = L.nodes.find(n => n.id === 'Guest'), c = L.nodes.find(n => n.id === 'Caretaker');
    assert.ok(direction === 'right' ? c.x > g.x + g.w : c.y > g.y + g.h);
  }
});

test('layout: the edge closing a cycle loops round; one skipping a rank goes round the box between', () => {
  const L = layout(parse(BOOKING));
  assert.equal(L.edges.find(e => e.from === 'Owner' && e.to === 'Guest').route, 'back');
  const S = layout(parse('A -> B\nB -> C\nA -- C'));
  const skip = S.edges.find(e => e.from === 'A' && e.to === 'C'), b = S.nodes.find(n => n.id === 'B');
  assert.equal(skip.route, 'over');
  for (const [x, y] of skip.samples) assert.ok(!(x > b.x && x < b.x + b.w && y > b.y && y < b.y + b.h), 'never through B');
});

test('layout: a group frame holds its members and no one else', () => {
  for (const direction of ['right', 'down']) {
    const L = layout(parse('Roof => Gutter\nGutter => Tank\nTank => Garden\nTank -> Kitchen\ngroup The house: Roof, Gutter, Tank, Kitchen'), { direction });
    const [g] = L.groups;
    for (const n of L.nodes) {
      const inside = n.x >= g.x && n.y >= g.y && n.x + n.w <= g.x + g.w && n.y + n.h <= g.y + g.h;
      assert.equal(inside, n.group === 'The house', `${n.id} ${direction}`);
      if (!n.group) assert.ok(!overlap(n, g), `${n.id} clear of the frame (${direction})`);
    }
  }
});

test('layout is deterministic', () => {
  assert.deepEqual(layout(parse(BOOKING)), layout(parse(BOOKING)));
});

test('describe: every part and connection in words; steps use the prose when there is some', () => {
  const D = describe(parse(BOOKING));
  assert.equal(D.summary, 'How a booking travels: 4 parts, 4 connections.');
  assert.equal(D.parts, 'Booking portal, Owner (in Casa Exemplo), Caretaker (in Casa Exemplo) and Guest');
  assert.deepEqual(D.connections, ['Guest to Booking portal: books a stay.', 'Booking portal sends to Owner: asks to hold.', 'Owner to Caretaker: readies the house.', 'Owner to Guest: confirms.']);
  assert.equal(D.steps[0], 'The guest picks dates and pays a deposit.');
  assert.equal(D.steps[1], 'Booking portal sends to Owner: asks to hold.');
  for (const s of [...D.steps, ...D.connections]) assert.doesNotMatch(s, /—|\.\.$/);
  assert.equal(describe(parse('A -- B')).connections[0], 'A is linked with B.');
  assert.equal(describe(parse('A <-> B: talk')).connections[0], 'A and B, both ways: talk.');
  assert.equal(describe(parse('')).summary, 'Diagram: 0 parts, 0 connections.');
});

test('ink: closed ribbons, deterministic; a box is four strokes that cross at the corners', () => {
  const d = inkPath([[0, 0], [100, 20]], { seed: 3 });
  assert.match(d, /^M[\d. -]+(L[\d. -]+)+Z$/);
  assert.equal(d, inkPath([[0, 0], [100, 20]], { seed: 3 }));
  assert.notEqual(d, inkPath([[0, 0], [100, 20]], { seed: 4 }));
  assert.equal(inkPath([[1, 1]]), '');
  const box = inkBox(10, 10, 120, 40, { seed: 1 });
  assert.equal(box.match(/M/g).length, 4);
  const xs = box.match(/-?\d+(\.\d+)?/g).map(Number).filter((_, i) => i % 2 === 0);
  assert.ok(Math.min(...xs) < 10 && Math.max(...xs) > 130, 'strokes run past the corners');
  assert.equal(inkHead([50, 50], 0).match(/M/g).length, 2);
  assert.match(head([50, 50], 0), /^M[\d.]+ [\d.]+L50 50L[\d.]+ [\d.]+$/);
});

test('renderDiagram: a figure with a named SVG, its text alternative, and no inline styles', () => {
  const { html, text, errors } = renderDiagram(BOOKING, { id: 'bk' });
  assert.deepEqual(errors, []);
  assert.match(html, /^<sg-diagram id="bk"/);
  assert.match(html, /<svg[^>]* role="img" aria-labelledby="bk-title" aria-describedby="bk-text"/);
  assert.match(html, /<title id="bk-title">How a booking travels<\/title>/);
  assert.match(html, /id="bk-text"/);
  assert.match(html, /<figcaption>How a booking travels<\/figcaption>/);
  assert.match(html, /<details class="sg-diagram-text"><summary>Read the diagram as text<\/summary>/);
  assert.doesNotMatch(html, /\sstyle=/, 'a strict CSP needs nothing for it');
  assert.doesNotMatch(html, /<script/);
  assert.equal(text, describe(parse(BOOKING)).text);
  for (const w of ['Booking portal', 'Casa Exemplo', 'books a stay', 'Guest to Booking portal: books a stay.']) assert.ok(html.includes(w), w);
});

test('renderDiagram: steps become an ordered list, readable without JavaScript', () => {
  const { html } = renderDiagram(BOOKING, { id: 'bk', steps: true });
  const items = html.match(/<li data-step="\d+">[^<]*<\/li>/g);
  assert.equal(items.length, 4);
  assert.match(items[0], /The guest picks dates and pays a deposit\./);
  assert.match(html, /data-steps/);
  assert.match(html, /<ol class="sg-diagram-steps" id="bk-text"/);
});

test('renderDiagram: each register draws differently; flows carry still dots', () => {
  const q = renderDiagram(BOOKING, { id: 'x', register: 'quiet' }).html;
  const w = renderDiagram(BOOKING, { id: 'x', register: 'warm' }).html;
  const p = renderDiagram(BOOKING, { id: 'x', register: 'playful' }).html;
  assert.match(q, /class="sg-d-box"/); assert.doesNotMatch(q, /class="sg-d-ink"/);
  assert.match(w, /class="sg-d-ink"/); assert.doesNotMatch(w, /data-hue/);
  assert.match(p, /data-hue="\d"/);
  assert.equal(renderDiagram(BOOKING, { register: 'nonsense' }).html.includes('data-register-drawn="warm"'), true);
  assert.equal((w.match(/class="sg-d-dots"/g) || []).length, 1);
});

test('renderDiagram: escapes what it is given, keeps the source for the page, and a stable id', () => {
  const { html } = renderDiagram('A <b> -> "B & C": <script>x</script>');
  assert.doesNotMatch(html, /<b>|<script>/);
  assert.match(html, /&lt;script&gt;x&lt;\/script&gt;/);
  assert.match(html, /data-src="A &lt;b&gt; -&gt; &quot;B &amp; C&quot;: &lt;script&gt;x&lt;\/script&gt;"/);
  assert.equal(renderDiagram('A -> B').html.match(/id="(sg-d-[a-z0-9]+)"/)[1], renderDiagram('A -> B').html.match(/id="(sg-d-[a-z0-9]+)"/)[1]);
  assert.notEqual(renderDiagram('A -> B').html.match(/id="([^"]+)"/)[1], renderDiagram('A -> C').html.match(/id="([^"]+)"/)[1]);
});

test('renderDiagram: opts override the source; a chosen direction is marked so the page keeps it', () => {
  const { html } = renderDiagram('title: One\nA -> B', { title: 'Two', direction: 'down' });
  assert.match(html, /<figcaption>Two<\/figcaption>/);
  assert.match(html, /data-direction="down" data-direction-set/);
  assert.doesNotMatch(renderDiagram('A -> B').html, /data-direction-set/);
});

test('parse: a mistyped arrow or a chain is an error on its line, never a box (decision 0013)', () => {
  const { errors, nodes, edges } = parse('Guest -> Portal\nPortal ->\n-> Owner\nA -> B -> C\nA --> B\nOwner');
  assert.deepEqual(errors.map(e => [e.line, e.message]), [
    [2, STRINGS.errEnds], [3, STRINGS.errEnds], [4, STRINGS.errChain], [5, STRINGS.errEnds],
  ]);
  assert.deepEqual(nodes.map(n => n.id), ['Guest', 'Portal', 'Owner'], 'good lines are still used');
  assert.equal(edges.length, 1);
  assert.equal(parse('"Check-in" -- Desk: hands over the key').errors.length, 0, 'a hyphen in a name is not an arrow');
});

test('renderDiagram: bad lines come back as errors, and the diagram still draws what it could read', () => {
  const { html, errors } = renderDiagram('A -> B\nB ->');
  assert.deepEqual(errors, [{ line: 2, message: STRINGS.errEnds }]);
  assert.match(html, /class="sg-diagram-svg"/);
});

test('labels never sit on each other or on a box, in either direction', () => {
  const DIRECT = `Guest = Guest
Site = Your site
Bank = Your bank
Guest -> Site: chooses dates
Guest => Razorpay: pays
Site -> Guest: confirms, with the house manual
Razorpay => Bank: the payment, less the fee`;
  const FAN = 'Hub -> A: first label here\nHub -> B: second label here\nHub -> C: third label here\nC -> Hub: back again, the long way';
  for (const src of [BOOKING, DIRECT, FAN]) {
    for (const direction of ['right', 'down']) {
      const L = layout(parse(src), { direction });
      assert.deepEqual(labelClashes(L), [], `${direction}: ${src.split('\n')[0]}`);
      assert.deepEqual(pathClashes(L), [], `${direction}: no line runs through a box that is not one of its ends`);
      for (const e of L.edges.filter(x => x.label)) assert.ok(!!e.labelBox !== !!e.badge, 'each labelled connection has its words or its number');
      if (L.badges) assert.ok(L.edges.every(e => e.badge && e.badge.n === e.index + 1), 'numbers everywhere or nowhere, matching the order written');
      for (const e of L.edges.filter(x => x.labelBox)) {
        const b = e.labelBox;
        assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= L.width && b.y + b.h <= L.height, 'every label is inside the picture');
      }
    }
  }
  // running down, a loop back goes round the side the labels are not on, so the picture stays narrow
  const down = layout(parse(DIRECT), { direction: 'down' });
  assert.ok(down.width <= 358, `the Casa diagram fits a 390 px phone at full size (it is ${down.width} wide)`);
});

test('the picture sits in a scroll box, so it can stop shrinking before its words get too small', () => {
  const { html } = renderDiagram('A -> B: books', { id: 'd' });
  assert.match(html, /<div class="sg-diagram-scroll"><svg class="sg-diagram-svg"/);
});

test('the Casa diagram: running right, each label by its own line and the loop back over the top, clear of Razorpay', () => {
  const DIRECT = ['Guest = Guest', 'Site = Your site', 'Bank = Your bank', 'Guest -> Site: chooses dates', 'Guest => Razorpay: pays', 'Site -> Guest: confirms, with the house manual', 'Razorpay => Bank: the payment, less the fee'].join('\n');
  const right = layout(parse(DIRECT), { direction: 'right' });
  assert.equal(right.badges, false, 'there is room for every label beside its own line');
  const site = right.nodes.find(n => n.id === 'Site'), back = right.edges.find(e => e.from === 'Site');
  assert.ok(Math.abs(back.samples[0][1] - site.y) < 1, 'Your site to Guest leaves from the top of Your site');
  assert.deepEqual(pathClashes(right), [], 'and never runs through Razorpay');
  const down = layout(parse(DIRECT), { direction: 'down' });
  assert.equal(down.badges, true, 'on a narrow page the connections are numbered instead');
  const { html } = renderDiagram(DIRECT, { id: 'v', direction: 'down', steps: true });
  assert.match(html, /<g class="sg-d-label sg-d-badge" data-edge="0"><circle[^>]*\/><text[^>]*>1<\/text><\/g>/);
  assert.match(html, /<ol class="sg-diagram-steps"/, 'and the numbered steps beneath say what each number is');
});
