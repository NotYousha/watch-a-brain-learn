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

---

## Phase 1: presenter shell

New: `presenter.html`, `presenter.css`, `presenter.js`, `shared.js`.
Changed: `app.js` now uses `shared.js`, `index.html` loads it, `_verify_ui.js`
rewritten, `brain.js` gained three additions, `config.js` relation switched.

### What went into shared.js and why

`app.js` and `presenter.js` genuinely share the pacing table, the training loop,
and the number formatting. All three moved into `shared.js` and both entry points
call it, so the presenter is not a copy of the lab UI. `Shared.Trainer` owns
pause and resume and calls back into whichever UI is driving it. The lab UI's
frame behaviour is unchanged: still one example per frame on slow, still a stats
refresh every twenty frames.

Also in `shared.js`: the output vote distribution, the one hump versus two humps
detection, and a reader for how many inputs each cell actually ended up with.
Those are needed by the presenter, by A/B mode in phase 6, and by nothing in the
lab UI.

### Additions to brain.js

Three, all permitted by the brief, none touching the learning rule.

- `lesionOrder(seed)` and `lesionTo(fraction, seed)`. One fixed kill order from
  an independent generator, then take a prefix of it. Repeatable, nested, and
  fully reversible, which the built-in `lesion()` is not. See phase 0 finding 1.
- `snapshot()` and `restore(s)`. Copies `Who`, `alive`, `fireCount` and
  `stepsTrained`. Deliberately does not touch `Wih`, which is fixed at birth and
  never learns. The tutorial in phase 5 needs this to put the brain back after
  training silently to make a point.

### Colourless chrome without editing viz.js

The brief says reuse `viz.js` unchanged, and also says no hue anywhere in the
chrome. The shipped dark theme is blue-black, which is a hue. Resolved by
assigning a neutral palette onto `Viz.theme` and `NeuronView.theme` from
`presenter.js` after `init()`, which needs no edit to either file.

Neuron fill colours are left alone on purpose. Pale blue for a colour-pathway
cell, amber for a brightness-pathway cell, and the green membrane arc are data,
not decoration: they say which pathway a cell belongs to and whether it just
fired. Tour stop 6 refers to the green arc by name.

### Surprises

- A `<canvas>` with `width: 100%` and no CSS height falls back to its 150px
  intrinsic attribute height. That silently inflated the whole metric row to
  about 440px on the first screenshot. Canvases in this build get an explicit
  CSS height.
- The fake DOM in `_verify_ui.js` defaulted every element's `hidden` to false, so
  the shortcuts overlay looked permanently open and the keydown handler, which
  correctly ignores keys while an overlay is up, appeared to be broken. The
  harness now reads the `hidden` attribute out of the markup.
- `_verify_ui.js` was rewritten around a reusable harness so each page gets its
  own fake DOM. Booting both pages into one scope had them fight over the `net`
  and `cell` canvas ids and over the `Viz` singleton. This is part of phase 9's
  work brought forward, because it protects every phase after this one.
- The header wiring chip reads real in-degrees: each cell hears 1 to 7 of 28, not
  the 2 to 4 the brief's tour copy assumes. Tour stop 8 must read the real
  numbers rather than hard-code them.

### Screenshots

Captured headless with the Playwright Chromium already on this machine at
`~/.cache/ms-playwright/chromium-1228/chrome-linux64/chrome`. No scrollbar and no
clipping at either 1920x1080 or 1440x900. `presenter.html#train` starts a fast
run on load, which is what makes a useful screenshot possible.

### Relation changed to complement

Asked for during this phase. `warmer` drags every colour toward orange and lifts
saturation, so the answer row reads as a set of shades rather than a
transformation, which is a fair complaint. `CONFIG.relation` is now `complement`,
the clean opposite-on-the-wheel flip. Only the config value changed. No relation
definition in `colors.js` was touched, and all six are still reachable live on
keys 1 to 6.

---

## Phase 2: metrics and the confidence widget

