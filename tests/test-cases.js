/* Shared test specification for the antenna math.
 *
 * Works in the browser (window.AntennaTests) and in Node (module.exports), so
 * the exact same assertions run in both places — see run-tests.html and
 * antennas.test.js. Expected values were derived independently (Python) from
 * the published formulas, not from the module's own output.
 */

(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.AntennaTests = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  function makeAsserts() {
    return {
      ok: function (cond, msg) {
        if (!cond) throw new Error(msg || 'expected a truthy value');
      },
      eq: function (actual, expected, msg) {
        if (actual !== expected) {
          throw new Error((msg || 'values differ') + ' — got ' + actual + ', expected ' + expected);
        }
      },
      near: function (actual, expected, tolPct, msg) {
        var tol = Math.abs(expected) * (tolPct / 100);
        if (!(Math.abs(actual - expected) <= tol)) {
          throw new Error((msg || 'values differ') + ' — got ' + actual + ', expected ' +
            expected + ' ±' + tolPct + '% (tolerance ' + tol + ')');
        }
      },
      throws: function (fn, msg) {
        var threw = false;
        try { fn(); } catch (e) { threw = true; }
        if (!threw) throw new Error(msg || 'expected the call to throw');
      }
    };
  }

  function findRow(res, prefix) {
    var i;
    for (i = 0; i < res.rows.length; i++) {
      if (res.rows[i].label.indexOf(prefix) === 0) return res.rows[i];
    }
    return null;
  }

  /** First row whose label contains `text` anywhere. */
  function findRowContaining(res, text) {
    var i;
    for (i = 0; i < res.rows.length; i++) {
      if (res.rows[i].label.indexOf(text) !== -1) return res.rows[i];
    }
    return null;
  }

  function countRows(res, re) {
    var n = 0, i;
    for (i = 0; i < res.rows.length; i++) if (re.test(res.rows[i].label)) n++;
    return n;
  }

  var TESTS = [
    { name: 'constants: feet and metres per MHz', fn: function (t, A) {
      t.near(A.constants.FT_PER_MHZ, 983.571056, 0.0001, 'ft per MHz');
      t.near(A.constants.M_PER_MHZ, 299.792458, 0.0001, 'm per MHz');
      t.near(A.constants.DEFAULT_FACTOR, 0.95, 0.0001, 'default length factor');
      t.near(A.constants.LOOP_FT_PER_MHZ, 1005, 0.0001, 'loop constant');
      t.near(A.constants.M_PER_FT, 0.3048, 0.0001, 'metres per foot');
    } },

    { name: 'wavelength at 14.175 MHz', fn: function (t, A) {
      var w = A.wavelength(14.175);
      t.near(w.ft, 69.387729, 0.01, 'free-space λ in feet');
      t.near(w.m, 21.149380, 0.01, 'free-space λ in metres');
      t.near(A.wavelength(146).m, 2.053373, 0.01, 'λ at 146 MHz');
    } },

    { name: 'half-wave dipole at 14.175 MHz (default factor)', fn: function (t, A) {
      var res = A.calc('dipole', { f: 14.175 });
      var total = findRow(res, 'Total length'), leg = findRow(res, 'Each leg');
      t.near(total.ft, 32.959171, 0.01, 'total length');
      t.near(leg.ft, 16.479586, 0.01, 'leg length');
      t.near(leg.ft * 2, total.ft, 0.0001, 'legs sum to the total');
      t.near(total.ft, 468 / 14.175, 0.5, 'close to the classic 468/f rule');
    } },

    { name: 'length factor scales straight-wire elements', fn: function (t, A) {
      var full = A.calc('dipole', { f: 14.175, factor: 1 });
      var half = A.calc('dipole', { f: 14.175, factor: 0.5 });
      t.near(findRow(full, 'Total length').ft, 34.693864, 0.01, 'factor 1.0 = λ/2 exactly');
      t.near(findRow(half, 'Total length').ft, 17.346932, 0.01, 'factor 0.5');
    } },

    { name: 'quarter-wave vertical and radials at 14.175 MHz', fn: function (t, A) {
      var res = A.calc('quarterWaveVertical', { f: 14.175 });
      var radiator = findRow(res, 'Radiator'), radial = findRow(res, 'Each radial');
      t.near(radiator.ft, 16.479586, 0.01, 'radiator = ¼ λ × factor');
      t.near(radial.ft, 17.346932, 0.01, 'radial = free-space ¼ λ');
      t.ok(radial.ft > radiator.ft, 'radials are cut slightly longer than the radiator');
      t.near(radial.ft / radiator.ft, 1.0526, 0.5, '~5 % longer, as standard practice');
    } },

    { name: 'half-wave vertical radiator equals the dipole', fn: function (t, A) {
      var v = A.calc('halfWaveVertical', { f: 14.175 });
      t.near(findRow(v, 'Radiator').ft, 32.959171, 0.01, 'half-wave vertical radiator');
    } },

    { name: 'five-eighth-wave vertical at 146 MHz', fn: function (t, A) {
      var res = A.calc('fiveEighthVertical', { f: 146 });
      t.near(findRow(res, 'Radiator').ft, 3.999968, 0.05, '⅝ λ radiator');
      t.near(findRow(res, 'Each radial').ft, 1.684197, 0.01, '¼ λ radial');
      t.near(findRow(res, 'Radiator').ft, 585 / 146, 0.5, 'close to the classic 585/f rule');
    } },

    { name: 'inverted-V apex angle handling at 14.175 MHz', fn: function (t, A) {
      var flat = A.calc('invertedV', { f: 14.175, apexDeg: 180 });
      var vee = A.calc('invertedV', { f: 14.175, apexDeg: 90 });
      var dip = A.calc('dipole', { f: 14.175 });
      t.near(findRow(flat, 'Total wire').ft, findRow(dip, 'Total length').ft, 0.001, '180° = flat dipole');
      t.near(findRow(vee, 'Total wire').ft, 32.217590, 0.01, '90° apex is ~2 % shorter');
      t.near(findRow(vee, 'Total wire').ft / findRow(flat, 'Total wire').ft, 0.9775, 0.01, 'apex shortening factor');
      var leg = findRow(vee, 'Each leg').ft;
      t.near(findRow(vee, 'Span').ft, 2 * leg * Math.sin(Math.PI / 4), 0.01, 'span at 90°');
      t.near(findRow(vee, 'Vertical drop').ft, leg * Math.cos(Math.PI / 4), 0.01, 'drop at 90°');
    } },

    { name: 'folded dipole wire budget at 14.175 MHz', fn: function (t, A) {
      var res = A.calc('foldedDipole', { f: 14.175 });
      var span = findRow(res, 'Span'), wire = findRow(res, 'Wire needed');
      var spacingFt = A.mToFt(0.05);
      t.near(span.ft, 32.959171, 0.01, 'span equals a plain dipole');
      t.near(wire.ft, 2 * span.ft + 2 * spacingFt, 0.01, 'wire = two runs plus two folds');
    } },

    { name: 'end-fed half wave at 14.175 MHz', fn: function (t, A) {
      var res = A.calc('efhw', { f: 14.175 });
      t.near(findRow(res, 'Radiator').ft, 32.959171, 0.01, 'radiator');
      t.near(findRow(res, 'Counterpoise').ft, 3.469386, 0.01, 'counterpoise = 0.05 λ');
    } },

    { name: 'Yagi defaults at 28.5 MHz (3 directors)', fn: function (t, A) {
      var res = A.calc('yagi', { f: 28.5 });
      var drv = findRow(res, 'Driven element').ft;
      var refl = findRow(res, 'Reflector').ft;
      var d1 = findRow(res, 'Director 1').ft;
      var d2 = findRow(res, 'Director 2').ft;
      var d3 = findRow(res, 'Director 3').ft;
      t.near(drv, 16.392851, 0.01, 'driven element = half-wave dipole');
      t.near(refl, 17.061525, 0.01, 'reflector ≈ 0.495 λ');
      t.near(refl / drv, 1.0408, 0.05, 'reflector is ~4 % longer than the driven element');
      t.near(d1, 15.327316, 0.01, 'first director');
      t.near(d3, 14.753566, 0.01, 'last director');
      t.ok(d1 > d2 && d2 > d3, 'directors taper shorter towards the front');
      t.near(findRow(res, 'Boom length').ft, 0.70 * 34.511265, 0.01, 'boom = 0.70 λ with the defaults');
      t.near(A.yagiGainDbi(5), 10.189700, 0.01, 'gain rule of thumb for 5 elements');
    } },

    { name: 'Yagi element count and spacing changes', fn: function (t, A) {
      var none = A.calc('yagi', { f: 28.5, directors: 0 });
      var many = A.calc('yagi', { f: 28.5, directors: 6, directorGap: 0.2 });
      t.eq(countRows(none, /^Director \d+/), 0, 'no director rows when directors = 0');
      t.near(findRow(none, 'Boom length').ft, 0.30 * 34.511265, 0.01, 'boom with only a reflector');
      t.eq(countRows(many, /^Director \d+/), 6, 'six director rows');
      t.near(findRow(many, 'Boom length').ft, 1.30 * 34.511265, 0.01, 'boom = 1.30 λ');
      var clamped = A.calc('yagi', { f: 28.5, directors: 99 });
      t.eq(countRows(clamped, /^Director \d+/), 10, 'director count is clamped to 10');
      var reversed = A.calc('yagi', { f: 28.5, directors: -4 });
      t.eq(countRows(reversed, /^Director \d+/), 0, 'negative director counts clamp to 0');
    } },

    { name: 'full-wave loop at 7.1 MHz', fn: function (t, A) {
      var res = A.calc('fullWaveLoop', { f: 7.1 });
      var perim = findRow(res, 'Loop perimeter').ft;
      t.near(perim, 141.549296, 0.01, 'perimeter = 1005/f');
      t.near(perim, 1005 / 7.1, 0.0001, 'exactly the published constant');
      t.near(findRow(res, 'Square loop').ft, 35.387324, 0.01, 'square side = perimeter / 4');
      t.near(findRow(res, 'Delta loop').ft, 47.183099, 0.01, 'delta side = perimeter / 3');
      t.near(findRowContaining(res, 'VF 0.66').ft, 22.867606, 0.01, '¼ λ 75 Ω matching section, VF 0.66');
      t.near(findRowContaining(res, 'VF 0.80').ft, 27.718310, 0.01, '¼ λ 75 Ω matching section, VF 0.80');
      t.near(A.ftToM(perim), 306 / 7.1, 0.2, 'matches the published 306/f metric figure');
      var low = A.calc('fullWaveLoop', { f: 7.1, factor: 0.5 });
      t.near(findRow(low, 'Loop perimeter').ft, perim, 0.0001, 'loops ignore the length factor');
    } },

    { name: 'cubical quad at 14.175 MHz', fn: function (t, A) {
      var two = A.calc('cubicalQuad', { f: 14.175, quadElements: 2 });
      var drv = findRow(two, 'Driven loop — perimeter').ft;
      t.near(drv, 70.899471, 0.01, 'driven loop perimeter = 1005/f');
      t.near(findRow(two, 'Driven loop — side').ft, 17.724868, 0.01, 'driven loop side');
      t.near(findRow(two, 'Reflector loop — perimeter').ft, 74.444444, 0.01, 'reflector = 1.05 × driven');
      t.eq(countRows(two, /^Director loop \d+/), 0, 'a 2-element quad has no directors');
      t.near(findRow(two, 'Boom length').ft, 0.15 * 69.387729, 0.01, 'boom = 0.15 λ');
      var four = A.calc('cubicalQuad', { f: 14.175, quadElements: 4 });
      t.eq(countRows(four, /^Director loop \d+/), 4, 'two directors produce four rows');
      t.ok(findRow(four, 'Director loop 1').ft < drv, 'director loops are shorter than the driven loop');
      t.ok(findRow(four, 'Director loop 2').ft < findRow(four, 'Director loop 1').ft, 'directors taper');
      var biggest = A.calc('cubicalQuad', { f: 14.175, quadElements: 99 });
      t.eq(countRows(biggest, /^Director loop \d+/), 8, 'quad loop count is clamped to 6 elements');
    } },

    { name: 'dual-band 2 m + 70 cm vertical', fn: function (t, A) {
      var res = A.calc('dualBandVertical', { f: 145.5, f2: 433.5 });
      var whip = findRow(res, 'Shared whip'), r2 = findRow(res, '2 m radials'), r70 = findRow(res, '70 cm radials');
      t.near(whip.ft, 1.611041, 0.01, 'compromise whip length');
      t.near(r2.ft, 1.689985, 0.01, '2 m radial = free-space quarter wave');
      t.near(r70.ft, 0.567227, 0.01, '70 cm radial = free-space quarter wave');
      t.ok(r2.ft > r70.ft, '2 m radials are longer than 70 cm radials');
      t.ok(Math.abs(r2.ft - whip.ft) < 0.15, 'whip is close to a plain 2 m quarter wave (the classic 19 in whip)');
      t.eq(res.f, 145.5, 'echoes the 2 m design frequency');
      t.eq(res.f2, 433.5, 'echoes the 70 cm design frequency');
      t.throws(function () { A.calc('dualBandVertical', { f: 145.5, f2: 0 }); }, 'rejects a bad second frequency');
      t.ok(A.BANDS.some(function (b) { return Math.abs(b.mhz - 145.5) < 1e-9 && Math.abs((b.f2 || 0) - 433.5) < 1e-9; }),
        'band table includes the dual-band preset');
    } },

    { name: 'every calculator returns well-formed results', fn: function (t, A) {
      var ids = Object.keys(A.calculators), i, res, j, r, fRef, lamRef;
      t.ok(ids.length >= 11, 'eleven antenna types are registered');
      for (i = 0; i < ids.length; i++) {
        if (ids[i] === 'dualBandVertical') {
          res = A.calc(ids[i], { f: 145.5, f2: 433.5 });
          fRef = 145.5; lamRef = A.wavelength(145.5).m;
        } else {
          res = A.calc(ids[i], { f: 14.175 });
          fRef = 14.175; lamRef = 21.149380;
        }
        t.ok(res.rows.length >= 5, ids[i] + ': has result rows');
        t.ok(res.notes.length >= 3 && res.formulas.length >= 2, ids[i] + ': has notes and formulas');
        t.ok(res.title.length > 0 && res.summary.length > 0, ids[i] + ': has a title and summary');
        t.near(res.lambda.m, lamRef, 0.01, ids[i] + ': wavelength metadata');
        t.eq(res.f, fRef, ids[i] + ': echoes the design frequency');
        for (j = 0; j < res.rows.length; j++) {
          r = res.rows[j];
          if (typeof r.ft === 'number') {
            t.ok(isFinite(r.ft) && r.ft > 0, ids[i] + ' / ' + r.label + ': positive finite length');
          } else {
            t.ok(typeof r.text === 'string' && r.text.length > 0, ids[i] + ' / ' + r.label + ': text value');
          }
        }
      }
    } },

    { name: 'all types stay sane across the bands', fn: function (t, A) {
      var freqs = [1.9, 3.75, 7.1, 14.175, 28.5, 50.15, 145.5, 433.5, 1296], ids = Object.keys(A.calculators);
      var i, j, k, res, r;
      for (i = 0; i < freqs.length; i++) {
        for (j = 0; j < ids.length; j++) {
          res = ids[j] === 'dualBandVertical'
            ? A.calc(ids[j], { f: 145.5, f2: freqs[i] })
            : A.calc(ids[j], { f: freqs[i] });
          for (k = 0; k < res.rows.length; k++) {
            r = res.rows[k];
            t.ok(typeof r.ft !== 'number' || (isFinite(r.ft) && r.ft > 0),
              ids[j] + ' at ' + freqs[i] + ' MHz / ' + r.label);
          }
        }
      }
      var low = A.calc('dipole', { f: 1.9 }), high = A.calc('dipole', { f: 28.5 });
      t.ok(findRow(low, 'Total length').ft > findRow(high, 'Total length').ft,
        'lower frequencies need longer antennas');
    } },

    { name: 'invalid inputs are rejected', fn: function (t, A) {
      t.throws(function () { A.calc('dipole', { f: 0 }); }, 'zero frequency');
      t.throws(function () { A.calc('dipole', { f: -7 }); }, 'negative frequency');
      t.throws(function () { A.calc('dipole', { f: 'not a number' }); }, 'non-numeric frequency');
      t.throws(function () { A.calc('dipole', {}); }, 'missing frequency');
      t.throws(function () { A.calc('notAnAntenna', { f: 14 }); }, 'unknown antenna type');
    } },

    { name: 'length factor is clamped to a physical range', fn: function (t, A) {
      var base = A.calc('dipole', { f: 14.175, factor: 1 }).rows;
      var tooBig = A.calc('dipole', { f: 14.175, factor: 5 });
      var tooSmall = A.calc('dipole', { f: 14.175, factor: 0.01 });
      t.near(findRow(tooBig, 'Total length').ft, findRow({ rows: base }, 'Total length').ft * 1.1, 0.01, 'clamped at 1.1');
      t.near(findRow(tooSmall, 'Total length').ft, findRow({ rows: base }, 'Total length').ft * 0.5, 0.01, 'clamped at 0.5');
    } },

    { name: 'band table and unit conversion helpers', fn: function (t, A) {
      var i;
      t.ok(A.BANDS.length >= 15, 'covers the amateur bands');
      t.ok(A.BANDS.some(function (b) { return Math.abs(b.mhz - 14.175) < 1e-9; }), 'includes 20 m');
      for (i = 1; i < A.BANDS.length; i++) {
        t.ok(A.BANDS[i].mhz >= A.BANDS[i - 1].mhz, 'bands ascend in frequency');
      }
      t.near(A.ftToM(1), 0.3048, 0.0001, 'ft → m');
      t.near(A.mToFt(1), 3.280840, 0.001, 'm → ft');
      t.near(A.mToFt(A.ftToM(10)), 10, 0.000001, 'round trip');
      t.near(A.spaceFt(14.175, 0.5), 34.693864, 0.01, 'free-space half wave at 14.175 MHz');
    } },

    { name: 'radial, radiator and loop conventions', fn: function (t, A) {
      var v = A.calc('quarterWaveVertical', { f: 7.1 });
      t.ok(findRow(v, 'Each radial').ft > findRow(v, 'Radiator').ft, 'radials longer than radiator');
      var loop = A.calc('fullWaveLoop', { f: 14.175 });
      t.near(findRow(loop, 'Loop perimeter').ft, 1005 / 14.175, 0.0001, 'loop uses 1005/f, never the factor');
      var quad = A.calc('cubicalQuad', { f: 14.175, quadElements: 3 });
      t.ok(findRow(quad, 'Reflector loop').ft > findRow(quad, 'Driven loop').ft, 'quad reflector longer than driven');
      var y = A.calc('yagi', { f: 14.175 });
      t.ok(findRow(y, 'Reflector').ft > findRow(y, 'Driven element').ft, 'Yagi reflector longer than driven element');
      t.ok(findRow(y, 'Director 1').ft < findRow(y, 'Driven element').ft, 'Yagi directors shorter than driven element');
    } },
  ];

  function runTests(A) {
    var results = [], passed = 0, failed = 0, i, err;
    for (i = 0; i < TESTS.length; i++) {
      try {
        TESTS[i].fn(makeAsserts(), A);
        results.push({ name: TESTS[i].name, ok: true });
        passed++;
      } catch (e) {
        err = e && e.message ? e.message : String(e);
        results.push({ name: TESTS[i].name, ok: false, message: err });
        failed++;
      }
    }
    return { passed: passed, failed: failed, total: TESTS.length, results: results };
  }

  return { runTests: runTests, TESTS: TESTS, makeAsserts: makeAsserts };
});
