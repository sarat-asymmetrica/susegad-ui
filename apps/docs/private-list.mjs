// The export's private list is tools/publish/export.mjs, which is private: the public tree does not have it, and nothing in that tree is
// private. Absent is the public tree. Present is the private one, and then it must load: a syntax error or a renamed export throws here,
// where a `.catch(() => ({}))` had quietly switched the pointers check off (Rasika, 18 October 2026, S3).

import fs from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const PRIVATE_LIST = fileURLToPath(new URL('../../tools/publish/export.mjs', import.meta.url));

/** @returns {Promise<{ isPrivate: (p: string) => boolean, absent: boolean }>} */
export async function loadPrivateList(file = PRIVATE_LIST) {
  if (!fs.existsSync(file)) return { isPrivate: () => false, absent: true };
  const { isPrivate } = await import(pathToFileURL(file).href);
  if (typeof isPrivate !== 'function') throw new Error(`${file} is present but does not export isPrivate()`);
  return { isPrivate, absent: false };
}
