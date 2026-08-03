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

---

## Phase 6: A/B split screen

New `ab.js`. Two brains, one config difference, one stream.

### Synchronisation is structural, not hopeful

The stream is generated once into an array, and a single `Shared.Trainer` hands
each example to both brains inside one `onExample`. There are not two loops that
happen to agree. Seeding both brains identically would not have been enough: per
phase 0 finding 2, the example stream comes from `Math.random()`, so same-seed
brains get identical wiring and then diverge. `_verify_ui.js` asserts both brains
report the same `stepsTrained` after a run.

The crowd view and neuron view are not drawn in this mode, which the brief already
wanted for space reasons and which phase 0 independently required: `Viz` and
`NeuronView` are singletons holding one layout and one spotlight, so pointing them
at two brains would have them fight.

### Two of the brief's acceptance criteria do not hold

Measured at 4000 examples on `complement`, both brains fed the identical stream:

| preset | A | B | difference |
|---|---|---|---|
| chromaFraction 0.40 vs 0.80 | 85, 3.3 deg | 78, 2.3 deg | A wins by 7 on score |
| fireFraction 0.05 vs 1.0, competition off | 86, 3.3 deg | 79, 6.2 deg | A wins by 7 |
| connectivity 0.15 vs 1.0, dense wiring | 85, 3.3 deg | 85, 5.2 deg | no score difference |
| hiddenNeurons 256 vs 96 | 85, 3.3 deg | 81, 7.0 deg | A wins by 4 |
| forgetting 0 vs 0.001 | 85, 3.3 deg | 85, 3.4 deg | none |

The brief expected the competition-off preset to "visibly collapse one side" and
the dense-wiring preset to "visibly degrade one side". Neither happens.

**Competition off costs about 7 points, it does not collapse.** With
`fireFraction` at 1.0 the k winners threshold becomes the minimum, so nothing is
silenced and all 256 cells fire. The reason it survives is that competition is not
the only brake in `think()`: the final line divides the whole layer by its total
activity, so the layer always fires with the same total energy no matter how many
cells are involved. That energy normalisation does a lot of the work people
attribute to the contest. Worth knowing, because it is a better answer to "what
stops it collapsing" than the tutorial's original one.

**Dense wiring does not degrade the score at all.** It costs precision on hue,
3.3 degrees to 5.2, and nothing on score. The tutorial's original claim, that with
full connectivity "all 256 would respond identically and you would have paid for
256 neurons and built one, copied", is simply false for this implementation: even
at full connectivity every cell gets its own independent signed random weights, so
the cells still differ from each other. They differ less usefully, which is what
the hue error shows.

Both tour stops were reworded to say what the numbers actually support. That
matters more than usual here, because A/B mode lets anyone in the room run the
comparison live while the claim is still on screen.

### One confirmed answer to an open question

`chromaFraction` 0.40 does earn its place, at least against 0.80: 85 against 78 on
`complement`. Phase 7 sweeps it properly across four values and ten seeds.

### Fixed during this phase

- The preset dropdown did not resync when the preset was set from a URL hash or a
  number key, so the label could disagree with the two brains on screen.
- `.abrow:first-of-type` matched nothing, because `:first-of-type` matches by
  element type and the first div in a column is the header, not a row.

---

## Phase 7: experiment harness

`_dev/experiments.js` writes `_dev/results.json` and `RESULTS.md`. Total runtime
110.6 seconds, inside the two-minute target. Slowest is seed variance at 36.5s,
which is 120 full training runs and cannot be helped.

### Reproducibility, per the decision recorded in phase 0

Every experiment runs inside `withSeed()`, which swaps the global `Math.random`
for a seeded xorshift and restores it in a `finally` block, so a thrown experiment
cannot leave a seeded generator installed. All six relations are reproducible,
including `triadic` and `split-complement` whose coin flip lives inside `apply()`.
No shipped file is touched.

### Two ablations config cannot express

k winners take all and sparse wiring are both reachable through config. The
homeostatic cap and the mean input subtraction are single lines inside `brain.js`,
so those are ablated by patching a copy of the source string in memory and loading
that. The shipped file is never written to. Each patch asserts it matched, so if
`brain.js` changes and a needle stops applying, the harness throws instead of
quietly reporting the baseline twice.

### Results that matter, in order

**Confidence correlates with hue error at r = -0.97 across 100 runs.** This is the
result worth leading with. A usable uncertainty estimate, from a network with no
loss function, no target comparison and no error signal anywhere.

**Seed 7 was not lucky.** `complement` is 85.3 ± 1.2 across 20 seeds, range 84 to
88.

**chromaFraction 0.40 earned its place.** Best of the four tested: 83.0, 85.3,
82.9, 79.6 for 0.2, 0.4, 0.6, 0.8.

**Redundancy scales with size.** At 256 neurons, killing 40 per cent costs 0.9
points and 95 per cent still leaves 49.9. At 96 neurons the same cuts cost 7.4 and
leave 34.8.

**forgetting is free up to 0.001 and costs 3 points at 0.01.**

