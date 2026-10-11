/* Headless UI test for the radiation-pattern panel.
 *
 *   node tests/ui-dom.test.js
 *
 * The app is plain ES5 that drives the DOM, so rather than pulling in a DOM
 * library this file installs a minimal DOM shim, loads antennas.js and app.js
 * for real, then drives the same events a user would. That gives the UI logic
 * genuine coverage in Node (and therefore in CI) without a browser.
 *
 * Scope: the pattern panel, its read-out and the height slider. The broader
 * end-to-end walkthrough lives in tests/ui-driver.html.
 */

'use strict';

var fs = require('fs');
var path = require('path');
var ROOT = path.join(__dirname, '..');

/* ---------------- Minimal DOM shim (just enough for app.js) --------- */

function makeStyle() { return { display: '', className: '', textContent: '' }; }

function El(tag, id) {
  this.tagName = String(tag || 'div').toUpperCase();
  this.nodeType = 1;
  this.id = id || '';
  this.children = [];
  this.childNodes = this.children;
  this.parentNode = null;
  this.style = makeStyle();
  this._html = '';
  this._text = '';
  this.attrs = {};
  this._listeners = {};
  this.value = '';
  this.dataId = '';
  this.className = '';
}

/* Parse the small HTML subset app.js generates into real El children, so tests
 * can click real buttons instead of poking at markup. Handles <tag attr="v">
 * …</tag>, void tags and comments. */
var TAG_RE = /<!--[\s\S]*?-->|<(\/?)([a-zA-Z][\w-]*)((?:\s+[\w-]+(?:=(?:"[^"]*"|'[^']*'|[^\s">]+))?)*)\s*(\/?)>/g;
var VOID = { br: 1, hr: 1, img: 1, input: 1, meta: 1, link: 1, area: 1, base: 1, col: 1, embed: 1, source: 1, track: 1, wbr: 1 };

