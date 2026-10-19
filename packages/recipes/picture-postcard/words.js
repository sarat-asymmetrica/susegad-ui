// The words the maker says while it works. Written by Kathakar; `{braces}` are filled by `fill`. A page can pass
// its own `words` to `mountPostcard`. The labels and notes in a page's markup are the page's own.

export const WORDS = Object.freeze({
  // the card, while the name field is empty
  emptyCard: 'Your name',
  // a nudge, never an error: said when Save or Share is pressed with no name
  emptyTry: 'Type your name first, then save your postcard.',
  nameCut: 'Long names are shortened to {max} letters.',
  sceneChanged: 'Scene: {scene}',

  // making the GIF
  gifStart: 'Making your GIF. It can take a little while on a phone.',
  gifDrawing: 'Drawing the frames: {percent}%',
  gifEncoding: 'Putting the frames together: {percent}%',
  gifCancelled: 'Cancelled. Nothing was saved.',
  gifFailed: 'The GIF could not be made on this device. Your picture can still be saved.',
  gifLarge: 'This GIF is large ({size}), and some chat apps may not take it. You can still save it, or save the picture, which is smaller.',
  gifStill: 'This scene is a still picture, so it saves as a picture only. Choose another scene to make a GIF.',
  reducedMotion: 'Your device is set to reduce motion, so a GIF will be saved but not played on this page.',

  // saving and sharing
  saved: 'Saved {filename}.',
  savedGif: 'Saved {filename} ({size}).',
  savedWhere: 'It should be in your downloads or your Files app.',
  shared: 'Shared {filename}.',
  sharedGif: 'Shared {filename} ({size}).',
  shareCancelled: 'Sharing cancelled.',
  shareFallback: 'This browser cannot share files, so the card was saved to your device instead.',
  pngFailed: 'The picture could not be saved just now. Please try again.',
  shareTitle: 'Postcard for {name}',
  shareText: 'A postcard of Goa for {name}. Make yours: https://{url}',

  // after a save, for in-app browsers where nothing downloads

  // when something goes wrong
  errFonts: 'The lettering is slow to load, so your card is using a plain face for now. It will switch when the fonts arrive.',
  errScene: 'That scene did not load. Please choose another, or try again.',
  errDraw: 'The card could not be drawn just now. Please try again.',
});

/** A template with `{name}` holes filled from `vars`. */
export const fill = (template, vars = {}) => String(template).replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
