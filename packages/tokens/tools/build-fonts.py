#!/usr/bin/env python3
"""Build the self-hosted fonts for Susegad UI tokens.

    python packages/tokens/tools/build-fonts.py [--src <cache dir>]

Downloads each family from the google/fonts repository at a pinned commit,
splits it by script (Latin, Devanagari, Kannada) with every OpenType layout
feature kept (Indic shaping depends on them), writes WOFF2 into
packages/tokens/fonts/<family>/, copies each OFL.txt, and writes
packages/tokens/fonts.css and packages/tokens/fonts/README.md.

A dev tool, run once when the fonts change; the output is committed. Needs
fontTools and brotli (pip install fonttools brotli). The metric-matched
fallbacks are measured against the real Georgia, Arial and Segoe Print when
they are installed (Windows); otherwise the last measured values are kept.
"""

import argparse
import json
import os
import shutil
import sys
import tempfile
import urllib.request
from pathlib import Path

from fontTools.ttLib import TTFont
from fontTools import subset
from fontTools.varLib import instancer

COMMIT = 'b5efa9c32e8f9b63005f5cdb1ad5527a77d2cd04'
RAW = f'https://raw.githubusercontent.com/google/fonts/{COMMIT}/ofl'

HERE = Path(__file__).resolve().parent
PKG = HERE.parent
OUT = PKG / 'fonts'

# Unicode ranges per script, after the ones Google Fonts serves.
RANGES = {
    # Latin with Latin Extended: Konkani in Romi, Portuguese house names, the rupee.
    'latin': 'U+0000-02FF, U+0304, U+0308, U+0329, U+1D00-1DBF, U+1E00-1EFF, U+2000-206F, U+20A0-20C0, U+2113, U+2122, U+2191, U+2193, U+2212, U+2215, U+2C60-2C7F, U+A720-A7FF, U+FEFF, U+FFFD',
    'devanagari': 'U+0900-097F, U+1CD0-1CF9, U+200C-200D, U+20A8, U+20B9, U+20F0, U+25CC, U+A830-A839, U+A8E0-A8FF, U+11B00-11B09',
    'kannada': 'U+0964-0965, U+0C80-0CFF, U+1CD0-1CFA, U+200C-200D, U+20B9, U+25CC, U+A830-A835',
}

# family, folder in google/fonts, css weight, css style, source file, scripts, variable-axis limits
FACES = [
    ('Mukta', 'mukta', '400', 'normal', 'Mukta-Regular.ttf', ['latin', 'devanagari'], None),
    ('Mukta', 'mukta', '500', 'normal', 'Mukta-Medium.ttf', ['latin', 'devanagari'], None),
    ('Mukta', 'mukta', '600', 'normal', 'Mukta-SemiBold.ttf', ['latin', 'devanagari'], None),
    ('Kalam', 'kalam', '300', 'normal', 'Kalam-Light.ttf', ['latin', 'devanagari'], None),
    ('Kalam', 'kalam', '400', 'normal', 'Kalam-Regular.ttf', ['latin', 'devanagari'], None),
    ('Castoro', 'castoro', '400 700', 'normal', 'Castoro[wght].ttf', ['latin'], None),
    ('Castoro', 'castoro', '400 700', 'italic', 'Castoro-Italic[wght].ttf', ['latin'], None),
    ('Tiro Devanagari Marathi', 'tirodevanagarimarathi', '400', 'normal', 'TiroDevanagariMarathi-Regular.ttf', ['devanagari'], None),
    ('Tiro Kannada', 'tirokannada', '400', 'normal', 'TiroKannada-Regular.ttf', ['kannada'], None),
    ('Noto Sans Kannada', 'notosanskannada', '400 600', 'normal', 'NotoSansKannada[wdth,wght].ttf', ['kannada'], {'wdth': 100, 'wght': (400, 600)}),
]

# Metric-matched fallbacks: a local face stretched to the web face's width and
# line metrics, so text does not jump when the web face arrives.
FALLBACKS = [
    # family, local names, local file (Windows), web source
    ('Castoro', ["Georgia"], 'georgia.ttf', 'castoro/Castoro[wght].ttf'),
    ('Mukta', ["Arial", "ArialMT", "Liberation Sans"], 'arial.ttf', 'mukta/Mukta-Regular.ttf'),
    ('Kalam', ["Segoe Print"], 'segoepr.ttf', 'kalam/Kalam-Regular.ttf'),
]
# Letter frequencies of English, for an average advance width that looks like running text.
FREQ = {'e': 12.7, 't': 9.1, 'a': 8.2, 'o': 7.5, 'i': 7.0, 'n': 6.7, 's': 6.3, 'h': 6.1, 'r': 6.0, 'd': 4.3, 'l': 4.0, 'c': 2.8,
        'u': 2.8, 'm': 2.4, 'w': 2.4, 'f': 2.2, 'g': 2.0, 'y': 2.0, 'p': 1.9, 'b': 1.5, 'v': 1.0, 'k': 0.8, 'j': 0.15, 'x': 0.15,
        'q': 0.1, 'z': 0.07, ' ': 18.0}


