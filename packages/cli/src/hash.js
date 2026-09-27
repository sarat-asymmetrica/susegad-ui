import { createHash } from 'node:crypto';

/**
 * Hash file content the same way on every machine. Text has CRLF read as LF,
 * so a Windows checkout or an editor's line-ending setting is not an "edit".
 * Anything with a NUL byte is treated as binary and hashed as it is.
 * @param {Buffer | string} content
 * @returns {string} "sha256-<hex>"
 */
export function hashContent(content) {
  const buf = typeof content === 'string' ? Buffer.from(content, 'utf8') : content;
  const body = buf.includes(0) ? buf : Buffer.from(buf.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  return 'sha256-' + createHash('sha256').update(body).digest('hex');
}

/** One hash for a list of already-hashed parts, order included. */
export function hashParts(parts) {
  return 'sha256-' + createHash('sha256').update(parts.join('\n')).digest('hex');
}
