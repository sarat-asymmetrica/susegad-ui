// The /postcard page: pure. Every string comes from words-postcard.md (Kathakar's file, docs/runs/postcard/); the numbers
// (how many scenes, how many Goan) are read from the registry and the event's words from its config, never typed here.
// The maker itself is packages/recipes/picture-postcard; this is the page around it, and postcard-page.js wires them.

import { esc, posterImg } from './site.core.js';

/** Static words of the page. The maker's own status lines live with the recipe (picture-postcard/words.js). */
export const POSTCARD = {
  title: 'Your postcard of Goa',
  description: 'Make a free postcard of Goa with your name on it, stamped {stamp}. It is drawn in your browser, so your name stays on your device.',
  intro: 'Type your name, choose a scene, and keep the card or send it to someone.',
  noscript: 'Postcards are drawn in your browser, so this page needs JavaScript. Please switch it on and come back.',
  name: {
    label: 'Your name',
    placeholder: 'Asha Naik',
    hint: 'Any name, in any script, up to {max} letters. The card changes as you type.',
  },
  scene: { legend: 'Choose a scene', another: 'Another scene', anotherName: 'Show another scene' },
  buttons: { savePicture: 'Save picture', saveGif: 'Save GIF', sharePicture: 'Share picture', shareGif: 'Share GIF', cancel: 'Cancel', cancelName: 'Cancel making the GIF', progress: 'Making the GIF' },
  privacy: {
    line: 'Your name stays on your device. The card is made right here in your browser, and nothing is sent or stored anywhere else.',
    share: 'Once you share a card, the people you send it to can see the name on it.',
  },
  own: { lead: 'Know someone who would like one? They can make theirs at', url: 'susegad.asymmetrica.ai/postcard' },
  about: { line: 'Made with Susegad UI, an open-source Goan design library with {sceneTotal} scenes drawn in code, {sceneGoa} of them from Goa.', link: 'See all the scenes' },
};

const fill = (s, vars) => s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));

/** How many scenes the library has and how many are Goan, read from the registry's items. */
export function sceneCounts(items) {
  const scenes = items.filter(i => i.type === 'scene');
  return { total: scenes.length, goan: scenes.filter(i => i.motif?.origin === 'goa').length };
}

export const postcardDescription = event => fill(POSTCARD.description, { stamp: event.stamp });

/**
 * The page's main content.
 * @param {{ scenes: { name: string, label: string }[], posters: Record<string, {w: number, h: number}>, counts: { total: number, goan: number }, nameMax: number, defaultScene: string }} o
 */
export function postcardMain({ scenes, posters, counts, nameMax, defaultScene }) {
  const t = POSTCARD;
  const thumb = s => {
    const poster = posters[`scene-${s.name}`];
    return `<label class="pc-thumb">
            <input type="radio" name="scene-pick" value="${esc(s.name)}"${s.name === defaultScene ? ' checked' : ''}>
            <span class="pc-thumb-pic" aria-hidden="true">${poster ? posterImg(`scene-${s.name}`, poster, 0, { eager: true }) : ''}</span>
            <span class="pc-thumb-name">${esc(s.label)}</span>
          </label>`;
  };
  return `    <section class="pc" aria-labelledby="pc-title">
      <div class="s-head">
        <h1 id="pc-title" class="s-title">${esc(t.title)}</h1>
        <p class="lede">${esc(t.intro)}</p>
      </div>
      <noscript><p class="pc-note pc-nojs">${esc(t.noscript)}</p></noscript>
      <form id="maker" class="pc-maker" novalidate>
        <div class="pc-name">
          <label for="name">${esc(t.name.label)}</label>
          <input id="name" name="name" type="text" placeholder="${esc(t.name.placeholder)}" maxlength="${nameMax}" autocomplete="name" autocapitalize="words" spellcheck="false" enterkeyhint="done" aria-describedby="name-hint">
          <p id="name-hint" class="pc-hint">${esc(fill(t.name.hint, { max: nameMax }))}</p>
        </div>
        <figure class="pc-preview">
          <canvas id="card" width="1800" height="1200" role="img" aria-label="${esc(t.title)}"></canvas>
          <img id="gif-preview" alt="" hidden width="900" height="600">
        </figure>
        <fieldset class="pc-scenes" data-scene-picker>
          <legend>${esc(t.scene.legend)}</legend>
          <input type="hidden" id="scene" name="scene" value="${esc(defaultScene)}">
          <div class="pc-thumbs">
          ${scenes.map(thumb).join('\n          ')}
          <button type="button" id="another-scene" class="pc-another" aria-label="${esc(t.scene.anotherName)}">${esc(t.scene.another)}</button>
          </div>
        </fieldset>
        <div class="pc-acts">
          <button type="button" id="save-png" class="pc-btn pc-btn-main">${esc(t.buttons.savePicture)}</button>
          <button type="button" id="save-gif" class="pc-btn pc-btn-main" aria-describedby="gif-note">${esc(t.buttons.saveGif)}</button>
          <button type="button" id="share-png" class="pc-btn">${esc(t.buttons.sharePicture)}</button>
          <button type="button" id="share-gif" class="pc-btn" aria-describedby="gif-note">${esc(t.buttons.shareGif)}</button>
        </div>
        <div class="pc-progress"><progress id="progress" max="1" value="0" aria-label="${esc(t.buttons.progress)}"></progress><button type="button" id="cancel" class="pc-btn" aria-label="${esc(t.buttons.cancelName)}">${esc(t.buttons.cancel)}</button></div>
        <p id="gif-note" class="pc-note" hidden></p>
        <p id="motion-note" class="pc-note" hidden></p>
        <p id="status" class="pc-status" role="status"></p>
        <div id="hold" class="pc-hold">
          <p id="hold-line" class="pc-note" role="status"></p>
          <img id="hold-img" class="pc-hold-img" alt="" hidden width="900" height="600" aria-describedby="hold-line">
        </div>
      </form>
      <div class="pc-after">
        <p class="pc-privacy">${esc(t.privacy.line)}</p>
        <p class="pc-note">${esc(t.privacy.share)}</p>
        <p class="pc-own">${esc(t.own.lead)} <a href="postcard">${esc(t.own.url)}</a></p>
        <p class="pc-about">${esc(fill(t.about.line, { sceneTotal: counts.total, sceneGoa: counts.goan }))} <a href="scenes">${esc(t.about.link)}</a></p>
      </div>
    </section>`;
}
