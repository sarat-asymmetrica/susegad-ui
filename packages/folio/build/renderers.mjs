// Folio build: the directives whose markup is written at build time by their
// own pure cores. Each is used only if its module is in the project; otherwise
// the Markdown renderer's plain version stands.

import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const flag = v => v === true || v === 'true';

async function load(root, rel) {
  const file = join(root, rel);
  if (!existsSync(file)) return null;
  try { return await import(pathToFileURL(file).href); } catch { return null; }
}

/** @returns {Promise<{ renderers: object, used: string[] }>} */
export async function renderersFor(root, inline) {
  const renderers = {}, used = [];
  const diagram = await load(root, 'packages/folio/diagram/render.js');
  if (diagram?.renderDiagram) {
    renderers.diagram = ({ source, attrs, title, id }) => diagram.renderDiagram(source, { id, title, steps: flag(attrs.steps), register: attrs.register, direction: attrs.direction });
    used.push('diagram (packages/folio/diagram/render.js)');
  }
  const price = await load(root, 'packages/recipes/proposal/price-table.core.js');
  if (price?.modelFor && price?.tableHTML) {
    renderers['price-table'] = attrs => price.tableHTML(price.modelFor(attrs));
    used.push('price-table (packages/recipes/proposal/price-table.core.js)');
  }
  const timeline = await load(root, 'packages/recipes/proposal/timeline.core.js');
  if (timeline?.readSteps && timeline?.timelineHTML) {
    renderers.timeline = ({ lines, title }) => {
      const r = timeline.readSteps(lines);
      return { html: timeline.timelineHTML(r.steps, { title, inline }), problems: r.problems };
    };
    used.push('timeline (packages/recipes/proposal/timeline.core.js)');
  }
  return { renderers, used };
}
