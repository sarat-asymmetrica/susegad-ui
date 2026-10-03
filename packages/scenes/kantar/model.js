// Kantar: the tiatr stage and curtain. The pure model.
//
// Ported from asymmetrica-web/explorations/susegad/pieces/kantar.js under
// Scene Contract v2. The tiatr is the Konkani musical theatre of Goa.
// Between scenes, the heavy red velvet curtain drops, a singer steps into the
// spotlight to sing a kantar (often reflecting current events or village life)
// while the stagehands change the painted backdrop behind.
//
// Pure function: model({ time, seed, register, params, W, H }).
// Completely deterministic for a given seed and time. Runs in Node without DOM.

import { clamp, lerp, smoothstep, phase, ease, TAU } from '../../engine/index.js';

export const W = 1200;
export const H = 800;

export const OPEN = { x0: 150, x1: 1050, y0: 150, y1: 610 };
export const APRON = 640;

export const SCENES = [
  { id: 'church', title: 'Scene one: the church square' },
  { id: 'beach', title: 'Scene two: the beach at dusk' },
  { id: 'balcao', title: 'Scene three: the balcão at night' },
];

export const SONGS = [
  'Susegad: the unhurried contentment of a Goan afternoon',
  'The bus to Mapusa waits for no one, except when the driver is having his tea',
  'Rain on the roof tiles, fish in the curry, and my cousin in Dubai asks what is new',
];

// Phase lengths in seconds: scene on display, curtain dropping, kantar song, curtain rising
export const PHASES = {
  scene: 7.0,
  down: 1.6,
  song: 6.4,
  up: 1.8,
};

export const ACT_DURATION = PHASES.scene + PHASES.down + PHASES.song + PHASES.up; // 16.8s
export const TOTAL_SETS = SCENES.length;
export const SHOW_DURATION = ACT_DURATION * TOTAL_SETS; // 50.4s

export const RISE_TIME = 1.8; // Warm load curtain rise duration (under 2s)

// The hero: the same stage as the front door's masthead, where the show runs
// only when asked. It rises once, rests, and a click plays one act (the curtain
// drops, a kantar is sung, the curtain rises on the next set) and rests again.
// The kantar sung is our own line; the plate's placeholder songs stay out of it
// until a Konkani ear has heard them.
export const HERO_LINE = 'Susegad: the unhurried contentment of a Goan afternoon.';
export const HERO_ACT = PHASES.down + PHASES.song + PHASES.up; // 9.8s, then it rests

// The tempo of the show. A tiatr ballad sits near 120 beats a minute; the pit,
// the singer and the house all breathe on this one pulse, which is the only
// thing that makes a stage look performed rather than posed.
export const BEAT = 0.5;
export const BAR = 4;
// Where the refrain begins inside a song, as a share of the song.
export const REFRAIN_AT = 0.56;

/**
 * The performance, as pure functions of the song clock.
 *
 * Everything here is zero when the spotlight is off, so quiet and warm (both of
 * which hold spot at 0) are untouched by it and stay exactly as settled as they
 * were.
 *
 * @param {object} o
 * @param {number} [o.song] song progress 0..1, or -1 when nothing is being sung
 * @param {number} [o.landed] seconds since the curtain landed
 * @param {number} [o.time] free running time, used when no song is on
 * @param {number} [o.spot] the spotlight 0..1, the gate on every moving part
 * @param {number} [o.curtain] curtain 0 up, 1 down
 * @returns {object} the performance, all values 0 when the stage is still
 */
export function performanceAt({ song = -1, landed = -1, time = 0, spot = 0, curtain = 0, quiet = false } = {}) {
  const singing = song >= 0;
  const s = singing ? clamp(song, 0, 1) : 0;
  // While a song is up, the clock is the curtain landing, so the beat starts on
  // the first note. Between songs nothing is being sung, so it falls back to time.
  const beat = singing ? Math.max(0, landed ?? 0) / BEAT : time / BEAT;
  const pulse = beat * TAU;
  const inBar = Math.floor(beat) % BAR;

  const refrain = singing ? smoothstep(REFRAIN_AT, REFRAIN_AT + 0.12, s) : 0;
  const finalNote = singing ? smoothstep(0.86, 0.96, s) : 0;
  // Breath: empty at the beat, full between beats. The singer takes it in on the beat.
  const breath = Math.sin(pulse - Math.PI / 2) * 0.5 + 0.5;

  // How much of the show is happening right now. The house is dark and still
  // behind a closed curtain, attentive during a scene, fully alive during a song.
  const stageDrive = singing ? spot : 0;
  const houseDrive = quiet || curtain >= 0.99 ? 0 : singing ? Math.max(spot, 0.25) : 0.5;

  return {
    beat,
    inBar,
    singing,
    refrain,
    finalNote,
    breath,
    // The singer
    lean: Math.sin(pulse) * 1.3 * stageDrive,
    hip: Math.sin(pulse) * 3.6 * stageDrive,
    // The gown swings a beat behind the body. This is what makes a silhouette read
    // as a person who is moving rather than a person who is standing.
    hem: Math.sin(pulse - 0.7) * 7 * (0.4 + 0.6 * refrain) * (0.3 + 0.7 * stageDrive),
    tilt: finalNote * 0.36 * stageDrive,
    armOut: clamp(refrain * 0.9 + finalNote * 0.3, 0, 1) * stageDrive,
    chest: breath * 0.022 * (0.4 + 0.6 * stageDrive),
    // The house, seen from behind in the front row
    bob: Math.sin(pulse) * 3.4 * houseDrive,
    clap: clamp(refrain * 1.15 - 0.15, 0, 1) * houseDrive,
    // The pit, in the same time
    pit: Math.sin(pulse) * 0.5 + 0.5,
    pitDrive: stageDrive > 0 ? 1 : 0.45 * houseDrive,
  };
}

