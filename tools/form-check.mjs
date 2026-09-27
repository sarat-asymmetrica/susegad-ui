// Form smoke test: does each form block an empty submit and go through when filled?
//
//   node tools/form-check.mjs --url /packages/recipes/booking/index.html [--no-js] [--form "#booking"]
//
//   --form CSS     check only the forms matching this selector (default: every <form> on the page)
//   --no-js        JavaScript off: the browser's own constraint validation and a plain submit
//   --register R / --theme T / --palette P   passed to the page as for the other tools
//   --json         print the full result as JSON
//   --samples F    read sample values from F instead of the form-check.json beside the page
//
// A page can supply its own valid values in form-check.json, in the page's folder. It maps a
// field's name (or id) to a value, so a form with rules the tool cannot guess (a minimum stay,
// a code sent by the page) can still be filled. Fields the file names are filled even when they
// are optional; required fields it leaves out get the tool's own samples.
//
//   { "about": "why these values",
//     "values": {
//       "arrival": "2026-11-16",                  a text, date, number or select value
//       "room": "whole",                          a radio group: the value to choose
//       "rules": true,                            a checkbox: true checks it, false clears it
//       "code": { "press": ".booking__send",      press this first,
//                 "read": ".booking__code",       then read the value from this element's text:
//                 "match": "(\\d{3}) (\\d{3})" }   the match's groups joined, or the whole match
//     } }
//
// An object value may give "value" instead of "read". Unknown keys are an error.
//
// A form with an <sg-stepper> (JavaScript on) is walked as a person walks it: fill the fields
// on the step that shows, press Next, wait for the next step, and so on; submit on the last.
// The empty phase presses Next on the first step and fails if the stepper moves on.
//
// For each form, twice, on a fresh load:
//   1. empty:  press its submit button without filling anything;
//   2. filled: fill every required field with a valid sample for its type (tools/lib/forms.mjs),
//              then press submit.
// Before each press it records what constraint validation says (checkValidity, and each invalid
// field's validity flags and validationMessage). Every navigation and every non-GET fetch/XHR after
// the press is intercepted and answered with a stub, so nothing reaches a server; the report says
// whether a submit happened, how, and with which fields. With JavaScript on it also records whether
// a script took over the submit event (defaultPrevented).
//
// A form fails if it submits with required fields empty (unless it has novalidate), if it is a
// GET form with personal fields (a name, a phone, an email, a signature), or if it does
// not submit once filled. Console errors, page errors and failed requests fail the run too.

import { parseArgs } from './lib/args.mjs';
import { TARGET_SPEC, targetFrom } from './lib/target.mjs';
import { session, openTarget, waitReady, errorCount, printLog, DESKTOP } from './lib/browser.mjs';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { planFor, readSamples, samplesPathFor, valueFromText, decodeBody, formVerdict, personalFields } from './lib/forms.mjs';

const SPEC = { ...TARGET_SPEC, form: 'string', json: 'bool', samples: 'string' };
let parsed, t;
try {
  parsed = parseArgs(process.argv.slice(2), SPEC);
  t = targetFrom(parsed.opts, parsed.positional);
} catch (e) { console.error(e.message); process.exit(2); }
const { opts } = parsed;
if (!t.url) { console.error('usage: node tools/form-check.mjs --url <page> [--no-js] [--form <css>]'); process.exit(2); }
const formSel = opts.form || 'form';

// The page's own sample values, from form-check.json beside it (or --samples).
const ROOT = fileURLToPath(new URL('..', import.meta.url));
const samplesFile = opts.samples ?? (existsSync(ROOT + samplesPathFor(t.url)) ? ROOT + samplesPathFor(t.url) : null);
let samples = new Map();
if (samplesFile) {
  try { samples = readSamples(readFileSync(samplesFile, 'utf8')); } catch (e) { console.error(`${samplesFile}: ${e.message}`); process.exit(2); }
}

