# Dev notes

Working notes for the conference build. Not part of the student project.
Updated at the end of every phase with what was tried and what surprised me.

The spec being followed is `CONFERENCE_BUILD_PROMPT.md` in this folder.

---

## Phase 0: recon and safety rails

Done 2026-08-03. Nothing in the shipped project was modified. Tag `pre-conference`
points at commit `427f7e8`, which is the state before any conference work.

### File map

| File | Owns | Globals it defines | Reads from config.js |
|---|---|---|---|
| `colors.js` | HSV and RGB conversion, hue distance, RGB distance, the six relations, random colour and example generation | `Colors`, `Colors.relationNames` | nothing |
| `brain.js` | population coding, the network, competition, Hebbian learning, readout, lesioning, scoring | `HUE_N` 16, `SAT_N` 6, `VAL_N` 6, `DIM` 28, `HUE_SIGMA`, `LIN_SIGMA`, `HUE_GAIN` 2.0, `POOL_CHROMA` 0, `POOL_LUMA` 1, `READOUT_SHARPNESS` 0.5, `readPeak`, `sharpen`, `Code`, `Brain` | `hiddenNeurons`, `connectivity`, `fireFraction`, `chromaFraction`, `learningRate`, `forgetting`, `seed`, all read through `this.cfg` |
| `config.js` | the eleven student settings | `CONFIG` | is the source |
| `viz.js` | the crowd view of all neurons, the brain map strip, the score sparkline, the shared theme palette, `slotColor` | `Viz` | `theme` at init only |
| `neuronview.js` | one spotlighted neuron at cell scale: dendrites, soma, membrane arc, axon with travelling spike, terminals, tuning curve | `NeuronView` | `theme` at init, reads `brain.cfg.fireFraction` live in `drives()` |
| `app.js` | all UI wiring, the training loop, the readouts. An IIFE, exports nothing | none | `relation`, `theme`, `brainName`, `ownerName`, `trainingExamples`, `trainSpeed` |
| `index.html` | layout, the inline stylesheet, the element ids, the script tag order | 27 element ids | nothing |
| `_verify.js` | headless check of all six relations, a hidden-layer sweep, parameter extremes, the lesion curve, a timing budget | dev only | reads `CONFIG` as a base |
| `_verify_ui.js` | runs the browser code under a fake DOM, checks every id referenced in `app.js` exists in `index.html`, drives every control | dev only | reads `CONFIG` as a base |

Script tag order in `index.html` matters and is load bearing:
`colors.js`, `brain.js`, `config.js`, `viz.js`, `neuronview.js`, `app.js`.
`neuronview.js` reads `Viz.themes` at init, so `viz.js` must come first.

### Every place state is mutated in place

The pattern to know about: `Brain` reuses the same typed arrays for every call.
The arrays are instance state, not return values, so any call that runs the
network destroys what the drawing code was about to read. `neuronview.js`
already had to work around this once, in `drives()`.

| Where | What it mutates | Why it bites |
|---|---|---|
| `brain.js:234` `think()` | `this.inp` via `.set(x)` | `viz.js` and `neuronview.js` both read `brain.inp` as "the colour currently being shown". Any `predict`, `evaluate` or `drawMap` call silently repaints it. `app.js:178` already compensates by re-running `think()` on the example it wants displayed. |
| `brain.js:235` `think()` | `this.hid`, aliased as `pre` and returned | Confirmed: `think()` returns `this.hid` itself, not a copy. The caller's "activation vector" is destroyed by the next call that runs the network. This is the one that forced `drives()` to recompute the pool threshold from scratch. |
| `brain.js:249,264,271` `think()` | `pre[j]`, so `this.hid`, three times: rectify, then silence the losers, then normalise by the total | After `think()` returns there is no record of the raw pre competition drive. It is gone. Anything that wants "how hard was this cell driven" has to recompute it. |
| `brain.js:278-279` `predict()` | `this.out` via `y.fill(0)` then accumulate | `viz.js` draws the output column from `brain.out` and `Viz.outPeak(brain)`. `evaluate()` calls `predict()` 120 times, so after a stats refresh `brain.out` holds the last internal probe, not anything on screen. |
| `brain.js:309` `learn()` | `this.Who` scaled by `(1 - decay)` | Expected. Note it runs for every hidden neuron including silent ones, before the `a === 0` early exit, so forgetting applies layer wide, not only to winners. |
| `brain.js:314` `learn()` | `this.Who` Hebbian add | The learning rule. Do not touch. |
| `brain.js:323` `learn()` | `this.Who` divided by its norm when over 1 | The homeostatic cap. Do not touch. |
| `brain.js:305` `learn()` | `this.fireCount` | Cumulative, never reset except by `reset()`. |
| `brain.js:326` `learn()` | `this.stepsTrained` | |
| `brain.js:339` `lesion()` | `this.rng` closure state, plus `this.alive` | See below. This is the important one. |
| `brain.js:350` `heal()` | `this.alive` filled with 1 | |
| `brain.js:215` `reset()` | replaces `Who`, `alive`, `hid`, `out`, `inp`, `fireCount` with fresh arrays | Not an in place mutation, a reallocation. Anything caching a reference to an old array goes stale silently. Nothing currently does, because `viz.js` and `neuronview.js` re-read `brain.X` every frame. Worth remembering if a later phase adds caching. |
| `brain.js:187-202` `buildWiring()` | `this.rng` closure state | Wiring consumes a variable number of draws depending on `connectivity` and `hiddenNeurons`, so the rng is at a different position after construction for every config. |
| `viz.js:20,102-105` | `Viz.synCache`, `Viz.synCacheAge` | Module level singleton, refreshed every 12 frames, keyed to no particular brain. |
| `viz.js:38,73` | `Viz.layout` | Rebuilt only when `layout.hidden.length !== brain.nHid`. Two brains with the same neuron count silently share one layout. |
| `neuronview.js:27-34` | `NeuronView.spikeAt`, `wasFiring`, `prof`, `profFor`, `profAge` | Module level singleton, one spotlight only. |

