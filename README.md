# Ham Antenna Calculator

A dependency-free web app that calculates ham radio antenna dimensions for a
chosen design frequency: **half-wave dipole, inverted-V, folded dipole, end-fed
half wave, quarter-wave / ground-plane vertical, half-wave vertical,
five-eighth-wave vertical, Yagi beams, full-wave loops and cubical quads.**

Every result is shown in **feet and metres** (plus a feet + inches figure for
cutting wire), together with a labelled schematic, builder notes and the exact
formula used.

## Quick start

Open `index.html` in any modern browser — no build step, no server, no
dependencies, no tracking. To run it from a local server instead:

```sh
py -m http.server 8000      # Windows (Python launcher)
python3 -m http.server 8000 # macOS / Linux
# then browse to http://localhost:8000/
```

## Using it

1. Pick a **band preset** or type a **frequency in MHz** (the centre of the part
   of the band you use most).
2. Choose **feet** or **metres**.
3. Leave the **length factor** at `0.95` unless you have a reason to change it.
4. Pick an **antenna type** and read the dimensions — per-type inputs cover the
   inverted-V apex angle, Yagi directors/spacings and quad loop count/spacing.
5. **Copy results** into a notebook, or **Print / save as PDF**.

The app remembers your last settings in `localStorage`.

## Formulas

All calculators start from the free-space wavelength:

```
λ(ft) = 983.5711 / f(MHz)        λ(m) = 299.792458 / f(MHz)
```

Straight wire elements are shortened to allow for end effect and insulation:

```
element = ratio × λ × length factor        (default factor 0.95)
```

| Antenna | Relationship | At factor 0.95 |
| --- | --- | --- |
| Half-wave dipole (total) | `0.5 λ × factor` | `467.2 / f` ft = `142.4 / f` m |
| Dipole leg | `0.25 λ × factor` | `233.6 / f` ft |
| Inverted-V | dipole length × apex factor | 90° apex ≈ 2 % short of a flat dipole |
| Folded dipole | same span as a dipole | feed impedance ≈ 4 × ≈ 292 Ω |
| End-fed half wave | same as a dipole | 49:1 unun at the feed point |
| Quarter-wave vertical | `0.25 λ × factor` | `233.6 / f` ft |
| Radials / counterpoise | `0.25 λ` (free space) | ≈ 5 % longer than the radiator |
| Half-wave vertical | `0.5 λ × factor` | high feed impedance, needs matching |
| Five-eighth-wave vertical | `0.625 λ × factor` | `585 / f` ft, needs a base matching coil |
| Yagi driven element | `0.5 λ × factor` | same as a dipole |
| Yagi reflector | `1.0408 × driven` ≈ `0.495 λ` | ~4 % longer than the driven element |
| Yagi directors | `0.935 … 0.900 × driven`, log-tapered | DL6WU-style starting values |
| Full-wave loop / quad driven loop | `1005 / f` ft = `306 / f` m | published loop convention |
| Quad reflector | `1.05 × driven loop` | 5 % longer |
| Quad directors | `0.96, 0.95, … × driven loop` | 1 % extra shortening per loop |

> The classic field rules `468 / f` ft (dipole) and `234 / f` ft (quarter wave)
> correspond to a length factor of **0.9516**; the 0.95 default in the UI is
> within 0.2 % of them, and the slider goes to 1.00 for pure free-space sizes.

**Loops are the exception:** `1005 / f` already includes the loop's end effect,
so the length factor is *not* applied to loops — that is how the published quad
and loop conventions behave.

### Spacing defaults for beams

Yagi: reflector `0.15 λ` behind the driven element, first director `0.15 λ`
ahead, then `0.20 λ` between directors. Cubical quad: all loops `0.15 λ` apart.
Both are adjustable in the UI.

## Tests

The antenna maths has a 20-case suite with expected values derived independently
from the published formulas, plus a 34-check UI smoke test that drives the real
page in an iframe.

```sh
# 1. Node (needs Node installed)
node tests/antennas.test.js

# 2. Any browser — no server needed
start tests/run-tests.html          # Windows
open tests/run-tests.html           # macOS

# 3. Interactive UI test — serve the folder first, then open
py -m http.server 8000
# http://localhost:8000/tests/ui-driver.html
```

The Node runner exits non-zero when a test fails, so it works in CI. The browser
harness prints `ALL TESTS PASSED` (or the failure list) into the page, which also
makes it easy to run headless:

```sh
chrome --headless=new --dump-dom tests/run-tests.html | findstr "ALL TESTS"
```

## Files

```
index.html              page shell (controls, results, footer)
styles.css              dark/light responsive theme, no frameworks
antennas.js             pure calculation module (browser + Node)
app.js                  UI layer: tabs, inputs, formatting, SVG schematics
tests/test-cases.js     shared assertions (browser + Node)
tests/antennas.test.js  Node runner
tests/run-tests.html    browser runner
tests/ui-driver.html    end-to-end UI test (needs a local server)
```

## Accuracy and caveats

These are **starting dimensions**, not cut-and-forget answers. Height above
ground, ground conductivity, wire insulation, nearby metal, element diameter and
mounting hardware all move the resonant point.

- Cut 2–3 % long and trim to resonance with an SWR meter or analyser.
- Thick tubing resonates lower than thin wire: shorten thick elements slightly,
  and apply a boom correction when elements pass through a metal boom.
- Model beams before drilling: MMANA-GAL, EZNEC, 4nec2 and YO are free or
  low-cost and beat any closed-form estimate.
- Yagi gain and F/B figures are rules of thumb (±1.5 dB); feed impedance depends
  heavily on spacing and tuning.
- The calculators assume full-size, single-band antennas. Traps, loading coils,
  capacity hats and shortened designs need their own calculations.

## References

ARRL Antenna Book practice; DL6WU / Rothammel Yagi design data (VHF
Communications 3/82); published full-wave loop and cubical quad conventions.
The `468`, `234`, `585`, `1005` and `306` shortcuts all derive from the
wavelength constants above with the usual end-effect factors.

## Possible next steps

Moxon rectangles, delta loops, J-pole / Slim-Jim details, coil-loaded verticals,
trap dipoles, LPDA, SWR / coax loss and a link-budget calculator.