Most of this landed with the shell in phase 1. What phase 2 added is the
measurement that the panel's claim is actually true, plus two fixes.

### The claim, measured

Trained 4000 examples per relation, then read the vote distribution for one fixed
probe colour, pure red at h 0:

| relation | confidence | score | vote shape |
|---|---|---|---|
| complement | 96% | 86 | unimodal, one spike at 180 deg |
| analogous | 96% | 86 | unimodal, spike at 23 deg |
| triadic | 53% | 51 | **bimodal, peaks 135 deg apart**, humps at 113 and 248 |
| split-complement | 86% | 69 | bimodal, peaks 45 deg apart, humps at 158 and 203 |
| warmer | 93% | 85 | unimodal, spike at 23 deg |
| luminance | 0% | 84 | no hue vote at all, by design |

Triadic's two correct answers for red are 120 and 240. The network puts its two
humps at 113 and 248, so the picture the talk needs is real and not a stretch.
This is now asserted in `_verify_ui.js`, including that ambiguity collapses
confidence relative to complement, so it cannot quietly stop being true.

### The vote distribution is normalised per population, not globally

Each of the three groups is scaled against its own loudest cell. That needs
saying out loud because it sounds like flattery and is not: `Code.decode()` reads
hue by circular mean across the 16 hue cells, and reads vividness and brightness
each by a peak within their own six. Normalising all 28 against one global peak
let the brightness cells, which carry more total weight, visually crush the hue
spike that is the entire point of the panel. Per population matches how the
network reads itself.

### Two labels that were wrong

- A brain with no hue vote at all was reading "no vote yet", which is right for an
  untrained brain and misleading on `luminance`, where every correct answer is a
  grey and no hue vote is the correct result rather than a failure. Now
  distinguished by `stepsTrained`.
- The bimodal readout goes to `--signal` when it fires, because that is the
  moment worth looking at.

### Surprise

`analogous` and `warmer` both peak at 23 degrees rather than 30 and 13.5. That is
the bin spacing, not an error: hue cells sit every 22.5 degrees, so the reported
hump is the loudest cell, not the interpolated answer. The interpolated answer is
what `decode()` returns and what the hue error metric uses. Worth knowing before
someone asks why the label says 23.

---

## Phase 3: the prediction grid

New `probes.js`. 64 fixed colours, 16 hues at four combinations of vividness and
brightness, so the strip reads as four hue sweeps rather than noise.

### How the hold-out is enforced

Two mechanisms, and the brief asked for this to be logged, so:

1. **The trainer refuses them.** `Probes.example(relation)` draws from
   `Colors.makeExample()` and throws the candidate away if it lands within
   `RADIUS` of any probe, which is 1.2 degrees of hue and 0.02 of both saturation
   and brightness. `presenter.js` uses `Probes.example()` and never
   `Colors.makeExample()` for training. `Probes.rejected` counts the throwaways
   and the count is shown on screen beside the grid, so the enforcement is
   visible rather than asserted.
2. **Nothing ever learns a probe.** The grid only calls `predict()`, which writes
   to `out`, `inp` and `hid` but never to `Who`.

Verified in `_verify_ui.js`: all 64 probes are recognised as held out, and across
20000 generated training colours, zero landed on a probe. The refusal rate is
about 0.26 percent, which matches the radius.

The four levels all sit inside the range `Colors.randomColor()` draws from, s and
v both 0.45 to 1.0. That matters: probes outside the training distribution would
make a bad score meaningless.

### Render cost, measured honestly

The brief asked for under 8ms. Measured over 40 runs on a trained 256-neuron
brain, in Node, excluding the DOM writes:

```
min 5.61ms   median 6.23ms   max 9.00ms   cold first render 6.05ms
```

So the median is comfortably inside 8ms but the tail is not: it can spike to 9ms,
and in the browser the 64 style writes add roughly another 1 to 3ms. The observed
worst case on screen was 9.5ms.

