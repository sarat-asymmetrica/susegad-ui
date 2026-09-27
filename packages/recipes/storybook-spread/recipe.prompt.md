# Storybook spread

*Text beside a scene, bilingual, narrated, the current word marked as it plays.*

## The prompt

Build one spread of a children's storybook: a scene the story lives inside (`<sg-scene name="paus">`, the register warm), the story's text in two languages with a switch between them, and each language's own narration, played from a plain `<audio controls>` with a native `<track kind="captions">` so captions and playback both work without any JavaScript, wrapped in a polished player once JavaScript runs. Wrap the visible text's words in spans once the page mounts, so a highlight driver has something to mark without the static markup ever looking like anything but plain paragraphs. Wire the narration's per-phrase event to the scene's params, using the same beat order the story script already gives both languages, so the window's rain answers what the words just said regardless of which language is playing, and never drifts out of sync when a reader pauses or replays. When a played-back media element and a separate word-highlight driver can both draw captions from the same track, pick one as the page's real captions and say why, rather than showing the same sentence twice with nothing between them. Say plainly, in both languages, that a screen without JavaScript still holds the whole story in words. Where no audio can be reached, fall back to the browser's own voice or, failing that, the text and captions already on the page.

## Words to code

| When you say | Technique | What happens |
|---|---|---|
| a highlight driver has something to mark without the static markup ever looking like anything but plain paragraphs | progressive enhancement | `wrapWords(el)` runs at mount time, splitting each paragraph's text nodes into `[data-word]` spans while leaving the HTML source as plain sentences. |
| each language's own narration, played from a plain `<audio controls>` … wrapped in a polished player once JavaScript runs | progressive enhancement, not a replacement | `<sg-player>` wraps the native `<audio>`; without JavaScript the browser's own controls and captions are the whole experience; with it, a drawn bar takes over, the native element still underneath. |
| the window's rain answers what the words just said … never drifts out of sync | beat-driven, not clock-driven | `sg-narration` fires `sg-phrase` with the phrase's index; `mountStorybookSpread` looks that index up in `story/spread.json`'s `scene_cues.cues` and calls `scene.set(cue.params)` — driven by which words are playing, never by elapsed time. |
| regardless of which language is playing | one cue list, one beat order | Both languages' phrase arrays share the same beat order and count, so one `cues` array, indexed by position, drives the scene under either. |
| pick one as the page's real captions and say why | one source of truth | `<sg-player>`'s own caption line and `<sg-narration>`'s word-highlighted paragraph both read the same `<track>`; `recipe.css` hides `.sg-player__captions` (the paragraph is always-visible page content, not an optional overlay, and the box is built for a video frame this audio player doesn't have) and says why in a comment at the top of `recipe.js`. |
| fall back to the browser's own voice … the text and captions already on the page | graceful degradation | An `<audio>` `error` event calls `speakFallback()` from `packages/narration`; if that itself can't run, the paragraphs and native captions are already there. |

## Accessibility

- Every state the scene or the highlight shows is also plain text: the story paragraphs, always visible; the captions, always present; the language names, spoken as words on the switch buttons.
- The language switch is `<button aria-pressed>`, not a custom widget, so it needs no extra ARIA wiring.
- Nothing autoplays. The player's own play press is the consent (decision 0015); it is the same press whether `<sg-player>` has enhanced the control or not.

## Credit

The story itself — "The first rain" — and its Marathi retelling are Kathakar's, in `story/spread.md` and `story/spread.json`, with open questions for a native speaker and for the owner flagged there. This recipe is the scaffolding around it, not the words.
