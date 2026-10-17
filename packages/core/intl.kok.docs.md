# Konkani dates and hours

Days, months and the hours of the day in Konkani, in Devanagari and in Romi, the same in every browser. Import from `susegad/core/intl.kok.js`. It sits beside `intl.core.js`: the zone is Asia/Kolkata unless you say otherwise, and nothing reads the clock.

```js
import { formatKonkani, konkaniClock } from 'susegad/core/intl.kok.js';

formatKonkani(at, { locale: 'gom-Deva' })               // शेनवार 21 नोव्हेंबर
formatKonkani(at, { locale: 'gom-Deva', time: true })   // शेनवार 21 नोव्हेंबर, सांजे 7:00
formatKonkani(at, { locale: 'gom-Latn', time: true })   // Sonvar 21 Novembr, sanje 7:00
formatKonkani(at, { locale: 'gom-Latn', weekday: false, year: true })  // 21 Novembr 2026
konkaniClock(at, { locale: 'gom-Deva' })                // सांजे 7:00
```

Every call takes `gom` or `kok`, with or without a script. A bare tag is Devanagari. Another language gives an empty string.

## Why a table

What `Intl` knows about Konkani depends on the engine. Probed on 8 October 2026:

| Engine | `kok`, `gom`, `kok-Deva` | `gom-Latn`, `kok-Latn` |
|---|---|---|
| Node, full ICU | Devanagari words | Romi words |
| Firefox 155 | fine | fine |
| Chromium 153 | `kok` with the root pattern: the month reads "M10" | fine |
| WebKit 26.6 | `kok` and `kok-Deva` fine; `gom` falls back to en-GB | `kok-Latn` fine; `gom-Latn` falls back to en-GB |

So the tag is mapped `gom` to `kok` with its script kept, and the engine's answer is probed with `formatToParts`: does it resolve to Konkani, and are the weekday and the month each one word in the script asked for, not English and not a root pattern? When the probe passes, the engine's words are used. When it fails, the words come from the table in the file, which holds ICU's forms, so the same day reads the same in every engine. `probeKonkani(tag)` says which, and why not.

## What is always the table's

- **The parts of the day.** The 12-hour clock is written with a word in place of AM and PM, because "PM" in Latin letters reads badly on a Devanagari page: सकाळीं (4:00 to 11:59), दनपारां (12:00 to 15:59), सांजे (16:00 to 19:59), राती (20:00 to 3:59). In Romi: sokallim, donparam, sanje, rati.
- **Digits** stay western.
- **No ending on a date.** Konkani would say 21 नोव्हेंबराक for "on 21 November"; a table cannot carry the ending, so the date stands plain and the sentence around it does the work.
- **No year** unless `year: true`.

## Options

| Option | Default | |
|---|---|---|
| `locale` | `kok-Deva` | any `gom` or `kok` tag |
| `zone` | `Asia/Kolkata` | an IANA zone |
| `weekday` | `true` | `false` drops the day name |
| `year` | `false` | adds the year |
| `time` | `false` | adds the part of the day and the clock |
| `make` | `Intl.DateTimeFormat` | swap the formatter; tests use it to fake an engine |

## Words, and who has read them

The days, months and parts of the day are ICU's, read from Node on 8 October 2026, except the parts of the day, which are the writer's reading of ICU's four bands. They are a draft for a native reader (the questions are in the event template's `KONKANI-FOR-READER.md`). Where a Goan reader says a word is wrong, change it in `TABLE` in the file. Engines that have their own Konkani words are asked first, so a word changed here will still show the engine's version in those engines, and the two can then disagree. The first day this would show is शेनवार against the older शनिवार.

## Tests

`node --test packages/core/intl.kok.test.js` fakes the engine: the good path (its words are used, under the `kok` tag with the script kept), Chromium's root pattern, WebKit's en-GB fallback, a throwing engine, and the IST day for an instant that is another day in Tokyo. Where the machine's own ICU knows Konkani, one test also shows it agrees with the table word for word.