/** Describe the form's fields and tag them with data-sg-fc so Playwright can act on them. */
function describe({ sel, index }) {
  const form = document.querySelectorAll(sel)[index];
  if (!form) return null;
  form.dataset.sgFcForm = '';
  // A stepper that JavaScript has taken over (data-stepped): its steps, to fill one at a time
  const stepper = form.querySelector('sg-stepper[data-stepped]');
  const steps = stepper ? [...stepper.querySelectorAll(':scope > fieldset')] : [];
  if (stepper) stepper.dataset.sgFcStepper = '';
  const seen = new Set();
  const els = [...(form.elements || []), ...form.querySelectorAll('[required], [aria-required="true"]')]
    .filter(el => !seen.has(el) && seen.add(el));
  const radioNames = new Set();
  const fields = [];
  els.forEach((el, i) => {
    const tag = el.localName;
    const type = (el.type || el.getAttribute('type') || (tag === 'textarea' ? 'textarea' : tag === 'select' ? 'select' : 'text')).toLowerCase();
    if (['submit', 'button', 'reset', 'image', 'fieldset', 'output', 'object'].includes(type) || tag === 'fieldset' || tag === 'button' || tag === 'output') return;
    const required = !!el.required || el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
    const name = el.name || el.getAttribute('name') || '';
    let first = true;
    if (type === 'radio') { first = !radioNames.has(name); radioNames.add(name); }
    el.dataset.sgFc = String(i);
    // A form-associated custom element: act on a native control inside its open shadow root, if any.
    let inner = false;
    if (tag.includes('-') && el.shadowRoot) {
      const c = el.shadowRoot.querySelector('input:not([type=hidden]), textarea, select');
      if (c) { c.dataset.sgFcInner = String(i); inner = true; }
    }
    const label = el.labels?.[0]?.textContent?.trim() || el.getAttribute('aria-label') || '';
    fields.push({
      key: String(i), tag, type, name, id: el.id, label, autocomplete: el.getAttribute('autocomplete') || '',
      required, firstOfGroup: first, custom: tag.includes('-'), inner, inStep: steps.findIndex(st => st.contains(el)),
      min: el.getAttribute('min') ?? undefined, max: el.getAttribute('max') ?? undefined, step: el.getAttribute('step') ?? undefined,
      minLength: el.minLength >= 0 ? el.minLength : undefined, maxLength: el.maxLength >= 0 ? el.maxLength : undefined,
      pattern: el.getAttribute('pattern') || undefined, multiple: !!el.multiple,
      options: tag === 'select' ? [...el.options].map(o => ({ value: o.value, disabled: o.disabled })) : undefined,
    });
  });
  const submitters = [
    ...form.querySelectorAll('button:not([type]), button[type=submit], input[type=submit], input[type=image]'),
    ...(form.id ? document.querySelectorAll(`[form="${CSS.escape(form.id)}"]:is(button:not([type]), button[type=submit], input[type=submit])`) : []),
  ];
  // No submit button: press what a person would press, a plain button. Never requestSubmit(),
  // which would hide a form nobody can submit.
  const fallback = submitters[0] ? null : form.querySelector('button, [role="button"]');
  const pressed = submitters[0] || fallback;
  if (pressed) pressed.dataset.sgFcSubmit = '';
  return {
    id: form.id, name: form.getAttribute('name') || '', action: form.action, method: (form.method || 'get').toLowerCase(),
    novalidate: form.noValidate, fields, stepper: stepper ? { count: steps.length } : null,
    submitter: pressed ? (pressed.textContent || pressed.value || pressed.getAttribute('aria-label') || '').trim() : null,
    submitterKind: submitters[0] ? 'submit' : fallback ? 'plain' : 'none',
  };
}

