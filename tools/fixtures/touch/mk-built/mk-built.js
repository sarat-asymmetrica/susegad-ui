import { SgElement, defineComponent } from '../../../../packages/core/component.js';
class Fx extends SgElement { static native = 'button'; }
defineComponent('sg-fx-mk-built', Fx);
const mk = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
const host = document.querySelector('sg-fx-mk-built');
host.append(mk('button', 'Built by a helper'));