### Three findings against the write-up

1. **The homeostatic cap does almost nothing.** `brain.js` says "Without this the
   brain collapses into shouting the same answer at everything". Removing it costs
   0.9 points. It is not idle: 103 of 256 cells sit pressed against it. It binds
   constantly and still barely matters, because the hue readout is a weighted
   circular mean that divides by total weight and is therefore largely blind to
   how big any one cell's weights became. Removing the cap and the competition
   together still gives 79.0. The predicted collapse does not happen.
2. **Sparse wiring does not help the score.** Dense wiring scores 86.5 against
   85.3, which is better. It costs 0.3 degrees of hue precision. The claim that
   full connectivity makes all cells respond identically is false here: every cell
   still gets independent signed random weights.
3. **Competition is the largest single ablation at 5.2 points, and still not a
   collapse.** What prevents runaway without it is the last line of `think()`,
   which divides the layer by its own total activity.

Tour stops 7, 8 and 10 were reworded to match all three, because A/B mode lets
anyone in the room check them live.

### A correction to phase 4's note in this file

Phase 4 concluded from a single seed that lesion damage does not recover. Ten
seeds says that was too strong. At 50 and 80 per cent there is nothing to recover,
but at 90 per cent retraining regains 4.3 points and at 95 per cent 5.7, which is
about 19 and 16 per cent of what was lost. Small, consistent, not zero. The
ceiling is still explained by `Wih` being fixed at birth.

The brief's experiment 6 specified 50 per cent only, which can return nothing but a
null result. It runs at 50, 80, 90 and 95.

---

## Phase 8: backprop baseline

`_dev/baseline.js`. One hidden layer MLP, 28 to H to 28, ReLU hidden, linear
output, mean squared error, online gradient descent. Pure JS, dev only, never
shipped. Runtime 84 seconds.

### The comparison is set up to be fair to backprop

Same input encoding, same output readout, same seeded stream of 4000 examples,
same 64 held-out probes, and the same scorer. Not a copy of the scorer:
`Brain.prototype.evaluate` is borrowed with `.call()`, because the MLP exposes a
`predict(color)` with the same shape. There is exactly one scoring implementation,
so the two cannot be measured differently even by accident.

The MLP also gets a longer run than Brian if it wants one. Both a single pass over
the 4000 examples, which matches Brian's exposure, and 20 epochs over the same
4000, which gives backprop 20 times the compute, are reported.

### Parameter counts

Brian has 7168 learnable parameters, the hidden to output weights, and 7168 frozen
ones, the input wiring that is fixed at birth and never learns. An MLP of 28 to H
to 28 costs 57H + 28. So H = 125 matches the learnable count at 7153 and H = 251
matches the total at 14335. Both are reported rather than picking whichever
flatters.

### Backprop wins on score, comfortably

| model | score | hue error |
|---|---|---|
| Hebbian, 256 cells, one pass | 84.8 | 4.3 deg |
| MLP H=125, one pass | 95.6 | 1.6 deg |
| MLP H=125, 20 epochs | 96.6 | 1.3 deg |
| MLP H=251, 20 epochs | 96.8 | 1.3 deg |

It wins even at matched exposure, one pass each, 95.6 against 84.8. There is no
version of this where the Hebbian network is competitive on accuracy, and the talk
should say so first rather than being made to admit it.

### The lesion comparison is where the thesis holds

Retained fraction of the undamaged score:

| killed | Hebbian | MLP H=125 |
|---|---|---|
| 40% | 99.6% | 78.8% |
| 80% | 89.2% | 44.4% |
| 95% | 61.3% | 27.4% |

The two curves cross at about 25 per cent killed. Below that backprop is simply
better. Above it the Hebbian network is better and the gap widens the more damage
is done.

This is the result the thesis needed and it survived a fair test, which is worth
more than if it had been rigged. Neither implementation asked for either property.
Backprop was not told to be brittle and the Hebbian network was not told to be
robust.

`lesion-comparison.svg` is committed for use on a slide, 820 by 400, self
contained, no fonts to load.

---

## Phase 9: attribution, docs, cleanup

### The licence position

`LICENSE-NOTE.md` at the repository root, not `LICENSE.md`. The name matters:
GitHub's licence detector reads `LICENSE*` and a file called `LICENSE.md` would
make the repository look licensed when it is not. The note states plainly that
upstream carries no licence, that all rights are therefore reserved by Kara Codex,
that this fork exists only under GitHub's Terms of Service, and that permission is
being sought and has not been granted. It also lists exactly which files came from
upstream and which were added here. No licence was invented.

### The upstream pull request branch

Branch `pr/neuron-view`, one commit on top of `origin/main`, 821 insertions across
seven files. `brain.js` and `colors.js` untouched. Verified with both verifiers on
that branch.

Two things were deliberately stripped that the original `427f7e8` commit carried:

- The fork's root `README.md` and root `index.html`. The README opens with "This
  is a fork" and the index is a GitHub Pages redirect. Neither means anything
  upstream.