/**
 * Determine the show state at time t for playful looping.
 * Pure timeline calculations: scene index, phase, curtain progress, song progress, landed time.
 */
export function showAt(t) {
  const normT = ((t % SHOW_DURATION) + SHOW_DURATION) % SHOW_DURATION;
  const i = Math.floor(normT / ACT_DURATION);
  const u = normT - i * ACT_DURATION;

  let curtain = 0;
  let song = -1;
  let landed = -1;
  let set = i;
  let phaseName = 'scene';

  if (u < PHASES.scene) {
    curtain = 0;
    phaseName = 'scene';
  } else if (u < PHASES.scene + PHASES.down) {
    const p = (u - PHASES.scene) / PHASES.down;
    curtain = ease.inCubic(p);
    phaseName = 'curtain-drop';
  } else if (u < PHASES.scene + PHASES.down + PHASES.song) {
    curtain = 1;
    song = (u - PHASES.scene - PHASES.down) / PHASES.song;
    landed = u - PHASES.scene - PHASES.down;
    phaseName = 'song';
    // The set is changed behind the curtain while the song is sung
    if (u >= PHASES.scene + PHASES.down + 0.2) {
      set = (i + 1) % TOTAL_SETS;
    }
  } else {
    const p = (u - (ACT_DURATION - PHASES.up)) / PHASES.up;
    curtain = 1 - ease.inOutCubic(p);
    set = (i + 1) % TOTAL_SETS;
    phaseName = 'curtain-rise';
  }

  return { i, u, set, curtain, song, landed, phase: phaseName, t: normT };
}

/**
 * The hero's state at scene-clock `time`, given the clock time `cue` at which
 * the last click struck an act and `acts`, how many have been struck. Before
 * the first click it is the warm rise, then rest. Pure.
 * @param {number} time
 * @param {number|null} cue
 * @param {number} acts
 */
export function heroAt(time, cue, acts) {
  const n = Math.max(0, Math.floor(acts || 0));
  const rest = (set, phaseName = 'settled') => ({ curtain: 0, set, song: -1, landed: -1, phase: phaseName, settled: true });
  if (cue === null || cue === undefined || n === 0) {
    if (time < RISE_TIME) return { curtain: 1 - ease.inOutCubic(phase(time, 0, RISE_TIME)), set: 0, song: -1, landed: -1, phase: 'curtain-rise', settled: false };
    return rest(0);
  }
  const u = time - cue;
  const before = (n - 1) % TOTAL_SETS, after = n % TOTAL_SETS;
  if (u < 0 || u >= HERO_ACT) return rest(after);
  if (u < PHASES.down) return { curtain: ease.inCubic(u / PHASES.down), set: before, song: -1, landed: -1, phase: 'curtain-drop', settled: false };
  if (u < PHASES.down + PHASES.song) {
    const sung = u - PHASES.down;
    return { curtain: 1, set: sung >= 0.2 ? after : before, song: sung / PHASES.song, landed: sung, phase: 'song', settled: false };
  }
  const p = (u - PHASES.down - PHASES.song) / PHASES.up;
  return { curtain: 1 - ease.inOutCubic(p), set: after, song: -1, landed: -1, phase: 'curtain-rise', settled: false };
}

/**
 * The next mark inside a hero act, for a click while it plays: seconds from the
 * act's start, or null once the act is over and the stage is at rest.
 */
export function heroNext(u) {
  const marks = [PHASES.down, PHASES.down + PHASES.song, HERO_ACT];
  return marks.find(m => m > u + 0.05) ?? null;
}

/**
 * Start of the next phase after time t, for clicking or tapping to skip ahead.
 */
export function nextPhase(t) {
  const base = Math.floor(t / ACT_DURATION) * ACT_DURATION;
  const u = t - base;
  const marks = [
    PHASES.scene,
    PHASES.scene + PHASES.down,
    PHASES.scene + PHASES.down + PHASES.song,
    ACT_DURATION,
  ];
  const next = marks.find(m => m > u + 0.05) ?? ACT_DURATION;
  return base + next;
}

