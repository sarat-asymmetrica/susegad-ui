// Prahar: what the scene is called, what it shows, and how to ask for it.
// The prompt and map here are the same text as in prahar.prompt.md (prompts.test.js checks).
import { W, H, STILL_TIME } from './model.js';

export const meta = {
  id: 'prahar',
  title: 'Raga hours',
  word: 'Prahar',
  gloss: 'a watch of about three hours; in Hindustani music each raga belongs to one of the eight watches of the day and night',
  alt: 'A day over a village on a Goan river: blue ridges of the Ghats, the river, paddy, palms, a chapel, a shrine and a house, lit for one hour of the day, with a ruler of the eight watches along the bottom.',
  caption:
    'A day over a village on a Goan river: the Ghats, the paddy, a chapel, a shrine and a line of palms. Each watch of the day is named for a raga sung at that hour, from Lalit before dawn to Malkauns at midnight, and the light shifts from one to the next. This mapping of ragas to hours is one common reckoning; traditions differ. In playful, drag along the ruler to move through the day. Set the hour from your own clock and it becomes a theme that warms and cools with the viewer’s day.',
  after: {
    who: 'the time theory of Hindustani music, and the Goan singers who carried it: Kesarbai Kerkar, Mogubai Kurdikar, Kishori Amonkar',
    took: 'the idea that a colour, like a raga, belongs to an hour',
    left: 'the music itself; the ragas here are named, never imitated',
  },
  keys: 'Left and right arrow keys move the day along the ruler.',
  W, H, seed: 1, stillTime: STILL_TIME,
  tier: 'shared practice',
  credit: 'The eight watches and their ragas follow one common reckoning of Hindustani time theory; other traditions place some ragas differently. The raga names are given in English and Devanagari.',
  techniques: ['colour', 'texture', 'interaction', 'easing', 'state', 'calm'],
  prompt:
    'Draw one day over a village on a Goan river in plain JavaScript on a canvas: blue ridges of the Western Ghats, a wide river that mirrors the sky, paddy plots with bunds, palms, a whitewashed chapel, a small shrine with a tulsi planter, and a house with windows. Keep the sky as keyframes for about a dozen hours of the day, each a zenith and a horizon colour, and blend between them in OKLab so dawn goes through rose and apricot rather than grey. Paint every land layer once as a mask and tint it each frame from its own day and night colours, warmed near sunrise and sunset, so the whole scene follows the light. Move the sun and moon on arcs, light the windows after dusk, and bring out stars at night. Along the bottom, draw a ruler of the eight prahars, each labelled with its raga in English and Devanagari, with a brass bead at the current hour; dragging along it scrubs the day. Give it an hour attribute: when the page sets it from its own clock, the light holds at that hour and the watch is said in words. Give it three registers: quiet is one finished hour, warm turns the day slowly, and playful turns it at full speed with the ruler under your hand and the arrow keys.',
  map: [
    ['blend between them in OKLab', 'colour', 'OKLab is built so that equal steps look equal. Blending dawn keyframes there keeps the rose and apricot instead of sliding through grey as plain RGB does.'],
    ['Paint every land layer once as a mask and tint it each frame', 'texture', 'Each layer’s shapes and hatching are painted once in black. They are recoloured with source-in compositing into two group canvases, which are repainted only when a colour has moved more than 2 of 255; most frames are one blit per group. The sketchbook measured about 18 ms a frame this way, down from 45.'],
    ['warmed near sunrise and sunset', 'colour', 'A warmth value peaks at dawn and dusk and pulls every layer toward apricot by a little, which is what makes the golden hours read as golden.'],
    ['dragging along it scrubs the day', 'interaction', 'While you drag, the pointer’s position on the ruler is the hour. When you let go, the scene’s clock is moved to that hour and the day carries on from there. Each arrow key moves it by the hand’s step along the ruler, about 48 minutes.'],
    ['Move the sun and moon on arcs', 'easing', 'The sun’s height is a sine of the hour between sunrise and sunset, so it climbs quickly, lingers at noon and drops quickly again.'],
    ['the light holds at that hour and the watch is said in words', 'state', 'With hour set, time stands still and the scene rests until the attribute changes. The status says the watch, its raga and the time, such as "Evening, Yaman, 19:10".'],
  ],
};
