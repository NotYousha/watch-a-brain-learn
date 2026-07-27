# Hero neuron view + training speed control

**Date:** 2026-07-27
**Project:** build-a-brain
**Status:** approved (user delegated remaining decisions with "do what's recommended")

## Problem

Two complaints, one session:

1. The visualization does not look like a neuron. Every unit is a filled
   circle (`viz.js:178`). Nothing on screen resembles a dendrite, a soma, an
   axon or a synapse, so the biological claim the workshop makes is not
   visible anywhere in the workshop.
2. Training is too fast to follow. `app.js:73` runs
   `trainingExamples / 900` examples per animation frame — about 4 per frame,
   the whole run over in ~15 seconds — and the student cannot see progression.

## Non-goals

- Redrawing all `hiddenNeurons` units anatomically. At 256 neurons each cell
  would be a few pixels across; it reads as texture, not anatomy, and costs
  frame time. Rejected in favour of one large cell.
- Changing anything about how the brain computes. `brain.js` maths is
  untouched. This is presentation plus pacing only.

## Design

### 1. Hero neuron panel (`neuronview.js`, new file)

A wide panel below the existing network view showing **one** hidden neuron at
anatomical scale, left to right:

| part | driven by | teaching point |
|---|---|---|
| dendrites | non-zero `Wih[j][i]` | it only listens to a handful of inputs |
| dendrite tips | `inp[i]`, coloured by `Viz.slotColor(i)` | what it is currently hearing |
| soma + potential ring | recomputed drive vs pool threshold | summation and threshold |
| axon with myelin | `hid[j] > 0` | it either fires or it does not |
| terminal boutons | `Who[j][o]`, radius ∝ weight | **these are the numbers that learn** |

Excitatory connections (`w > 0`) render cool, inhibitory (`w < 0`) render
warm, width ∝ `|w|`. Dead (lesioned) neurons render greyed with a severed
axon.

The competition threshold is not stored by `brain.think()` — `pre` aliases
`this.hid` and is overwritten in place. The view recomputes raw drive for the
neuron's pool each frame (`nHid × nIn` ≈ 7k multiply-adds at 256 neurons) and
takes the k-th value, matching `brain.js:259-261`. This also yields the
neuron's rank within its pool, which is displayed.

When the neuron fires, a spike bead animates along the axon over ~650ms and
boutons flash where the current training target is active — the literal
"fire together, wire together" moment. `app.js` passes the last example's
target to the view; the view does not reach into the training loop.

### 1b. Tuning curve and vote (added after first review)

The panel also answers *what has this cell become*, with two readouts:

- **What makes it fire** — sweep 48 colours past the neuron, plot its raw
  drive. Chroma-pool neurons get a hue sweep; luma-pool neurons are deaf to
  hue, so they get a brightness sweep instead (a flat line would teach
  nothing). A colour strip under the axis says what was swept.
- **What it says** — its `Who` row decoded through `Code.decode`, the same
  path the brain uses for its own answer, shown as a swatch. Blank until it
  has learned anything.

Together these read as "likes blue → says green", which is the whole brain in
one cell.

Sweeping costs 48 encodes, so the result is cached: recomputed every 30
draws, on selection change, or on `NeuronView.invalidate()` after a reset,
lesion, heal or single step.

### 2. Selection

Default: the neuron with the most dendrites (highest `inDeg`), since it is
the most interesting to look at. Clicking any dot in the network view moves
the spotlight; `Viz.hiddenAt(x, y, brain)` does nearest-neighbour hit testing
and `Viz.draw` rings the selection.

### 3. Speed control

`trainSpeed` in `config.js`, overridable live by a slider:

| setting | examples/frame | 4000 examples takes |
|---|---|---|
| slow | 1 | ~65s |
| normal | `trainingExamples / 900` (current behaviour) | ~15s |
| fast | `trainingExamples / 120` | ~2s |

Default changes to `slow`, because watching is the point.

A **Step ×1** button trains exactly one example and redraws, working whether
or not a run is in progress. This is the setting that makes a single
Hebbian update visible.

## Files

| file | change |
|---|---|
| `neuronview.js` | new — the hero panel |
| `viz.js` | add `hiddenAt()` hit test, draw selection ring |
| `index.html` | `#cell` canvas, speed slider, Step button, script tag |
| `app.js` | selection state, click handler, speed, step, view wiring |
| `config.js` | add `trainSpeed` |
| `_verify_ui.js` | add `neuronview.js` to its hardcoded script list, stub canvas gradients, give `getBoundingClientRect` a `left`/`top` so click hit-testing is exercised, drive the new controls |

## Verification

`node _verify.js` and `node _verify_ui.js` must both still pass. `_verify_ui.js`
checks that every id referenced in `app.js` exists in `index.html` and runs
the page under a fake DOM, so new controls are covered automatically once the
script list is updated.
