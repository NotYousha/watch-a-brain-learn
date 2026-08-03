# Feature log

Everything in this project, what it does, and where it lives. Written as a
reference, not a tutorial. For the plain-words explanation see
`_dev/SPEAKER-NOTES.md`, and for the during-the-talk version see `_dev/RUNBOOK.md`.

Nothing here requires a server, a build step, a package install, or a network
connection.

---

## 1. What it is

A 256-neuron associative network that learns colour transformations in a browser
using one Hebbian update line and no error signal. There is no loss function, no
gradient, and nothing anywhere in the code that compares an answer to a target.

Two front ends share the same network code:

| entry point | for | notes |
|---|---|---|
| `index.html` | the original student workshop | Kara Codex's lab UI, plus a single-cell view |
| `presenter.html` | talking to a room | one screen, no scrolling, keyboard driven, colourless |

---

## 2. File map

### Shipped to the browser

| file | owns | origin |
|---|---|---|
| `colors.js` | HSV/RGB conversion, hue and RGB distance, the six relations, example generation | Kara Codex, unmodified |
| `brain.js` | population coding, the network, competition, the Hebbian rule, readout, lesioning, scoring | Kara Codex, plus four added methods (section 11) |
| `config.js` | the eleven student settings | Kara Codex's template, values set for this build |
| `viz.js` | crowd view of all neurons, brain map strip, score sparkline, `slotColor` | Kara Codex, plus a spotlight ring |
| `neuronview.js` | one neuron at cell scale: dendrites, soma, membrane arc, axon, terminals, tuning curve | added in this fork |
| `app.js` | the lab UI's wiring and training loop | Kara Codex, plus neuron-view hooks and `shared.js` use |
| `index.html` | the lab UI layout | Kara Codex, plus the cell canvas and speed control |
| `shared.js` | logic both front ends use: pacing, the training loop, formatting, vote readout, bimodality detection | new |
| `probes.js` | the 64 held-out probe colours and the hold-out enforcement | new |
| `presenter.html` | the presenter layout | new |
| `presenter.css` | the design system and every layout mode | new |
| `presenter.js` | presenter wiring, keyboard, panels, big mode | new |
| `ab.js` | A/B mode: two brains, one shared example stream | new |
| `tour.js` | the tutorial's content, as data. No logic | new |
| `tour-ui.js` | the tutorial's mechanics. No copy | new |

### Dev only, never loaded by the browser

| file | does | runtime |
|---|---|---|
| `_verify.js` | trains all six relations, sweeps settings, walks the lesion curve, prints a timing budget | ~13s |
| `_verify_ui.js` | boots both pages under a fake DOM and drives every control | ~15s |
| `_dev/experiments.js` | the seven-experiment study, writes `results.json` and `RESULTS.md` | ~111s |
| `_dev/baseline.js` | a backprop MLP for comparison, writes `baseline.json` and the SVG chart | ~84s |

### Generated

| file | from |
|---|---|
| `RESULTS.md` | `experiments.js`, with section 8 appended by `baseline.js` |
| `_dev/results.json` | `experiments.js` |
| `_dev/baseline.json` | `baseline.js` |
| `lesion-comparison.svg` | `baseline.js`, self-contained, for a slide |

### Documentation

| file | for |
|---|---|
| `../README.md` | the fork's front page, plus the Presenting this section |
| `../LICENSE-NOTE.md` | the licence position, stated rather than invented |
| `README.md` | the student guide |
| `TEACHER.md` | the teaching script |
| `CLAUDE.md` | the tutoring instructions for a 40-minute workshop |
| `FEATURES.md` | this file |
| `_dev/README.md` | the per-phase engineering log, including everything that surprised me |
| `_dev/SPEAKER-NOTES.md` | plain-words explainer and Q&A prep |
| `_dev/RUNBOOK.md` | 60-second and 6-minute demo paths, recovery table |
| `_dev/render-narration.md` | how to regenerate tutorial audio |
| `_dev/pr-neuron-view.md` | the upstream pull request description |
| `_dev/CONFERENCE_BUILD_PROMPT.md` | the original brief, kept verbatim |

---

## 3. The presenter screen, panel by panel

### Header

- the network's name and owner, from `config.js`
- six live config chips: task, neurons, wiring, fires, learn rate, seed
- the wiring chip reads the **real measured** in-degree range, "each cell hears 1 to
  7 of 28", not the configured probability
- an examples-seen counter

### Metric cards

