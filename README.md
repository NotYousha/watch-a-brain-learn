# Build a Brain — live

A small neural network that learns colour relationships in your browser, using
Hebb's rule from 1949. No backpropagation, no gradients, no build step, no
internet. Open it and press Train.

**→ [Open it](build-a-brain/)**

## Credit

This is a fork. The original workshop — the brain, the colour maths, the six
puzzles, the teaching script — was written by **Kara Codex**
(<kara@freethemachines.ai>) at [machinesbefree/learning](https://github.com/machinesbefree/learning).
Go there for the source of truth.

The original carries no licence, so it is all-rights-reserved by its author.
This fork exists under GitHub's terms for public repositories. If you want to
use any of it outside GitHub, ask Kara first.

## What's different in this fork

Additions to the visualization only. `brain.js` and `colors.js` — the actual
neural network and the colour puzzles — are untouched.

- **`neuronview.js`** (new) — a panel showing one hidden neuron at cell scale:
  real dendrites from its wiring, a soma with a membrane-potential ring
  against the live competition threshold, a myelinated axon that carries a
  visible spike, and synaptic terminals sized by their learned weights. Click
  any neuron in the crowd view to move the spotlight.
- **Tuning curve and vote** — sweeps every colour past the spotlighted neuron
  to plot what drives it, and decodes its learned weights into the colour it
  votes for. Reads as "likes blue → says green".
- **Speed control** — slow / normal / fast, plus **Step ×1** to watch a single
  Hebbian update. Default is now slow, because watching is the point.

Design notes: `docs/superpowers/specs/2026-07-27-neuron-visualization-design.md`

## Checking it still works

```
node _verify.js      # trains all six relations, sweeps settings, lesion curve
node _verify_ui.js   # runs the page under a fake DOM, drives every control
```
