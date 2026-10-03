// <sg-tile-band>: a band of hand-painted tiles for a border or a divider: Goan azulejo, the blue-and-white
// tiles of the Portuguese-era houses and churches, and its majolica cousin (cobalt, lemon and leaf green).
// Four motifs (a rosette, a quatrefoil, quarter-circle corners, a vine), geometric and floral only, laid from
// a seed. Painted once on a canvas and kept; there is no frame loop. It runs along the page or down it.
//
//   <sg-tile-band></sg-tile-band>                      a decoration: aria-hidden
//   <sg-tile-band><hr></sg-tile-band>                  a divider: the <hr> is the separator, and is the cobalt line without JavaScript
//   <sg-tile-band tones="majolica" seed="church"></sg-tile-band>
//   <sg-tile-band orientation="vertical" style="height: 20rem"></sg-tile-band>
//
// Attributes: tones (azulejo | majolica, default azulejo), seed, orientation (horizontal | vertical),
// register. Size: --sg-tile-size (default 4rem, 3.25rem on a phone) is the tile you would like; the band fits
// whole square tiles to its length and sets its own thickness to match.

import { SgElement, defineComponent } from '../../core/component.js';
import { TONES } from './tile-band.core.js';

export class SgTileBand extends SgElement {
  static native = 'hr';
  static observedAttributes = ['register', 'seed', 'tones', 'orientation'];
  static skins = {
    quiet: () => import('./skins/quiet.js'),
    warm: () => import('./skins/warm.js'),
    playful: () => import('./skins/playful.js'),
  };

  connected() {
    // with an <hr> in it the band is a divider and says so; without one it is only decoration
    if (!this.native) this.setAttribute('aria-hidden', 'true');
  }

  state() {
    const tones = this.getAttribute('tones');
    return {
      seed: this.getAttribute('seed') || 'azulejo',
      tones: TONES.includes(tones) ? tones : 'azulejo',
      vertical: this.getAttribute('orientation') === 'vertical',
      motion: this.motion,
      visible: this.visible,
    };
  }
}

defineComponent('sg-tile-band', SgTileBand);