/** What constraint validation says right now. */
function validity({ sel, index }) {
  const form = document.querySelectorAll(sel)[index];
  const flags = ['valueMissing', 'typeMismatch', 'patternMismatch', 'tooShort', 'tooLong', 'rangeUnderflow', 'rangeOverflow', 'stepMismatch', 'badInput', 'customError'];
  const invalid = [];
  for (const el of form.querySelectorAll('[data-sg-fc]')) {
    if (!el.validity || el.validity.valid || el.willValidate === false) continue;
    invalid.push({ name: el.name || el.id || el.localName, type: el.type || el.localName, message: el.validationMessage, flags: flags.filter(f => el.validity[f]) });
  }
  // Not form.checkValidity(): that fires `invalid` events, and a stepper answers them by jumping to the step.
  return { valid: [...form.elements].every(el => !el.willValidate || el.validity.valid), invalid };
}

async function phase(s, index, fill) {
  const { context, page, log } = await openTarget(s, t, DESKTOP);
  const out = { ready: null, fills: [], validity: null, submitted: false, via: null, requests: [], script: null };
  try {
    out.ready = await waitReady(page, t);
    if (!out.ready.ok) return { out, log };
    const info = await page.evaluate(describe, { sel: formSel, index });
    out.info = info;

    if (!fill) {
      // "Empty" means the required fields are blank, even when the page prefills them.
      await page.evaluate(() => {
        for (const el of document.querySelectorAll('[data-sg-fc]')) {
          const req = el.required || el.hasAttribute('required') || el.getAttribute('aria-required') === 'true';
          if (!req) continue;
          if (el.type === 'checkbox' || el.type === 'radio') el.checked = false;
          else if (el.localName === 'select') el.selectedIndex = [...el.options].findIndex(o => o.value === '');
          else if ('value' in el) el.value = '';
        }
      });
    }
    const walking = !!info.stepper && !t.noJs;
    const stepIndex = () => page.evaluate(() => document.querySelector('[data-sg-fc-stepper]').index);
    // Press the stepper's Next and wait for the next step to show. Returns the step it ends on.
    const pressNext = async () => {
      const from = await stepIndex();
      await page.locator('[data-sg-fc-stepper] .sg-stepper-next:not([hidden])').first().click({ timeout: 5000 });
      await page.waitForFunction(i => document.querySelector('[data-sg-fc-stepper]').index !== i, from, { timeout: 3000 }).catch(() => {});
      return stepIndex();
    };

    if (fill) {
      const plans = info.fields
        .filter(f => f.type !== 'radio' || f.firstOfGroup)
        .map(f => ({ f, plan: planFor(f, samples) }))
        .filter(p => p.plan.action !== 'leave');

      const fillOne = async ({ f, plan }) => {
        const rec = { name: f.name || f.id || f.tag, type: f.type, required: f.required, from: plan.from, action: plan.action, value: plan.value, reason: plan.reason };
        out.fills.push(rec);
        if (plan.action === 'skip') return;
        const skip = reason => { rec.action = 'skip'; rec.reason = reason; };
        const radio = f.type === 'radio' && plan.value != null;
        const loc = page.locator(radio
          ? `[data-sg-fc-form] input[type=radio][name="${f.name}"][value="${plan.value}"]`
          : f.inner ? `[data-sg-fc-inner="${f.key}"]` : `[data-sg-fc="${f.key}"]`).first();
        try {
          // the page asked for a button to be pressed first, such as "Send a code"
          if (plan.press) {
            const btn = page.locator(plan.press).first();
            if (!(await btn.isVisible())) return skip(`nothing to press at ${plan.press}${t.noJs ? ' (JavaScript is off)' : ''}`);
            await btn.click({ timeout: 5000 });
          }
          if (plan.read) {
            const text = await page.waitForFunction(({ sel, match }) => {
              const tx = document.querySelector(sel)?.textContent ?? '';
              return (match ? new RegExp(match).test(tx) : tx.trim()) ? tx : null;
            }, { sel: plan.read, match: plan.match }, { timeout: 3000 }).then(h => h.jsonValue()).catch(() => null);
            const v = text == null ? null : valueFromText(text, plan.match);
            if (v == null) return skip(`found no value in ${plan.read}`);
            rec.value = plan.value = v;
          }
          if (f.custom && !f.inner) {
            if (t.noJs) return skip('custom element without JavaScript');
            await page.evaluate(([k, v]) => { const el = document.querySelector(`[data-sg-fc="${k}"]`); el.value = v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }, [f.key, plan.value ?? 'on']);
            return;
          }
          // a field the page does not show (a code box with JavaScript off, say) is left alone unless required
          if (!f.required && !(await loc.isVisible())) return skip('not shown on this page');
          if (plan.action === 'fill') await loc.fill(plan.value, { timeout: 5000 });
          else if (plan.action === 'select') await loc.selectOption(plan.value, { timeout: 5000 });
          else if (plan.action === 'check') await loc.check({ timeout: 5000 });
          else if (plan.action === 'uncheck') await loc.uncheck({ timeout: 5000 });
        } catch (e) {
          skip(`could not ${plan.action}: ${e.message.split('\n')[0]}`);
        }
      };

      if (walking) {
        // One step at a time, as a person would: fill what shows, press Next, wait for the next step.
        const done = new Set();
        for (const p of plans.filter(p => p.f.inStep < 0)) { await fillOne(p); done.add(p); }
        for (let guard = 0; guard <= info.stepper.count; guard++) {
          const at = await stepIndex();
          for (const p of plans.filter(p => p.f.inStep === at && !done.has(p))) { await fillOne(p); done.add(p); }
          if (at >= info.stepper.count - 1) break;
          const to = await pressNext().catch(() => at);
          if (to === at) {
            out.stuck = {
              step: at + 1, count: info.stepper.count,
              message: await page.evaluate(() => [...document.querySelector('[data-sg-fc-stepper]').steps.find(s => !s.hidden)?.elements ?? []].find(c => c.willValidate && !c.validity.valid)?.validationMessage ?? ''),
            };
            break;
          }
        }
        for (const p of plans.filter(p => !done.has(p))) {
          out.fills.push({ name: p.f.name || p.f.id || p.f.tag, type: p.f.type, required: p.f.required, from: p.plan.from, action: 'skip', reason: `not reached: the stepper stayed on step ${out.stuck?.step}` });
        }
      } else {
        for (const p of plans) await fillOne(p);
      }
    }

    out.validity = await page.evaluate(validity, { sel: formSel, index });
    if (!t.noJs) {
      await page.evaluate(() => {
        window.__fcEvents = [];
        document.addEventListener('submit', e => window.__fcEvents.push(e), true);
      });
    }
    // From here on nothing leaves the browser: navigations and writes are answered with stubs.
    await page.route('**/*', route => {
      const r = route.request();
      if (r.isNavigationRequest() && r.frame() === page.mainFrame()) {
        out.requests.push({ kind: 'navigation', method: r.method(), url: r.url(), contentType: r.headers()['content-type'] || '', body: r.postData() || '' });
        return route.fulfill({ status: 200, contentType: 'text/html; charset=utf-8', body: '<!doctype html><title>Submitted</title><p>Submitted.</p>' });
      }
      if ((r.resourceType() === 'fetch' || r.resourceType() === 'xhr') && r.method() !== 'GET') {
        out.requests.push({ kind: r.resourceType(), method: r.method(), url: r.url(), contentType: r.headers()['content-type'] || '', body: r.postData() || '' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{}' });
      }
      return route.continue();
    });

    if (walking && !fill) {
      // Empty, with a stepper: the submit button is on the last step, so press Next on the first.
      out.via = 'the stepper\'s Next button on step 1';
      const from = await stepIndex();
      out.walkedOn = (await pressNext().catch(() => from)) !== from;
    } else if (info.submitterKind !== 'none') {
      out.via = info.submitterKind === 'submit' ? `the "${info.submitter}" button` : `the "${info.submitter}" button, which is not a submit button`;
      const state = await page.evaluate(() => {
        const b = document.querySelector('[data-sg-fc-submit]');
        return b.disabled ? 'disabled' : b.getAttribute('aria-disabled') === 'true' ? 'aria-disabled' : null;
      });
      if (state) out.via += ` (it is ${state})`;
      await page.locator('[data-sg-fc-submit]').first().click({ timeout: 5000, noWaitAfter: true }).catch(e => { out.via += ` (click failed: ${e.message.split('\n')[0]})`; });
    } else {
      // Implicit submission: Enter in a text field, as a person with no button would try.
      const first = info.fields.find(f => !['checkbox', 'radio', 'select', 'select-one', 'select-multiple', 'textarea', 'file'].includes(f.type) && !f.custom);
      out.via = first ? `Enter in ${first.name || first.type} (the form has no button)` : 'nothing: the form has no button and no text field';
      if (first) await page.locator(`[data-sg-fc="${first.key}"]`).first().press('Enter', { timeout: 5000, noWaitAfter: true }).catch(() => {});
    }
    await page.waitForTimeout(600);
    if (!t.noJs) {
      out.script = await page.evaluate(({ sel, index }) => {
        const form = document.querySelectorAll(sel)[index];
        if (!form || !window.__fcEvents) return null; // navigated away
        const events = window.__fcEvents.filter(e => e.target === form);
        return {
          fired: events.length > 0,
          prevented: events.some(e => e.defaultPrevented),
          markedInvalid: form.querySelectorAll('[aria-invalid="true"]').length,
        };
      }, { sel: formSel, index }).catch(() => null);
    }
    // A script that takes over the submit (defaultPrevented), sends nothing and marks nothing
    // invalid is counted as handled: the tool cannot see what it did, so the report says so.
    out.handledByScript = !out.requests.length && !!out.script?.fired && out.script.prevented && out.script.markedInvalid === 0;
    out.submitted = out.requests.length > 0 || out.handledByScript;
    out.requests = out.requests.map(({ body, ...q }) => ({
      ...q, fields: q.method === 'GET' ? [...new URL(q.url).searchParams] : decodeBody(q.contentType, body),
    }));
  } finally {
    await context.close();
  }
  return { out, log };
}

const s = await session();
const results = [];
let problems = 0;
try {
  const probe = await openTarget(s, t, DESKTOP);
  const ready = await waitReady(probe.page, t);
  const count = ready.ok ? await probe.page.evaluate(sel => document.querySelectorAll(sel).length, formSel) : 0;
  await probe.context.close();
  if (!ready.ok) { console.log(`not ready: ${ready.reason}`); problems++; }
  else if (!count) { console.log(`no forms match "${formSel}" on ${t.url}`); problems++; }

  for (let i = 0; i < count; i++) {
    const empty = await phase(s, i, false);
    const filled = await phase(s, i, true);
    const info = filled.out.info || empty.out.info;
    const required = info.fields.filter(f => f.required && (f.type !== 'radio' || f.firstOfGroup)).length;
    const skipped = filled.out.fills.filter(f => f.action === 'skip' && f.required).length;
    const personalInGet = info.method === 'get' ? personalFields(info.fields) : [];
    const verdict = formVerdict({ required, novalidate: info.novalidate, skipped, personalInGet, empty: empty.out, filled: { submitted: filled.out.submitted, invalid: filled.out.validity?.invalid ?? [], stuck: filled.out.stuck } });
    const errors = errorCount(empty.log) + errorCount(filled.log);
    if (required === 0 && info.submitterKind === 'none') {
      // A layout-only <form> (no button, nothing required) is not a form a person submits.
      results.push({ form: info.id ? `#${info.id}` : `${formSel} #${i + 1}`, skipped: 'no button and no required fields', errors, pass: errors === 0 });
      if (!opts.json) console.log(`
skip  form ${results.at(-1).form}: no button and no required fields, so nothing to check`);
      if (errors) problems++;
      continue;
    }
    const r = {
      form: info.id ? `#${info.id}` : `${formSel} #${i + 1}`, action: info.action, method: info.method, novalidate: info.novalidate,
      required, fields: info.fields.length, submitter: info.submitter,
      samples: samplesFile, stepper: info.stepper && !t.noJs ? info.stepper : null,
      empty: { validity: empty.out.validity, submitted: empty.out.submitted, walkedOn: empty.out.walkedOn, via: empty.out.via, requests: empty.out.requests, script: empty.out.script },
      filled: { fills: filled.out.fills, validity: filled.out.validity, submitted: filled.out.submitted, handledByScript: filled.out.handledByScript, stuck: filled.out.stuck, via: filled.out.via, requests: filled.out.requests, script: filled.out.script },
      errors, verdict,
      pass: verdict.pass && errors === 0,
    };
    results.push(r);
    if (!r.pass) problems++;

    if (!opts.json) {
      console.log(`\n${r.pass ? 'pass' : 'FAIL'}  form ${r.form}: ${r.method.toUpperCase()} ${new URL(r.action).pathname}${r.novalidate ? ', novalidate' : ''}, ${r.required} required of ${r.fields} field(s), submit by ${filled.out.via}`);
      if (r.samples) console.log(`  samples from ${r.samples.replace(ROOT, '').replace(/\\/g, '/')}`);
      if (r.stepper) console.log(`  walked an <sg-stepper> of ${r.stepper.count} steps, pressing Next at each`);
      const e = r.empty;
      if (e.walkedOn != null) console.log(`  empty:  Next on step 1 ${e.walkedOn ? 'MOVED ON with its required fields empty' : 'stayed on step 1'}`);
      console.log(`  empty:  valid ${e.validity?.valid}; ${e.submitted ? `SUBMITTED (${e.requests.map(q => `${q.method} ${new URL(q.url).pathname}`).join(', ') || 'handled by a script with nothing marked invalid'})` : 'not submitted'}${e.script?.markedInvalid ? `; a script marked ${e.script.markedInvalid} field(s) aria-invalid` : ''}`);
      for (const f of e.validity?.invalid ?? []) console.log(`          ${f.name} (${f.type}): ${f.flags.join(', ')}: "${f.message}"`);
      const fl = r.filled;
      for (const f of fl.fills) {
        const what = f.action === 'skip' ? `${f.required ? 'SKIPPED' : 'left'}, ${f.reason}` : f.action === 'check' ? `checked${f.type === 'radio' && f.value ? ` ${JSON.stringify(f.value)}` : ''}` : f.action === 'uncheck' ? 'unchecked' : JSON.stringify(f.value);
        console.log(`  fill    ${f.name} (${f.type}${f.required ? '' : ', optional'}${f.from === 'page' ? ', from the page' : ''}): ${what}`);
      }
      console.log(`  filled: valid ${fl.validity?.valid}; ${fl.submitted ? (filled.out.handledByScript ? 'handled by a script, which sent no request' : 'submitted') : 'NOT submitted'}`);
      for (const f of fl.validity?.invalid ?? []) console.log(`          still invalid: ${f.name} (${f.type}): ${f.flags.join(', ')}: "${f.message}"`);
      for (const q of fl.requests) console.log(`          ${q.kind} ${q.method} ${new URL(q.url).pathname}: ${q.fields.map(([k, v]) => `${k}=${v}`).join('&') || '(no fields)'}`);
      if (fl.script?.fired) console.log(`          submit event: ${fl.script.prevented ? 'taken over by a script (defaultPrevented)' : 'not prevented'}${fl.script.markedInvalid ? `, ${fl.script.markedInvalid} field(s) marked aria-invalid` : ''}`);
      for (const n of verdict.notes) console.log(`  note: ${n}`);
      if (errors) { printLog(empty.log, '  '); printLog(filled.log, '  '); }
    }
  }
} finally {
  await s.done();
}
if (opts.json) console.log(JSON.stringify({ url: t.url, javascript: !t.noJs, forms: results }, null, 2));
else console.log(`\n${results.filter(r => r.pass).length} of ${results.length} form(s) pass${t.noJs ? ', JavaScript off' : ''}`);
process.exit(problems ? 1 : 0);
