// Susegad UI core: the register, the scene contract and <sg-scene>.
// Importing this in a browser defines the element; in Node it is inert.

export * from './register.js';
export * from './define-scene.js';
export { readColors } from './colors.js';
export { SgScene } from './scene-element.js';
import { SgScene } from './scene-element.js';

if (globalThis.customElements && !customElements.get('sg-scene')) customElements.define('sg-scene', SgScene);