def slug(s):
    return s.lower().replace(' ', '-')


def fetch(folder, name, cache):
    dest = cache / folder / name
    if not dest.exists():
        dest.parent.mkdir(parents=True, exist_ok=True)
        url = f'{RAW}/{folder}/{urllib.parse.quote(name)}'
        with urllib.request.urlopen(url) as r, open(dest, 'wb') as f:
            shutil.copyfileobj(r, f)
    return dest


def version(path):
    return TTFont(path)['name'].getDebugName(5).split(';')[0]


def avg_width(font):
    cmap = font.getBestCmap()
    hmtx = font['hmtx']
    total = weight = 0
    for ch, w in FREQ.items():
        g = cmap.get(ord(ch))
        if g:
            total += hmtx[g][0] * w
            weight += w
    return total / weight / font['head'].unitsPerEm


def fallback_metrics(web_path, local_path):
    web = TTFont(web_path)
    loc = TTFont(local_path)
    size_adjust = avg_width(web) / avg_width(loc)
    upm = web['head'].unitsPerEm
    hhea = web['hhea']
    return {
        'size-adjust': f'{size_adjust * 100:.2f}%',
        'ascent-override': f'{hhea.ascent / upm / size_adjust * 100:.2f}%',
        'descent-override': f'{abs(hhea.descent) / upm / size_adjust * 100:.2f}%',
        'line-gap-override': f'{hhea.lineGap / upm / size_adjust * 100:.2f}%',
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--src', help='cache directory for downloaded sources')
    args = ap.parse_args()
    cache = Path(args.src) if args.src else Path(tempfile.gettempdir()) / 'susegad-fonts-src'
    cache.mkdir(parents=True, exist_ok=True)

    if OUT.exists():
        for p in OUT.glob('*/*.woff2'):
            p.unlink()
    OUT.mkdir(exist_ok=True)

    css = [
        '/* Susegad UI fonts, self-hosted. Generated by tools/build-fonts.py; do not edit by hand.',
        '   Every face is OFL; the licences and sources are in fonts/README.md.',
        '   Faces are split by script with unicode-range, so a page downloads only the scripts it shows.',
        '   No request leaves the site. */',
        '',
    ]
    rows = []
    sources = {}
    for family, folder, weight, style, fname, scripts, limits in FACES:
        src = fetch(folder, fname, cache)
        lic = fetch(folder, 'OFL.txt', cache)
        (OUT / folder).mkdir(exist_ok=True)
        shutil.copyfile(lic, OUT / folder / 'OFL.txt')
        sources[family] = {'folder': folder, 'version': version(src), 'files': sources.get(family, {}).get('files', []) + [fname]}
        for script in scripts:
            font = TTFont(src)
            if limits:
                # Save and reload the instance: subsetting a freshly instanced
                # font trips over its lazily loaded glyph table.
                import io
                buf = io.BytesIO()
                instancer.instantiateVariableFont(font, limits).save(buf)
                buf.seek(0)
                font = TTFont(buf)
            opts = subset.Options()
            opts.layout_features = ['*']
            opts.name_IDs = ['*']
            opts.name_languages = ['*']
            opts.notdef_outline = True
            opts.hinting = False
            opts.flavor = 'woff2'
            sub = subset.Subsetter(options=opts)
            sub.populate(unicodes=parse_ranges(RANGES[script]))
            sub.subset(font)
            w = weight.replace(' ', '-')
            out_name = f"{slug(family)}-{w}{'-italic' if style == 'italic' else ''}-{script}.woff2"
            out_path = OUT / folder / out_name
            font.flavor = 'woff2'
            font.save(out_path)
            size = out_path.stat().st_size
            rows.append((family, weight, style, script, f'fonts/{folder}/{out_name}', size))
            css += [
                f'/* {family} {weight} {style}, {script} */',
                '@font-face {',
                f"  font-family: '{family}';",
                f'  font-style: {style};',
                f'  font-weight: {weight};',
                '  font-display: swap;',
                f"  src: url('fonts/{folder}/{out_name}') format('woff2');",
                f'  unicode-range: {RANGES[script]};',
                '}',
            ]

    measured = PKG / 'fonts' / 'fallbacks.json'
    known = json.loads(measured.read_text()) if measured.exists() else {}
    fonts_dir = Path(os.environ.get('WINDIR', 'C:/Windows')) / 'Fonts'
    css += ['', '/* Metric-matched fallbacks: local faces stretched to the web faces\' widths and line',
            '   metrics, so text does not jump when the web face arrives. */']
    for family, local_names, local_file, web_rel in FALLBACKS:
        local_path = fonts_dir / local_file
        if local_path.exists():
            known[family] = {'local': local_names, 'measuredAgainst': local_file, **fallback_metrics(cache / web_rel, local_path)}
        m = known.get(family)
        if not m:
            print(f'no metrics for {family} fallback; skipped', file=sys.stderr)
            continue
        srcs = ', '.join(f"local('{n}')" for n in m['local'])
        css += ['@font-face {', f"  font-family: '{family} Fallback';", f'  src: {srcs};']
        css += [f'  {k}: {m[k]};' for k in ('size-adjust', 'ascent-override', 'descent-override', 'line-gap-override')]
        css += ['}']
    measured.write_text(json.dumps(known, indent=2) + '\n')

    (PKG / 'fonts.css').write_text('\n'.join(css) + '\n', encoding='utf-8')
    write_readme(rows, sources, known)
    total = sum(r[5] for r in rows)
    print(f'wrote {len(rows)} woff2 files, {total / 1024:.0f} KB in all, and fonts.css')


def parse_ranges(text):
    out = set()
    for part in text.split(','):
        part = part.strip().removeprefix('U+')
        if '-' in part:
            a, b = part.split('-')
            out.update(range(int(a, 16), int(b, 16) + 1))
        else:
            out.add(int(part, 16))
    return out


def write_readme(rows, sources, fallbacks):
    lines = [
        '# Fonts',
        '',
        'Self-hosted web fonts for Susegad UI. `../fonts.css` declares them; link it beside `tokens.css`. Nothing is fetched from a third party at run time.',
        '',
        'Every family is licensed under the SIL Open Font License 1.1; each folder holds its `OFL.txt`. The files were built by `tools/build-fonts.py` from the google/fonts repository at commit',
        f'[`{COMMIT[:7]}`](https://github.com/google/fonts/tree/{COMMIT}/ofl), split by script with every OpenType layout feature kept and hinting removed.',
        '',
        '| Family | Version | Source | Designer |',
        '|---|---|---|---|',
    ]
    designers = {
        'Mukta': 'Ek Type', 'Kalam': 'Indian Type Foundry', 'Castoro': 'Tiro Typeworks',
        'Tiro Devanagari Marathi': 'Tiro Typeworks, John Hudson, Fiona Ross', 'Tiro Kannada': 'Tiro Typeworks, John Hudson, Fiona Ross',
        'Noto Sans Kannada': 'Google, the Noto project',
    }
    for fam, s in sources.items():
        files = ', '.join(f"[{f}](https://github.com/google/fonts/blob/{COMMIT}/ofl/{s['folder']}/{urllib.parse.quote(f)})" for f in s['files'])
        lines.append(f"| {fam} | {s['version']} | {files} | {designers.get(fam, '')} |")
    lines += ['', '## Files', '', '| File | Weight | Style | Script | Size |', '|---|---|---|---|---|']
    for fam, weight, style, script, path, size in rows:
        lines.append(f'| `{path}` | {weight} | {style} | {script} | {size / 1024:.1f} KB |')
    total = sum(r[5] for r in rows)
    lines += ['', f'{len(rows)} files, {total / 1024:.0f} KB in all. A page downloads only the faces and scripts it uses; the Folio builder subsets further (Wave 3).', '']
    lines += ['## Fallbacks', '', 'While a web face loads, and wherever it cannot, a local face stands in, stretched to match its metrics:', '',
              '| Stands in for | Local face | size-adjust | ascent | descent | line gap |', '|---|---|---|---|---|---|']
    for fam, m in fallbacks.items():
        lines.append(f"| {fam} | {', '.join(m['local'])} | {m['size-adjust']} | {m['ascent-override']} | {m['descent-override']} | {m['line-gap-override']} |")
    lines += ['', 'Measured against the Windows files. Devanagari and Kannada fall back to the system Indic faces in the token stacks without metric overrides.', '']
    (OUT / 'README.md').write_text('\n'.join(lines), encoding='utf-8')


if __name__ == '__main__':
    import urllib.parse  # noqa: E402
    main()