The dominant cost is not the drawing, it is `think()`: each of the 64 `predict()`
calls builds and sorts one array per pool, so a single render performs 128 sorts.
That cannot be reduced without touching the competition, which is forbidden and
rightly so. Since the grid re-renders every 200 examples, the worst case is an
occasional dropped frame rather than a stall. Worth knowing rather than claiming
a clean pass.

### The cadence is not a flat 200

Convergence is fastest in the first few hundred examples, which is exactly when a
flat 200-example cadence leaves a stale number on screen. The first screenshot
caught it at 198 examples still displaying the untrained 90 degree error, which
would be an unfortunate thing to have happen live. It now re-renders every 50
examples until 600 have been seen, then settles to the configured 200.

### Correct row is frozen per relation

`triadic` and `split-complement` pick one of their two correct answers at random
inside `apply()`, so recomputing ground truth every render would make the bottom
row flicker for reasons that have nothing to do with learning. `paintStatic()`
computes it once per relation and `Probes.answers()` takes it as an argument.

---

## Phase 4: live lesion slider

Uses `brain.lesionTo()` from phase 1, not the built-in `lesion()`. Same slider
position always kills the same cells, 40 percent is a superset of 20 percent, and
dragging back to zero restores exactly. Debounced at 60ms.

The step chart is inline SVG built by string, no library. The curve costs about
110ms to compute, twenty real lesions and twenty real evaluations, so it runs when
a training run finishes rather than mid-drag, and is invalidated by anything that
changes the weights.

### The lesion curve, measured

4000 examples, 300-colour evaluation at each point, deterministic mask:

| killed | 0% | 20% | 40% | 50% | 60% | 75% | 80% | 90% | 95% |
|---|---|---|---|---|---|---|---|---|---|
| complement | 85 | 86 | 87 | 84 | 84 | 82 | 71 | 65 | 53 |
| warmer | 85 | 83 | 85 | 82 | 80 | 79 | 73 | 66 | 52 |

This matches the figures in the brief: 86 at 0 percent, 86 at 40 percent, and
about 54 at 95 percent. Nothing needed adjusting. Dragging back to 0 returns to
the starting score exactly. All four assertions are now in `_verify_ui.js`.

### Retraining the survivors does not recover the damage

This is the open question the brief wanted answered, and the answer is no. It
contradicts what "Retrain lesioned" implicitly promises, so it is worth stating
plainly. Pre-lesion, post-lesion, and post-retrain scores after a further 4000
examples with the mask held on:

| relation | killed | pre | post | retrained | alive | verdict |
|---|---|---|---|---|---|---|
| complement | 50% | 85 | 86 | 84 | 128 | nothing was lost to recover |
| complement | 80% | 86 | 79 | 80 | 51 | no recovery |
| complement | 90% | 85 | 65 | 67 | 26 | within noise |
| complement | 95% | 84 | 51 | 47 | 13 | no recovery |
| warmer | 50% | 85 | 82 | 83 | 128 | no recovery |
| warmer | 80% | 84 | 73 | 73 | 51 | no recovery |
| warmer | 90% | 85 | 67 | 66 | 26 | no recovery |
| warmer | 95% | 86 | 57 | 61 | 13 | within noise |

Every change is inside the roughly two point run to run noise of `evaluate()`.

Two things follow, and both are better talking points than a recovery would have
been.

First, the brief's phase 7 experiment 6 specifies lesioning 50 percent and
retraining. At 50 percent there is no damage to recover: the score is already
unchanged. The experiment as specified can only ever return a null result. Phase
7 runs it at 50, 80, 90 and 95 percent instead, so there is something to measure.

Second, the reason it cannot recover is worth saying out loud, because it makes
the redundancy claim sharper rather than weaker. Retraining can only change
`Who`, the hidden to output weights. `Wih`, the input wiring that decides what
each cell is tuned to, is fixed at birth and never learns. Kill 95 percent of the
cells and the 13 survivors have a fixed, sparse, arbitrary set of tuning curves
that between them simply do not cover the hue wheel. What was lost is
representational capacity, not readout. So the fault tolerance in this
architecture is built in at birth by spreading the answer widely, and it is not
re-acquirable afterwards. That is a stronger claim than "it heals".