/**
 * The pure model function for Kantar.
 *
 * @param {object} options
 * @param {number} [options.time=0] - Elapsed animation time in seconds
 * @param {number|string} [options.seed=1] - Deterministic random seed
 * @param {'quiet'|'warm'|'playful'} [options.register='warm'] - Interaction register
 * @param {object} [options.params={}] - User-provided parameters (progress, set, spot)
 * @param {number} [options.W=1200] - Canvas logical width
 * @param {number} [options.H=800] - Canvas logical height
 * @returns {object} The complete stage state for rendering
 */
export function model({
  time = 0,
  seed = 1,
  register = 'warm',
  params = {},
  W: width = W,
  H: height = H,
} = {}) {
  const hasProgress = params.progress !== null && params.progress !== undefined;
  const hasSet = params.set !== null && params.set !== undefined;
  const hasSpot = params.spot !== null && params.spot !== undefined;

  let curtain = 0;
  let set = 0;
  let spot = 0;
  let song = -1;
  let songIndex = 0;
  let landed = -1;
  let phaseName = 'scene';
  let settled = false;
  let flicker = 0;
  let breathe = 0;

  if (register === 'quiet') {
    // Quiet: curtain up, set lit and still, settled: true
    curtain = 0;
    set = 0;
    spot = 0;
    song = -1;
    landed = -1;
    phaseName = 'quiet-still';
    settled = true;
    flicker = 0;
    breathe = 0;
  } else if (register === 'warm') {
    // Warm: on load curtain rises once (under 2s), stage settles and breathes with subtle footlight flicker, settled: true after rise
    if (time < RISE_TIME) {
      const riseProgress = phase(time, 0, RISE_TIME);
      curtain = 1 - ease.inOutCubic(riseProgress);
      phaseName = 'curtain-rise';
      settled = false;
      flicker = 0.04 * Math.sin(time * 5.0);
      breathe = 0.4 * Math.sin(time * 2.0);
    } else {
      curtain = 0;
      phaseName = 'settled';
      settled = true;
      flicker = 0;
      breathe = 0;
    }
    set = 0;
    spot = 0;
    song = -1;
    landed = -1;
  } else {
    // Playful: interactive clicking/toggling phases (scene, curtain drop, kantar song, curtain rise).
    // With hero, only when asked: heroAt rises once and rests between clicks.
    const show = params.hero ? heroAt(time, params.cue ?? null, params.acts ?? 0) : showAt(time);
    curtain = show.curtain;
    set = show.set;
    song = show.song;
    songIndex = params.hero ? 0 : show.i % TOTAL_SETS;
    landed = show.landed;
    phaseName = show.phase;
    settled = !!show.settled;

    // Spotlight is active during the kantar song
    if (song >= 0) {
      spot = smoothstep(0, 0.08, song) * (1 - smoothstep(0.9, 1.0, song));
    } else {
      spot = 0;
    }

    flicker = settled ? 0 : 0.12 * Math.sin(time * 6.0 + 1.2);
    breathe = settled ? 0 : 0.8 * Math.sin(time * 1.6);
  }

  // Explicit parameters override timeline values
  if (hasProgress) {
    curtain = clamp(params.progress, 0, 1);
  }
  if (hasSet) {
    set = Math.floor(clamp(params.set, 0, TOTAL_SETS - 1));
  }
  if (hasSpot) {
    spot = clamp(params.spot, 0, 1);
  }

  // Calculate hem ripple wave amplitude for the curtain
  const rippleAmp = landed >= 0
    ? 7.0 * Math.exp(-landed * 2.2)
    : 2.4 * curtain * (1.0 - curtain) * 4.0;

  const currentSongText = register === 'playful' && params.hero ? HERO_LINE : SONGS[songIndex % SONGS.length];
  const currentScene = SCENES[set % SCENES.length];

  // The performance of the singer, the pit and the house, all on one beat.
  const performance = performanceAt({
    song,
    landed,
    time,
    spot,
    curtain,
    quiet: register === 'quiet',
  });

  return {
    time,
    seed,
    register,
    W: width,
    H: height,
    curtain,
    set,
    sceneTitle: currentScene.title,
    sceneId: currentScene.id,
    spot,
    song,
    songIndex,
    songText: currentSongText,
    landed,
    rippleAmp,
    phase: phaseName,
    settled,
    flicker,
    breathe,
    performance,
    singer: spot > 0.01,
    params: {
      progress: hasProgress ? clamp(params.progress, 0, 1) : null,
      set: hasSet ? Math.floor(clamp(params.set, 0, TOTAL_SETS - 1)) : null,
      spot: hasSpot ? clamp(params.spot, 0, 1) : null,
    },
  };
}
