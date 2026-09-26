/* Ham Antenna Calculator — antenna dimension math.
 *
 * Pure functions, no DOM. Loads in the browser as window.Antennas and in Node
 * (for the test suite) via module.exports.
 *
 * Conventions used by every calculator (all lengths returned in FEET, converted
 * by the UI, which also shows metres):
 *
 *   lambda (free space, ft) = 983.5711 / f(MHz)      [299.792458 m/MHz]
 *   wire element length     = ratio * lambda * factor
 *       factor = "length factor" (end effect / insulation), default 0.95
 *       0.5  * lambda * 0.95 = 491.8 * 0.95 = 467.2 ft/f  (the field constant
 *       0.25 * lambda * 0.95 = 245.9 * 0.95 = 233.6 ft/f   468/f and 234/f
 *                                                          correspond to 0.9516)
 *   radial / counterpoise   = free-space quarter wave, 245.9 / f ft
 *                             (~5 % longer than the radiator, standard practice)
 *   full-wave loops / quad  = 1005 / f ft (306 / f m) - the published convention,
 *                             which already includes the loop's end effect, so the
 *                             length factor is NOT applied to loops.
 *
 * Values cross-checked against ARRL Antenna Book practice, DL6WU/Rothammel Yagi
 * design data and common online calculator conventions.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.Antennas = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  /* ------------------------------------------------------------------ *
   * Constants
   * ------------------------------------------------------------------ */

  var C_M_S = 299792458;                     // speed of light, m/s
  var M_PER_FT = 0.3048;
  var M_PER_MHZ = C_M_S / 1e6;               // 299.792458 m per MHz
  var FT_PER_MHZ = M_PER_MHZ / M_PER_FT;     // 983.5711 ft per MHz
  var DEFAULT_FACTOR = 0.95;                 // end effect / insulation
  var LOOP_FT_PER_MHZ = 1005;                // full-wave loop / quad driver loop
  var LOOP_M_PER_MHZ = 306;
  var SQRT2 = Math.SQRT2;

  var BANDS = [
    { label: '160 m', mhz: 1.850 },
    { label: '80 m', mhz: 3.750 },
    { label: '60 m', mhz: 5.357 },
    { label: '40 m', mhz: 7.150 },
    { label: '30 m', mhz: 10.125 },
    { label: '20 m', mhz: 14.175 },
    { label: '17 m', mhz: 18.118 },
    { label: '15 m', mhz: 21.225 },
    { label: '12 m', mhz: 24.940 },
    { label: '10 m', mhz: 28.500 },
    { label: '6 m', mhz: 50.150 },
    { label: '4 m', mhz: 70.200 },
    { label: '2 m', mhz: 145.500 },
    { label: '2 m + 70 cm (dual)', mhz: 145.500, f2: 433.500 },
    { label: '1.25 m', mhz: 223.500 },
    { label: '70 cm', mhz: 433.500 },
    { label: '33 cm', mhz: 915.000 },
    { label: '23 cm', mhz: 1296.000 },
    { label: '13 cm', mhz: 2320.000 }
  ];

  /* ------------------------------------------------------------------ *
   * Helpers
   * ------------------------------------------------------------------ */

  function num(x, fallback) {
    var v = typeof x === 'string' ? parseFloat(x) : x;
    return typeof v === 'number' && isFinite(v) ? v : fallback;
  }

  function freq(opts) {
    var f = num(opts && opts.f, NaN);
    if (!isFinite(f) || f <= 0) throw new Error('A positive frequency in MHz is required.');
    return f;
  }

  function factor(opts) {
    var k = num(opts && opts.factor, DEFAULT_FACTOR);
    return Math.min(1.1, Math.max(0.5, k));
  }

  function wavelength(fMHz) {
    return { ft: FT_PER_MHZ / fMHz, m: M_PER_MHZ / fMHz };
  }

  /** Length in ft of `ratio` wavelengths of wire (ratio 0.5 = half wave). */
  function wireFt(fMHz, ratio, k) {
    return (FT_PER_MHZ / fMHz) * ratio * (k === undefined ? DEFAULT_FACTOR : k);
  }

  /** Free-space length in ft of `ratio` wavelengths (no end-effect factor). */
  function spaceFt(fMHz, ratio) {
    return (FT_PER_MHZ / fMHz) * ratio;
  }

  function ftToM(ft) { return ft * M_PER_FT; }
  function mToFt(m) { return m / M_PER_FT; }

  function round(x, dp) {
    var p = Math.pow(10, dp === undefined ? 2 : dp);
    return Math.round(x * p) / p;
  }

  /** Rule-of-thumb forward gain of a Yagi with `elements` total elements, dBi. */
  function yagiGainDbi(elements) {
    return 10 * Math.log10(Math.max(2, elements)) + 3.2;
  }

  function L(label, ft, note) { return { label: label, ft: ft, note: note }; }
  function T(label, text, note) { return { label: label, text: text, note: note, plain: true }; }

  function wireFormulas(ratioText, ratio) {
    return [
      'Length = ' + round(ratio * FT_PER_MHZ, 1) + ' / f(MHz) ft × length factor   (free-space ' +
        ratioText + 'λ = ' + round(ratio * FT_PER_MHZ, 1) + ' ft = ' + round(ratio * M_PER_MHZ, 1) + ' m)',
      'At the default factor 0.95 → ' + round(ratio * FT_PER_MHZ * DEFAULT_FACTOR, 1) +
        ' / f(MHz) ft = ' + round(ratio * M_PER_MHZ * DEFAULT_FACTOR, 1) + ' / f(MHz) m',
      'λ(free space) = 983.571 / f(MHz) ft = 299.792 / f(MHz) m'
    ];
  }

  /* ------------------------------------------------------------------ *
   * Dipole family
   * ------------------------------------------------------------------ */

  function dipole(opts) {
    var f = freq(opts), k = factor(opts);
    var total = wireFt(f, 0.5, k);
    return {
      id: 'dipole',
      title: 'Half-wave dipole',
      summary: 'Centre-fed half-wave dipole — the reference antenna every other HF design is compared with.',
      rows: [
        L('Total length (tip to tip)', total),
        L('Each leg (feed point to tip)', total / 2),
        T('Feed-point impedance', '≈ 73 Ω in free space', '50–75 Ω at practical heights; use a 1:1 current balun'),
        T('Recommended height', '≥ ¼ λ — ½ λ or more for DX', 'Height sets the radiation angle'),
        L('¼ λ height reference', spaceFt(f, 0.25), 'Minimum height for a clean, low-angle-ish pattern')
      ],
      notes: [
        'Cut 2–3 % long and trim to resonance with an SWR meter or analyser — height, ground and nearby objects all shift the resonant point.',
        'The classic "468 / f(MHz) ft" figure is this formula with the length factor at 0.9516; the 0.95 default lands within 0.2 % of it.',
        'Coil-loaded or trapped dipoles need their own loading calculations; these figures are for full-size wire.'
      ],
      formulas: wireFormulas('½', 0.5)
    };
  }

  function invertedV(opts) {
    var f = freq(opts), k = factor(opts);
    var apex = Math.min(180, Math.max(30, num(opts && opts.apexDeg, 90)));
    // Coupling between the sloping legs shortens the antenna; 180° (flat) = plain dipole.
    var apexFactor = 1 - 0.03 * (Math.pow(90 / apex, 2) - 0.25);
    var total = wireFt(f, 0.5, k) * apexFactor;
    var leg = total / 2;
    var half = (apex / 2) * Math.PI / 180;
    var span = 2 * leg * Math.sin(half);
    var drop = leg * Math.cos(half);
    return {
      id: 'invertedV',
      title: 'Inverted-V dipole',
      summary: 'One centre support, two sloping legs — a quiet, single-mast half-wave antenna.',
      rows: [
        L('Total wire length', total, 'Apex to both end insulators'),
        L('Each leg', leg),
        L('Span between end insulators', span, 'Horizontal distance with straight legs'),
        L('Vertical drop: apex to ends', drop),
        L('¼ λ height reference', spaceFt(f, 0.25), 'Minimum apex height; ends drop by the value above'),
        T('Feed-point impedance', '≈ 50 Ω at a 90° apex', 'Good match for 50 Ω coax; a 1:1 choke balun is still recommended'),
        T('Apex angle used', apex.toFixed(0) + '°', 'Narrower apex = more shortening; 180° reproduces a flat dipole')
      ],
      notes: [
        'The 90° default is the standard field layout. Because the legs couple to each other the antenna resonates slightly low, so it is cut about 2 % shorter than a flat dipole.',
        'Apex height matters more than span: ¼ λ minimum, ½ λ or more for low-angle (DX) radiation. Keep the ends ≥ 2 m (6 ft) off the ground.',
        'Feeding at the apex puts the feed point at the highest, driest point of the antenna.'
      ],
      formulas: wireFormulas('½', 0.5).concat([
        'Apex shortening = 1 − 0.03 × ((90 / apex°)² − 0.25)   (180° gives 1.000 = flat dipole)',
        'Span = 2 × leg × sin(apex°/2)  •  drop = leg × cos(apex°/2)'
      ])
    };
  }

  function foldedDipole(opts) {
    var f = freq(opts), k = factor(opts);
    var span = wireFt(f, 0.5, k);
    var spacingFt = mToFt(Math.min(0.3, Math.max(0.02, num(opts && opts.spacingM, 0.05))));
    return {
      id: 'foldedDipole',
      title: 'Folded dipole',
      summary: 'A dipole folded back on itself: same span, four times the feed-point impedance.',
      rows: [
        L('Span (tip to tip, same as a dipole)', span),
        L('Wire needed', 2 * span + 2 * spacingFt, 'Two straight runs plus the fold at each end'),
        L('Conductor spacing (centre to centre)', spacingFt, 'Typical 25–75 mm (1–3 in), or use 300 Ω twin-lead'),
        T('Feed-point impedance', '≈ 4 × a dipole ≈ 290–300 Ω', 'Use a 4:1 balun to 75 Ω, or feed 300 Ω twin-lead directly'),
        T('Direct 50 Ω feed', 'Not recommended', 'SWR would be around 6:1 without matching'),
        T('Recommended height', '≥ ¼ λ', 'Same radiation pattern as a plain dipole')
      ],
      notes: [
        'Keep both wires exactly parallel and bend the ends with as generous a radius as practical — the spacing sets the impedance step-up ratio.',
        'Wider spacing raises the impedance further; equal-diameter conductors give a 1:1 current split and a 4:1 impedance ratio.',
        'Popular as a Yagi driven element on HF because it is broadband and easy to match.'
      ],
      formulas: wireFormulas('½', 0.5).concat([
        'Feed impedance ≈ 4 × plain dipole (292 Ω ideal for equal diameters)',
        'Wire length = 2 × span + 2 × conductor spacing'
      ])
    };
  }

  function efhw(opts) {
    var f = freq(opts), k = factor(opts);
    var wire = wireFt(f, 0.5, k);
    return {
      id: 'efhw',
      title: 'End-fed half-wave (EFHW)',
      summary: 'Half-wave radiator fed at one end through a broadband transformer — no feedline in the middle.',
      rows: [
        L('Radiator length', wire),
        L('Counterpoise (recommended)', spaceFt(f, 0.05), '≈ 0.05 λ; run it along the ground or under the coax'),
        T('Matching transformer', '49:1 unun (≈ 2 400 Ω → 50 Ω)', 'Some builds use 56:1 or 64:1 — follow your design'),
        T('Feed-point impedance', '≈ 2 000–4 000 Ω', 'An EFHW is a high-impedance load — never feed it directly'),
        T('Choke', '1:1 choke balun at the rig end', 'Keeps the feedline shield from radiating'),
        T('Multi-band use', 'All odd harmonics', 'With an ATU: 40/20/15/10 m from a single 40 m wire')
      ],
      notes: [
        'Build the wire a little long and trim the far end for lowest SWR on the design frequency.',
        'Keep the transformer and wire clear of metal and wet foliage — EFHWs are sensitive to their surroundings.',
        'The counterpoise is not a radial field; it simply gives the return current a defined path back to the transformer.'
      ],
      formulas: wireFormulas('½', 0.5).concat([
        'Counterpoise = 0.05 × λ = ' + round(0.05 * FT_PER_MHZ, 1) + ' / f(MHz) ft',
        'Transformer ratio ≈ 2 400 / 50 ≈ 49:1'
      ])
    };
  }

  /* ------------------------------------------------------------------ *
   * Verticals
   * ------------------------------------------------------------------ */

  function quarterWaveVertical(opts) {
    var f = freq(opts), k = factor(opts);
    var radiator = wireFt(f, 0.25, k);
    var radial = spaceFt(f, 0.25);
    return {
      id: 'quarterWaveVertical',
      title: 'Quarter-wave vertical / ground plane',
      summary: 'Classic ¼ λ vertical radiator over a radial field — the simplest effective vertical.',
      rows: [
        L('Radiator (vertical element)', radiator),
        L('Each radial', radial, 'Free-space ¼ λ — about 5 % longer than the radiator, standard practice'),
        T('Feed-point impedance', '≈ 36 Ω over a perfect ground', 'Droop the radials 30–45° to bring it near 50 Ω'),
        T('Radials needed', '4 elevated minimum', 'Ground-mounted HF verticals: 16–64+ radials, the more the better'),
        T('Base height (elevated radials)', '0.05–0.1 λ or more', 'Keeps ground losses low, raises the feed impedance slightly'),
        T('Radiation pattern', 'Omni, low angle', 'Needs a good radial field — the radials are half the antenna')
      ],
      notes: [
        'Radial length is not critical: anything from ¼ λ to a little longer works, but keep them all equal and slope them down to match 50 Ω coax.',
        'On HF, a ground-mounted vertical is only as good as its radial field. Four radials are a compromise; 32+ short radials usually beat 4 long ones.',
        'For 2 m/70 cm, three or four drooping radials make a fine ground plane — no ground connection needed if they slope enough.'
      ],
      formulas: wireFormulas('¼', 0.25).concat([
        'Radial = ¼ λ free space = ' + round(0.25 * FT_PER_MHZ, 1) + ' / f(MHz) ft = ' +
          round(0.25 * M_PER_MHZ, 1) + ' / f(MHz) m   (no length factor applied)',
        'Drooping radials ≈ 45° bring the feed impedance close to 50 Ω'
      ])
    };
  }

  function halfWaveVertical(opts) {
    var f = freq(opts), k = factor(opts);
    var radiator = wireFt(f, 0.5, k);
    return {
      id: 'halfWaveVertical',
      title: 'Half-wave vertical',
      summary: 'A vertical half-wave radiator — more gain over a quarter wave, but a high feed impedance.',
      rows: [
        L('Radiator length', radiator),
        T('Feed-point impedance', '≈ 1 000–2 000 Ω (base fed)', 'Needs an L-network, tuned circuit or 49:1 transformer'),
        T('Radial field', 'Not required', 'Return current is handled by the choke/counterpoise at the feed point'),
        T('Feed method', 'Base tuner or end-fed transformer', 'A parallel tuned circuit or tapped inductor works well'),
        T('Gain vs ¼ λ vertical', '≈ +1 to +1.5 dB at low angles', 'The extra height moves the current maximum up the radiator'),
        L('¼ λ reference height', spaceFt(f, 0.25), 'Keep the base at least this far above ground')
      ],
      notes: [
        'Because the current maximum sits half-way up, a half-wave vertical is less dependent on ground quality than a quarter wave — but it must be matched properly.',
        'Build it slightly long and trim for lowest SWR; nearby structures pull the resonance hard on a vertical.',
        'A J-pole is the classic practical half-wave vertical: the same half-wave radiator with a ¼ λ matching stub, which you can read off the ¼ λ dimension here.'
      ],
      formulas: wireFormulas('½', 0.5).concat([
        'J-pole stub: ¼ λ of open-wire line ≈ ' +
          round(0.25 * FT_PER_MHZ * DEFAULT_FACTOR, 1) + ' / f(MHz) ft, cut to the line\'s own velocity factor'
      ])
    };
  }

  function fiveEighthVertical(opts) {
    var f = freq(opts), k = factor(opts);
    var radiator = wireFt(f, 0.625, k);
    return {
      id: 'fiveEighthVertical',
      title: '⅝-wave vertical',
      summary: 'The tall mobile/base vertical: maximum low-angle gain, but it needs a base matching network.',
      rows: [
        L('Radiator length', radiator, 'Physical length, ~0.625 λ'),
        L('Each radial', spaceFt(f, 0.25), 'A solid ¼ λ ground plane is essential'),
        T('Base matching', 'Loading / matching coil required', 'A ⅝ λ radiator is not 50 Ω at the base — tap the coil or use an L-network'),
        T('Feed-point impedance', '≈ 50 Ω after matching', 'Never feed 50 Ω coax straight to an unmatched ⅝ λ whip'),
        T('Gain vs ¼ λ vertical', '≈ +2.5 to +3 dB at low angles', 'The ⅝ λ length concentrates radiation near the horizon'),
        T('Usable bandwidth', 'Narrower than ¼ λ', 'Expect to retune across a wide band; fine for 2 m/70 cm')
      ],
      notes: [
        '⅝ λ verticals are the standard mobile whip: the coil at the base matches the high impedance and adds the missing inductance.',
        'A proper ground plane (or vehicle body) is not optional — without it the pattern tilts upward and the gain claim disappears.',
        'For 2 m/70 cm, commercial whips are already matched; use this calculator to check the whip against the design frequency or to trim a homebrew one.'
      ],
      formulas: wireFormulas('⅝', 0.625).concat([
        '⅝ λ = 0.625 × 983.571 / f(MHz) ft → ' + round(0.625 * FT_PER_MHZ * DEFAULT_FACTOR, 1) + ' / f(MHz) ft at factor 0.95 (= 585 / f ft)',
        'Radial = ¼ λ free space = ' + round(0.25 * FT_PER_MHZ, 1) + ' / f(MHz) ft'
      ])
    };
  }

  /* ------------------------------------------------------------------ *
   * Yagi
   * ------------------------------------------------------------------ */

  function yagi(opts) {
    var f = freq(opts), k = factor(opts);
    var directors = Math.min(10, Math.max(0, Math.round(num(opts && opts.directors, 3))));
    var reflS = Math.min(0.35, Math.max(0.05, num(opts && opts.reflectorSpacing, 0.15)));
    var dirS = Math.min(0.35, Math.max(0.05, num(opts && opts.directorSpacing, 0.15)));
    var gapS = Math.min(0.50, Math.max(0.05, num(opts && opts.directorGap, 0.20)));

    var driven = wireFt(f, 0.5, k);
    var reflector = driven * (0.495 / 0.4756);
    var firstDir = driven * 0.935;
    var lastDir = driven * (directors > 1 ? 0.900 : 0.935);

    var lam = wavelength(f);
    var rows = [];
    rows.push(L('Driven element (DE) — feed here', driven, 'Same length as a half-wave dipole'));
    rows.push(L('Reflector', reflector, '≈ ' + round(reflS, 3) + ' λ behind the DE = ' +
      round(lam.ft * reflS, 2) + ' ft (' + round(lam.m * reflS, 2) + ' m)'));
    rows.push(L('DE → reflector spacing', lam.ft * reflS, round(reflS, 3) + ' λ'));
    rows.push(L('DE → director 1 spacing', lam.ft * dirS, round(dirS, 3) + ' λ ahead'));

    var i, len;
    for (i = 1; i <= directors; i++) {
      if (directors === 1) len = firstDir;
      else len = firstDir + (lastDir - firstDir) * (Math.log(i) / Math.log(directors));
      if (i === 1) {
        rows.push(L('Director 1', len, 'First director, ' + round(dirS, 3) + ' λ ahead of the DE'));
      } else {
        rows.push(L('Director ' + i, len, 'Ahead of director ' + (i - 1) + ' by ' + round(gapS, 3) + ' λ = ' +
          round(lam.ft * gapS, 2) + ' ft (' + round(lam.m * gapS, 2) + ' m)'));
      }
    }
    if (directors > 1) rows.push(L('Director → director spacing', lam.ft * gapS, round(gapS, 3) + ' λ, used for directors 2…' + directors));

    var boomLambda = reflS + dirS + (directors > 0 ? (directors - 1) * gapS : 0);
    var totalElements = 2 + directors;
    var gain = yagiGainDbi(totalElements);

    rows.push(L('Boom length (reflector to last ' + (directors > 0 ? 'director' : 'element') + ')',
      lam.ft * boomLambda, round(boomLambda, 2) + ' λ long boom, ' + totalElements + ' elements'));
    rows.push(T('Estimated forward gain', '≈ ' + gain.toFixed(1) + ' dBi (' + (gain - 2.15).toFixed(1) + ' dBd)',
      'Rule of thumb: 10·log₁₀(elements) + 3.2 dBi — real designs vary ±1.5 dB with spacing and tuning'));
    rows.push(T('Front-to-back ratio', '≈ 15–20 dB (3 el), 20–25 dB (5 el+)', 'Peaks at one specific spacing; gain and F/B are never best at the same setting'));
    rows.push(T('Feed-point impedance', '≈ 20–35 Ω with the reflector this close',
      'Use a gamma/T match, or a folded-dipole driven element with a 4:1 balun'));

    return {
      id: 'yagi',
      title: 'Yagi beam (' + totalElements + ' elements)',
      summary: 'Reflector, driven element and ' + directors + ' director' + (directors === 1 ? '' : 's') +
        ' — ' + round(boomLambda, 2) + ' λ boom aimed at the design frequency.',
      rows: rows,
      notes: [
        'These are DL6WU-style starting dimensions for moderate-diameter elements. Thick tubing or elements mounted through a metal boom need a shortening correction (roughly 0.5–1 boom diameter per element).',
        'Optimise before you cut metal: model the design in MMANA-GAL, EZNEC or 4nec2, then trim for best gain, F/B and SWR.',
        'Spacing sets the trade-off: closer spacing = more F/B, wider spacing = more gain and bandwidth but lower feed impedance.',
        'The driven element here is a split dipole; substitute the folded-dipole length from the Folded dipole tab if you want an easy 4:1 match.'
      ],
      formulas: [
        'λ(free space) = 983.571 / f(MHz) ft',
        'Driven = 0.4756 λ (half-wave dipole at factor 0.95, i.e. 468 / f ft)',
        'Reflector = 1.0408 × driven ≈ 0.495 λ',
        'Director 1 = 0.935 × driven ≈ 0.445 λ; last director = 0.900 × driven, log-tapered in between',
        'Boom length = (reflector spacing + first-director spacing + (n−1) × director gap) × λ'
      ]
    };
  }

  /* ------------------------------------------------------------------ *
   * Loops and quads
   * ------------------------------------------------------------------ */

  function fullWaveLoop(opts) {
    var f = freq(opts);
    var perimeter = LOOP_FT_PER_MHZ / f;
    var side = perimeter / 4;
    return {
      id: 'fullWaveLoop',
      title: 'Full-wave loop',
      summary: 'A closed full-wave wire loop: quiet on receive, about 1 dB up on a dipole and multi-band friendly.',
      rows: [
        L('Loop perimeter (wire needed)', perimeter, 'Add a little for insulators and the tuning stub'),
        L('Square loop — side length', side, 'Also the loop height when hung as a square'),
        L('Square loop — corner diagonal', side * SQRT2, 'Corner-to-corner, handy for mast/tree spacing'),
        L('Delta loop — side length', perimeter / 3, 'Equal-sided triangle'),
        L('Round loop — diameter', perimeter / Math.PI, 'Ideally, feed at the bottom'),
        L('¼ λ 75 Ω matching section (VF 0.66)', (246 * 0.66) / f, 'Solid-polyethylene coax (VF 0.80 foam is below)'),
        L('¼ λ 75 Ω matching section (VF 0.80)', (246 * 0.80) / f, 'Use the cable\'s own published velocity factor'),
        T('Feed-point impedance', '≈ 100 Ω', 'Match with a ¼ λ 75 Ω coax section, or a 2:1 balun, or an ATU'),
        T('Height', '¼ λ or more above ground', 'Higher = lower radiation angle; keeps the loop clear of losses')
      ],
      notes: [
        'Loops use the published "1005 / f(MHz) ft" (306 / f m) perimeter; it already includes the loop\'s end effect, so the length factor control does not apply.',
        'Erect it as a square if you can — the shape matters less than the enclosed area. Feed a vertical loop at the bottom centre of one side.',
        'A 40 m loop also works well on 15 m and 10 m; expect a different pattern on the harmonics.'
      ],
      formulas: [
        'Perimeter = ' + LOOP_FT_PER_MHZ + ' / f(MHz) ft = ' + LOOP_M_PER_MHZ + ' / f(MHz) m',
        'Square side = perimeter / 4  •  delta side = perimeter / 3  •  circle = perimeter / π',
        '¼ λ matching section = 246 × cable VF / f(MHz) ft = 75 × VF / f(MHz) m'
      ]
    };
  }

  function cubicalQuad(opts) {
    var f = freq(opts);
    var elements = Math.min(6, Math.max(2, Math.round(num(opts && opts.quadElements, 2))));
    var spacing = Math.min(0.35, Math.max(0.08, num(opts && opts.quadSpacing, 0.15)));
    var driven = LOOP_FT_PER_MHZ / f;
    var lam = wavelength(f);
    var rows = [
      L('Driven loop — perimeter', driven),
      L('Driven loop — side', driven / 4),
      L('Driven loop — corner diagonal', (driven / 4) * SQRT2, 'Spider arm: centre to corner = side × 0.7071'),
      L('Driven → reflector spacing', lam.ft * spacing, round(spacing, 3) + ' λ')
    ];
    var reflector = driven * 1.05;
    rows.push(L('Reflector loop — perimeter', reflector, '+5 % on the driven loop'));
    rows.push(L('Reflector loop — side', reflector / 4));

    var i, d;
    for (i = 1; i <= elements - 2; i++) {
      d = driven * Math.max(0.90, 0.96 - 0.01 * (i - 1));
      rows.push(L('Director loop ' + i + ' — perimeter', d, '−' + round((1 - d / driven) * 100, 1) +
        ' % on the driven loop, ' + round(spacing, 3) + ' λ ahead'));
      rows.push(L('Director loop ' + i + ' — side', d / 4));
    }
    rows.push(L('Boom length (reflector to last loop)', lam.ft * spacing * (elements - 1),
      (elements - 1) + ' × ' + round(spacing, 3) + ' λ gaps'));
    rows.push(T('Feed-point impedance', elements >= 3 ? '≈ 50 Ω (tuned)' : '≈ 50–75 Ω',
      '1:1 current balun at the driven loop; a lone loop is ≈ 100 Ω'));
    rows.push(T('Feed point', 'Bottom centre of the driven loop',
      'Sets horizontal or vertical polarisation — keep every loop the same way up'));
    rows.push(T('Gain', '≈ ' + (yagiGainDbi(2 * (elements - 1)) - 0.2).toFixed(1) + ' dBi (rule of thumb)',
      'Quads are quieter than Yagis on receive; model the design before building'));

    return {
      id: 'cubicalQuad',
      title: 'Cubical quad (' + elements + ' elements)',
      summary: 'Full-wave loops stacked on one boom — a high-performance, low-noise beam with an easy match.',
      rows: rows,
      notes: [
        'Each loop is a full-wave wire loop; keep every side equal and every corner a firm 90°, because the perimeter sets the resonance.',
        'Loop wire is usually #14–#18 AWG. Unlike straight elements, insulated wire needs no length correction on a quad.',
        'Spreaders must hold the loop clear of the boom and the mast — a wet spreader, or a guy wire touching the loop, will shift the tuning badly.',
        'Quads with more than 4 elements get mechanically involved and tune sharply; 2–3 elements covers most HF work.'
      ],
      formulas: [
        'Driven loop perimeter = ' + LOOP_FT_PER_MHZ + ' / f(MHz) ft = ' + LOOP_M_PER_MHZ + ' / f(MHz) m',
        'Loop side = perimeter / 4  •  corner diagonal = side × √2',
        'Reflector = driven × 1.05  •  director n = driven × (0.96 − 0.01 × (n−1)), floor 0.90',
        'Loop spacing (default 0.15 λ) = ' + round(0.15 * FT_PER_MHZ, 1) + ' / f(MHz) ft'
      ]
    };
  }

  /** Shared 1/4-wave-on-2m / 3/4-wave-on-70cm dual-band ground-plane vertical. */
  function dualBandVertical(opts) {
    var f2 = num(opts && opts.f2, 433.500);
    var f = freq(opts);
    if (!isFinite(f2) || f2 <= 0) throw new Error('A positive second frequency in MHz is required.');
    var k = factor(opts);
    var lam = wavelength(f);
    var l2 = wavelength(f2);
    var radiator2 = 0.25 * lam.ft * k;     // quarter wave on 2 m, shortened
    var radiator70 = 0.75 * l2.ft * k;     // three-quarter wave on 70 cm, shortened
    var whip = (radiator2 + radiator70) / 2;
    var radial2 = 0.25 * lam.ft;           // free-space quarter wave, 2 m
    var radial70 = 0.25 * l2.ft;           // free-space quarter wave, 70 cm
    var delta = Math.abs(radiator2 - radiator70);
    var rows = [
      L('Shared whip — cut length', whip,
        'compromise between ¼ λ on 2 m (' + round(radiator2, 3) + ' ft) and ¾ λ on 70 cm (' +
        round(radiator70, 3) + ' ft); differs by ' + round(delta, 3) + ' ft, tune for lowest SWR on both bands'),
      L('Classic 19 in whip check', 19 / 12,
        'a 19 in whip is ¼ λ near 147 MHz and ¾ λ near 440 MHz — start long and trim'),
      L('2 m radials — each (×4)', radial2, 'free-space ¼ λ at ' + round(f, 3) + ' MHz, droop 30–45°'),
      L('70 cm radials — each (×4)', radial70, 'free-space ¼ λ at ' + round(f2, 3) + ' MHz, alternate with the 2 m set'),
      L('2 m wavelength (free space)', lam.ft),
      L('70 cm wavelength (free space)', l2.ft),
      L('Mounting height', 0.25 * lam.ft + 6, 'get the feedpoint at least ¼ λ on 2 m above ground or roof'),
      T('Feed-point impedance', '≈ 50 Ω on both bands', 'one 50 Ω coax, choke balun at the feedpoint'),
      T('SWR target', '≤ 1.5 : 1 both bands', 'a shared whip is a compromise — trim in ⅛ in steps and re-check both bands')
    ];
    return {
      id: 'dualBandVertical',
      title: 'Dual-band 2 m / 70 cm vertical',
      summary: 'One whip that is a quarter wave on 2 m and three-quarter wave on 70 cm, with a dual radial set.',
      rows: rows,
      notes: [
        'Start with the compromise whip length, then trim in small steps: the 2 m resonance moves roughly three times slower than the 70 cm resonance.',
        'Use four 2 m radials plus four 70 cm radials (8 total), alternating around the mount and drooped 30–45° for a 50 Ω match.',
        'A plain 19 in whip with 19 in radials is already close on both bands; the calculator refines it for your exact design frequencies.',
        'Keep the whip vertical and clear of metal gutters or railings — at 70 cm even a few centimetres of nearby metal detunes the antenna.'
      ],
      formulas: [
        'Whip = (¼ λ₂ₘ × factor + ¾ λ₇₀cm × factor) / 2',
        'Radials = free-space ¼ λ on each band = ' + round(FT_PER_MHZ / 4, 1) + ' / f(MHz) ft'
      ]
    };
  }

  var PAT_FLOOR_DB = -30;

  function patLinToDb(e) {
    var v = 20 * Math.log10(Math.max(e, 1e-6));
    return v < PAT_FLOOR_DB ? PAT_FLOOR_DB : v;
  }

  function patNorm(lin) {
    var i, m = 0, db = [];
    for (i = 0; i < lin.length; i++) if (lin[i] > m) m = lin[i];
    for (i = 0; i < lin.length; i++) db.push(m > 0 ? patLinToDb(lin[i] / m) : PAT_FLOOR_DB);
    return db;
  }

  function patHeightLambda(opts) {
    var h = num(opts && (opts.patternHeight !== undefined ? opts.patternHeight : opts.heightLambda), 0.5);
    return Math.min(2.5, Math.max(0.05, h));
  }

  /** Half-wave wire: azimuth `phiDeg` from broadside — 1 broadside, 0 off the ends. */
  function patDipoleAz(phiDeg) {
    var p = phiDeg * Math.PI / 180;
    var c = Math.cos(p);
    if (Math.abs(c) < 1e-3) return 0;
    return Math.abs(Math.cos(1.5707963268 * Math.sin(p)) / c);
  }

  /** Two-ray ground factor for horizontal polarization over perfect ground. */
  function patHeightFactor(elDeg, h) {
    return Math.abs(Math.sin(2 * Math.PI * h * Math.sin(elDeg * Math.PI / 180)));
  }

  /** Vertical monopole of length L (in wavelengths) over perfect ground. */
  function patMonopoleEl(elDeg, L) {
    var el = elDeg * Math.PI / 180, c = Math.cos(el);
    if (c < 0.02) return 0;
    var kL = 2 * Math.PI * L;
    return Math.abs((Math.cos(kL * Math.sin(el)) - Math.cos(kL)) / c);
  }

  function patWrap180(d) {
    d = d % 360;
    if (d > 180) d -= 360;
    if (d < -180) d += 360;
    return d;
  }

  /** Directional azimuth: Gaussian main lobe plus a small back lobe. */
  function patBeamAz(azDeg, elements, fbDb, wide) {
    var w = Math.abs(patWrap180(azDeg));
    var hpbw = wide * 90 / Math.sqrt(Math.max(2, elements));
    var t = w / (hpbw / 2);
    var main = Math.pow(2, -(t * t));
    var bw = Math.abs(patWrap180(azDeg - 180));
    var bt = bw / 18;
    var back = Math.pow(10, -fbDb / 10) * Math.pow(2, -(bt * bt));
    return Math.sqrt(main + back);
  }

  /** Horizontal half-wave wire, broadside elevation factor: 1 at horizon, 0 overhead. */
  function patDipoleElFs(elDeg) {
    var el = elDeg * Math.PI / 180, c = Math.cos(el);
    if (c < 0.02) return 0;
    return Math.abs(Math.cos(1.5707963268 * Math.sin(el)) / c);
  }

  function patRound1(x) { return Math.round(x * 10) / 10; }

  function patDipoleCuts(h) {
    var azLin = [], elLin = [], i;
    for (i = 0; i <= 360; i += 5) azLin.push(patDipoleAz(i));
    for (i = 0; i <= 90; i += 2) elLin.push(patDipoleElFs(i) * patHeightFactor(i, h));
    return { azLin: azLin, elLin: elLin };
  }

  function patPack(id, azLin, elLin, el2Lin, meta, h) {
    var azDb = patNorm(azLin), elDb = patNorm(elLin), el2Db = el2Lin ? patNorm(el2Lin) : null;
    var az = [], el = [], el2 = null, k;
    for (k = 0; k < azDb.length; k++) az.push({ deg: k * 5, db: patRound1(azDb[k]) });
    for (k = 0; k < elDb.length; k++) el.push({ deg: k * 2, db: patRound1(elDb[k]) });
    if (el2Db) {
      el2 = [];
      for (k = 0; k < el2Db.length; k++) el2.push({ deg: k * 2, db: patRound1(el2Db[k]) });
    }
    var peakEl = 0, peakV = -99;
    for (k = 0; k < elDb.length; k++) if (elDb[k] > peakV) { peakV = elDb[k]; peakEl = k * 2; }
    var m3 = 0;
    while (m3 < azDb.length && azDb[m3] >= -3) m3++;
    var caption = meta.gain + '. ' + meta.shape + ' ' + meta.orient;
    if (meta.heightApplies) {
      caption += ' Height ' + h.toFixed(2) + ' λ — first elevation lobe peaks near ' + peakEl + '°.';
    } else if (id === 'dualBandVertical') {
      var peak2 = 0, peak2V = -99;
      for (k = 0; k < el2Db.length; k++) if (el2Db[k] > peak2V) { peak2V = el2Db[k]; peak2 = k * 2; }
      caption += ' 2 m lobe peaks at the horizon; 70 cm first lobe peaks near ' + peak2 + '°.';
    } else {
      caption += ' Strongest at the horizon (0°).';
    }
    return {
      id: id, az: az, el: el, el2: el2,
      fbDb: patRound1(azDb[0] - azDb[36]),
      hpbwDeg: (m3 * 5 >= 180) ? null : patRound1(2 * m3 * 5),
      peakElDeg: peakEl, nullDepthDb: patRound1(Math.min.apply(null, azDb)),
      gainText: meta.gain, caption: caption, orientation: meta.orient,
      heightLambda: h, heightApplies: meta.heightApplies
    };
  }

  function patVerticalCuts(L) {
    var azLin = [], elLin = [], i;
    for (i = 0; i <= 360; i += 5) azLin.push(1);
    for (i = 0; i <= 90; i += 2) elLin.push(patMonopoleEl(i, L));
    return { azLin: azLin, elLin: elLin };
  }

  /**
   * Idealized azimuth + elevation cuts for one antenna type.
   * az covers 0–360° in 5° steps, el 0–90° in 2° steps, each { deg, db }.
   * Cuts are normalized so each peak is 0 dB, floor −30 dB.
   */
  function radiationPattern(id, opts) {
    if (!CALCULATORS[id]) throw new Error('Unknown antenna type: ' + id);
    var o = opts || {};
    var h = patHeightLambda(o);
    var cuts, cuts2 = null, meta, i, e, L2, n, fb, wide, g, d;
    if (id === 'dipole' || id === 'foldedDipole' || id === 'efhw' || id === 'fullWaveLoop') {
      cuts = patDipoleCuts(h);
      meta = id === 'fullWaveLoop'
        ? { gain: '≈ 3 dBi max', heightApplies: true,
            orient: 'Loop plane faces 0°/180° (best); nulls edge-on at 90°/270°.',
            shape: 'Broad figure-8, slightly fatter than a dipole, and quieter on receive.' }
        : { gain: '≈ 2.2 dBi free space (≈ 8 dBi at the lobe peak, ½ λ over perfect ground)',
            heightApplies: true,
            orient: 'Azimuth 0° = broadside (best); 90°/270° = off the wire ends (nulls).',
            shape: 'Figure-8 azimuth; elevation lobes are set by the height slider.' };
      return patPack(id, cuts.azLin, cuts.elLin, null, meta, h);
    }
    if (id === 'invertedV') {
      var apex = Math.min(180, Math.max(30, num(o.apexDeg, 90)));
      var tilt = (180 - apex) / 2 * Math.PI / 180;
      var wFill = 0.45 * Math.pow(Math.sin(tilt), 1.5);
      var sUp = 0.5 * Math.sin(tilt);
      var azLin = [], elLin = [];
      for (i = 0; i <= 360; i += 5) azLin.push((1 - wFill) * patDipoleAz(i) + wFill);
      for (i = 0; i <= 90; i += 2) {
        e = i * Math.PI / 180;
        var flat = patDipoleElFs(i) * patHeightFactor(i, h);
        var high = Math.abs(Math.cos(2 * Math.PI * h * Math.sin(e)));
        elLin.push(Math.sqrt(Math.pow((1 - sUp) * flat, 2) + Math.pow(sUp * high, 2)));
      }
      return patPack(id, azLin, elLin, null, {
        gain: '≈ 2.0 dBi max', heightApplies: true,
        orient: 'Azimuth 0° = broadside; the sloping legs partly fill the end nulls.',
        shape: 'Softer figure-8 than a flat dipole, with kinder high-angle fill.'
      }, h);
    }
    if (id === 'quarterWaveVertical' || id === 'halfWaveVertical' ||
        id === 'fiveEighthVertical' || id === 'dualBandVertical') {
      L2 = id === 'halfWaveVertical' ? 0.5 : (id === 'fiveEighthVertical' ? 0.625 : 0.25);
      cuts = patVerticalCuts(L2);
      if (id === 'dualBandVertical') cuts2 = patVerticalCuts(0.75);
      meta = { gain: '≈ 5 dBi on 2 m over perfect ground; 70 cm splits higher', heightApplies: false,
        orient: 'Omnidirectional in azimuth on both bands.',
        shape: 'Solid trace = 2 m quarter-wave lobe; dashed trace = 70 cm ¾-wave with its extra high lobe.' };
      if (id === 'quarterWaveVertical') meta = { gain: '≈ 5.2 dBi over perfect ground',
        heightApplies: false, orient: 'Omnidirectional in azimuth — identical in all compass directions.',
        shape: 'Classic ground-hugging doughnut: strongest at the horizon, null straight up.' };
      if (id === 'halfWaveVertical') meta = { gain: '≈ 3 dBi', heightApplies: false,
        orient: 'Omnidirectional in azimuth — identical in all compass directions.',
        shape: 'Low, fat lobe hugging the horizon; less thirst for radials than a quarter wave.' };
      if (id === 'fiveEighthVertical') meta = { gain: '≈ 5–6 dBi at the horizon over perfect ground',
        heightApplies: false, orient: 'Omnidirectional in azimuth — identical in all compass directions.',
        shape: 'Tight horizon lobe plus a weaker high-angle lobe — that second lobe is the price of the extra gain.' };
      return patPack(id, cuts.azLin, cuts.elLin, cuts2 ? cuts2.elLin : null, meta, h);
    }
    d = Math.min(10, Math.max(0, Math.round(num(o.directors, 3))));
    n = id === 'cubicalQuad'
      ? Math.min(6, Math.max(2, Math.round(num(o.quadElements, 2))))
      : 2 + d;
    g = id === 'cubicalQuad' ? yagiGainDbi(2 * (n - 1)) - 0.2 : yagiGainDbi(n);
    fb = id === 'cubicalQuad' ? Math.min(28, 13 + 2 * (2 * (n - 1))) : Math.min(25, 10 + 2 * n);
    wide = id === 'cubicalQuad' ? 0.9 : 1;
    var baz = [], bel = [];
    for (i = 0; i <= 360; i += 5) baz.push(patBeamAz(i, n, fb, wide));
    for (i = 0; i <= 90; i += 2) bel.push(patDipoleElFs(i) * patHeightFactor(i, h));
    return patPack(id, baz, bel, null, {
      gain: '≈ ' + g.toFixed(1) + ' dBi forward', heightApplies: true,
      orient: 'Azimuth 0° = forward (toward the directors); 180° = backward.',
      shape: 'Forward beam with a small back lobe; elevation takeoff is set by the height slider.'
    }, h);
  }

  /* Registry and public API follows below. */

  var CALCULATORS = {
    dipole: dipole,
    invertedV: invertedV,
    foldedDipole: foldedDipole,
    efhw: efhw,
    quarterWaveVertical: quarterWaveVertical,
    halfWaveVertical: halfWaveVertical,
    fiveEighthVertical: fiveEighthVertical,
    dualBandVertical: dualBandVertical,
    yagi: yagi,
    fullWaveLoop: fullWaveLoop,
    cubicalQuad: cubicalQuad
  };

  /** Run one calculator and attach the shared frequency / wavelength metadata. */
  function calc(id, opts) {
    var fn = CALCULATORS[id];
    if (!fn) throw new Error('Unknown antenna type: ' + id);
    var f = freq(opts);
    var res = fn(opts || {});
    res.f = f;
    // Only the dual-band calculator reports a second design frequency; every
    // other type shares the default f2 state but must not display it.
    if (id === 'dualBandVertical') {
      var f2 = num(opts && opts.f2, NaN);
      res.f2 = isFinite(f2) && f2 > 0 ? f2 : null;
    } else {
      res.f2 = null;
    }
    res.lambda = wavelength(f);
    res.factor = factor(opts);
    return res;
  }

  return {
    calc: calc,
    calculators: CALCULATORS,
    radiationPattern: radiationPattern,
    BANDS: BANDS,
    wavelength: wavelength,
    wireFt: wireFt,
    spaceFt: spaceFt,
    ftToM: ftToM,
    mToFt: mToFt,
    round: round,
    yagiGainDbi: yagiGainDbi,
    constants: {
      FT_PER_MHZ: FT_PER_MHZ,
      M_PER_MHZ: M_PER_MHZ,
      DEFAULT_FACTOR: DEFAULT_FACTOR,
      LOOP_FT_PER_MHZ: LOOP_FT_PER_MHZ,
      LOOP_M_PER_MHZ: LOOP_M_PER_MHZ,
      M_PER_FT: M_PER_FT
    }
  };
});
