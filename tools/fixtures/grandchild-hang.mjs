// A check that hangs with a grandchild holding its stdout, as a check's browser does. run-check.test.mjs
// times it out and expects both processes gone. Prints the grandchild's pid so the test can look for it.
import { spawn } from 'node:child_process';
const g = spawn(process.execPath, ['-e', 'setTimeout(() => {}, 300000)'], { stdio: 'inherit' });
console.log(`grandchild=${g.pid}`);
setInterval(() => {}, 1000);
