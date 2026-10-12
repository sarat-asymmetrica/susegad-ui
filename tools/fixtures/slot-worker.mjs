// Test fixture for slots.test.mjs: take a slot, log in/out around a short hold, release.
import fs from 'node:fs';
import { acquireSlot } from '../lib/slots.mjs';
const [, , log, hold] = process.argv;
const release = await acquireSlot({ label: `worker-${process.pid}`, pollMs: 10, log: () => {} });
fs.appendFileSync(log, `in ${process.pid}\n`);
await new Promise(r => setTimeout(r, Number(hold)));
fs.appendFileSync(log, `out ${process.pid}\n`);
release();
