import { defineScene } from '../../core/index.js';
import { disc } from '../../engine/index.js';
import { model } from './model.js';

export default defineScene({
  name: 'dot',
  caption: 'A red dot on warm paper',
  model,
  draw(ctx, { x, y, r }) {
    ctx.fillStyle = '#f6efe2';
    ctx.fillRect(0, 0, 320, 200);
    disc(ctx, x, y, r, '#b3261e');
  },
});
