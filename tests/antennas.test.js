/* Node test runner — from the project root:
 *
 *     node tests/antennas.test.js
 *
 * The same assertions also run in a browser: open tests/run-tests.html.
 * Exits with code 1 if any test fails, so it can be used in CI.
 *
 * (No shebang line on purpose, so the file is valid ECMAScript that even a
 *  browser can parse — see tests/syntax-check.html.)
 */

'use strict';

var path = require('path');
var A = require(path.join(__dirname, '..', 'antennas.js'));
var spec = require(path.join(__dirname, 'test-cases.js'));

var report = spec.runTests(A);
var i, r, line;

for (i = 0; i < report.results.length; i++) {
  r = report.results[i];
  line = (r.ok ? 'PASS' : 'FAIL') + ' — ' + r.name + (r.ok ? '' : ' :: ' + r.message);
  process.stdout.write(line + '\n');
}

process.stdout.write('\n' + (report.failed === 0 ? 'ALL TESTS PASSED' : 'FAILURES: ' + report.failed) +
  '  (' + report.passed + '/' + report.total + ' passed)\n');

process.exit(report.failed === 0 ? 0 : 1);