| card | shows | rounding |
|---|---|---|
| score | out of 100, on colours never seen | integer |
| hue error | mean degrees off the correct answer | one decimal, degree sign |
| confidence | how much the output population agrees | integer per cent |
| neurons alive | alive of total, plus how many are firing right now | integer |

Every number is monospace with tabular figures, so digits do not jitter as they
update. All formatting goes through `Shared.fmt` so the two front ends can never
disagree about rounding.

### The confidence widget

The 28 output neurons drawn as vertical bars, in input-neuron order so the 16 hue
cells form one contiguous run. Boundaries are marked between the hue, vividness and
brightness groups.

- each group is normalised against its **own** loudest cell, which matches how
  `Code.decode()` reads them, rather than letting the brightness cells visually
  crush the hue spike
- a computed readout underneath: `unimodal`, or `bimodal, peaks 135 deg apart`
- detection finds every local maximum in the circular hue run above half the global
  peak, merges runs of equal neighbours so one wide bump is not double counted, and
  handles wrap-around at 0 degrees
- the readout turns to `--signal` colour when it reads bimodal
- an untrained brain says `nothing learned yet`; `luminance`, where every correct
  answer is a grey, says `no hue vote, every correct answer here is a grey`
- the bars are always drawn for one **fixed** probe colour, so they are comparable
  second to second rather than jumping with whatever example arrived last

### The 64 held-out colours

Three rows of 64 swatches: shown, it answers, correct. The middle row starts as
noise and settles onto the bottom row, with a 300ms colour transition so it reads as
settling rather than flickering.

Beside it: mean hue error over the 64, the count of probe colours the trainer
refused, and the render time in milliseconds.

Enforcement of the hold-out, both mechanisms:

1. `Probes.example()` draws a candidate and throws it away if it lands within 1.2
   degrees of hue and 0.02 of both saturation and brightness of any probe. The
   presenter trains only through this function.
2. The grid only ever calls `predict()`, which never writes to the learned weights.

Verified: across 20000 generated training colours, zero landed on a probe. The
refusal rate is about 0.26 per cent and the count is displayed.

Cadence: re-renders every 50 examples for the first 600, then every 200. The early
rate exists because convergence is fastest at the start, which is exactly when a
flat 200-example cadence would leave a stale number on screen.

### The network view

Drawn by `viz.js`, with a neutral grey palette swapped onto the singleton so no
chrome hue competes with the colours under test.

- input column: 28 cells, the population-coded bump visible
- two clouds: the colour pathway and the brightness pathway, each running its own
  competition
- output column: 28 answer cells
- bright dots are the roughly 13 currently firing; the rest are silenced
- faint lines are the fixed input wiring; brighter lines are learned output weights
- click any neuron to move the spotlight to it

### The single cell view

Drawn by `neuronview.js`. Everything is read out of the running network, nothing is
illustrative.

- **dendrites**: one branch per real connection. Cool for excitatory, warm for
  inhibitory, width by weight magnitude, brightness by what that input carries now
- **soma**: the ring is membrane potential against the live k-winners threshold for
  that cell's own pool
- **axon**: myelinated with nodes, carrying a spike that visibly travels on firing
- **terminals**: sized by learned output weight, flashing white where the training
  target is active at the same moment the cell fired
- **tuning curve**: 48 colours swept past the cell to show what drives it, plus its
  learned output row decoded back into the colour it votes for
- a lesioned cell is drawn with its axon cut
- a live status line: firing or silent, its rank in its pool, and how many times it
  has fired

### The lesion row

- slider, 0 to 95 per cent, step 5, debounced at 60ms
- a step chart in inline SVG, no library, plotting score against per cent killed
  with the current position marked. Computed from twenty real lesions and twenty
  real evaluations, refreshed when a run finishes rather than mid-drag
- three persisting numbers: before, lesioned, retrained

---

## 4. Modes

| mode | enter | what changes |
|---|---|---|
| normal | default | everything visible |
| **big** | `b` | network takes the whole screen; grid, metrics and lesion row hidden |
| **A/B** | `a` | two brains side by side; single-brain panels hidden |
| **tutorial** | `t` | spotlight overlay and card over the live network |
| **shortcuts** | `?` | keyboard list overlay |

`esc` leaves any of them.

### Big mode

Hands the whole screen to the network so a room can read the cell and its wires.

- safe to press mid-run: it touches only the two canvas sizes. No trainer call, no
  reset, no lesion reapplied, and the travelling spike keeps its phase
