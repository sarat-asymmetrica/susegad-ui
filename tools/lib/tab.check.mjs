// The Tab helpers (tools/lib/tab.mjs) held to account: they must reach a real tab stop, walk in the order
// the engine's Tab would, and read red when the target is not a tab stop. WebKit leaves links out of the tab
// order, so there the helpers stand in for Option+Tab; this check proves the stand-in is not a free pass.
//
//   node tools/lib/tab.check.mjs        (SG_ENGINE=webkit for the engine that needs the stand-in)

import { harness, tab, tabTo, tabWalk, tabsToLinks } from './component-check.mjs';
import { unsupportedIn } from './engine.mjs';

const { browser, engine, check, openHtml, done } = await harness();
const PAGE = body => `<!doctype html><html lang="en"><head><title>tab</title></head><body>${body}</body></html>`;
const name = e => e.id || e.localName;

{
  const { ctx, page } = await openHtml('tab-walk', PAGE('<a id="a1" href="#1">1</a><button id="b1">b</button><a id="a2" href="#2">2</a><input id="i1"><a id="a3" href="#3">3</a>'));
  const order = await tabWalk(page, 5, name);
  check('a walk over link, button, link, field, link visits all five in document order', order.join() === 'a1,b1,a2,i1,a3', order.join());
  await ctx.close();
}
{
  // a positive tabindex jumps the queue: the order the stand-in promises is the one the engine presses, or tab() would throw
  const { ctx, page } = await openHtml('tab-positive', PAGE('<a id="a1" href="#1">1</a><button id="b1">b</button><a id="a3" href="#3" tabindex="2">3</a><a id="a4" href="#4" tabindex="1">4</a>'));
  const order = await tabWalk(page, 4, name);
  check('positive tabindex goes first, lowest first, then the rest in document order', order.join() === 'a4,a3,a1,b1', order.join());
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('tab-to', PAGE('<button id="b0">0</button><a id="a1" href="#1">1</a>'));
  const presses = await tabTo(page, '#a1', 4);
  check('tabTo reaches a link', presses > 0, `${presses} presses`);
  await ctx.close();
}
for (const [what, markup] of [
  ['with tabindex="-1"', '<a id="t" href="#x" tabindex="-1">x</a>'],
  ['with no href', '<a id="t">x</a>'],
  ['with display: none', '<a id="t" href="#x" style="display:none">x</a>'],
  ['with visibility: hidden', '<a id="t" href="#x" style="visibility:hidden">x</a>'],
  ['inside an inert block', '<div inert><a id="t" href="#x">x</a></div>'],
]) {
  const { ctx, page } = await openHtml('tab-not', PAGE(`<button>0</button>${markup}<button>2</button>`));
  const presses = await tabTo(page, '#t', 4);
  check(`control: a link ${what} is never reached`, presses === 0, `${presses} presses`);
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('tab-disabled', PAGE('<a href="#1">1</a><button id="t" disabled>x</button><a href="#2">2</a>'));
  check('control: a disabled button is never reached', await tabTo(page, '#t', 4) === 0);
  await ctx.close();
}
{
  const { ctx, page } = await openHtml('tab-radio', PAGE('<a id="a1" href="#1">1</a><input type="radio" name="g" id="r1"><input type="radio" name="g" id="r2" checked><input type="radio" name="g" id="r3"><a id="a2" href="#2">2</a>'));
  const order = await tabWalk(page, 3, name);
  check('a radio group is one stop (the checked one)', order.join() === 'a1,r2,a2', order.join());
  await ctx.close();
}
if (await tabsToLinks(browser)) {
  unsupportedIn(engine, 'the stand-in disagreement probe', 'this engine tabs to links, so tab() never uses the stand-in');
} else {
  // A stop the DOM walk cannot see (a button in a shadow root) sits where the next real stop is, so a real Tab disagrees with the promise and tab() must say so.
  const { ctx, page } = await openHtml('tab-disagree', PAGE('<button id="b0">0</button><div id="host"></div><button id="b2">2</button><script>document.getElementById("host").attachShadow({mode:"open"}).innerHTML="<button id=\\"hidden\\">h</button>"</script>'));
  await page.focus('#b0');
  const threw = await tab(page).then(() => false, e => /DOM order promised/.test(e.message));
  check('control: when the DOM order and the engine\'s own Tab disagree, tab() throws instead of passing', threw);
  await ctx.close();
}
{
  // focus on an element that is not a tab stop (tabindex -1): Tab goes to the next stop after it in the document, not to the first stop
  const { ctx, page } = await openHtml('tab-from-minus-one', PAGE('<a id="a1" href="#1">1</a><div id="d" tabindex="-1">d</div><a id="a2" href="#2">2</a><button id="b2">b</button>'));
  await page.focus('#d');
  const ok = await tab(page).then(() => true, () => false);
  const at = await page.evaluate(() => document.activeElement.id);
  check('control: Tab from a tabindex=-1 element does not go back to the first stop', ok && at !== 'a1', `landed on ${at}`);
  await ctx.close();
}
await done();
