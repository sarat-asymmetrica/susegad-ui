// Test fixture for run-check.test.mjs: what a check does when it starts a browser helper under runCheck.
import fs from 'node:fs';
import { acquireSlot } from '../lib/slots.mjs';
const release = await acquireSlot({ label: 'inside', log: () => {} }); // must not wait: runCheck holds our slot
const locks = fs.readdirSync(process.env.SG_SLOTS_DIR).filter(f => f.endsWith('.lock'));
const rec = JSON.parse(fs.readFileSync(`${process.env.SG_SLOTS_DIR}/${locks[0]}`, 'utf8'));
console.log(`held=${process.env.SG_SLOT_HELD} locks=${locks.length} label=${rec.label} childPid=${rec.childPid === process.pid}`);
release();