- hides the metric row and lesion row as well as the grid, because `viz.js` spreads
  its columns over 80 per cent of canvas **height** and sizes each pool by
  `min(w * 0.16, h * 0.19)`. Height, not width, is what makes it look open
- the crowd view gets about 420px at a 900px viewport and 640px at 1080p; the single
  cell sits under it at a fixed 260px, the same shape the lab UI uses
- no CSS transition on the layout, deliberately: a canvas keeps its old backing
  resolution until `resize()` is called, so animating the width would show a
  stretched blurry network throughout
- refused while A/B is up, with a message saying to press `a` first
- `l` drops out of big mode before focusing the lesion slider, since that row is
  hidden there

### A/B mode

Two independent brains, one config difference, **one shared example stream**.

- the stream is generated once into an array and a single `Shared.Trainer` hands
  each example to both brains inside one callback. Synchronisation is structural,
  not two loops that happen to agree
- seeding both brains identically would not be enough: the example stream comes from
  `Math.random()`, so same-seed brains get identical wiring and then diverge
- each side gets its own metric row, vote distribution, bimodality readout and
  three-row prediction grid
- the crowd and cell views are hidden here, both for space and because `Viz` and
  `NeuronView` are singletons that would fight over two brains
- each preset carries a note stating what the difference actually measured, so the
  screen never promises more than the numbers support

---

## 5. Keyboard

| key | does |
|---|---|
| `space` | train, or pause a run in progress |
| `s` | show it one example and stop |
| `r` | reset every learned weight to blank |
| `l` | focus the lesion slider, then arrow keys |
| `b` | bigger: the network takes the whole screen |
| `t` | the twelve-stop tutorial |
| `a` | A/B mode |
| `1` to `6` | switch relation, retraining from scratch |
| `?` | the shortcut overlay |
| `esc` | leave any overlay or mode |

In the tutorial: left and right arrows, clicking the dimmed area advances, `esc`
exits and restores. In A/B: `space` runs both, `1` to `5` pick the comparison.

Every button and the slider have a visible focus ring that is never suppressed,
because the whole thing is meant to be driven without looking at the trackpad.

---

## 6. URL hooks

For rehearsing and for the headless checks. Flags combine with a comma.

| hash | does |
|---|---|
| `#train` | start a fast training run on load |
| `#big` | open with the network enlarged |
| `#tour` | open the tutorial |
| `#tour7` | open the tutorial at stop 7 |
| `#ab` | open A/B mode and start it |
| `#ab3` | open A/B at comparison 3 |
| `#big,train` | combined |

---

## 7. The six relations

Switchable live on `1` to `6`. Each switch resets the brain and retrains from
scratch. Typical scores at 4000 examples:

| key | relation | score | confidence | vote shape | why |
|---|---|---|---|---|---|
| 1 | complement | 86 | 96% | unimodal | one clear answer |
| 2 | analogous | 86 | 96% | unimodal | one clear answer |
| 3 | **triadic** | **51** | **53%** | **bimodal, ~135° apart** | **two correct answers, cannot choose** |
| 4 | split-complement | 69 | 86% | bimodal, ~45° apart | two correct answers, close together |
| 5 | warmer | 85 | 93% | unimodal | one clear answer |
| 6 | luminance | 84 | n/a | no hue vote | answers are greys, hue is meaningless |

The two ambiguous relations pick one of their two correct answers at random inside
`apply()`, which is why ground truth for the grid is frozen once per relation rather
than recomputed each render.

---

## 8. The five A/B comparisons

| # | comparison | measured at 4000 examples |
|---|---|---|
| 1 | `chromaFraction` 0.40 vs 0.80 | 85 vs 78. More cells on colour is worse |
| 2 | `fireFraction` 0.05 vs 1.0, competition off | 86 vs 79. Costs 7 points, does not collapse |
| 3 | `connectivity` 0.15 vs 1.0, dense wiring | 85 vs 85. No score difference, costs hue precision |
| 4 | `hiddenNeurons` 256 vs 96 | 85 vs 81, and twice the hue error |
| 5 | `forgetting` 0 vs 0.001 | no measurable difference |

---

## 9. The twelve tutorial stops

Content lives in `tour.js` as a plain data array with no logic, so the script can be
rewritten without touching mechanics. Mechanics live in `tour-ui.js` with no copy.

