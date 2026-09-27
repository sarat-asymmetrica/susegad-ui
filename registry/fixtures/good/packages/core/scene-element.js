import { whenScene } from './define-scene.js';

class SgScene extends HTMLElement {
  async connectedCallback() {
    const def = await whenScene(this.getAttribute('name'));
    const canvas = document.createElement('canvas');
    canvas.width = 320;
    canvas.height = 200;
    canvas.setAttribute('role', 'img');
    canvas.setAttribute('aria-label', def.caption);
    this.append(canvas);
    def.draw(canvas.getContext('2d'), def.model({ seed: Number(this.getAttribute('seed') ?? 1) }));
    this.dispatchEvent(new CustomEvent('sg-ready', { bubbles: true }));
  }
}

if (!customElements.get('sg-scene')) customElements.define('sg-scene', SgScene);
