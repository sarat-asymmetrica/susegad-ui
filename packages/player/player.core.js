// player.core.js: the pure core of <sg-player>. Time, the scrubber's
// number line, keyboard commands and caption-cue selection. No DOM; runs in
// Node and is fully tested there.

/** Seconds to "0:07", "1:03:07" (hours only when the media is an hour or more). */
export function formatTime(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const total = Math.floor(seconds);
  const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
  const mm = h > 0 ? String(m).padStart(2, '0') : String(m);
  return h > 0 ? `${h}:${mm}:${String(s).padStart(2, '0')}` : `${mm}:${String(s).padStart(2, '0')}`;
}

/** How far along the scrubber sits, 0 to 1. NaN-safe: an unknown duration gives 0. */
export function scrubberFraction(currentTime, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, (currentTime || 0) / duration));
}

/** The time a fraction along the scrubber (0 to 1) means, clamped to the media's length. */
export function timeFromFraction(fraction, duration) {
  if (!Number.isFinite(duration) || duration <= 0) return 0;
  return Math.min(1, Math.max(0, fraction)) * duration;
}

/**
 * Map a keyboard event's `key` (plus whether the media is playing) to a
 * command name, or null when the player doesn't handle that key.
 * @param {string} key @returns {'toggle-play'|'seek-back'|'seek-fwd'|'seek-start'|'seek-end'|'toggle-mute'|'toggle-captions'|null}
 */
export function keyCommand(key) {
  switch (key) {
    case ' ': case 'k': case 'K': return 'toggle-play';
    case 'ArrowLeft': return 'seek-back';
    case 'ArrowRight': return 'seek-fwd';
    case 'Home': return 'seek-start';
    case 'End': return 'seek-end';
    case 'm': case 'M': return 'toggle-mute';
    case 'c': case 'C': return 'toggle-captions';
    default: return null;
  }
}

/** How far a seek key jumps, in seconds. Shift widens the jump, as scrubbing tools usually do. */
export function seekStep(shiftKey) { return shiftKey ? 15 : 5; }

/**
 * The cue active at `time`, from a plain list of `{ start, end, text }`
 * (as narration's `parseVtt` phrases, flattened, or a native TextTrack's
 * cues mapped to this shape). Cues are assumed non-overlapping and sorted;
 * a binary-search-free scan is fine for a track of any real length.
 * @param {{start: number, end: number, text: string}[]} cues @param {number} time
 * @returns {{start: number, end: number, text: string} | null}
 */
export function activeCue(cues, time) {
  if (!cues?.length) return null;
  for (const c of cues) if (time >= c.start && time < c.end) return c;
  return null;
}

/** A native TextTrack's `cues` (a TextTrackCueList of VTTCue) to the plain shape `activeCue` reads. */
export function cuesToPlain(trackCues) {
  const out = [];
  for (let i = 0; i < (trackCues?.length ?? 0); i++) {
    const c = trackCues[i];
    out.push({ start: c.startTime, end: c.endTime, text: c.text });
  }
  return out;
}