| # | id | points at | lands |
|---|---|---|---|
| 1 | whole | the whole screen | 256 neurons learned this from examples, nothing was programmed |
| 2 | arrives | one input swatch | the colour is never stored in one place |
| 3 | smeared | the 28 input cells | population coding: the colour is the shape of a bump |
| 4 | neuron | the dendrites | what a neuron is: listens, weights, adds, fires if it clears a bar |
| 5 | synapse | one dendrite | a synapse is one number, like a fader. Training only moves faders |
| 6 | threshold | the membrane arc | the bar it has to clear, and its live rank in its pool |
| 7 | competition | the crowd view | only ~13 of 256 fire. k winners take all |
| 8 | sparse | the wiring chip | each cell hears 1 to 7 inputs, fixed at birth, making it a specialist |
| 9 | hebb | the axon terminals | the one line that learns, with `brain.js:314` in a code strip |
| 10 | homeostasis | the metric row | three brakes stop runaway, and which one actually earns its keep |
| 11 | unsure | the confidence widget | switches to `triadic`, shows two humps and collapsed confidence |
| 12 | break | the lesion row | drives the slider to 40 then 95 itself |

Mechanics:

- spotlight is four SVG rects around the target plus a ring, not a `box-shadow`,
  which breaks at viewport edges, and not a single mask, which composited to nothing
  in Chromium
- the card auto-flips to whichever side has room, clamps inside the viewport, and
  centres when the target fills the screen. Body capped at 60 characters per line
- six stops point at things drawn inside a canvas and so use functions returning a
  viewport rectangle, computed from the canvas rect plus the layout constants
- numbers in the copy are interpolated live from the running network through
  `{placeholders}`, never typed in. `_verify_ui.js` fails if any placeholder
  survives unresolved, so the copy cannot claim something the network is not doing
- entering snapshots the weights, alive mask, fire counts, example count, relation,
  lesion level, spotlight and big mode; `esc` restores all of it
- stops needing a trained network train silently with a visible indicator rather
  than pointing at an empty panel
- works from a freshly reset brain and from a fully trained one

### Narration

Optional, **off on load**, and it never autoplays. Prefers committed
`audio/tour-NN.mp3` files, falls back to the browser's own speech synthesiser with
the same text, and never touches the network. No audio files are committed, so the
fallback is what runs. Captions are not a separate track: the card body is on screen
whether audio plays or not, so rewording `tour.js` changes both at once. See
`_dev/render-narration.md`.

---

## 10. Design system

The subject under test is colour, so **the interface has no hue in it anywhere**.
Every colour on screen is either a data swatch or a neuron. Any accent hue would sit
next to the colours being judged and make the demo lie.

| token | value | use |
|---|---|---|
| `--ink-0` | `#0B0C0C` | page |
| `--ink-1` | `#17191A` | panel |
| `--ink-2` | `#232628` | raised |
| `--rule` | `#33383B` | hairline |
| `--text-hi` | `#F2F3F1` | primary |
| `--text-mid` | `#9BA1A3` | secondary |
| `--text-lo` | `#676D70` | metadata |
| `--signal` | `#E8EAE6` | the only accent, for live values |

Type: a system sans stack for the interface, a monospace stack for every number,
weight, config value and code reference. Numbers are monospace so they stop
jittering as they update, which is functional rather than decorative.

Scale, for a projector at twelve metres: metric values 40px, panel titles 15px, body
16px, metadata 13px. Nothing below 13px anywhere. Line height 1.5.

Motion only where it carries information: the travelling spike, the grid settling,
the lesion recomputation, the spotlight moving. Every animation is wrapped in
`@media (prefers-reduced-motion: no-preference)`. No hover flourishes.

Fonts are system stacks only. No font file is loaded or committed.

---

## 11. Additions to `brain.js`

Four methods. The Hebbian update, the competition, the normalisation cap and the
readout are untouched.

| method | does | why |
|---|---|---|
| `lesionOrder(seed)` | one fixed kill order from an independent generator | the built-in `lesion()` draws from the brain's stateful generator, so the same percentage kills a different set every call |
| `lesionTo(fraction, seed)` | kills exactly that fraction, reversibly | same slider position always kills the same cells; 40 per cent is a superset of 20; 0 fully restores |
| `snapshot()` | copies learned weights, alive mask, fire counts and example count | the tutorial needs to train silently and put things back |
| `restore(s)` | writes a snapshot back | deliberately does not touch the input wiring, which is fixed at birth |

---

## 12. Dev tooling and what it guarantees

### `_verify.js`

All six relations trained and scored, a hidden-layer sweep, eight parameter
extremes, a six-point lesion curve, and a timing budget. 32 full training runs.