### Three findings that change later phases

**1. `lesion()` is not deterministic, so Phase 4 cannot use it as is.**

Measured: calling `heal()` then `lesion(0.4)` three times in a row kills three
different sets of cells. Consecutive calls shared only 37 of 102 dead cells.
The cause is that `lesion()` draws from `this.rng` for its shuffle, and `this.rng`
is a stateful closure that is never rewound. So every drag of the existing
lesion slider in `app.js` kills a fresh random set.

This is invisible in the current lab UI because nobody drags back and forth and
expects the same number. It would be very visible on a projector. Phase 4 asks
for "the same slider position always kills the same cells", so it needs a new
deterministic mask built from its own independent generator, seeded once. The
brief allows adding a lesion mask, so this is in scope and does not touch the
learning rule.

Side effect worth knowing: because `lesion()` advances `this.rng`, lesioning also
shifts the sequence any later `lesion()` call sees. Nothing else currently draws
from `this.rng` after construction, so no other behaviour is affected today.

**2. The training stream is not reproducible from `seed`, which affects Phases 6 and 7.**

Measured: two brains constructed with the same seed get byte identical fixed
wiring, and then diverge to different learned weights. `CONFIG.seed` only seeds
the wiring. The example stream comes from `Math.random()` in
`Colors.randomColor()`, and for the two ambiguous relations the coin flip that
picks between the two correct answers is also `Math.random()`, inside
`triadic.apply` and `split-complement.apply`.

Consequences:

- Phase 6 must generate one array of examples up front and feed the identical
  array to both brains. Seeding two brains identically is not enough. This needs
  no change to `colors.js`.
- Phase 7 claims every experiment is seeded and reproducible. That is not
  currently achievable for `triadic` and `split-complement`, because their
  randomness lives inside `apply`, which the hard constraints forbid me from
  changing.

  **Decided 2026-08-03.** `_dev/experiments.js` will temporarily replace the
  global `Math.random` with a seeded generator while it runs, then restore it.
  That makes all six relations reproducible, including the two ambiguous ones,
  and touches no shipped file. `colors.js` stays byte identical. The harness
  must restore the original function in a `finally` block so a thrown error
  cannot leave a seeded `Math.random` installed for the rest of the process.

**3. Extracting shared logic out of `app.js` weakens verifier check 1.**

`_verify_ui.js` finds element ids by regexing `app.js` specifically, for both
`getElementById(...)` and the `$(...)` helper. Phase 1 says to extract shared
logic into `shared.js` rather than copy `app.js`. Any `$()` call that moves out
of `app.js` stops being checked. Phase 9 already scopes extending the verifier,
but Phase 1 should keep the id checking honest by making the scan cover every
shipped script rather than only `app.js`.

### Other things worth remembering

- `think()` allocates a `members` array per pool per call and sorts it, so every
  training example costs two array builds and two sorts over the hidden layer.
  That is the hot path and it sets the Phase 7 runtime budget.
- `Code.encode()` and `Code.decode()` allocate fresh arrays and hold no state,
  so they are safe to call from drawing code. `readPeak` and `sharpen` only read.
- `evaluate()` returns `hueError: null` for `luminance`, because every answer is
  grey and the `target.s > 0.15` guard excludes every sample. Any new metric
  display has to handle null, not assume a number.
- `evaluate()` uses `Colors.randomColor()`, so the score moves a little between
  identical calls. Displayed scores are noisy by roughly a point.
- `score` is derived from RGB error, not hue error: `100 * (1 - rgbError / 0.5)`.

### Verifier baseline on a clean checkout

Both pass at commit `427f7e8`.

| Verifier | Wall clock | Result |
|---|---|---|
| `node _verify.js` | 12.9s | exit 0, all six relations train |
| `node _verify_ui.js` | 5.6s | exit 0, 27 ids resolved, all controls driven |

The brief expected `_verify_ui.js` to be the slow one at about 15 seconds. It is
not. It is the faster of the two at 5.6s, and `_verify.js` is the slow one at
12.9s, because it performs 32 full training runs of 4000 examples each. The
Phase 9 correction to `TEACHER.md` should say the pair takes about 20 seconds
and name `_verify.js` as the reason.

Single run cost, measured: 4000 examples at 256 hidden neurons takes about
424ms, and roughly 400ms including the evaluation passes. That is the number the
Phase 7 budget has to be built from. Around 300 distinct training runs are
needed if experiment 7 reuses experiment 1's runs rather than repeating them,
which lands the suite near 2 minutes single threaded and inside the target. If
experiment 7 trains its own brains the suite roughly doubles.
