# Fonts

Self-hosted web fonts for Susegad UI. `../fonts.css` declares them; link it beside `tokens.css`. Nothing is fetched from a third party at run time.

Every family is licensed under the SIL Open Font License 1.1; each folder holds its `OFL.txt`. The files were built by `tools/build-fonts.py` from the google/fonts repository at commit
[`b5efa9c`](https://github.com/google/fonts/tree/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl), split by script with every OpenType layout feature kept and hinting removed.

| Family | Version | Source | Designer |
|---|---|---|---|
| Mukta | Version 2.538 | [Mukta-Regular.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/mukta/Mukta-Regular.ttf), [Mukta-Medium.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/mukta/Mukta-Medium.ttf), [Mukta-SemiBold.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/mukta/Mukta-SemiBold.ttf) | Ek Type |
| Kalam | Version 2.001 | [Kalam-Light.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/kalam/Kalam-Light.ttf), [Kalam-Regular.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/kalam/Kalam-Regular.ttf) | Indian Type Foundry |
| Castoro | Version 3.000 | [Castoro[wght].ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/castoro/Castoro%5Bwght%5D.ttf), [Castoro-Italic[wght].ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/castoro/Castoro-Italic%5Bwght%5D.ttf) | Tiro Typeworks |
| Tiro Devanagari Marathi | Version 1.52 | [TiroDevanagariMarathi-Regular.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/tirodevanagarimarathi/TiroDevanagariMarathi-Regular.ttf) | Tiro Typeworks, John Hudson, Fiona Ross |
| Tiro Kannada | Version 1.52 | [TiroKannada-Regular.ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/tirokannada/TiroKannada-Regular.ttf) | Tiro Typeworks, John Hudson, Fiona Ross |
| Noto Sans Kannada | Version 2.006 | [NotoSansKannada[wdth,wght].ttf](https://github.com/google/fonts/blob/b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04/ofl/notosanskannada/NotoSansKannada%5Bwdth%2Cwght%5D.ttf) | Google, the Noto project |

## Files

| File | Weight | Style | Script | Size |
|---|---|---|---|---|
| `fonts/mukta/mukta-400-latin.woff2` | 400 | normal | latin | 20.9 KB |
| `fonts/mukta/mukta-400-devanagari.woff2` | 400 | normal | devanagari | 59.6 KB |
| `fonts/mukta/mukta-500-latin.woff2` | 500 | normal | latin | 21.6 KB |
| `fonts/mukta/mukta-500-devanagari.woff2` | 500 | normal | devanagari | 65.9 KB |
| `fonts/mukta/mukta-600-latin.woff2` | 600 | normal | latin | 21.2 KB |
| `fonts/mukta/mukta-600-devanagari.woff2` | 600 | normal | devanagari | 64.1 KB |
| `fonts/kalam/kalam-300-latin.woff2` | 300 | normal | latin | 16.3 KB |
| `fonts/kalam/kalam-300-devanagari.woff2` | 300 | normal | devanagari | 46.4 KB |
| `fonts/kalam/kalam-400-latin.woff2` | 400 | normal | latin | 17.8 KB |
| `fonts/kalam/kalam-400-devanagari.woff2` | 400 | normal | devanagari | 51.7 KB |
| `fonts/castoro/castoro-400-700-latin.woff2` | 400 700 | normal | latin | 48.1 KB |
| `fonts/castoro/castoro-400-700-italic-latin.woff2` | 400 700 | italic | latin | 49.6 KB |
| `fonts/tirodevanagarimarathi/tiro-devanagari-marathi-400-devanagari.woff2` | 400 | normal | devanagari | 58.4 KB |
| `fonts/tirokannada/tiro-kannada-400-kannada.woff2` | 400 | normal | kannada | 45.1 KB |
| `fonts/notosanskannada/noto-sans-kannada-400-600-kannada.woff2` | 400 600 | normal | kannada | 45.8 KB |

15 files, 632 KB in all. A page downloads only the faces and scripts it uses; the Folio builder subsets further (Wave 3).

## Fallbacks

While a web face loads, and wherever it cannot, a local face stands in, stretched to match its metrics:

| Stands in for | Local face | size-adjust | ascent | descent | line gap |
|---|---|---|---|---|---|
| Castoro | Georgia | 101.26% | 74.56% | 24.20% | 32.59% |
| Mukta | Arial, ArialMT, Liberation Sans | 95.36% | 118.50% | 55.79% | 0.00% |
| Kalam | Segoe Print | 83.99% | 126.56% | 63.22% | 0.00% |

Measured against the Windows files. Devanagari and Kannada fall back to the system Indic faces in the token stacks without metric overrides.