- Every personal value in `config.js`. The original commit changed `ownerName` to
  Yousha, `brainName` to Brian, and eight tuning values, all mixed into the same
  commit as the genuine `trainSpeed` hook. The PR branch keeps upstream's student
  defaults and adds only `trainSpeed`. Sending someone else's workshop back to
  them with your own name baked into the template would be a poor look.

The description is in `_dev/pr-neuron-view.md`, including a note flagging the
`think()` array reuse for the reviewer, since that is the one place the view
contains arithmetic that looks duplicated.

### TEACHER.md corrected

It claimed both verifiers run "in a couple of seconds". Measured: `_verify.js` is
about 13 seconds and `_verify_ui.js` about 15. The file now says budget 30 seconds
for the pair and explains why, which is 32 full training runs in the first and the
twelve tutorial stops plus two A/B brains in the second.

Note this is the opposite of what the brief assumed. The brief expected
`_verify_ui.js` to be the slow one at 15 seconds and blamed slow-speed frames. At
phase 0 it was the faster of the two at 5.6 seconds. It has since grown to about
15 because of everything phases 1 to 6 added to it, so the brief's number is now
right by coincidence rather than by diagnosis.

### Verifier coverage

`_verify_ui.js` now covers, and fails on, all of the new surfaces:

- both pages' element ids checked against every script each page loads
- the presenter shell boots and every keyboard binding is driven
- all twelve tutorial stops resolve a target, interpolate every placeholder, and
  escape restores the exact example count and relation
- the lesion mask is repeatable, nested and fully reversible, and the curve has
  the right shape at 0, 40 and 95 per cent
- A/B mode builds two distinct brains, both see an identical number of examples,
  and all five presets build
- **all six** relations switch, retrain and produce both a score and a vote
  readout. Previously only three were spot-checked.
- the held-out probes are provably held out, and held-out error converges
- the confidence widget's central claim: complement unimodal, triadic bimodal,
  and ambiguity collapsing confidence

### Attribution on screen

`Original workshop by Kara Codex`, linked to the upstream repository, in the
presenter header. It is in the header rather than a footer specifically so it
cannot scroll away, and the header is on screen for the entire talk.

---

## Phase 10: pre-flight

### Resolutions

Captured headless at three sizes, all with `#train` so the network is actually
running rather than blank:

| target | CSS viewport | result |
|---|---|---|
| 1920x1080 | 1920x1080 | no scrollbar, no clipping |
| 1440x900 | 1440x900 | no scrollbar, no clipping |
| 1440x900 at 150 per cent zoom | 960x600 | no scrollbar, no clipping, all buttons reachable |

The 150 per cent case was the one worth checking and it is fine. The metric row
and the two strips absorb the loss of height, and the button row stays on screen.

### Offline

Verified rather than assumed. Two checks.

First, a grep across every shipped file for `https?://`, `//cdn`, `fonts.`,
`@import`, `fetch(`, `XMLHttpRequest`, `WebSocket`, `new Worker` and `integrity=`.
One hit: the attribution anchor's `href` in `presenter.html`, which only navigates
when clicked and loads nothing.

Second, the page was loaded with `--proxy-server=127.0.0.1:1`, which forces every
network request to a dead port. It trained 165 examples, scored 58, produced a live
vote readout and rendered the attribution. Nothing degraded.

Fonts are system stacks only. No font file is loaded or committed.

### Assets and size

No binary assets at all. Every tracked file is text: JavaScript, JSON, Markdown,
HTML, CSS, and one SVG. There is no `audio/` directory, so narration falls back to
the browser's own speech synthesiser, which is the documented behaviour.

```
tracked files   472K
.git            1.4M
total           2.3M
```

If narration audio is added later it will be the only binary content in the
repository. `_dev/render-narration.md` says to keep the set under about 3MB.

### Runbook

`_dev/RUNBOOK.md`: a 60-second path for passers-by, a 6-minute path for people who
sit down, a table of hostile questions with the honest answer to each including the
three where the measurements went against the write-up, and a symptom-to-fix table.
The last row of that table is the important one: if the presenter build fails
entirely, `index.html` is the original lab UI, shares the same brain code, and has
enough on it to give the talk from.

### Post-phase fix: stop 1's copy

Found by screenshotting stop 1 rather than by any verifier, because it was valid
text, just wrong text. The `{task}` placeholder was interpolating
`Colors.relations[rel].blurb`, which is a standalone sentence with its own capital
letter and a worked example: "The colour directly opposite on the wheel. Red ->
cyan." Dropped mid-sentence that produced:

> learned to turn a colour into The colour directly opposite on the wheel. Red ->
> cyan. Nothing here was programmed to do that.

Which is the very first thing the room reads. `tour.js` now holds
`TASK_PHRASES`, one short lowercase phrase per relation that reads correctly
mid-sentence, falling back to the old behaviour for anything not listed.

Worth noting the verifier could not have caught this: it checks that no
`{placeholder}` survives interpolation, and this one interpolated perfectly well.
Some things only a screenshot finds.
