/* Ham Antenna Calculator — UI layer.
 * Requires antennas.js (window.Antennas) to be loaded first.
 * Vanilla ES5-style JS, no build step, no dependencies.
 */

(function () {
  'use strict';

  if (typeof document === 'undefined') return;      // safe to include anywhere
  var A = typeof window !== 'undefined' ? window.Antennas : null;
  if (!A) {
    if (typeof console !== 'undefined') console.error('antennas.js must be loaded before app.js');
    return;
  }

  var STORAGE_KEY = 'ham-antenna-calculator/v1';

  /* ------------------------------------------------------------------ *
   * Antenna types and their extra inputs
   * ------------------------------------------------------------------ */

  var TYPES = [
    { id: 'dipole', label: 'Dipole' },
    { id: 'invertedV', label: 'Inverted-V', options: ['apex'] },
    { id: 'foldedDipole', label: 'Folded dipole', options: ['foldedSpacing'] },
    { id: 'efhw', label: 'End-fed ½ λ' },
    { id: 'quarterWaveVertical', label: '¼ λ vertical' },
    { id: 'halfWaveVertical', label: '½ λ vertical' },
    { id: 'fiveEighthVertical', label: '⅝ λ vertical' },
    { id: 'dualBandVertical', label: '2 m + 70 cm', options: ['dual'] },
    { id: 'yagi', label: 'Yagi', options: ['yagi'] },
    { id: 'fullWaveLoop', label: 'Full-wave loop' },
    { id: 'cubicalQuad', label: 'Cubical quad', options: ['quad'] }
  ];

  var OPTION_HTML = {
    apex:
      '<div class="field"><label for="opt-apex">Apex angle (°)</label>' +
      '<input id="opt-apex" type="number" min="30" max="180" step="5" data-key="apexDeg" value="90">' +
      '<p class="hint">90° is the standard field layout; 180° is a flat dipole.</p></div>',
    dual:
      '<div class="field-row">' +
      '<div class="field"><label for="opt-f">2 m design frequency (MHz)</label>' +
      '<input id="opt-f" type="number" min="100" max="600" step="0.001" data-key="f" value="145.500"></div>' +
      '<div class="field"><label for="opt-f2">70 cm design frequency (MHz)</label>' +
      '<input id="opt-f2" type="number" min="300" max="600" step="0.001" data-key="f2" value="433.500"></div>' +
      '</div>' +
      '<p class="hint">Compromise whip: ¼ λ on 2 m and ¾ λ on 70 cm, one feedline. The band preset sets both.</p>',
    foldedSpacing:
      '<div class="field"><label for="opt-spacing">Conductor spacing (mm)</label>' +
      '<input id="opt-spacing" type="number" min="20" max="300" step="5" data-key="spacingM" data-divisor="1000" value="50">' +
      '<p class="hint">Centre-to-centre gap between the two wires — 25–75 mm is typical on HF.</p></div>',
    yagi:
      '<div class="field-row">' +
      '<div class="field"><label for="opt-dir">Directors</label>' +
      '<input id="opt-dir" type="number" min="0" max="10" step="1" data-key="directors" value="3"></div>' +
      '<div class="field"><label for="opt-ref">Reflector gap (λ)</label>' +
      '<input id="opt-ref" type="number" min="0.05" max="0.35" step="0.01" data-key="reflectorSpacing" value="0.15"></div>' +
      '</div>' +
      '<div class="field-row">' +
      '<div class="field"><label for="opt-de1">DE → director 1 (λ)</label>' +
      '<input id="opt-de1" type="number" min="0.05" max="0.35" step="0.01" data-key="directorSpacing" value="0.15"></div>' +
      '<div class="field"><label for="opt-gap">Director gap (λ)</label>' +
      '<input id="opt-gap" type="number" min="0.05" max="0.5" step="0.01" data-key="directorGap" value="0.20"></div>' +
      '</div>' +
      '<p class="hint">DL6WU-style defaults: 0.15 λ behind the DE, 0.15 λ ahead, then 0.20 λ between directors.</p>',
    quad:
      '<div class="field-row">' +
      '<div class="field"><label for="opt-qel">Loops</label>' +
      '<input id="opt-qel" type="number" min="2" max="6" step="1" data-key="quadElements" value="2"></div>' +
      '<div class="field"><label for="opt-qsp">Loop spacing (λ)</label>' +
      '<input id="opt-qsp" type="number" min="0.08" max="0.35" step="0.01" data-key="quadSpacing" value="0.15"></div>' +
      '</div>' +
      '<p class="hint">Loop 1 is the reflector, loop 2 the driven element, then directors.</p>'
  };

  /* ------------------------------------------------------------------ *
   * State
   * ------------------------------------------------------------------ */

  /* Version of the dimension + pattern model. Bump this whenever a formula or
   * a pattern factor changes, so a result can be reproduced later. */
  var MODEL_VERSION = '7.6.2';

  /* Shown wherever the pattern model is described, so nobody mistakes an
   * analytic sketch for a measured or NEC-simulated pattern. */
  var PATTERN_DISCLAIMER = 'idealized analytic pattern over perfect ground, not a NEC model';

  var DEFAULTS = {
    f: 14.175,
    f2: 433.500,
    units: 'ft',
    factor: 0.95,
    type: 'dipole',
    apexDeg: 90,
    spacingM: 0.05,
    directors: 3,
    reflectorSpacing: 0.15,
    directorSpacing: 0.15,
    directorGap: 0.20,
    quadElements: 2,
    quadSpacing: 0.15,
    patternHeight: 0.5
  };

  var state = {};
  var stKey;
  for (stKey in DEFAULTS) if (Object.prototype.hasOwnProperty.call(DEFAULTS, stKey)) state[stKey] = DEFAULTS[stKey];

  function loadState() {
    var raw = null, saved = null, k;
    try { raw = window.localStorage.getItem(STORAGE_KEY); } catch (e) { raw = null; }
    if (!raw) return;
    try { saved = JSON.parse(raw); } catch (e) { return; }
    if (!saved || typeof saved !== 'object') return;
    for (k in DEFAULTS) {
      if (Object.prototype.hasOwnProperty.call(DEFAULTS, k) &&
          Object.prototype.hasOwnProperty.call(saved, k) &&
          typeof saved[k] === typeof DEFAULTS[k]) {
        state[k] = k === 'type' && !saved[k] ? DEFAULTS.type : saved[k];
      }
    }
  }

  function saveState() {
    try { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* private mode */ }
  }

  /* ------------------------------------------------------------------ *
   * Formatting
   * ------------------------------------------------------------------ */

  function decimalsFor(value) {
    var v = Math.abs(value);
    if (v >= 100) return 1;
    if (v >= 10) return 2;
    if (v >= 1) return 3;
    if (v >= 0.1) return 4;
    return 5;
  }

  function fixed(value, dp) {
    return value.toFixed(dp === undefined ? decimalsFor(value) : dp);
  }

  function fraction(eighths) {
    var num = eighths, den = 8;
    while (num % 2 === 0 && den % 2 === 0) { num /= 2; den /= 2; }
    return num + '/' + den;
  }

  /** "31 ft 5 7/8 in" style text for a length in feet. */
  function feetInches(ft) {
    var totalIn = Math.abs(ft) * 12;
    var feet = Math.floor(totalIn / 12);
    var eighths = Math.round((totalIn - feet * 12) * 8);
    if (eighths === 96) { feet += 1; eighths = 0; }
    var whole = Math.floor(eighths / 8);
    var frac = eighths % 8;
    var prefix = feet > 0 ? feet + ' ft ' : '';
    if (!prefix) return whole + (frac ? ' ' + fraction(frac) : '') + ' in';
    return prefix + whole + (frac ? ' ' + fraction(frac) : '') + ' in';
  }

  /** Primary + secondary strings for a length in feet. */
  function formatLength(ft, units) {
    var m = A.ftToM(ft);
    if (units === 'm') {
      return { main: fixed(m) + ' m', sub: fixed(ft) + ' ft  ·  ' + feetInches(ft) };
    }
    return { main: fixed(ft) + ' ft', sub: fixed(m) + ' m  ·  ' + feetInches(ft) };
  }

  /** First result row whose label starts with `prefix`. */
  function row(res, prefix) {
    var i, r;
    for (i = 0; i < res.rows.length; i++) {
      r = res.rows[i];
      if (r.label.indexOf(prefix) === 0) return r;
    }
    return null;
  }

  function main(res, prefix, units) {
    var r = row(res, prefix);
    if (!r || typeof r.ft !== 'number') return '';
    return formatLength(r.ft, units).main;
  }

  /* ------------------------------------------------------------------ *
   * Tiny SVG helpers for the schematics
   * ------------------------------------------------------------------ */

  function svgWrap(inner, h) {
    return '<svg viewBox="0 0 640 ' + (h || 220) + '" preserveAspectRatio="xMidYMid meet" role="img">' + inner + '</svg>';
  }

  function svgLine(x1, y1, x2, y2, cls, w) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" class="' + (cls || 'd-stroke') + '" stroke-width="' + (w || 3) + '" fill="none"/>';
  }

  function svgText(x, y, text, cls, anchor, size, rotate) {
    return '<text x="' + x + '" y="' + y + '" class="' + (cls || 'd-text') + '" text-anchor="' +
      (anchor || 'middle') + '" font-size="' + (size || 13) + '"' +
      (rotate ? ' transform="rotate(' + rotate + ' ' + x + ' ' + y + ')"' : '') + '>' + text + '</text>';
  }

  function svgDot(x, y) {
    return '<circle cx="' + x + '" cy="' + y + '" r="4.5" class="d-fill"/>';
  }

  /** Dashed horizontal dimension line with end ticks and a centred label. */
  function dimH(x1, x2, y, label) {
    return svgLine(x1, y, x2, y, 'd-stroke-alt d-dash', 1.5) +
      svgLine(x1, y - 5, x1, y + 5, 'd-stroke-alt', 1.5) +
      svgLine(x2, y - 5, x2, y + 5, 'd-stroke-alt', 1.5) +
      svgText((x1 + x2) / 2, y - 7, label, 'd-strong', 'middle', 13);
  }

  /** Dashed vertical dimension line with the label to its right. */
  function dimV(x, y1, y2, label) {
    return svgLine(x, y1, x, y2, 'd-stroke-alt d-dash', 1.5) +
      svgLine(x - 5, y1, x + 5, y1, 'd-stroke-alt', 1.5) +
      svgLine(x - 5, y2, x + 5, y2, 'd-stroke-alt', 1.5) +
      svgText(x + 8, (y1 + y2) / 2 + 4, label, 'd-strong', 'start', 13);
  }

  function svgCircle(cx, cy, r, cls, sw) {
    return '<circle cx="' + (+cx).toFixed(2) + '" cy="' + (+cy).toFixed(2) + '" r="' + (+r).toFixed(2) +
      '" class="' + (cls || 'd-stroke') + '"' + (sw ? ' stroke-width="' + sw + '"' : '') + ' fill="none"/>';
  }

  /** Small filled marker used for pattern peaks and nulls. */
  function svgMarker(x, y, cls) {
    return '<circle cx="' + (+x).toFixed(2) + '" cy="' + (+y).toFixed(2) + '" r="3.4" class="' + cls + '"/>';
  }

  /** Raw SVG path with a class — used by the pattern lobe traces. */
  function svgPath(d, cls, fill) {
    return '<path d="' + d + '" class="' + cls + '"' +
      (fill ? ' fill="' + fill + '"' : ' fill="none"') + '/>';
  }

  function svgRect(x, y, w, h, cls, sw) {
    return '<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" class="' +
      (cls || 'd-stroke') + '" stroke-width="' + (sw || 3) + '" fill="none"/>';
  }

  /** Horizontal dipole style schematic (dipole, folded dipole, EFHW). */
  function diagramDipole(res, units) {
    var y = 84, x1 = 60, x2 = 580, cx = 320;
    var total = main(res, 'Total length', units) || main(res, 'Span', units) || main(res, 'Radiator', units);
    var legRow = row(res, 'Each leg'), spanRow = row(res, 'Span');
    var leg = main(res, 'Each leg', units);
    var legCaption = 'each leg';
    if (!leg && spanRow) {
      leg = formatLength(spanRow.ft / 2, units).main;
      legCaption = 'each half of the span';
    }
    var inner =
      svgText(320, 18, 'total length (tip to tip)', 'd-text', 'middle', 12) +
      dimH(x1, x2, 38, total) +
      svgLine(x1, y, cx - 9, y, 'd-stroke', 3) +
      svgLine(cx + 9, y, x2, y, 'd-stroke', 3) +
      svgLine(x1, y - 7, x1, y + 7, 'd-stroke', 2) +
      svgLine(x2, y - 7, x2, y + 7, 'd-stroke', 2) +
      svgLine(cx, y + 5, cx, y + 62, 'd-stroke-alt', 2.5) +
      svgDot(cx, y) +
      svgText(cx + 8, y + 60, 'feed', 'd-text', 'start', 12) +
      dimH(cx, x2, 150, leg || '') +
      svgText(450, 168, legCaption, 'd-text', 'middle', 12);
    return svgWrap(inner);
  }

  function diagramInvertedV(res, units) {
    var span = row(res, 'Span'), drop = row(res, 'Vertical drop');
    var spanFt = span ? span.ft : 1, dropFt = drop ? drop.ft : 1;
    var apexX = 320, apexY = 46;
    var k = Math.min(470 / spanFt, 130 / dropFt);
    var half = (spanFt / 2) * k, dropPx = dropFt * k;
    var ex1 = apexX - half, ex2 = apexX + half, ey = apexY + dropPx;
    var inner =
      svgLine(apexX, apexY, ex1, ey, 'd-stroke', 3) +
      svgLine(apexX, apexY, ex2, ey, 'd-stroke', 3) +
      svgDot(apexX, apexY) +
      svgText(apexX, apexY - 10, 'feed at apex', 'd-strong', 'middle', 12) +
      svgLine(ex1, ey - 7, ex1, ey + 7, 'd-stroke', 2) +
      svgLine(ex2, ey - 7, ex2, ey + 7, 'd-stroke', 2) +
      dimV(ex2 + 18, apexY, ey, main(res, 'Vertical drop', units)) +
      dimH(ex1, ex2, ey + 42, main(res, 'Span', units)) +
      svgText(ex2, ey + 60, 'between end insulators', 'd-text', 'end', 12) +
      svgText(apexX + 26, apexY + 30, main(res, 'Apex angle', units) || '90°', 'd-text', 'start', 12) +
      svgText(apexX, ey + 90, 'each leg: ' + (main(res, 'Each leg', units) || ''), 'd-strong', 'middle', 13);
    return svgWrap(inner, 240);
  }

  /** Vertical radiator plus radial field. */
  function diagramVertical(res, units) {
    var rad = row(res, 'Each radial');
    var radiator = row(res, 'Radiator');
    var ratio = rad && radiator ? radiator.ft / rad.ft : 1;   // ¼ λ = 1, ½ λ = 2, ⅝ λ = 2.5
    var baseY = 196, baseX = 320;
    var radiatorPx = Math.min(176, 70 * ratio);
    var topY = baseY - radiatorPx;
    var inner =
      svgLine(baseX, topY, baseX, baseY, 'd-stroke', 4) +
      svgDot(baseX, baseY) +
      svgLine(baseX, baseY, baseX - 57, baseY + 40, 'd-stroke-alt', 2.5) +
      svgLine(baseX, baseY, baseX + 57, baseY + 40, 'd-stroke-alt', 2.5) +
      svgLine(baseX, baseY, baseX - 20, baseY + 42, 'd-stroke-alt d-dash', 2) +
      svgLine(baseX, baseY, baseX + 20, baseY + 42, 'd-stroke-alt d-dash', 2) +
      dimV(238, topY, baseY, main(res, 'Radiator', units)) +
      svgText(baseX - 66, baseY + 60, main(res, 'Each radial', units), 'd-strong', 'middle', 12) +
      svgText(baseX - 66, baseY + 76, 'each radial', 'd-text', 'middle', 12) +
      svgLine(70, 250, 570, 250, 'd-faint d-dash', 1.5) +
      svgText(574, 254, 'ground', 'd-text', 'start', 11) +
      svgText(baseX + 12, baseY + 24, 'feed', 'd-text', 'start', 12);
    return svgWrap(inner, 270);
  }

  function diagramYagi(res, units) {
    var driven = row(res, 'Driven element');
    var refl = row(res, 'Reflector');
    var boomRow = row(res, 'Boom length');
    var dRefl = row(res, 'DE → reflector spacing');
    var dDir = row(res, 'DE → director 1 spacing');
    var gapR = row(res, 'Director → director spacing');
    if (!driven || !refl || !boomRow || !dRefl || !dDir) return '';

    var els = [{ name: 'R', len: refl.ft, pos: 0 }];
    els.push({ name: 'DE', len: driven.ft, pos: dRefl.ft });
    var dirs = [], i, r;
    for (i = 0; i < res.rows.length; i++) {
      r = res.rows[i];
      if (/^Director \d+\b/.test(r.label) && typeof r.ft === 'number') dirs.push(r.ft);
    }
    var gapFt = gapR ? gapR.ft : 0;
    for (i = 0; i < dirs.length; i++) {
      els.push({ name: 'D' + (i + 1), len: dirs[i], pos: dRefl.ft + dDir.ft + i * gapFt });
    }

    var boomFt = Math.max(boomRow.ft, 0.001);
    var kx = 500 / boomFt;
    var cx = 70;
    var cy = 100;
    var maxHalf = Math.max.apply(null, els.map(function (e) { return e.len / 2; }));
    var ky = 62 / Math.max(maxHalf, 0.001);
    var inner = '', x, half, e;
    for (i = 0; i < els.length; i++) {
      e = els[i];
      x = cx + e.pos * kx;
      half = (e.len / 2) * ky;
      inner += svgLine(x, cy - half, x, cy + half, i === 1 ? 'd-stroke-alt' : 'd-stroke', i === 1 ? 4 : 3);
      inner += svgText(x, cy - half - 7, e.name, 'd-strong', 'middle', 12);
      if (els.length <= 6 || i === 0 || i === 1 || i === els.length - 1) {
        inner += svgText(x, cy + half + 15, fixed(A.ftToM(e.len) * 1000, 0) + ' mm', 'd-text', 'middle', 11);
      }
    }
    inner += svgDot(cx + els[1].pos * kx, cy) +
      svgLine(cx + els[1].pos * kx, cy, cx + els[1].pos * kx, cy + 62, 'd-stroke-alt', 2) +
      svgText(cx + els[1].pos * kx + 7, cy + 60, 'feed', 'd-text', 'start', 11) +
      svgLine(cx, cy, cx + boomFt * kx, cy, 'd-faint d-dash', 1.2) +
      dimH(cx, cx + boomFt * kx, 206, main(res, 'Boom length', units)) +
      svgText(320, 226, 'boom: reflector → last director', 'd-text', 'middle', 12);
    return svgWrap(inner, 240);
  }

  function diagramLoop(res, units) {
    var x1 = 215, x2 = 425, y1 = 34, y2 = 244;
    var inner =
      svgRect(x1, y1, x2 - x1, y2 - y1, 'd-stroke', 3) +
      svgLine(x1, y1, x2, y2, 'd-stroke-alt d-dash', 1.2) +
      svgLine(x1, y2, x2, y1, 'd-stroke-alt d-dash', 1.2) +
      svgText(320, 20, 'perimeter: ' + (main(res, 'Loop perimeter', units) || ''), 'd-strong', 'middle', 13) +
      svgText(320, 144, 'corner diagonal: ' + (main(res, 'Square loop — corner diagonal', units) || ''), 'd-text', 'middle', 12) +
      svgDot(320, y2) +
      svgLine(320, y2, 320, y2 + 26, 'd-stroke-alt', 2.5) +
      svgText(330, y2 + 24, 'feed', 'd-text', 'start', 11) +
      dimH(x1, x2, y2 + 42, main(res, 'Square loop — side length', units)) +
      svgText(x2, y2 + 60, 'side (square)', 'd-text', 'end', 12);
    return svgWrap(inner, 300);
  }

  function diagramQuad(res, units) {
    var n = 2, i, r;
    for (i = 0; i < res.rows.length; i++) {
      r = res.rows[i];
      if (/^Director loop \d+\b/.test(r.label)) n = Math.max(n, parseInt(r.label.replace(/^Director loop (\d+).*/, '$1'), 10) + 2);
    }
    var firstName = 'R', secondName = 'DE';
    var side = n <= 3 ? 112 : 84;
    var pitch = n > 1 ? 460 / (n - 1) : 0;
    var y = 44;
    var centers = [];
    var inner = '', cxm, label;
    for (i = 0; i < n; i++) {
      cxm = 90 + i * pitch;
      centers.push(cxm);
      label = i === 0 ? firstName : (i === 1 ? secondName : 'D' + (i - 1));
      inner += svgRect(cxm - side / 2, y, side, side, i === 1 ? 'd-stroke-alt' : 'd-stroke', i === 1 ? 3.5 : 2.5);
      inner += svgText(cxm, y - 8, label, 'd-strong', 'middle', 12);
      if (i === 1) {
        inner += svgLine(cxm - side / 2, y + side / 2, cxm + side / 2, y + side / 2, 'd-stroke-alt d-dash', 1.2) +
          svgDot(cxm, y + side);
      }
    }
    inner += svgLine(centers[0], y + side / 2, centers[n - 1], y + side / 2, 'd-faint d-dash', 1.2);
    inner += dimH(centers[0], centers[1], y + side + 30, main(res, 'Driven → reflector spacing', units)) +
      svgText((centers[0] + centers[1]) / 2, y + side + 48, 'loop spacing', 'd-text', 'middle', 12) +
      svgText(320, y + side + 76, 'driven loop side: ' + (main(res, 'Driven loop — side', units) || '') +
        '   •   perimeter: ' + (main(res, 'Driven loop — perimeter', units) || ''), 'd-strong', 'middle', 12);
    return svgWrap(inner, 250);
  }

  function diagramEfhw(res, units) {
    var y = 92, x = 112;
    var inner =
      svgRect(64, y - 28, 48, 56, 'd-stroke-alt', 2.5) +
      svgText(88, y - 4, '49:1', 'd-strong', 'middle', 12) +
      svgText(88, y + 12, 'unun', 'd-text', 'middle', 11) +
      svgLine(40, y, 64, y, 'd-stroke', 2.5) +
      svgText(36, y - 10, 'to rig', 'd-text', 'end', 11) +
      svgLine(x, y, 580, y, 'd-stroke', 3) +
      svgLine(580, y - 7, 580, y + 7, 'd-stroke', 2) +
      dimH(x, 580, 40, main(res, 'Radiator', units)) +
      svgText(346, 24, 'radiator', 'd-text', 'middle', 12) +
      svgLine(88, y + 28, 168, y + 62, 'd-stroke-alt d-dash', 2) +
      svgText(174, y + 66, 'counterpoise: ' + (main(res, 'Counterpoise', units) || ''), 'd-text', 'start', 12) +
      svgText(360, y + 40, 'build long, trim the far end for lowest SWR', 'd-text', 'middle', 12);
    return svgWrap(inner, 210);
  }

  function diagramDualBand(res, units) {
    var baseY = 190, baseX = 320;
    var radiatorPx = 168, topY = baseY - radiatorPx;
    var f2 = typeof res.f2 === 'number' && isFinite(res.f2) ? res.f2 : 433.5;
    var inner =
      svgLine(baseX, topY, baseX, baseY, 'd-stroke', 4) +
      svgText(baseX + 10, topY + 30, '¼ λ @ 2 m', 'd-text', 'start', 11) +
      svgText(baseX + 10, topY + 46, '¾ λ @ 70 cm', 'd-text', 'start', 11) +
      svgDot(baseX, baseY) +
      // Long 2 m radial pair (slightly longer lines) + short 70 cm pair.
      svgLine(baseX, baseY, baseX - 76, baseY + 40, 'd-stroke-alt', 2.5) +
      svgLine(baseX, baseY, baseX + 76, baseY + 40, 'd-stroke-alt', 2.5) +
      svgLine(baseX, baseY, baseX - 28, baseY + 44, 'd-stroke', 2.5) +
      svgLine(baseX, baseY, baseX + 28, baseY + 44, 'd-stroke', 2.5) +
      dimV(238, topY, baseY, main(res, 'Shared whip', units)) +
      svgText(baseX - 84, baseY + 58, main(res, '2 m radials', units), 'd-text', 'middle', 11) +
      svgText(baseX + 84, baseY + 62, main(res, '70 cm radials', units), 'd-text', 'middle', 11) +
      svgText(baseX, baseY + 80, '4 × 2 m + 4 × 70 cm radials, one 50 Ω feed', 'd-strong', 'middle', 12) +
      svgLine(70, 250, 570, 250, 'd-faint d-dash', 1.5) +
      svgText(574, 254, 'ground', 'd-text', 'start', 11) +
      svgText(baseX + 12, baseY + 24, 'feed', 'd-text', 'start', 12);
    return svgWrap(inner, 270);
  }

  /* RF radiation pattern panel — instrument-style renderers.
   * Everything is pure string building, matching the rest of app.js. */

  var PAT_RING_DB = [0, -3, -6, -10, -15, -20, -25, -30];
  var PAT_COMPASS = [[0, 'N'], [45, 'NE'], [90, 'E'], [135, 'SE'],
    [180, 'S'], [225, 'SW'], [270, 'W'], [315, 'NW']];

  /** dB → radius on a plot whose rim is 0 dB and whose centre is the floor. */
  function patRadius(db, R, floor) {
    return R * (1 + Math.max(db, floor) / -floor);
  }

  /** dB → fractional radius, shared by the polar and cartesian plots. */
  function patFrac(db, floor) { return Math.max(0, 1 + db / -floor); }

  /** Polar point for a bearing in degrees, 0° up and clockwise. */
  function patPoint(cx, cy, r, deg) {
    var a = (deg - 90) * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  /** Elevation point: 0° sits on the horizon (straight right), 90° points at
   *  the zenith (straight up), so the half-plane opens upward. */
  function patElPoint(cx, cy, r, elevDeg) {
    var a = -elevDeg * Math.PI / 180;
    return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
  }

  /** Trace one elevation cut as a filled, mirrored half-plane lobe. */
  function patElLobePath(cx, cy, R, floor, cut) {
    var d = 'M' + cx + ' ' + cy, k, r, p, q;
    for (k = 0; k < cut.length; k++) {
      r = patRadius(cut[k].db, R, floor);
      p = patElPoint(cx, cy, r, cut[k].deg);
      d += 'L' + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    }
    for (k = cut.length - 1; k >= 0; k--) {
      r = patRadius(cut[k].db, R, floor);
      q = patElPoint(cx, cy, r, cut[k].deg);
      d += 'L' + (2 * cx - q.x).toFixed(2) + ' ' + q.y.toFixed(2);   // mirror across the vertical
    }
    return d + 'Z';
  }

  /** Azimuth rose: dB rings, compass rose, lobe fill, peak and null markers. */
  function polarRose(pat, geom) {
    var cx = geom.cx, cy = geom.cy, R = geom.R, floor = pat.azimuth.floorDb;
    var s = '', i, ri, db, r, pt, text;

    for (ri = 0; ri < PAT_RING_DB.length; ri++) {
      db = PAT_RING_DB[ri];
      r = patRadius(db, R, floor);
      s += svgCircle(cx, cy, r, db === 0 ? 'p-ring-zero' : (db % 10 === 0 ? 'p-ring' : 'p-ring-minor'));
      // Label the major rings only — minors stay as unlabeled 5 dB ticks.
      if (db % 10 === 0) {
        text = db === 0 ? '0' : String(db);
        s += svgText(cx + 5, cy - r + 11, text, 'p-ring-label', 'start', 9);
      }
    }

    for (i = 0; i < PAT_COMPASS.length; i++) {
      pt = patPoint(cx, cy, R, PAT_COMPASS[i][0]);
      s += svgLine(cx, cy, pt.x, pt.y, 'p-spoke', 0.6);
      var outer = patPoint(cx, cy, R + 15, PAT_COMPASS[i][0]);
      s += svgText(outer.x, outer.y + 3, PAT_COMPASS[i][1], 'p-compass', 'middle', 10);
      s += svgText(outer.x, outer.y + 14, PAT_COMPASS[i][0] + '°', 'p-compass-deg', 'middle', 8);
    }

    // Lobe body: fan the samples out from the centre so the shape reads as an area.
    var d = 'M' + cx + ' ' + cy, k, p;
    for (k = 0; k < pat.az.length; k++) {
      r = patRadius(pat.az[k].db, R, floor);
      p = patPoint(cx, cy, r, pat.az[k].deg);
      d += 'L' + p.x.toFixed(2) + ' ' + p.y.toFixed(2);
    }
    s += '<path class="p-fill" d="' + d + 'Z"/>';
    s += '<path class="p-lobe" d="' + d + 'Z" fill="none"/>';

    // Main lobe pointer, and the −3 dB arc that measures the beamwidth.
    var peak = pat.azimuth.peakDeg;
    p = patPoint(cx, cy, patRadius(0, R, floor), peak);
    s += svgLine(cx, cy, p.x, p.y, 'p-peak-ray', 1);
    s += svgMarker(p.x, p.y, 'p-peak-dot');
    s += svgText(p.x + (peak > 90 && peak < 270 ? 8 : -8), p.y - 7,
      pat.azimuth.omnidirectional ? 'omni' : peak + '°', 'p-peak-label',
      (peak > 90 && peak < 270 ? 'start' : 'end'), 10);

    if (pat.azimuth.beamwidthDeg !== null) {
      var half = pat.azimuth.beamwidthDeg / 2;
      var arcR = patRadius(-3, R, floor);
      s += patArc(cx, cy, arcR, peak - half, peak + half, 'p-bw-arc');
      // Label the ends of the arc, just inside it — labelling at the compass ring
      // radius puts the text on top of the N/NE/NW markers.
      var lbl = patRadius(-7, R, floor);
      var l = patPoint(cx, cy, lbl, peak - half), rr2 = patPoint(cx, cy, lbl, peak + half);
      s += svgText(l.x, l.y - 4, '−3 dB', 'p-bw-label', 'middle', 8);
      s += svgText(rr2.x, rr2.y - 4, '−3 dB', 'p-bw-label', 'middle', 8);
    }

    // Null ticks for the deep bearings.
    var nulls = pat.azimuth.nullText ? pat.azimuth.nullText.split(/[,–]/) : [];
    for (i = 0; i < nulls.length; i++) {
      var nd = parseFloat(nulls[i]);
      if (!isFinite(nd)) continue;
      var np = patPoint(cx, cy, patRadius(-30, R, floor), nd);
      s += svgMarker(np.x, np.y, 'p-null-dot');
    }
    return s;
  }

  /** SVG arc helper (degrees, clockwise from up). */
  function patArc(cx, cy, r, fromDeg, toDeg, cls) {
    var a = patPoint(cx, cy, r, fromDeg), b = patPoint(cx, cy, r, toDeg);
    var large = Math.abs(toDeg - fromDeg) > 180 ? 1 : 0;
    var sweep = toDeg > fromDeg ? 1 : 0;
    return '<path class="' + cls + '" d="M' + a.x.toFixed(2) + ' ' + a.y.toFixed(2) +
      'A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 ' + large + ' ' + sweep + ' ' +
      b.x.toFixed(2) + ' ' + b.y.toFixed(2) + '" fill="none"/>';
  }

  /** Elevation half-plane: 0° horizon to 90° zenith, rings shared with the rose. */
  function polarElevation(pat, geom) {
    var cx = geom.cx, cy = geom.cy, R = geom.R, floor = pat.elevation.floorDb;
    var s = '', i, ri, db, r, ang, p;

    for (ri = 0; ri < PAT_RING_DB.length; ri++) {
      db = PAT_RING_DB[ri];
      r = patRadius(db, R, floor);
      s += svgCircle(cx, cy, r, db === 0 ? 'p-ring-zero' : (db % 10 === 0 ? 'p-ring' : 'p-ring-minor'));
      // Label the rings down the empty axis below the centre. The upward axis is
      // the 90° spoke, so a label placed there lands on top of the zenith tick.
      s += svgText(cx + 5, cy + r - 3, db === 0 ? '0' : String(db), 'p-ring-label', 'start', 9);
    }

    // Mirror the elevation cut to both sides of the vertical so the lobe reads
    // as a real 3-D slice rather than a single ray.
    var lobeD = patElLobePath(cx, cy, R, floor, pat.el);
    s += svgPath(lobeD, 'p-fill');
    s += svgPath(lobeD, 'p-lobe');

    if (pat.el2) {
      s += svgPath(patElLobePath(cx, cy, R, floor, pat.el2), 'p-lobe2');
    }

    // Horizon guide across the middle; zenith guide up the vertical.
    s += svgLine(cx - R - 12, cy, cx + R + 12, cy, 'p-horizon', 1.2);
    var spokes = [0, 15, 30, 45, 60, 75, 90];
    for (i = 0; i < spokes.length; i++) {
      p = patElPoint(cx, cy, R, spokes[i]);
      var inner = patElPoint(cx, cy, 7, spokes[i]);
      s += svgLine(inner.x.toFixed(1), inner.y.toFixed(1), p.x.toFixed(1), p.y.toFixed(1), 'p-spoke', 0.6);
    }
    // Spoke labels hug the 0 dB rim but sit *inside* it, so the horizon and
    // zenith captions (drawn just outside) never collide with them.
    for (i = 0; i < spokes.length; i++) {
      var lp = patElPoint(cx, cy, R - 13, spokes[i]);
      s += svgText(lp.x.toFixed(1), (lp.y + 3).toFixed(1), spokes[i] + '°', 'p-compass-deg', 'middle', 8);
    }
    s += svgText(cx + R + 30, cy + 3.5, 'horizon', 'p-compass', 'start', 9);
    s += svgText(cx, cy - R - 22, 'zenith', 'p-compass', 'middle', 9);

    // Peak / takeoff pointer. The angle read-out sits in a fixed callout in the
    // empty lower-left quadrant with a leader line back to the peak dot. Placing
    // it along the ray let it land on top of the spoke labels (and the 0°/15°/30°
    // ticks) whenever the takeoff angle happened to fall near one of them.
    var peak = pat.elevation.peakDeg;
    var rimPt = patElPoint(cx, cy, patRadius(0, R, floor), peak);
    s += svgLine(cx, cy, rimPt.x.toFixed(2), rimPt.y.toFixed(2), 'p-peak-ray', 1);
    s += svgMarker(rimPt.x, rimPt.y, 'p-peak-dot');
    var boxX = cx - R + 10, boxY = cy + 30;
    s += svgLine((boxX - 5).toFixed(1), (boxY - 4).toFixed(1),
      rimPt.x.toFixed(1), rimPt.y.toFixed(1), 'p-leader', 0.7);
    s += svgText(boxX.toFixed(1), boxY.toFixed(1), 'takeoff ' + peak + '°',
      'p-peak-label', 'start', 10);
    return s;
  }

  /** Cartesian dB-vs-angle plot — the classic engineering view of one cut.
   *
   *  `axes: false` draws the trace only, for a second band overlaid on the same
   *  frame. The 0 dB line is kept clear of the title band: the peak of any cut
   *  sits on it, and its label needs room to the left and above. */
  function patCartesian(cut, opts) {
    var o = opts || {};
    var axes = o.axes !== false;
    var L = 44, T = 34, W = 236, H = 136, floor = o.floor;
    var maxDeg = o.maxDeg;
    var x = function (deg) { return L + (deg / maxDeg) * W; };
    var y = function (db) { return T + H * (1 - (db - floor) / -floor); };
    var s = '', i, db, p;

    if (axes) {
      s += svgPath('M' + L + ' ' + T + 'h' + W + 'v' + H + 'h' + (-W) + 'Z', 'p-plot-frame');

      for (db = 0; db >= floor; db -= 5) {
        s += svgLine(L, y(db).toFixed(1), (L + W).toFixed(1), y(db).toFixed(1),
          db % 10 === 0 ? 'p-plot-grid' : 'p-plot-grid-minor', 0.8);
        if (db % 10 === 0) s += svgText(L - 6, (y(db) + 3.5).toFixed(1), String(db), 'p-axis-label', 'end', 9);
      }
      for (i = 0; i <= maxDeg; i += o.step) {
        s += svgLine(x(i).toFixed(1), T, x(i).toFixed(1), (T + H).toFixed(1), 'p-plot-grid-minor', 0.8);
        if (i % (o.step * 2) === 0) {
          s += svgText(x(i).toFixed(1), (T + H + 13).toFixed(1), i + '°', 'p-axis-label', 'middle', 9);
        }
      }
    }

    // Trace, then the filled area down to the floor.
    var d = '', area = '';
    for (i = 0; i < cut.length; i++) {
      db = Math.max(cut[i].db, floor);
      p = x(cut[i].deg).toFixed(2) + ' ' + y(db).toFixed(2);
      d += (i ? 'L' : 'M') + p;
      area += (i ? 'L' : 'M') + p;
    }
    area += 'L' + x(cut[cut.length - 1].deg).toFixed(2) + ' ' + y(floor).toFixed(2) +
      'L' + x(cut[0].deg).toFixed(2) + ' ' + y(floor).toFixed(2) + 'Z';
    s += svgPath(area, o.dashed ? 'p-fill2' : 'p-fill');
    s += svgPath(d, o.dashed ? 'p-lobe2' : 'p-lobe');

    if (axes) {
      // −3 dB marker at the peak with the beamwidth bracket.
      var peakIdx = 0, pv = -99;
      for (i = 0; i < cut.length; i++) if (cut[i].db > pv) { pv = cut[i].db; peakIdx = i; }
      var px = x(cut[peakIdx].deg), py = y(pv);
      s += svgMarker(px, py, 'p-peak-dot');
      // Anchor the peak label inside the frame: a 0° peak would otherwise run
      // left, out over the dB axis labels.
      var lab = 'peak ' + cut[peakIdx].deg + '° / ' + pv.toFixed(1) + ' dB';
      var anchor = 'start', lx = px + 7;
      if (px + 7 + lab.length * 5 > L + W) { anchor = 'end'; lx = px - 7; }
      s += svgText(lx.toFixed(1), (py - 6).toFixed(1), lab, 'p-peak-label', anchor, 9);

      var bw = o.beamwidthDeg;
      if (bw !== null && bw !== undefined) {
        var y3 = y(pv - 3);
        s += svgLine((px - (bw / maxDeg) * W / 2).toFixed(1), y3.toFixed(1),
          (px + (bw / maxDeg) * W / 2).toFixed(1), y3.toFixed(1), 'p-bw-arc', 1);
        // Keep the centred label within the frame so it cannot land on the axis.
        var half = 26;
        s += svgText(Math.min(Math.max(px, L + half), L + W - half).toFixed(1),
          (y3 - 5).toFixed(1), '−3 dB · ' + bw + '°', 'p-bw-label', 'middle', 8);
      }
      s += svgText(L, (T + H + 27).toFixed(1), o.xLabel, 'p-axis-title', 'start', 9);
      s += svgText(L - 6, (T - 6).toFixed(1), 'dB', 'p-axis-title', 'end', 9);
    }
    return s;
  }

  /** One metric cell in the read-out grid. */
  function patStat(label, value, unit, hint) {
    return '<div class="pat-stat">' +
      '<dt class="pat-stat-k">' + escapeHtml(label) + '</dt>' +
      '<dd class="pat-stat-v">' + escapeHtml(value) +
      (unit ? ' <span class="pat-stat-u">' + escapeHtml(unit) + '</span>' : '') +
      (hint ? '<span class="pat-stat-h">' + escapeHtml(hint) + '</span>' : '') +
      '</dd></div>';
  }

  /** Lead with the headline dBi figure from a prose gain string. */
  function patGainShort(gainText) {
    var m = /≈?\s*([\d.]+)(?:–([\d.]+))?\s*dBi/.exec(gainText);
    if (m) return '≈ ' + m[1] + (m[2] ? '–' + m[2] : '') + ' dBi';
    return gainText;
  }

  /** Whatever the gain string says *about* the number, once the figure is shown. */
  function patGainBasis(gainText) {
    var m = /≈?\s*[\d.]+(?:–[\d.]+)?\s*dBi\s*([\s\S]*)$/.exec(gainText);
    var tail = m ? m[1].replace(/^[\s,;—-]+/, '') : '';
    return tail || 'analytic estimate';
  }

  /** dB read-out with a fixed sign, so ratios scan consistently. */
  function patDb(v) { return v === null || v === undefined ? '—' : (v > 0 ? '+' : '') + v.toFixed(1); }

  /** Read-out grid: the numbers an operator actually wants from a pattern. */
  function patStatsGrid(pat) {
    var az = pat.azimuth, el = pat.elevation;
    var s = '<dl class="pat-stats">';
    s += patStat('Polarization', pat.polarization, '', 'relative to the ground');
    s += patStat('Pattern class', pat.directional ? 'directional beam' :
      (az.omnidirectional ? 'omnidirectional' : 'bidirectional'), '',
      pat.directional ? 'one main lobe' :
        (az.omnidirectional ? 'no azimuth nulls' : 'nulls off the element ends'));
    s += patStat('Peak gain', patGainShort(pat.gainText), '', patGainBasis(pat.gainText));
    s += patStat('Azimuth peak bearing', az.peakDeg + '°', 'from north', 'main lobe centre');
    s += patStat('Azimuth −3 dB beamwidth', az.beamwidthDeg === null ? '360° (omni)' : az.beamwidthDeg + '°', '',
      az.beamwidthDeg === null ? 'no azimuth nulls' :
        (az.beamwidthDeg2 !== null && az.beamwidthDeg2 !== undefined && az.lobeCount > 1 ?
          'per lobe · both lobes ' + az.beamwidthDeg2 + '°' : 'half-power width'));
    if (az.omnidirectional) {
      // A 0 dB ratio on a round pattern says nothing — label it instead of implying performance.
      s += patStat('Front-to-back', 'n/a (omni)', '', 'a round pattern has no front or back');
      s += patStat('Front-to-side', 'n/a (omni)', '', 'equal signal in every direction');
    } else {
      s += patStat('Front-to-back', patDb(az.frontToBackDb), 'dB', '0° vs 180°');
      s += patStat('Front-to-rear (worst)', patDb(az.frontToRearDb), 'dB', '0° vs best of 90°–270°');
      s += patStat('Front-to-side', patDb(az.frontToSideDb), 'dB', '0° vs best of 80°–100°');
    }
    s += patStat('Azimuth nulls', az.omnidirectional ? 'none — omni' : (az.nullText || 'none below −20 dB'), '',
      'deepest sample −' + Math.abs(pat.nullDepthDb) + ' dB');
    s += patStat('Takeoff angle', el.peakDeg + '°', 'elevation', 'strongest ray above the horizon');
    s += patStat('Elevation −3 dB beamwidth', el.beamwidthDeg === null ? '—' : el.beamwidthDeg + '°', '',
      'vertical lobe width');
    s += patStat('Elevation lobes', el.lobeCount + '', '', el.lobes || 'horizon doughnut');
    s += patStat('Ground model', 'perfect ground', '', 'no losses, no terrain');
    s += patStat('Normalization', '0 dB = peak', '', 'rings every 5 dB to −' + Math.abs(az.floorDb) + ' dB');
    return s + '</dl>';
  }

  /** CSV of every sample, so a pattern can leave the browser as data.
   *  Wide layout (one row per angle) because azimuth and elevation are sampled
   *  at different steps; blank cells mean "not sampled at this angle". */
  function patternCsv(pat) {
    var rows = ['angle_deg,azimuth_db,elevation_db' + (pat.el2 ? ',elevation_band2_db' : '')];
    var i, azDb = '', elDb = '', el2Db = '';
    for (i = 0; i < Math.max(pat.az.length, pat.el.length); i++) {
      azDb = i < pat.az.length ? pat.az[i].db.toFixed(1) : '';
      elDb = i < pat.el.length ? pat.el[i].db.toFixed(1) : '';
      if (pat.el2) el2Db = ',' + (i < pat.el2.length ? pat.el2[i].db.toFixed(1) : '');
      rows.push((i < pat.az.length ? pat.az[i].deg : '') + ',' + azDb + ',' + elDb + el2Db);
    }
    return rows.join('\n');
  }

  /** Filesystem-safe stem for the CSV download. */
  function patternFileStem(pat) {
    var f = state.f;
    return pat.id + '-' + (isFinite(f) ? String(Math.round(f * 1000)) : 'pattern') + 'MHz';
  }

  /** Collapsible data table + CSV export, so the sketch is analysable offline. */
  function patDataDetails(pat) {
    var head = '<tr><th scope="col">Angle (°)</th><th scope="col">Azimuth (dB)</th>' +
      '<th scope="col">Elevation (dB)</th>' +
      (pat.el2 ? '<th scope="col">Elevation, band 2 (dB)</th>' : '') + '</tr>';
    var body = '', i, cells;
    for (i = 0; i < Math.max(pat.az.length, pat.el.length); i++) {
      cells = (i < pat.az.length ? pat.az[i].deg : '') + '</td><td>' +
        (i < pat.az.length ? pat.az[i].db.toFixed(1) : '');
      cells = '<td>' + cells + '</td><td>' +
        (i < pat.el.length ? pat.el[i].db.toFixed(1) : '');
      if (pat.el2) cells += '</td><td>' + (i < pat.el2.length ? pat.el2[i].db.toFixed(1) : '');
      body += '<tr>' + cells + '</td></tr>';
    }
    return '<details class="pat-data">' +
      '<summary>Pattern data table &amp; CSV export</summary>' +
      '<div class="pat-data-actions">' +
      '<button type="button" class="btn pat-csv" data-stem="' + escapeHtml(patternFileStem(pat)) + '">' +
      'Export CSV</button>' +
      '<span class="hint">' + pat.az.length + ' azimuth + ' + pat.el.length +
      ' elevation samples, 0 dB = peak.</span>' +
      '</div>' +
      '<div class="pat-table-scroll"><table class="pat-table"><thead>' + head +
      '</thead><tbody>' + body + '</tbody></table></div>' +
      '</details>';
  }

  /** Hand the CSV to the browser as a download, with a clipboard fallback. */
  function exportPatternCsv(pat, btn) {
    var csv = patternCsv(pat);
    var name = patternFileStem(pat) + '-pattern.csv';
    try {
      if (window.URL && window.URL.createObjectURL && window.Blob) {
        var url = window.URL.createObjectURL(new window.Blob([csv], { type: 'text/csv' }));
        var a = document.createElement('a');
        a.href = url;
        a.download = name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 0);
        return true;
      }
    } catch (e) { /* fall through to the clipboard path */ }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(csv).then(
        function () { if (btn) btn.textContent = 'CSV copied ✓'; },
        function () { if (btn) btn.textContent = 'Copy blocked'; }
      );
      window.setTimeout(function () { if (btn) btn.textContent = 'Export CSV'; }, 1800);
      return true;
    }
    return false;
  }

  /** Full pattern panel: rose, elevation slice, cartesian cut, metric grid. */
  function patternHtml(pat) {
    var rose = '<svg class="pat-svg" viewBox="0 0 400 380" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Azimuth radiation pattern">' +
      svgText(200, 16, 'AZIMUTH — top-down', 'p-plot-title', 'middle', 11) +
      polarRose(pat, { cx: 200, cy: 196, R: 122 }) +
      svgText(200, 372, '0° up · bearings clockwise · rings every 5 dB', 'p-axis-title', 'middle', 9) +
      '</svg>';

    var elTitle = pat.id === 'dualBandVertical' ?
      'ELEVATION — 2 m solid · 70 cm dashed' : 'ELEVATION — side view';
    var elSvg = '<svg class="pat-svg" viewBox="0 0 400 380" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Elevation radiation pattern">' +
      svgText(200, 16, elTitle, 'p-plot-title', 'middle', 11) +
      polarElevation(pat, { cx: 200, cy: 236, R: 122 }) +
      svgText(200, 372, '0° = horizon · 90° = zenith', 'p-axis-title', 'middle', 9) +
      '</svg>';

    var el2 = pat.el2 || null;
    var cart = '<svg class="pat-svg" viewBox="0 0 300 210" preserveAspectRatio="xMidYMid meet" role="img" ' +
      'aria-label="Elevation gain against angle">' +
      svgText(150, 12, 'ELEVATION vs ANGLE', 'p-plot-title', 'middle', 11) +
      patCartesian(pat.el, {
        floor: pat.elevation.floorDb, maxDeg: 90, step: 15,
        beamwidthDeg: pat.elevation.beamwidthDeg, xLabel: 'elevation angle'
      });
    if (el2) {
      // Second band shares the frame: trace only, so nothing is drawn twice.
      cart += patCartesian(el2, {
        floor: pat.elevation.floorDb, maxDeg: 90, dashed: true, axes: false
      });
    }
    cart += '</svg>';

    var legend = '<ul class="pat-legend">' +
      '<li><span class="pat-swatch pat-swatch-lobe"></span>azimuth / elevation envelope</li>' +
      '<li><span class="pat-swatch pat-swatch-peak"></span>peak lobe</li>' +
      '<li><span class="pat-swatch pat-swatch-null"></span>null (&le; &minus;20 dB)</li>' +
      '<li><span class="pat-swatch pat-swatch-bw"></span>&minus;3 dB beamwidth</li>' +
      (el2 ? '<li><span class="pat-swatch pat-swatch-alt"></span>second band (dashed)</li>' : '') +
      '</ul>';

    var caption = escapeHtml(pat.caption) +
      ' Idealized teaching sketch over perfect ground, not a NEC model — confirm real builds in ' +
      'MMANA-GAL, EZNEC or 4nec2.';
    if (caption.indexOf(escapeHtml(pat.gainText)) === 0) caption = caption.slice(escapeHtml(pat.gainText).length + 2);

    var klass = pat.directional ? 'directional beam' :
      (pat.azimuth.omnidirectional ? 'omnidirectional' : 'bidirectional');

    return '<div class="pattern">' +
      '<div class="pat-head">' +
      '<span class="pat-head-title">Radiation pattern</span>' +
      '<span class="pat-chip">' + escapeHtml(klass) + '</span>' +
      '<span class="pat-chip pat-chip-ghost">idealized · perfect ground</span>' +
      '<span class="pat-head-meta">' + escapeHtml(pat.polarization) + ' · 0 dB = peak</span>' +
      '</div>' +
      '<div class="pat-plots">' +
      '<div class="pat-cell">' + rose + '</div>' +
      '<div class="pat-cell">' + elSvg + '</div>' +
      '<div class="pat-cell pat-cell-cart">' + cart + '</div>' +
      '</div>' +
      legend +
      '<div class="pat-readout">' +
      '<h5 class="pat-sub">Pattern read-out</h5>' +
      patStatsGrid(pat) +
      '</div>' +
      '<p class="hint pat-note">' + caption + '</p>' +
      patDataDetails(pat) +
      '</div>';
  }

  var DIAGRAMS = {
    dipole: diagramDipole,
    invertedV: diagramInvertedV,
    foldedDipole: diagramDipole,
    efhw: diagramEfhw,
    quarterWaveVertical: diagramVertical,
    halfWaveVertical: diagramVertical,
    fiveEighthVertical: diagramVertical,
    dualBandVertical: diagramDualBand,
    yagi: diagramYagi,
    fullWaveLoop: diagramLoop,
    cubicalQuad: diagramQuad
  };

  /* ------------------------------------------------------------------ *
   * Rendering
   * ------------------------------------------------------------------ */

  function escapeHtml(text) {
    return String(text === undefined || text === null ? '' : text)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function typeById(id) {
    var i;
    for (i = 0; i < TYPES.length; i++) if (TYPES[i].id === id) return TYPES[i];
    return TYPES[0];
  }

  function metaLine(res) {
    var line = fixed(res.f, 3) + ' MHz';
    if (typeof res.f2 === 'number' && isFinite(res.f2)) line += ' + ' + fixed(res.f2, 3) + ' MHz';
    return line + '  ·  λ = ' + fixed(res.lambda.m) + ' m (' + fixed(res.lambda.ft) + ' ft)' +
      '  ·  length factor ' + res.factor.toFixed(2);
  }

  function rowsHtml(res, units) {
    var html = '', i, r, f;
    for (i = 0; i < res.rows.length; i++) {
      r = res.rows[i];
      if (typeof r.ft === 'number') {
        f = formatLength(r.ft, units);
        html += '<div class="pat-card"><div class="pat-card-title">' + escapeHtml(r.label) +
          (r.note ? '<span class="pat-card-note">' + escapeHtml(r.note) + '</span>' : '') +
          '</div><table><thead><tr><th>Value</th></tr></thead><tbody><tr><td>' +
          escapeHtml(f.main) + '</td></tr></tbody></table></div>';
      } else {
        html += '<div class="pat-card pat-card-plain"><div class="pat-card-title">' + escapeHtml(r.label) +
          (r.note ? '<span class="pat-card-note">' + escapeHtml(r.note) + '</span>' : '') +
          '</div><div><span class="main">' + escapeHtml(r.text || '—') + '</span></div></div>';
      }
    }
    return html;
  }

  function listHtml(items) {
    var html = '', i;
    for (i = 0; i < items.length; i++) html += '<li>' + escapeHtml(items[i]) + '</li>';
    return html;
  }

  /** Plain-text version of a result, for the copy button. */
  function summaryText(res, units) {
    var lines = [];
    lines.push('Ham Antenna Calculator — ' + res.title);
    lines.push(metaLine(res) + '  ·  units: ' + (units === 'm' ? 'metres' : 'feet'));
    lines.push('');
    var i, r, f;
    for (i = 0; i < res.rows.length; i++) {
      r = res.rows[i];
      if (typeof r.ft === 'number') {
        f = formatLength(r.ft, units);
        lines.push(r.label + ': ' + f.main + '  (' + f.sub + ')');
      } else {
        lines.push(r.label + ': ' + r.text);
      }
    }
    lines.push('');
    lines.push('Notes:');
    for (i = 0; i < res.notes.length; i++) lines.push('- ' + res.notes[i]);
    lines.push('');
    lines.push('Starting dimensions only — cut long, then trim for resonance. Verify with antenna modelling software.');
    lines.push('Model v' + MODEL_VERSION + ' — ' + PATTERN_DISCLAIMER);
    return lines.join('\n');
  }

  function render() {
    var res, pat, diagram, d = dom;
    try {
      res = A.calc(state.type, state);
      pat = A.radiationPattern ? A.radiationPattern(state.type, state) : null;
    } catch (e) {
      d.title.textContent = 'Check your inputs';
      d.summary.textContent = '';
      d.meta.textContent = '';
      d.diagram.innerHTML = '';
      d.rows.innerHTML = '<p class="hint">' + escapeHtml(e.message || 'Invalid input') + '</p>';
      d.notes.innerHTML = '';
      d.formulas.innerHTML = '';
      if (d.pattern) { d.pattern.innerHTML = ''; d.pattern.style.display = 'none'; }
      if (d.patHeightWrap) d.patHeightWrap.style.display = 'none';
      return;
    }

    var type = typeById(state.type);
    d.title.textContent = res.title;
    d.summary.textContent = res.summary;
    d.meta.textContent = metaLine(res) + '  ·  units: ' + (state.units === 'm' ? 'metres' : 'feet');
    d.rows.innerHTML = rowsHtml(res, state.units);
    d.notes.innerHTML = listHtml(res.notes);
    d.formulas.innerHTML = listHtml(res.formulas || []);
    diagram = DIAGRAMS[state.type] ? DIAGRAMS[state.type](res, state.units) : '';
    d.diagram.innerHTML = diagram;
    d.diagram.style.display = diagram ? '' : 'none';
    if (pat && d.pattern) {
      d.pattern.innerHTML = '<h4 class="pattern-title">RF radiation pattern (idealized)</h4>' +
        patternHtml(pat);
      d.pattern.style.display = '';
      if (d.patHeight && d.patHeightWrap) {
        if (pat.heightApplies) {
          d.patHeight.value = String(pat.heightLambda);
          d.patHeightValue.textContent = pat.heightLambda.toFixed(2) + ' λ';
          d.patHeightWrap.style.display = '';
        } else {
          d.patHeightWrap.style.display = 'none';
        }
      }
    } else if (d.pattern) {
      d.pattern.innerHTML = '';
      d.pattern.style.display = 'none';
      if (d.patHeightWrap) d.patHeightWrap.style.display = 'none';
    }
    lastResult = res;
    lastType = type;
    lastPattern = pat || null;
    renderStatusBar(res, pat);
  }

  var lastResult = null, lastType = null, lastPattern = null;

  /** Sticky instrument read-out: what produced the numbers on screen. */
  function renderStatusBar(res, pat) {
    if (!dom.statusbar) return;
    if (dom.footVersion) dom.footVersion.textContent = 'v' + MODEL_VERSION;
    var span = '<span class="sb-sep">·</span>';
    var f = state.f;
    var parts = [];
    parts.push('f <b>' + (isFinite(f) ? f.toFixed(3) + ' MHz' : '—') + '</b>');
    if (res && res.lambda) {
      parts.push('λ <b>' + res.lambda.ft.toFixed(2) + ' ft</b>');
    }
    if (state.type === 'dualBandVertical' && isFinite(state.f2)) {
      parts.push('f₂ <b>' + state.f2.toFixed(3) + ' MHz</b>');
    }
    parts.push('k <b>' + state.factor.toFixed(2) + '</b>');
    if (pat && pat.heightApplies) {
      parts.push('h <b>' + pat.heightLambda.toFixed(2) + ' λ</b>');
    }
    if (pat) {
      parts.push('model <b class="sb-model">' + (pat.directional ? 'directional' : 'omni') +
        ' · analytic</b>');
    }
    dom.statusbar.innerHTML = parts.join(span) + span +
      'v<b>' + MODEL_VERSION + '</b>';
  }

  /* ------------------------------------------------------------------ *
   * Controls
   * ------------------------------------------------------------------ */

  var dom = {};

  function $(id) { return document.getElementById(id); }

  function syncTabs() {
    var i, btns = dom.tabs.querySelectorAll('.tab');
    for (i = 0; i < btns.length; i++) {
      btns[i].setAttribute('aria-selected', btns[i].getAttribute('data-id') === state.type ? 'true' : 'false');
    }
  }

  function buildTabs() {
    var html = '', i, t;
    for (i = 0; i < TYPES.length; i++) {
      t = TYPES[i];
      html += '<button type="button" class="tab" role="tab" data-id="' + t.id +
        '" aria-selected="false">' + escapeHtml(t.label) + '</button>';
    }
    dom.tabs.innerHTML = html;
    syncTabs();
  }

  function syncBand() {
    var i, matched = '', b, f2;
    var dualMode = state.type === 'dualBandVertical';
    for (i = 0; i < A.BANDS.length; i++) {
      b = A.BANDS[i];
      var isDual = !(b.f2 === undefined || b.f2 === null);
      if (dualMode && !isDual) continue;   // dual tab only matches dual presets
      if (!dualMode && isDual) continue;   // single-band tabs ignore dual presets
      if (Math.abs(b.mhz - state.f) >= 0.0005) continue;
      if (!isDual) {
        if (!matched) matched = String(b.mhz);
      } else {
        f2 = typeof state.f2 === 'number' ? state.f2 : NaN;
        if (Math.abs(b.f2 - f2) < 0.0005) { matched = String(b.mhz) + '|' + String(b.f2); break; }
      }
    }
    dom.band.value = matched;
  }

  function buildBands() {
    var html = '<option value="">Custom…</option>', i, b, value, blabel;
    for (i = 0; i < A.BANDS.length; i++) {
      b = A.BANDS[i];
      if (b.f2 === undefined || b.f2 === null) {
        value = String(b.mhz);
        blabel = b.label + ' — ' + b.mhz.toFixed(3) + ' MHz';
      } else {
        value = String(b.mhz) + '|' + String(b.f2);
        blabel = b.label + ' — ' + b.mhz.toFixed(3) + ' + ' + b.f2.toFixed(3) + ' MHz';
      }
      html += '<option value="' + value + '">' + escapeHtml(blabel) + '</option>';
    }
    dom.band.innerHTML = html;
    syncBand();
  }

  function syncExtras() {
    var type = typeById(state.type), opts = type.options || [], html = '', i, j, inputs, input, div;
    for (i = 0; i < opts.length; i++) html += OPTION_HTML[opts[i]] || '';
    dom.extra.innerHTML = html;
    inputs = dom.extra.querySelectorAll('[data-key]');
    for (j = 0; j < inputs.length; j++) {
      input = inputs[j];
      div = parseFloat(input.getAttribute('data-divisor') || '1');
      if (typeof state[input.getAttribute('data-key')] === 'number') {
        input.value = String(+(state[input.getAttribute('data-key')] * div).toFixed(6));
      }
    }
    dom.extra.style.display = html ? '' : 'none';
  }

  function syncUnits() {
    var ft = state.units === 'ft';
    dom.unitsFt.className = 'seg-btn' + (ft ? ' is-active' : '');
    dom.unitsM.className = 'seg-btn' + (ft ? '' : ' is-active');
    dom.unitsFt.setAttribute('aria-checked', ft ? 'true' : 'false');
    dom.unitsM.setAttribute('aria-checked', ft ? 'false' : 'true');
  }

  function syncControls() {
    dom.freq.value = String(state.f);
    dom.factor.value = String(state.factor);
    dom.factorValue.textContent = state.factor.toFixed(2);
    syncUnits();
    syncTabs();
    syncBand();
    syncExtras();
  }

  function update() {
    render();
    saveState();
  }

  /* ------------------------------------------------------------------ *
   * Events
   * ------------------------------------------------------------------ */

  function fallbackCopy(text) {
    var ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '-1000px';
    document.body.appendChild(ta);
    ta.select();
    var ok = false;
    try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
    document.body.removeChild(ta);
    return ok;
  }

  function copySummary() {
    if (!lastResult) return;
    var text = summaryText(lastResult, state.units);
    var done = function (ok) {
      dom.copy.textContent = ok ? 'Copied ✓' : 'Press Ctrl+C';
      window.setTimeout(function () { dom.copy.textContent = 'Copy results'; }, 1800);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(
        function () { done(true); },
        function () { done(fallbackCopy(text)); }
      );
    } else {
      done(fallbackCopy(text));
    }
  }

  function bindEvents() {
    dom.tabs.addEventListener('click', function (e) {
      var btn = e.target;
      if (btn && btn.nodeType === 1 && !btn.getAttribute('data-id') && btn.closest) btn = btn.closest('.tab');
      if (!btn || !btn.getAttribute || !btn.getAttribute('data-id')) return;
      state.type = btn.getAttribute('data-id');
      syncTabs();
      syncExtras();
      update();
    });

    dom.band.addEventListener('change', function () {
      if (!dom.band.value) return;
      var parts = String(dom.band.value).split('|');
      state.f = parseFloat(parts[0]);
      if (parts.length > 1) {
        state.f2 = parseFloat(parts[1]);
        if (state.type === 'dipole') state.type = 'dualBandVertical';
      }
      dom.freq.value = String(state.f);
      syncBand();
      syncExtras();
      update();
    });

    dom.freq.addEventListener('input', function () {
      var v = parseFloat(dom.freq.value);
      state.f = isFinite(v) ? v : NaN;      // render() reports the problem
      syncBand();
      if (state.type === 'dualBandVertical') syncExtras();
      update();
    });

    dom.unitsFt.addEventListener('click', function () { state.units = 'ft'; syncUnits(); update(); });
    dom.unitsM.addEventListener('click', function () { state.units = 'm'; syncUnits(); update(); });

    dom.factor.addEventListener('input', function () {
      var v = parseFloat(dom.factor.value);
      if (!isFinite(v)) return;
      state.factor = v;
      dom.factorValue.textContent = v.toFixed(2);
      update();
    });

    if (dom.patHeight) dom.patHeight.addEventListener('input', function () {
      var v = parseFloat(dom.patHeight.value);
      if (!isFinite(v)) return;
      state.patternHeight = Math.min(2.5, Math.max(0.05, v));
      dom.patHeightValue.textContent = state.patternHeight.toFixed(2) + ' λ';
      update();
    });

    dom.extra.addEventListener('input', function (e) {
      var input = e.target;
      if (!input || !input.getAttribute) return;
      var key = input.getAttribute('data-key');
      if (!key) return;
      var div = parseFloat(input.getAttribute('data-divisor') || '1');
      var v = parseFloat(input.value);
      state[key] = isFinite(v) ? v / div : NaN;   // NaN → calculator falls back to its default
      if (key === 'f' && isFinite(state.f)) dom.freq.value = String(state.f);
      if (key === 'f' || key === 'f2') syncBand();
      update();
    });

    dom.copy.addEventListener('click', copySummary);
    if (dom.print) dom.print.addEventListener('click', function () { window.print(); });
    if (dom.pattern) dom.pattern.addEventListener('click', function (e) {
      var btn = e.target;
      if (!btn || !btn.closest) return;
      btn = btn.closest('.pat-csv');
      if (!btn || !lastPattern) return;
      exportPatternCsv(lastPattern, btn);
    });
  }

  /* ------------------------------------------------------------------ *
   * Boot
   * ------------------------------------------------------------------ */

  function applyUrlOverrides() {
    var m = /[?&]ant=([\w-]+)/.exec(window.location.search);
    if (m) {
      var i;
      for (i = 0; i < TYPES.length; i++) {
        if (TYPES[i].id === m[1]) { state.type = m[1]; break; }
      }
    }
    m = /[?&]h=([\d.]+)/.exec(window.location.search);
    if (m) {
      var h = parseFloat(m[1]);
      if (isFinite(h)) state.patternHeight = Math.min(2.5, Math.max(0.05, h));
    }
  }

  function init() {
    dom.tabs = $('tabs');
    if (!dom.tabs) return;                    // not the calculator page
    dom.band = $('band');
    dom.freq = $('freq');
    dom.unitsFt = $('units-ft');
    dom.unitsM = $('units-m');
    dom.factor = $('factor');
    dom.factorValue = $('factor-value');
    dom.extra = $('extra-inputs');
    dom.title = $('ant-title');
    dom.summary = $('ant-summary');
    dom.meta = $('ant-meta');
    dom.diagram = $('diagram');
    dom.pattern = $('pattern');
    dom.statusbar = $('statusbar');
    dom.footVersion = $('foot-version');
    dom.patHeightWrap = $('pat-height-wrap');
    dom.patHeight = $('pat-height');
    dom.patHeightValue = $('pat-height-value');
    dom.rows = $('rows');
    dom.notes = $('notes');
    dom.formulas = $('formulas');
    dom.copy = $('copy');
    dom.print = $('print');

    loadState();
    applyUrlOverrides();
    buildTabs();
    buildBands();
    bindEvents();
    syncControls();
    update();
  }

  /* Debug / test hook — the calculator's data model stays inside this closure. */
  if (typeof window !== 'undefined') {
    window.HamAntennaCalculator = {
      state: state,
      TYPES: TYPES,
      formatLength: formatLength,
      feetInches: feetInches,
      metaLine: metaLine,
      summaryText: summaryText,
      patternHtml: patternHtml,
      MODEL_VERSION: MODEL_VERSION,
      patternCsv: patternCsv,
      patternFileStem: patternFileStem,
      exportPatternCsv: exportPatternCsv,
      lastResult: function () { return lastResult; },
      lastPattern: function () { return lastPattern; }
    };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
