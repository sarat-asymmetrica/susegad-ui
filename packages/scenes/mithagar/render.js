// Mithagar: The canvas renderer. Owns every side effect.
//
// quiet    crisp architectural elevation and grid: hairlines, settled pyramids,
//          mirror-still water; no animation loop
// warm     rich laterite washes, mud bank hatching, sky reflections,
//          gentle water ripples and rising heat shimmer
// playful  sandpiper waders running and pecking along bunds; click or Enter
//          rakes salt pyramids with circular clay ridges

import {
  stage,
  rng,
  clamp,
  lerp,
  smoothstep,
  TAU,
  hexToRgb,
  wash,
  hatch,
  paper,
  toPath,
} from '../../engine/index.js';
import { readColors } from '../../core/colors.js';
import { W, H, HORIZON_Y, crystallization, reflectY, skyAt, panDrying } from './model.js';

const mixHex = (a, b, t) => {
  const A = hexToRgb(a);
  const B = hexToRgb(b);
  return (
    '#' +
    A.map((v, i) =>
      Math.round(lerp(v, B[i], t))
        .toString(16)
        .padStart(2, '0')
    ).join('')
  );
};

export function createRenderer(host, { register = 'warm', theme = null, palette = null, seed = 1, invalidate = () => {} } = {}) {
  const st = stage(host, { W, H });
  let reg = register;
  let colors = null;
  const rakedHeaps = new Set();
  const rakeWaves = [];
  let focusHeapIndex = 0;

  st.onresize = () => {
    invalidate();
  };

  function getPalette() {
    return (colors ??= readColors(host, {
      paper: 'var(--sg-paper, light-dark(#f4efe6, #141724))',
      ink: 'var(--sg-ink, light-dark(#1b243b, #ebe5d8))',
      pencil: 'var(--sg-pencil, light-dark(#7e8499, #8c887b))',
      laterite: 'var(--sg-laterite, #b3563a)',
      lateriteDark: '#78351f',
      clayWet: 'light-dark(#4a2014, #2d140d)',
      clayDry: 'light-dark(#c87050, #8a4832)',
      saltWhite: '#ffffff',
      saltFacet: '#f2f5f9',
      saltShade: 'light-dark(#cfd6e6, #586078)',
      skyDawnZenith: '#26294a',
      skyDawnMid: '#6f5774',
      skyDawnHorizon: '#e29762',
      timber: '#4c3625',
      dark: 'light-dark(#000000, #ffffff)',
    }));
  }

  const isDark = () => getPalette().dark !== '#000000';
  const hair = () => (1.0 * W) / (st.canvas.clientWidth || W);

  // ── Interactivity in playful ──────────────────────────────────────────────
  function handleRakeAt(lx, ly) {
    if (reg !== 'playful') return;

    // Add ripple effect
    rakeWaves.push({ x: lx, y: ly, t: 0, maxR: 45 });

    // Find nearest heap
    const layout = st._lastData?.layout;
    if (layout?.pans) {
      let nearestPan = null;
      let minDist = 1e9;
      for (const pan of layout.pans) {
        const d = Math.hypot(pan.center[0] - lx, pan.center[1] - ly);
        if (d < minDist) {
          minDist = d;
          nearestPan = pan;
        }
      }
      if (nearestPan) {
        rakedHeaps.add(nearestPan.id);
        rakedHeaps.add(`heap_${nearestPan.id}`);
      }
    }
    invalidate();
  }

  // Pointer listener
  const onPointerDown = e => {
    if (reg !== 'playful') return;
    const [lx, ly] = st.toLogical(e.clientX, e.clientY);
    handleRakeAt(lx, ly);
  };

  // Keyboard navigation
  const onKeyDown = e => {
    if (reg !== 'playful') return;
    if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
      e.preventDefault();
      const pans = st._lastData?.layout?.pans;
      if (pans?.length) {
        if (e.key === 'ArrowRight') focusHeapIndex = (focusHeapIndex + 1) % pans.length;
        else if (e.key === 'ArrowLeft') focusHeapIndex = (focusHeapIndex - 1 + pans.length) % pans.length;
        else if (e.key === 'ArrowDown') focusHeapIndex = (focusHeapIndex + 4) % pans.length;
        else if (e.key === 'ArrowUp') focusHeapIndex = (focusHeapIndex - 4 + pans.length) % pans.length;
        invalidate();
      }
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const pans = st._lastData?.layout?.pans;
      if (pans?.[focusHeapIndex]) {
        const pan = pans[focusHeapIndex];
        handleRakeAt(pan.center[0], pan.center[1]);
      }
    }
  };

  st.canvas.addEventListener('pointerdown', onPointerDown);
  st.el.addEventListener('keydown', onKeyDown);

  /**
   * Bounds for a facet.
   *
   * hatch() works out its extent from an array of points, but when it is handed a
   * Path2D and no bounds it assumes the whole canvas and lays down a stroke for
   * every few pixels across all of it. A salt heap facet is forty pixels across,
   * so doing that cost this scene twenty two times the baseline.
   */
  function facetBounds(pts) {
    let x0 = Infinity;
    let y0 = Infinity;
    let x1 = -Infinity;
    let y1 = -Infinity;
    for (const p of pts) {
      if (p[0] < x0) x0 = p[0];
      if (p[0] > x1) x1 = p[0];
      if (p[1] < y0) y0 = p[1];
      if (p[1] > y1) y1 = p[1];
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 };
  }

  // ── Drawing Subroutines ───────────────────────────────────────────────────

  function drawSky(g, sky, dark) {
    const grad = g.createLinearGradient(0, 0, 0, HORIZON_Y);
    grad.addColorStop(0, dark ? '#101221' : sky.zenith);
    grad.addColorStop(0.55, dark ? '#281f33' : sky.mid);
    grad.addColorStop(1, dark ? '#52292a' : sky.horizon);
    g.fillStyle = grad;
    g.fillRect(0, 0, W, HORIZON_Y);

    // Sun disc and glow
    const { x, y, radius, glow } = sky.sun;
    const sunGrad = g.createRadialGradient(x, y, radius * 0.2, x, y, radius * 3.2);
    sunGrad.addColorStop(0, '#fffbe8');
    sunGrad.addColorStop(0.3, dark ? 'rgba(255,200,140,0.5)' : 'rgba(255,225,170,0.65)');
    sunGrad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = sunGrad;
    g.beginPath();
    g.arc(x, y, radius * 3.2, 0, TAU);
    g.fill();

    g.fillStyle = '#fffdf5';
    g.beginPath();
    g.arc(x, y, radius * 0.75, 0, TAU);
    g.fill();
  }

  function drawFarShore(g, palms, dark) {
    // Mandovi estuary far bank strip
    g.fillStyle = dark ? '#181b29' : '#3c404d';
    g.fillRect(0, HORIZON_Y - 4, W, 10);

    // River water channel in background
    const riverGrad = g.createLinearGradient(0, HORIZON_Y, 0, HORIZON_Y + 36);
    riverGrad.addColorStop(0, dark ? '#1d2338' : '#73869c');
    riverGrad.addColorStop(1, dark ? '#2a334d' : '#92a5b8');
    g.fillStyle = riverGrad;
    g.fillRect(0, HORIZON_Y, W, 48);

    // Distant coconut palms
    g.fillStyle = dark ? '#151722' : '#272d38';
    palms.forEach(p => {
      // Trunk
      g.beginPath();
      g.moveTo(p.x, p.y + 6);
      g.quadraticCurveTo(p.x + p.lean * 20, p.y - p.height * 0.5, p.x + p.lean * 35, p.y - p.height);
      g.lineWidth = 2.2;
      g.strokeStyle = dark ? '#151722' : '#272d38';
      g.stroke();

      // Fronds
      const hx = p.x + p.lean * 35;
      const hy = p.y - p.height;
      for (let f = 0; f < p.fronds; f++) {
        const ang = (f / p.fronds) * TAU * 0.6 - 0.9;
        const flen = 12 + (f % 3) * 3;
        g.beginPath();
        g.moveTo(hx, hy);
        g.quadraticCurveTo(hx + Math.cos(ang) * flen, hy + Math.sin(ang) * flen - 3, hx + Math.cos(ang) * flen * 1.3, hy + Math.sin(ang) * flen + 6);
        g.lineWidth = 1.2;
        g.stroke();
      }
    });
  }

  function drawSluiceGate(g, sluice, dark) {
    const c = getPalette();

    // Stone piers
    g.fillStyle = dark ? '#42221b' : c.lateriteDark;
    g.fillRect(sluice.leftPier.x0, sluice.leftPier.y0, sluice.leftPier.x1 - sluice.leftPier.x0, sluice.leftPier.y1 - sluice.leftPier.y0);
    g.fillRect(sluice.rightPier.x0, sluice.rightPier.y0, sluice.rightPier.x1 - sluice.rightPier.x0, sluice.rightPier.y1 - sluice.rightPier.y0);

    // Horizontal timber gate planks (ponns)
    g.fillStyle = dark ? '#281e18' : c.timber;
    sluice.planks.forEach(p => {
      g.fillRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
      g.strokeStyle = '#1d1712';
      g.lineWidth = 0.8;
      g.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0);
    });

    // Vertical lever
    g.fillStyle = dark ? '#281e18' : c.timber;
    g.fillRect(sluice.lever.x - 2, sluice.lever.y0, 4, sluice.lever.y1 - sluice.lever.y0);

    // Trickling water sheen
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.fillRect(sluice.planks[0].x0 + 4, sluice.planks[2].y1, sluice.planks[0].x1 - sluice.planks[0].x0 - 8, 8);
  }

  function drawQuiet(g, data) {
    const c = getPalette();
    const h = hair();

    // Crisp paper base
    g.fillStyle = c.paper;
    g.fillRect(0, 0, W, H);

    // Architectural hairlines
    g.strokeStyle = c.pencil;
    g.lineWidth = h;

    // Horizon and far shore
    g.beginPath();
    g.moveTo(0, HORIZON_Y);
    g.lineTo(W, HORIZON_Y);
    g.stroke();

    // Sluice gate
    const sl = data.sluice;
    g.strokeRect(sl.leftPier.x0, sl.leftPier.y0, sl.leftPier.x1 - sl.leftPier.x0, sl.leftPier.y1 - sl.leftPier.y0);
    g.strokeRect(sl.rightPier.x0, sl.rightPier.y0, sl.rightPier.x1 - sl.rightPier.x0, sl.rightPier.y1 - sl.rightPier.y0);
    sl.planks.forEach(p => g.strokeRect(p.x0, p.y0, p.x1 - p.x0, p.y1 - p.y0));

    // Bunds grid
    const { bunds, pans } = data.layout;
    bunds.horizontal.forEach(b => {
      g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    });
    bunds.vertical.forEach(b => {
      g.strokeRect(b.x0, b.y0, b.x1 - b.x0, b.y1 - b.y0);
    });

    // Pans & water level
    pans.forEach(pan => {
      // Pan outline
      g.strokeRect(pan.x0, pan.y0, pan.w, pan.h);

      // Water recede outline
      const rec = data.crys.recede;
      const wx0 = pan.x0 + rec;
      const wy0 = pan.y0 + rec;
      const ww = pan.w - rec * 2;
      const wh = pan.h - rec * 2;
      if (ww > 0 && wh > 0) {
        g.strokeStyle = c.ink;
        g.strokeRect(wx0, wy0, ww, wh);
        g.strokeStyle = c.pencil;
      }
    });

    // Salt heaps
    data.heaps.forEach(heap => {
      if (heap.height <= 0) return;

      // Base footprint
      g.beginPath();
      g.moveTo(heap.north[0], heap.north[1]);
      g.lineTo(heap.east[0], heap.east[1]);
      g.lineTo(heap.south[0], heap.south[1]);
      g.lineTo(heap.west[0], heap.west[1]);
      g.closePath();
      g.fillStyle = c.saltWhite;
      g.fill();
      g.stroke();

      // Ridges to apex
      g.beginPath();
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.north[0], heap.north[1]);
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.east[0], heap.east[1]);
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.south[0], heap.south[1]);
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.west[0], heap.west[1]);
      g.stroke();

      // Shaded face hatching
      g.save();
      g.beginPath();
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.north[0], heap.north[1]);
      g.lineTo(heap.west[0], heap.west[1]);
      g.closePath();
      g.clip();
      for (let y = heap.apex[1]; y <= heap.south[1]; y += 3 * h) {
        g.beginPath();
        g.moveTo(heap.west[0] - 10, y);
        g.lineTo(heap.east[0] + 10, y - 6);
        g.stroke();
      }
      g.restore();
    });
  }

  function drawWarmOrPlayful(g, data, opts) {
    const c = getPalette();
    const dark = isDark();
    const { layout, crys, sky, sluice, heaps, sandpipers, ripples, shimmer } = data;

    // 1. Paper ground, painted once and blitted. Generating sixty fibres and a
    //    full sheet of grain every frame is what put this scene at twenty two
    //    times the baseline; nothing about it needs to change from frame to frame.
    st.blit(
      st.cached(`ground|${dark}|${data.seed}`, gg => {
        paper(gg, W, H, {
          seed: data.seed,
          base: c.paper,
          mottle: dark ? 0.04 : 0.08,
          grain: dark ? 0.05 : 0.1,
          fibers: dark ? 20 : 60,
        });
      }),
      g
    );

    // 2 to 4. Sky, estuary, sluice and the clay bunds. None of it changes from
    //    frame to frame, so it is painted once and blitted.
    const { bunds, pans } = layout;
    st.blit(
      st.cached(`field|${dark}|${data.seed}|${data.timeOfDay}`, gg => {
      // 2. Sky & estuary
      drawSky(gg, sky, dark);
      drawFarShore(gg, sky.palms, dark);

      // 3. Sluice gate
      drawSluiceGate(gg, sluice, dark);

      // 4. Bunds (clay embankments)
      // Bund wash
      const bundBaseColor = dark ? '#381c15' : c.laterite;
      bunds.horizontal.forEach(b => {
        wash(gg, [
          [b.x0, b.y0],
          [b.x1, b.y0],
          [b.x1, b.y1],
          [b.x0, b.y1],
        ], { color: bundBaseColor, alpha: 0.92 });
      });
      bunds.vertical.forEach(b => {
        wash(gg, [
          [b.x0, b.y0],
          [b.x1, b.y0],
          [b.x1, b.y1],
          [b.x0, b.y1],
        ], { color: bundBaseColor, alpha: 0.92 });
      });

      // Bund hatching on sloping faces
      bunds.horizontal.forEach((b, idx) => {
        hatch(gg, [
          [b.x0, b.y0],
          [b.x1, b.y0],
          [b.x1, b.y0 + 6],
          [b.x0, b.y0 + 6],
        ], {
          angle: Math.PI / 4,
          spacing: 4.5,
          width: 0.8,
          color: dark ? '#5a2b1f' : c.lateriteDark,
          alpha: 0.65,
          seed: data.seed + idx,
        });
      });

      }),
      g
    );

    // 5. Inside each salt pan
    pans.forEach(pan => {
      // Each pan is at its own depth in the drying front, so the salt takes the
      // field as a front rather than as one fade applied to all of it.
      const dry = panDrying(pan, data.progress);
      const dryCrys = crystallization(dry);

      // Pan bed: wet laterite clay floor
      const bedColor = dark ? '#24120c' : c.clayWet;
      g.fillStyle = bedColor;
      g.beginPath();
      pan.polygon.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
      g.closePath();
      g.fill();

      // Receding brine pool
      const rec = dryCrys.recede;
      const bx0 = pan.x0 + rec;
      const by0 = pan.y0 + rec;
      const bw = pan.w - rec * 2;
      const bh = pan.h - rec * 2;

      if (bw > 2 && bh > 2) {
        // Brine water reflection: this pan's own slice of one sky, sampled at the
        // mirror of its own depth, so the field reflects the sky rather than
        // repeating it.
        const waterGrad = g.createLinearGradient(0, by0, 0, by0 + bh);
        if (dark) {
          waterGrad.addColorStop(0, '#1c223a');
          waterGrad.addColorStop(1, '#2c3756');
        } else {
          waterGrad.addColorStop(0, skyAt(sky, reflectY(pan.y0)));
          waterGrad.addColorStop(1, skyAt(sky, reflectY(pan.y1)));
        }
        g.fillStyle = waterGrad;
        g.globalAlpha = 0.88;
        g.fillRect(bx0, by0, bw, bh);
        g.globalAlpha = 1;

        // The sun's track on the water: a column of glitter lying under the sun,
        // widening as it comes toward you and dimming as the light goes.
        const trackX = sky.sun.x;
        const glow = sky.sun.glow * (dark ? 0.35 : 1);
        const halfW = lerp(46, 132, (pan.y1 - HORIZON_Y) / (H - HORIZON_Y));
        const tg = g.createLinearGradient(trackX - halfW, 0, trackX + halfW, 0);
        tg.addColorStop(0, 'rgba(255,244,214,0)');
        tg.addColorStop(0.5, `rgba(255,248,224,${0.46 * glow})`);
        tg.addColorStop(1, 'rgba(255,244,214,0)');
        g.fillStyle = tg;
        g.fillRect(Math.max(bx0, trackX - halfW), by0, Math.min(bw, halfW * 2), bh);

        // Soft water ripples
        if (ripples.amp > 0) {
          g.save();
          g.beginPath();
          g.rect(bx0, by0, bw, bh);
          g.clip();
          g.strokeStyle = dark ? 'rgba(180,200,240,0.22)' : 'rgba(255,255,255,0.45)';
          g.lineWidth = 1.1;

          for (let ry = by0 + 8; ry < by0 + bh; ry += 11) {
            g.beginPath();
            for (let rx = bx0; rx <= bx0 + bw; rx += 8) {
              const wy = ry + Math.sin(rx * 0.05 + ry * 0.03 + ripples.phase) * ripples.amp;
              if (rx === bx0) g.moveTo(rx, wy);
              else g.lineTo(rx, wy);
            }
            g.stroke();
          }
          g.restore();
        }
      }

      // Crystalline white salt crust along clay margins
      if (dryCrys.crustThickness > 0.5) {
        g.save();
        g.fillStyle = c.saltWhite;
        g.globalAlpha = dryCrys.crustCoverage * 0.92;

        const thick = dryCrys.crustThickness;
        // Top crust strip
        g.fillRect(pan.x0, pan.y0, pan.w, thick);
        // Bottom crust strip
        g.fillRect(pan.x0, pan.y1 - thick, pan.w, thick);
        // Left crust strip
        g.fillRect(pan.x0, pan.y0, thick, pan.h);
        // Right crust strip
        g.fillRect(pan.x1 - thick, pan.y0, thick, pan.h);

        // Irregular sparkle along the crust itself, not scattered over the water.
        const crng = rng(`pan:crust:${pan.id}:${data.seed}`);
        g.fillStyle = c.saltFacet;
        g.globalAlpha = 0.5 * dryCrys.crustCoverage;
        for (let k = 0; k < 26; k++) {
          const side = crng.int(0, 3);
          let cx, cy;
          const along = crng();
          const thick = Math.max(3, dryCrys.crustThickness);
          if (side === 0) { cx = pan.x0 + along * pan.w; cy = pan.y0 + crng() * thick; }
          else if (side === 1) { cx = pan.x0 + along * pan.w; cy = pan.y1 - crng() * thick; }
          else if (side === 2) { cy = pan.y0 + along * pan.h; cx = pan.x0 + crng() * thick; }
          else { cy = pan.y0 + along * pan.h; cx = pan.x1 - crng() * thick; }

          const sz = crng.range(0.9, 2.3);
          g.beginPath();
          g.arc(cx, cy, sz, 0, TAU);
          g.fill();
        }
        g.restore();
      }

      // Rake marks in damp clay around raked heaps
      const heap = heaps[pan.id];
      if (heap && (heap.raked || rakedHeaps.has(pan.id))) {
        g.save();
        g.strokeStyle = dark ? 'rgba(100,50,30,0.5)' : 'rgba(70,30,15,0.45)';
        g.lineWidth = 1.3;
        heap.rakeRings.forEach(ring => {
          g.beginPath();
          g.ellipse(heap.x, heap.y, ring.rx, ring.ry, 0, 0, TAU);
          g.stroke();
        });
        g.restore();
      }
    });

    // 6. Pyramidal salt heaps (mithacho rashi)
    heaps.forEach((heap, idx) => {
      if (heap.height <= 0.5) return;

      // Soft mud contact shadow
      g.save();
      g.fillStyle = 'rgba(20, 10, 5, 0.28)';
      g.beginPath();
      g.ellipse(heap.x, heap.y + heap.baseH * 0.1, heap.baseW * 0.55, heap.baseH * 0.45, 0, 0, TAU);
      g.fill();
      g.restore();

      // Shaded facet (facing away from dawn sun)
      g.fillStyle = dark ? '#40485c' : c.saltShade;
      g.beginPath();
      heap.facets.shaded.forEach((pt, i) => (i ? g.lineTo(pt[0], pt[1]) : g.moveTo(pt[0], pt[1])));
      g.closePath();
      g.fill();

      // Sunny facet (facing dawn sun)
      wash(g, toPath(heap.facets.sunny), { color: dark ? '#f0ebd8' : c.saltWhite, alpha: 0.98 });
      hatch(g, toPath(heap.facets.sunny), { bounds: facetBounds(heap.facets.sunny),
        angle: Math.PI / 4,
        spacing: 4.5,
        width: 0.6,
        color: dark ? '#e8c9b3' : '#fce3d2', // warm dawn light reflection
        alpha: 0.45,
        seed: data.seed + idx * 11,
      });

      // Front facet
      wash(g, toPath(heap.facets.front), { color: dark ? '#e2dccc' : c.saltFacet, alpha: 0.98 });
      hatch(g, toPath(heap.facets.front), { bounds: facetBounds(heap.facets.front),
        angle: -Math.PI / 8,
        spacing: 4,
        width: 0.5,
        color: dark ? '#505a75' : '#d2dbe6', // ambient cool sky light
        alpha: 0.35,
        seed: data.seed + idx * 13,
      });

      // Facet hatch on shaded side
      hatch(g, toPath(heap.facets.shaded), { bounds: facetBounds(heap.facets.shaded),
        angle: -Math.PI / 4,
        spacing: 3.2,
        width: 0.8,
        color: dark ? '#2a3040' : '#8890a4',
        alpha: 0.5,
        seed: data.seed + idx * 7,
      });

      // Ridges and apex in pencil line
      g.strokeStyle = dark ? '#2c3345' : '#72798e';
      g.lineWidth = 1.0;
      g.beginPath();
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.south[0], heap.south[1]);
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.east[0], heap.east[1]);
      g.moveTo(heap.apex[0], heap.apex[1]);
      g.lineTo(heap.west[0], heap.west[1]);
      g.stroke();

      // Keyboard focus indicator in playful
      if (reg === 'playful' && idx === focusHeapIndex) {
        g.strokeStyle = dark ? '#f5d547' : '#e4b24c';
        g.lineWidth = 2.0;
        g.beginPath();
        g.arc(heap.x, heap.y, heap.baseW * 0.75, 0, TAU);
        g.stroke();
      }
    });

    /**
   * The raker: one person bent over the near pan, and the shadow that says what
   * hour it is. She is drawn after the pans and before the sandpipers, because
   * she is standing in the field, not flying over it.
   */
  function drawRaker(g, rk, dark) {
    if (!rk) return;
    const h = rk.height;
    const x = rk.x;
    const y = rk.y;

    // Her shadow, thrown away from the sun and long at either end of the day.
    const len = h * rk.shadow;
    g.save();
    g.globalAlpha = dark ? 0.28 : 0.3;
    g.fillStyle = dark ? '#0d0a14' : '#3a1c10';
    g.beginPath();
    g.ellipse(x + rk.shadowDir * len * 0.55, y + 3, len * 0.62, 5.5, 0, 0, TAU);
    g.fill();
    g.restore();

    // Bent at the waist, the rake out in front, the whole body on one line.
    const lean = Math.sin(rk.bend) * h * 0.55;
    const hipX = x - rk.shadowDir * 4;
    const hipY = y - h * 0.52;
    const shoulderX = hipX + rk.shadowDir * lean;
    const shoulderY = hipY + h * 0.16;
    const headX = shoulderX + rk.shadowDir * h * 0.26;
    const headY = shoulderY - h * 0.1;

    // The sarong, in a colour the field does not otherwise use.
    g.save();
    g.fillStyle = dark ? '#3a2c48' : '#7a3b62';
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(hipX + rk.shadowDir * 7, hipY - h * 0.1);
    g.lineTo(hipX - rk.shadowDir * 2, y);
    g.lineTo(hipX - rk.shadowDir * 13, y);
    g.closePath();
    g.fill();
    g.restore();

    // Legs under it.
    g.strokeStyle = dark ? '#20182c' : '#4a2a1c';
    g.lineWidth = 3.4;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(hipX, y - 4);
    g.lineTo(hipX - 5, y);
    g.moveTo(hipX + 4, y - 4);
    g.lineTo(hipX + 10, y);
    g.stroke();

    // Torso and head.
    g.strokeStyle = dark ? '#2c2138' : '#c9a27a';
    g.lineWidth = 5.2;
    g.beginPath();
    g.moveTo(hipX, hipY);
    g.lineTo(shoulderX, shoulderY);
    g.stroke();
    g.fillStyle = dark ? '#241a30' : '#3a2418';
    g.beginPath();
    g.arc(headX, headY, 4.6, 0, TAU);
    g.fill();

    // The rake: a long wooden handle and a toothed head, travelling across.
    const rakeX = rk.shadowDir * h * 0.62 + rk.rakeX;
    const rakeY = y - 2 + rk.rakeY;
    g.strokeStyle = dark ? '#4a3a52' : '#7d5a34';
    g.lineWidth = 2.4;
    g.beginPath();
    g.moveTo(shoulderX, shoulderY + h * 0.06);
    g.lineTo(x + rakeX, rakeY);
    g.stroke();
    g.strokeStyle = dark ? '#5a4a62' : '#9a7448';
    g.lineWidth = 2.8;
    g.beginPath();
    g.moveTo(x + rakeX - 9, rakeY);
    g.lineTo(x + rakeX + 9, rakeY);
    g.stroke();
    g.lineWidth = 1.4;
    for (let k = -3; k <= 3; k++) {
      g.beginPath();
      g.moveTo(x + rakeX + k * 3, rakeY);
      g.lineTo(x + rakeX + k * 3, rakeY + 6);
      g.stroke();
    }
  }

  // 7. The raker, in the near pan
  drawRaker(g, data.raker, dark);

  // 8. Sandpiper waders (in playful, or single bird in warm)
    sandpipers.forEach(bird => {
      g.save();
      g.translate(bird.x, bird.y);
      
      // Ground cast shadow
      g.save();
      g.fillStyle = dark ? 'rgba(15, 8, 5, 0.35)' : 'rgba(50, 20, 10, 0.25)';
      g.beginPath();
      g.ellipse(0, 11, 8, 2.5, 0, 0, TAU);
      g.fill();
      g.restore();

      g.scale(bird.facing * bird.scale, bird.scale);

      // Legs
      g.strokeStyle = dark ? '#222' : '#33261a';
      g.lineWidth = 1.3;
      // Left leg
      g.beginPath();
      g.moveTo(-1, 2);
      g.lineTo(-1 + Math.sin(bird.legAngle) * 5, 10);
      g.stroke();
      // Right leg
      g.beginPath();
      g.moveTo(2, 2);
      g.lineTo(2 - Math.sin(bird.legAngle) * 5, 10);
      g.stroke();

      // Body (plump little oval)
      g.save();
      g.rotate(bird.peckAngle * 0.4);
      // Upperparts: warm brownish grey
      g.fillStyle = dark ? '#61554a' : '#7a6755';
      g.beginPath();
      g.ellipse(0, 0, 8, 4.5, 0, 0, TAU);
      g.fill();

      // Crisp white underbelly
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.ellipse(0, 2, 6, 2.5, 0, 0, TAU);
      g.fill();

      // Head and slender neck
      g.translate(6, -2);
      g.rotate(bird.peckAngle);
      g.fillStyle = dark ? '#61554a' : '#7a6755';
      g.beginPath();
      g.arc(0, 0, 3.2, 0, TAU);
      g.fill();

      // Slender bill
      g.strokeStyle = '#1a1815';
      g.lineWidth = 1.0;
      g.beginPath();
      g.moveTo(2.5, 0);
      g.lineTo(10, 1);
      g.stroke();

      // Eye
      g.fillStyle = '#111111';
      g.beginPath();
      g.arc(0.5, -1, 0.7, 0, TAU);
      g.fill();

      g.restore();
      g.restore();
    });

    // 8. Rake interactive waves (playful)
    for (let w = rakeWaves.length - 1; w >= 0; w--) {
      const wave = rakeWaves[w];
      wave.t += opts.dt || 0.016;
      const progress = wave.t / 1.5;
      if (progress >= 1) {
        rakeWaves.splice(w, 1);
        continue;
      }
      const r = progress * wave.maxR;
      g.save();
      g.strokeStyle = dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.6)';
      g.lineWidth = 1.8 * (1 - progress);
      g.beginPath();
      g.arc(wave.x, wave.y, r, 0, TAU);
      g.stroke();
      g.restore();
    }

    // 9. Heat shimmer over clay dikes
    if (shimmer.amp > 0) {
      g.save();
      g.fillStyle = dark ? 'rgba(255,220,180,0.035)' : 'rgba(255,255,255,0.045)';
      bunds.horizontal.forEach(b => {
        const shimY = b.y0 + Math.sin(shimmer.phase + b.y0 * 0.05) * shimmer.amp;
        g.fillRect(b.x0, shimY, b.x1 - b.x0, b.y1 - b.y0);
      });
      g.restore();
    }
  }

  return {
    render(data, opts = {}) {
      st._lastData = data;
      const g = st.begin();

      if (data.register === 'quiet') {
        drawQuiet(g, data);
      } else {
        drawWarmOrPlayful(g, data, opts);
      }
    },

    setRegister(newReg) {
      reg = newReg;
      colors = null;
      invalidate();
    },

    restyle() {
      colors = null;
      invalidate();
    },

    destroy() {
      st.canvas.removeEventListener('pointerdown', onPointerDown);
      st.el.removeEventListener('keydown', onKeyDown);
      st.destroy();
    },
  };
}