function setChildrenFromHtml(node, html) {
  node.children.forEach(function (c) { c.parentNode = null; });
  node.children = [];
  node.childNodes = node.children;

  var stack = [node], m, el, attrs, a, am;
  TAG_RE.lastIndex = 0;
  while ((m = TAG_RE.exec(html)) !== null) {
    if (m[0].charAt(0) === '!') continue;
    if (m[1] === '/') {
      if (stack.length > 1) stack.pop();
      continue;
    }
    el = new El(m[2]);
    attrs = m[3] || '';
    a = /([\w-]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s">]+)))?/g;
    while ((am = a.exec(attrs)) !== null) {
      el.setAttribute(am[1], am[2] !== undefined ? am[2] :
        (am[3] !== undefined ? am[3] : (am[4] !== undefined ? am[4] : '')));
    }
    var parent = stack[stack.length - 1];
    parent.appendChild(el);
    if (!m[4] && !VOID[m[2].toLowerCase()]) stack.push(el);
  }
}

Object.defineProperty(El.prototype, 'innerHTML', {
  get: function () { return this._html; },
  set: function (v) { this._html = String(v); setChildrenFromHtml(this, String(v)); }
});
Object.defineProperty(El.prototype, 'textContent', {
  get: function () { return this._text; },
  set: function (v) { this._text = String(v); }
});
Object.defineProperty(El.prototype, 'firstChild', {
  get: function () { return this.children[0] || null; }
});
Object.defineProperty(El.prototype, 'offsetParent', {
  get: function () { return null; }
});

El.prototype.appendChild = function (c) {
  c.parentNode = this; this.children.push(c); return c;
};
El.prototype.removeChild = function (c) {
  var i = this.children.indexOf(c);
  if (i !== -1) this.children.splice(i, 1);
  c.parentNode = null; return c;
};
El.prototype.insertBefore = function (c, ref) {
  var i = this.children.indexOf(ref);
  c.parentNode = this;
  if (i === -1) this.children.push(c); else this.children.splice(i, 0, c);
  return c;
};
El.prototype.setAttribute = function (k, v) {
  this.attrs[k] = String(v);
  if (k === 'id' && !this.id) this.id = String(v);
  if (k === 'data-id') this.dataId = String(v);
  if (k === 'value') this.value = String(v);
  if (k === 'class') this.className = String(v);
};
El.prototype.getAttribute = function (k) {
  return Object.prototype.hasOwnProperty.call(this.attrs, k) ? this.attrs[k] : null;
};
El.prototype.removeAttribute = function (k) { delete this.attrs[k]; };
El.prototype.addEventListener = function (type, fn) {
  (this._listeners[type] = this._listeners[type] || []).push(fn);
};
El.prototype.removeEventListener = function (type, fn) {
  var l = this._listeners[type] || [], i = l.indexOf(fn);
  if (i !== -1) l.splice(i, 1);
};
El.prototype.dispatchEvent = function (ev) {
  var node = this;
  if (!ev.target) ev.target = this;
  ev.preventDefault = function () {};
  if (ev.bubbles === undefined) ev.bubbles = true;
  while (node) {
    var l = (node._listeners[ev.type] || []).slice(), i;
    ev.currentTarget = node;
    for (i = 0; i < l.length; i++) l[i].call(node, ev);
    if (!ev.bubbles || !node.parentNode) break;
    node = node.parentNode;
  }
  return true;
};

function descendants(node, out) {
  out = out || [];
  var i, c = node.children || [];
  for (i = 0; i < c.length; i++) { out.push(c[i]); descendants(c[i], out); }
  return out;
}

function hasClass(node, cls) {
  return String(node.className || '').split(/\s+/).indexOf(cls) !== -1;
}

function matches(node, sel) {
  if (typeof sel !== 'string') return false;
  var cls = /\.([\w-]+)/.exec(sel);
  var tag = /^[\w]+/.exec(sel);
  if (tag && node.tagName !== tag[0].toUpperCase()) return false;
  if (cls && !hasClass(node, cls[1])) return false;
  return true;
}

El.prototype.querySelector = function (sel) {
  return descendants(this).filter(function (n) { return matches(n, sel); })[0] || null;
};
El.prototype.querySelectorAll = function (sel) {
  return descendants(this).filter(function (n) { return matches(n, sel); });
};
El.prototype.getElementById = function (id) {
  var found = descendants(this).filter(function (n) { return n.id === id; })[0];
  return found || (this.id === id ? this : null);
};
El.prototype.closest = function (sel) {
  var n = this;
  while (n) { if (matches(n, sel)) return n; n = n.parentNode; }
  return null;
};

/* ---------------- Document + sandbox ---------------- */

/* Pre-create every element index.html declares, so app.js's `init()` finds the
 * real control tree instead of bailing out on the "not the calculator page"
 * guard. */
var IDS = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')
  .match(/id="([\w-]+)"/g) || [];
var byId = {};
IDS.forEach(function (raw) {
  var id = raw.slice(4, -1);
  byId[id] = new El('div', id);
});
function ensure(id) {
  if (!byId[id]) byId[id] = new El('div', id);
  return byId[id];
}

var document = {
  documentElement: new El('html'),
  body: new El('body'),
  createElement: function (tag) { return new El(tag); },
  createTextNode: function (t) { var n = new El('#text'); n.textContent = t; return n; },
  createDocumentFragment: function () { return new El('#fragment'); },
  getElementById: function (id) { return byId[id] || null; },
  querySelector: function (sel) { return document.body.querySelector(sel); },
  querySelectorAll: function (sel) { return document.body.querySelectorAll(sel); },
  addEventListener: function () {}
};

var sandbox = {
  document: document,
  navigator: { clipboard: null },
  localStorage: {
    getItem: function () { return null; },
    setItem: function () {},
    removeItem: function () {}
  },
  setTimeout: function () {},
  location: { search: '', href: 'https://example.test/index.html' },
  addEventListener: function () {},
  print: function () {},
  console: console
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.self = sandbox;

/* ---------------- Load the real modules ---------------- */

/* Load a browser-style script into the sandbox. `module` and `globalThis` are
 * passed as shadowing parameters so the UMD wrapper takes its browser branch
 * (`root.Antennas = factory()`) instead of the Node `module.exports` one. */
function load(file, label) {
  var src = fs.readFileSync(path.join(ROOT, file), 'utf8');
  try {
    new Function(
      'window', 'document', 'navigator', 'localStorage', 'location',
      'module', 'globalThis', 'self',
      src
    ).call(sandbox, sandbox, document, sandbox.navigator, sandbox.localStorage,
      sandbox.location, undefined, sandbox, sandbox);
  } catch (e) {
    console.error('Failed to load ' + label + ': ' + (e && e.stack || e));
    process.exit(1);
  }
}

load('antennas.js', 'antennas.js');
load('app.js', 'app.js');

var A = sandbox.Antennas;
var App = sandbox.HamAntennaCalculator;

/* ---------------- Harness ---------------- */

var passed = 0, failed = 0;

function check(name, cond, detail) {
  if (cond) { passed++; console.log('  PASS — ' + name); }
  else { failed++; console.log('  FAIL — ' + name + (detail ? ' :: ' + detail : '')); }
}

/** Strip tags/entities so SVG markup can be searched as plain text. */
function htmlText(html) {
  return String(html || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&[a-zA-Z#0-9]+;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function countClass(html, cls) {
  var re = new RegExp('class="[^"]*\\b' + cls + '\\b', 'g');
  return (String(html).match(re) || []).length;
}

function patternHtml() { return ensure('pattern').innerHTML; }

function tabs() { return ensure('tabs').querySelectorAll('.tab'); }

function clickTab(id) {
  var btn = tabs().filter(function (t) {
    return (t.getAttribute('data-id') || t.dataId) === id;
  })[0];
  if (!btn) throw new Error('no tab button for ' + id);
  btn.dispatchEvent({ type: 'click', target: btn });
  return btn;
}

function fire(el, type) { el.dispatchEvent({ type: type, target: el }); }

/** Read the value cell of one read-out row by its label (label is a regex-safe
 *  string; the optional unit span is included so "dB"/"°" assertions work). */
function statValue(label) {
  var m = new RegExp('<dt class="pat-stat-k">' + label + '[^<]*</dt>\\s*' +
    '<dd class="pat-stat-v">([\\s\\S]*?)</dd>', 'i').exec(patternHtml());
  return m ? htmlText(m[1]) : null;
}

/* ---------------- Tests ---------------- */

console.log('\nHeadless UI test — radiation pattern panel\n');

if (!A) { console.error('antennas.js did not attach to the sandbox'); process.exit(1); }
if (!App) { console.error('app.js did not expose HamAntennaCalculator'); process.exit(1); }

console.log('[bootstrap]');
check('app exposes its pattern renderer', typeof App.patternHtml === 'function');
check('math module loaded in the same sandbox', typeof A.radiationPattern === 'function');
check('tabs were generated', tabs().length >= 11, 'found ' + tabs().length);

var ids = Object.keys(A.calculators);

console.log('\n[per-antenna panel]');
var missing = [], thin = [], dirty = [];
ids.forEach(function (id) {
  clickTab(id);
  var html = patternHtml();
  var svgs = (html.match(/<svg/g) || []).length;
  var stats = countClass(html, 'pat-stat');
  if (svgs < 2) missing.push(id + ' (' + svgs + ' svgs)');
  if (stats < 10) thin.push(id + ' (' + stats + ' metrics)');
  if (/NaN|undefined|Infinity/.test(html)) dirty.push(id);
});
check('every antenna type shows azimuth + elevation patterns', missing.length === 0, missing.join(', '));
check('every panel ships a full metric read-out', thin.length === 0, thin.join(', '));
check('no NaN / undefined leaks into the rendered HTML', dirty.length === 0, dirty.join(', '));

console.log('\n[azimuth rose geometry]');
clickTab('dipole');
var rose = patternHtml();
check('major 10 dB rings are drawn', countClass(rose, 'p-ring') >= 3,
  'p-ring count ' + countClass(rose, 'p-ring'));
check('minor 5 dB rings are drawn', countClass(rose, 'p-ring-minor') >= 5);
check('the 0 dB reference ring is emphasised', countClass(rose, 'p-ring-zero') >= 1);
check('compass letters are labelled', />\s*N\s*</.test(rose) || />\s*S\s*</.test(rose));
check('lobe area is filled', countClass(rose, 'p-fill') >= 1);
check('the peak lobe is marked', countClass(rose, 'p-peak-dot') >= 1);
check('nulls are marked', countClass(rose, 'p-null-dot') >= 1);
check('a legend explains the markers',
  /azimuth \/ elevation envelope/.test(htmlText(rose)));
var firstSvg = rose.slice(0, rose.indexOf('</svg>'));
check('minor rings carry no text label (majors only)',
  !/>\s*-5\s*</.test(firstSvg), 'a bare "-5" label leaked into the rose');

console.log('\n[elevation + cartesian cut]');
check('the horizon is drawn', countClass(rose, 'p-horizon') >= 1);
check('a cartesian dB-vs-angle plot is present', countClass(rose, 'p-plot-frame') >= 1);
check('the beamwidth arc is annotated', /−3\s*dB/.test(rose), 'no −3 dB marker');
check('angle ticks are labelled on the cartesian plot',
  countClass(rose, 'p-axis-label') >= 4);

console.log('\n[read-out values]');
check('polarization is reported', /Vertical|Horizontal/.test(statValue('Polarization') || ''),
  statValue('Polarization'));
check('pattern class is reported', !!statValue('Pattern class'), String(statValue('Pattern class')));
check('front-to-back is reported in dB', /dB/.test(statValue('Front-to-back') || ''),
  statValue('Front-to-back'));
check('takeoff angle is reported in degrees', /°/.test(statValue('Takeoff angle') || ''),
  statValue('Takeoff angle'));
check('azimuth nulls are reported', statValue('Azimuth nulls') !== null,
  String(statValue('Azimuth nulls')));
check('ground model is stated', /perfect ground/i.test(statValue('Ground model') || ''),
  statValue('Ground model'));
check('normalization is stated', /0 dB = peak/.test(statValue('Normalization') || ''),
  statValue('Normalization'));

console.log('\n[directional vs omnidirectional]');
clickTab('yagi');
check('a beam reports a finite azimuth beamwidth',
  /^\d/.test(statValue('Azimuth -3 dB beamwidth') || statValue('Azimuth −3 dB beamwidth') || ''),
  String(statValue('Azimuth −3 dB beamwidth')));
check('a beam reports a real front-to-back ratio',
  parseFloat(statValue('Front-to-back')) >= 8, statValue('Front-to-back'));
check('a beam reports its peak bearing', /°/.test(statValue('Azimuth peak bearing') || ''),
  statValue('Azimuth peak bearing'));
clickTab('quarterWaveVertical');
check('an omni reports itself as omnidirectional',
  /omnidirectional/.test(statValue('Pattern class') || ''), statValue('Pattern class'));
check('an omni shows no azimuth nulls', /none/i.test(statValue('Azimuth nulls') || ''),
  statValue('Azimuth nulls'));
check('an omni reports omni for azimuth beamwidth',
  /omni/.test(statValue('Azimuth −3 dB beamwidth') || ''), statValue('Azimuth −3 dB beamwidth'));

console.log('\n[height slider]');
clickTab('dipole');
check('the height slider is shown for a dipole',
  ensure('pat-height-wrap').style.display !== 'none');
var slider = ensure('pat-height');
slider.value = '1.5';
fire(slider, 'input');
check('dragging the slider updates its read-out',
  ensure('pat-height-value').textContent.indexOf('1.50') !== -1,
  ensure('pat-height-value').textContent);
check('dragging the slider re-renders the pattern', /pat-stat/.test(patternHtml()));
clickTab('quarterWaveVertical');
check('verticals hide the height slider',
  ensure('pat-height-wrap').style.display === 'none',
  String(ensure('pat-height-wrap').style.display));

console.log('\n[dual-band overlay]');
clickTab('dualBandVertical');
check('dual-band elevation mentions the 70 cm trace',
  /70 cm/.test(htmlText(patternHtml())), htmlText(patternHtml()).slice(0, 140));
check('dual-band draws the dashed second trace',
  countClass(patternHtml(), 'p-lobe2') >= 1);

console.log('\n[exported renderer]');
clickTab('dipole');
check('the app exposes the pattern it just rendered',
  typeof App.lastPattern === 'function' && App.lastPattern() && App.lastPattern().az.length > 0,
  String(App.lastPattern()));
var direct = App.patternHtml(App.lastPattern());
check('patternHtml() accepts a pattern object',
  typeof direct === 'string' && direct.length > 500);
/* The panel wraps the renderer output in a heading, so compare the tail. */
check('patternHtml() matches the rendered panel',
  patternHtml().indexOf(direct) === patternHtml().length - direct.length &&
  direct.length > 0,
  'exported renderer is not the tail of the DOM panel');
check('the panel keeps its heading above the plot',
  /pattern-title/.test(patternHtml().slice(0, patternHtml().indexOf(direct))));

console.log('\n[pattern data export]');
check('a data table is offered', /pat-data/.test(patternHtml()),
  patternHtml().slice(0, 120));
check('an export button is present', /class="[^"]*\bpat-csv\b/.test(patternHtml()));
check('the data table lists angles and dB columns',
  /Angle/.test(htmlText(patternHtml())) && /Azimuth \(dB\)/.test(htmlText(patternHtml())),
  htmlText(patternHtml()).slice(0, 200));
clickTab('dualBandVertical');
check('the dual-band table carries a fourth column',
  /Elevation, band 2/.test(htmlText(patternHtml())),
  htmlText(patternHtml()).slice(0, 240));
check('the dual-band CSV carries the band-2 field',
  App.patternCsv(App.lastPattern()).indexOf('elevation_band2_db') !== -1,
  App.patternCsv(App.lastPattern()).split('\n')[0]);

clickTab('dipole');
var csv = App.patternCsv(App.lastPattern()).split('\n');
check('CSV has one header row', /^angle_deg,azimuth_db,elevation_db$/.test(csv[0]), csv[0]);
check('CSV has one row per azimuth sample',
  csv.length === App.lastPattern().az.length + 1,
  csv.length + ' lines vs ' + App.lastPattern().az.length + ' samples');
/* Azimuth is 5°-stepped and elevation 2°-stepped, so the extra azimuth angles
 * legitimately have no elevation sample — those cells stay empty. */
check('CSV cells are numeric or empty',
  csv.slice(1).every(function (l) { return /^-?[\d.]*,-?\d+\.\d+,-?\d*\.?\d*$/.test(l); }),
  csv[1] + ' / ' + csv[csv.length - 1]);
check('every CSV azimuth sample starts at its angle',
  csv.slice(1, App.lastPattern().az.length + 1).every(function (l, i) {
    return l.split(',')[0] === String(i * 5);
  }), csv[1]);
check('the CSV filename encodes the antenna and frequency',
  /^dipole-\d+MHz$/.test(App.patternFileStem(App.lastPattern())),
  App.patternFileStem(App.lastPattern()));

console.log('\n[instrument status bar + version stamp]');
var sb = htmlText(ensure('statusbar').innerHTML);
check('the status bar reports the frequency', /\bf\b/.test(sb) && /MHz/.test(sb), sb);
check('the status bar reports wavelength', /λ/.test(sb), sb);
check('the status bar reports the length factor', /\bk\b/.test(sb), sb);
check('the status bar stamps the model version', /v\s*1\.\d/.test(sb), sb);
check('the status bar matches the app constant',
  sb.indexOf('v ' + App.MODEL_VERSION) !== -1, sb);
check('the footer version is filled in by the app',
  /^v\d+\.\d+$/.test(ensure('foot-version').textContent),
  ensure('foot-version').textContent);
clickTab('yagi');
check('the status bar names the pattern class',
  /directional/.test(htmlText(ensure('statusbar').innerHTML)),
  htmlText(ensure('statusbar').innerHTML));
clickTab('quarterWaveVertical');
check('an omni is labelled as such',
  /omni/.test(htmlText(ensure('statusbar').innerHTML)),
  htmlText(ensure('statusbar').innerHTML));
check('an omni omits the height term',
  !/\bh\b/.test(htmlText(ensure('statusbar').innerHTML)));

console.log('\n[copied summary carries the model stamp]');
clickTab('dipole');
var copied = App.summaryText(App.lastResult(), 'ft');
check('the copy block names the model version',
  copied.indexOf('Model v' + App.MODEL_VERSION) !== -1, copied.slice(-160));
check('the copy block carries the pattern disclaimer',
  /not a NEC model/.test(copied), copied.slice(-160));

console.log('\n' + (failed === 0 ? 'ALL UI TESTS PASSED' : 'FAILURES: ' + failed) +
  '  (' + passed + '/' + (passed + failed) + ')\n');
process.exit(failed ? 1 : 0);