### `_verify_ui.js`

Boots each page in its own fake DOM, because `Viz` and `NeuronView` are singletons
that would otherwise fight. It fails on any of:

- an element id referenced by any script a page loads not existing in that page
- a missing script file
- either page throwing on load
- a control not driving
- the lesion mask not being repeatable, nested, or fully reversible
- snapshot and restore losing the weights
- the lesion curve losing the right shape at 0, 40 and 95 per cent
- `complement` not voting unimodally, or `triadic` not voting bimodally, or ambiguity
  not collapsing confidence
- any probe colour leaking into the training stream, or held-out error not converging
- any of the twelve tutorial stops failing to resolve a target, leaving an
  unresolved placeholder, or showing a wrong progress label
- `esc` not restoring the exact example count and relation
- A/B not building two distinct brains, the two seeing different example counts, or
  any preset failing to build
- any of the six relations failing to switch, score, or produce a vote readout
- big mode failing to toggle, or stopping training when toggled

### `_dev/experiments.js`

Seven experiments in about 111 seconds, all seeded and reproducible. Reproducibility
comes from temporarily swapping the global `Math.random` for a seeded generator and
restoring it in a `finally` block, because two of the six relations draw randomness
inside `apply()`. No shipped file is touched.

Two ablations cannot be expressed through config, so they patch a copy of
`brain.js` in memory and assert the patch matched, failing loudly rather than
silently reporting the baseline twice.

1. seed variance, 20 seeds by 6 relations
2. ablations, 5 conditions by 10 seeds
3. `chromaFraction` sweep
4. `forgetting` sweep
5. lesion curves at two network sizes
6. lesion then retrain at four depths
7. confidence calibration

### `_dev/baseline.js`

A one-hidden-layer MLP, 28 to H to 28, ReLU, mean squared error, online gradient
descent. Same encoding, same readout, same seeded stream, same held-out probes, and
the **same scorer**: `Brain.prototype.evaluate` borrowed with `.call()` rather than
reimplemented, so one scoring implementation covers both.

---

## 13. Headline findings

Full tables in `RESULTS.md`.

**Confidence predicts actual hue error at r = −0.97 across 100 runs.** A working
uncertainty estimate from a network with no loss, no target comparison and no error
signal.

Also held up: seed 7 was not lucky (85.3 ± 1.2 over 20 seeds); `chromaFraction` 0.40
is the best of four values tested; redundancy scales with network size.

**Three claims that did not survive testing**, all reworded in the tutorial because
A/B mode lets the audience check them live:

1. removing the homeostatic cap costs 0.9 points, despite the code predicting
   collapse and despite 103 of 256 cells sitting against the cap
2. dense wiring scores slightly better than sparse, costing only hue precision
3. competition off costs about 5 points, not a collapse; the layer-wide energy
   normalisation is doing that work

**Backprop wins on score**, 96.9 against 85.0, and 95.7 even at matched single-pass
exposure. It loses badly on damage: at 95 per cent of cells killed the Hebbian
network keeps 61.3 per cent of its score and the matched MLP keeps 27.4 per cent.
The curves cross at about 25 per cent damage.

---

## 14. Guarantees

- **fully offline.** One external reference exists in the whole shipped set: the
  attribution anchor's `href`, which navigates on click and loads nothing. Verified
  by loading the page with every network request forced to a dead port
- **no build step, no bundler, no package install.** Plain script tags
- **no binary assets.** Every tracked file is text. 472K tracked, 2.3M with `.git`
- **no scrollbar and no clipping** at 1920x1080, 1440x900, and 1440x900 at 150 per
  cent zoom
- **both verifiers pass**, and they cover every surface listed in section 12
- **`brain.js` and `colors.js` carry no behavioural changes.** The scientific core is
  as Kara Codex wrote it

---

## 15. Deliberately not here

- no licence file granting rights over someone else's work. `LICENSE-NOTE.md` states
  the position instead
- no narration audio yet; the speech-synthesis fallback covers it
- no attribution line in the interface. It was removed from the header at the
  presenter's request. Authorship is recorded in `../README.md` and
  `../LICENSE-NOTE.md`, and in the origin column of the file map above, because the
  network, the colour maths, the crowd view and the teaching script are Kara Codex's
  work and the upstream repository carries no licence
- no attempt to claim this scales, or that it beats backpropagation at the task
- no dark and light theme for the presenter. One projector, one palette
