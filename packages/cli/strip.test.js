import { test } from 'node:test';
import assert from 'node:assert/strict';
import { stripComments } from './src/strip.js';

test('line, block and JSDoc comments go, and so do the blank lines they leave', () => {
  const src = [
    '/** The pencil box. */',
    '// a note',
    'export const a = 1; // trailing',
    '',
    '/*',
    ' * block',
    ' */',
    'export const b = 2;',
  ].join('\n');
  assert.equal(stripComments(src), 'export const a = 1;\nexport const b = 2;\n');
});

test('comment markers inside strings, templates and regexes stay', () => {
  const keep = [
    "const url = 'http://example.com';",
    'const s = "/* not a comment */";',
    'const t = `line // still text ${a /* gone */ + 1} and ${`inner // text`}`;',
    'const r = /\\/\\/[/*]+/g.test(x);',
    'const d = a / b / c; // divide',
  ].join('\n');
  const out = stripComments(keep);
  assert.match(out, /'http:\/\/example\.com'/);
  assert.match(out, /"\/\* not a comment \*\/"/);
  assert.match(out, /`line \/\/ still text \$\{a\s+\+ 1\} and \$\{`inner \/\/ text`\}`/);
  assert.match(out, /\/\\\/\\\/\[\/\*\]\+\/g\.test\(x\)/);
  assert.match(out, /const d = a \/ b \/ c;$/m);
  assert.doesNotMatch(out, /gone|divide/);
});

test('an object literal inside a template expression does not confuse the scanner', () => {
  assert.equal(stripComments('const x = `${ fn({ a: 1 }) } // kept`; // dropped\n'), 'const x = `${ fn({ a: 1 }) } // kept`;\n');
});
