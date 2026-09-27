# 0018: recorded samples for complex natural sounds

*26 September 2026. Sutradhar, at the owner's direction, after listening to the soundbook's "sev puri by the bay" round 2: the synthesised crows read as "a little gull-like, a little tinny". The owner: "we can just download a small set of crow sounds (and wherever complicated natural sounds like this are present)… so that iteration loops aren't spent on this."*

## Context

The charter says UI sound is synthesised with Web Audio (no files), and soundscapes are procedural and seeded. That holds up well for rain, surf, wind, crickets, bells and plucked strings. Some calls don't: crows, starlings and other complex animal voices. Synthesis rounds spent chasing them cost more than they return.

## Decision

1. **UI sound stays synthesised.** Tick, confirm, complete and gentle-error, and every musical figure: no files.
2. **Soundscapes may use recorded samples for complex natural voices** (birds, animals, and other sounds synthesis can't carry convincingly), mixed with the procedural bed. **Placement, timing, level, pan and variation stay seeded and procedural.** The recording supplies only the timbre.
3. **Licences:** only **CC0 or public domain**, or **CC BY** with attribution. Never NC (the library serves clients) and never ND (we trim and process). A licence counts only as read on the source page for that exact file, never assumed for a site as a whole.
4. **Provenance:** every sample has an entry in a `samples.json` beside it: source URL, author, licence and licence URL, date retrieved, original file hash, and what we did to it (trim, fade, normalise, resample, encode). CC BY credits appear in the docs and in a story's end card.
5. **Format and budget:** mono Opus in WebM or Ogg (with an AAC fallback if a target browser needs it), short (a few seconds per call), and lazily fetched, only when the sound switch is on. A piece declares its sample bytes in its budget. Folio documents embed their samples (no network).
6. **Consent and privacy are unchanged:** nothing plays or loads before the switch, and there is no hotlinking. Samples are served from the same origin or embedded.
7. **Honesty:** a piece's docs say which voices are recorded and which are synthesised.

## Consequences

- The soundbook adds a sample bank. Crows in `sevpuri-bay` come first; other candidates (the starlings in `saanj-dusk`, frogs) go in only with a before-and-after listen from the owner.
- The charter's Sound and AV section gets a line pointing here at the next charter edit.