---

## Phase 5: the guided tutorial

New `tour.js`, content only, and `tour-ui.js`, mechanics only. The split is real:
`tour.js` contains no logic and `tour-ui.js` contains no copy, so the twelve stops
can be rewritten the night before without touching anything that could break.

### Numbers in the copy are read from the network, not typed in

The brief's draft copy contained figures that are wrong for this build. It said
each cell hears 2 to 4 inputs; the real spread is 1 to 7. It said a cell was
ranked 40th of 102; the pools are actually about 107 and 149 and the rank changes
every frame. It described the task as making colours warmer, which is no longer
the active relation.

Rather than correcting those by hand and having them drift again, the copy uses
`{placeholders}` that resolve against the live network at the moment the stop is
shown. `{firing}` becomes 12, `{inMin}` and `{inMax}` become 1 and 7, `{rank}`
becomes whatever the spotlighted cell's rank actually is. `_verify_ui.js` walks
all twelve stops and fails if any placeholder is left unresolved, so the copy
cannot claim something the network is not doing.

### Two bugs worth recording

**`hidden` does not exist on SVGElement.** The spotlight rendered nothing at all
on the first two attempts. `show()` was doing `svg.hidden = false`, which is
correct for an HTMLElement and silently meaningless on an SVG element: it sets a
JavaScript expando and leaves the `hidden` attribute in place. The card, being a
div, worked fine, which is what made it look like a rendering or masking problem
rather than a visibility one. Both now go through `removeAttribute('hidden')`.
The DOM dump is what found it, not reasoning about it.

**The SVG mask composited to nothing.** The first implementation used a single
`<mask>` with a white full-viewport rect and a black hole, which is the textbook
approach and drew nothing in this Chromium. Replaced with four rects around the
hole plus a thin ring, which the brief also allows. Four rects turned out to be
better anyway: the geometry is exactly computable, it clamps cleanly when the
target touches a viewport edge, and several of these targets do sit in corners.

### Pointing at things drawn inside a canvas

Six of the twelve stops point at things that have no element: the input column,
the dendrites, one dendrite, the membrane arc, the axon terminals, the crowd. Those
targets are functions returning a viewport rectangle, computed in `TourUI.rect`
from the canvas rect plus the layout constants used by `viz.js` and
`neuronview.js`.

That duplicates those constants, which is a genuine coupling and is commented as
such. The alternative was adding a geometry export to `neuronview.js`, and phase 9
has to ship `neuronview.js` upstream as a self-contained pull request, so it stays
clean. If the neuron view layout changes, `TourUI.rect._cellGeom` moves with it.

### State really is restored

Entering snapshots `Who`, `alive`, `fireCount`, `stepsTrained`, the relation, the
lesion percentage, the spotlighted neuron and whether it was training. Stop 11
switches to `triadic` and trains 3000 examples, stop 12 switches back to
`complement` and trains again, and stop 12 drives the lesion slider to 95 per
cent. Pressing escape at any point puts all of it back. `_verify_ui.js` asserts
the relation and the example count are identical after exit.

### Narration

Off on load, as specified. Prefers `audio/tour-NN.mp3` if present, falls back to
the browser's own `speechSynthesis` with the same text, never calls anything over
the network. No audio files are committed yet, so the fallback is what runs.
`_dev/render-narration.md` describes regenerating them, including the problem that
a recording cannot speak a live placeholder and what to do about it.

Captions are not a separate track: the card body is on screen at every stop
whether audio plays or not, so rewording `tour.js` changes both at once.

### Dev hooks

`presenter.html#tour` opens the tutorial on load and `#tour7` opens it at stop 7,
which is how the stops were screenshot-checked and is useful for rehearsing one
stop without clicking through the others.
