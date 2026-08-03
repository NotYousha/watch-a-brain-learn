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

## Presenting this

There are two front ends. `build-a-brain/index.html` is Kara's student lab UI,
unchanged in how it works. `build-a-brain/presenter.html` is a presenter build for
talking to a room: one screen, no scrolling, keyboard driven, and no colour
anywhere in the interface so nothing competes with the colours under test.

### Launching it

Double-click `build-a-brain/presenter.html`. That is the whole procedure. No
server, no build, no install, no network. If a browser is already open, drag the
file onto it.

Then press **F11** for fullscreen and **Ctrl and plus** two or three times for the
projector. Check the bottom row of buttons is still visible after zooming.

### Keyboard

| key | does |
|---|---|
| `space` | train, or pause a run in progress |
| `s` | show it one example and stop |
| `r` | reset every learned weight to blank |
| `l` | focus the lesion slider, then arrow keys to drag it |
| `b` | bigger: the network takes over the grid's half of the screen. Safe to press mid-run |
| `t` | the twelve-stop guided tutorial |
| `a` | A/B mode, two brains with one difference |
| `1` to `6` | switch which relation it learns, retraining from scratch |
| `?` | the shortcut list |
| `esc` | close any overlay, or leave the tutorial or A/B mode |

Inside the tutorial: left and right arrows move, clicking the dimmed area
advances, `esc` leaves and puts the brain back exactly as it was.

Inside A/B mode: `space` runs both, `1` to `5` pick the comparison, `esc` leaves.

### URL shortcuts, for rehearsing

- `presenter.html#train` starts a fast training run on load
- `presenter.html#big` opens with the network already enlarged, and flags
  combine with a comma: `#big,train`
- `presenter.html#tour` opens the tutorial, and `#tour7` opens it at stop 7
- `presenter.html#ab` opens A/B mode, and `#ab3` opens comparison 3

### If something breaks mid-talk

| symptom | do this |
|---|---|
| the score sits at 0 and will not move | press `r` then `space`. If still stuck, reload the page. Nothing is persisted, so a reload always gives a clean brain. |
| a panel is blank or stale | press `space` twice. Every panel redraws on a training frame. |
| the tutorial spotlight is in the wrong place | press `esc` and reopen with `t`. Targets are measured live, so a resize or zoom mid-tour needs a reopen. |
| the layout is clipped or a button is off screen | `Ctrl and 0` to reset zoom, then zoom back in one step at a time. |
| A/B mode looks frozen | press `space`. Opening A/B does not start the run; it waits for you. |
| the lesion slider will not come back | drag to 0, or press `r`. The mask is reversible and 0 always fully restores. |
| you need a fallback | `build-a-brain/index.html` is the original lab UI and shares the same brain code. It has Train, a lesion slider and a brain map, which is enough to give the talk from. |

Nothing loads from the network, so conference wifi failing changes nothing.

### The numbers behind it

`RESULTS.md` holds the study: seed variance over 20 seeds, ablations, parameter
sweeps, lesion curves, and a backpropagation baseline. Regenerate with
`node _dev/experiments.js` and `node _dev/baseline.js`. `_dev/RUNBOOK.md` has a
60-second and a 6-minute demo path.
