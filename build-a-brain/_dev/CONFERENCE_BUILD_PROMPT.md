# Claude Code brief: conference build for watch-a-brain-learn

Saved verbatim from Yousha's original brief so later sessions can pick up
without it being pasted again. Phase 0 notes live in `_dev/README.md`.

---

## Context

This repo is `watch-a-brain-learn`, a fork of `machinesbefree/learning` by Kara Codex. It is a browser demo of a 256-neuron Hebbian associative network that learns colour transformations with no backpropagation, no loss function, and no error signal anywhere in the codebase.

Current architecture, all vanilla JS, no build step, no bundler, loaded by plain `<script>` tags in `index.html`:

- `colors.js` defines the six colour relations. The active one is `warmer`: shortest path 45 percent of the way toward hue 30, plus a saturation and brightness lift.
- `brain.js` is the network. 28 input neurons (16 hue, 6 saturation, 6 brightness), 256 hidden neurons split into a colour pool of about 102 and a brightness pool of about 154, sparse fixed random wiring at 0.15 connectivity, k-winners-take-all per pool at 0.05, 28 output neurons read back by circular mean and parabolic interpolation. The only learning is one line at `brain.js:314`, a Hebbian product of pre and post activation, with a synaptic strength normalisation cap at `brain.js:320`.
- `config.js` holds the seven settings. Current values: hiddenNeurons 256, connectivity 0.15, fireFraction 0.05, chromaFraction 0.40, learningRate 0.20, forgetting 0, seed 7, trainSpeed slow.
- `viz.js` draws the crowd view of all 256 neurons.
- `neuronview.js` draws one spotlighted hidden neuron at cell scale, with its real dendrites, a membrane potential arc against the current pool threshold, and axon terminals sized by learned weight.
- `app.js` wires the UI.
- `_verify.js` and `_verify_ui.js` are teacher-facing checkers. Both must keep passing.

I am presenting this at an innovation centre to an audience of professional AI and software engineers. The current UI is a lab tool. I need a presenter-grade demo, a guided tutorial that teaches the network to a stranger, and a results harness so the talk contains findings rather than just a toy.

---

## Hard constraints

Read these before writing any code. Violating them wastes both our time.

1. **Do not change the learning rule or the colour maths.** `brain.js` and `colors.js` are the scientific core. You may add new exported functions to them, and you may add a lesion mask and a clone or snapshot method. You may not alter the Hebbian update, the competition, the normalisation cap, the readout, or any relation definition. If a task seems to require it, stop and ask me.
2. **No build step, no bundler, no npm dependency for anything that ships.** Plain `<script>` tags and ES5-safe or widely supported ES2017 syntax. Dev-only tooling in `_dev/` is fine.
3. **Fully offline.** No CDN links, no Google Fonts, no external API calls at runtime. Conference wifi will fail. Fonts must be system stacks or self-hosted files committed to the repo.
4. **Both verifiers must pass** after every phase. Run them and paste the output.
5. **One phase at a time.** Finish a phase, show me the diff summary and the verifier output, then wait. Do not batch phases.
6. **Commit per phase** with a message of the form `phase N: short description`.
7. **Keep Kara Codex's authorship intact.** Do not rewrite history, do not remove her name from anything, and add attribution where noted in Phase 9.

---

## Design direction

The subject is colour perception, so **the chrome must be colourless**. Any hue in the interface competes with the hue under test and makes the demo lie. This is the single most important visual rule.

Aesthetic reference: a neuroscience rig readout. Instrument, not dashboard. Precise, dense where it needs to be, quiet everywhere else.

Tokens, define once in a new `presenter.css`:

```
--ink-0     #0B0C0C   page
--ink-1     #17191A   panel
--ink-2     #232628   raised
--rule      #33383B   hairline
--text-hi   #F2F3F1   primary
--text-mid  #9BA1A3   secondary
--text-lo   #676D70   metadata
--signal    #E8EAE6   the only non-grey accent, near-white, used for live values only
```

Type: system sans for UI (`-apple-system, "Segoe UI", system-ui, sans-serif`), and a monospace stack for every number, weight, config value, and code reference (`ui-monospace, "SF Mono", Menlo, Consolas, monospace`). Numbers must be monospace so they stop jittering as they update. That is functional, not decorative.

Scale, sized for a projector at twelve metres: metric values 40px, panel titles 15px, body 16px, metadata 13px. Nothing below 13px anywhere. Line height 1.5.

Motion: only where it carries information. The spike travelling the axon, the prediction grid converging, the lesion recomputation. Wrap every animation in `@media (prefers-reduced-motion: no-preference)`. No hover flourishes.

Signature element: the prediction grid in Phase 3. That is the one thing the room should remember. Keep everything around it disciplined.

---

## Phase 0: recon and safety rails

Before building anything:

1. Read every file and produce a short map: what each file owns, what globals it defines, what it reads from `config.js`.
2. Identify every place in `brain.js` that mutates state in place. The neuron view already had to recompute the pool threshold because `brain.think()` overwrites its working array. Document every other instance so later phases do not trip on the same thing.
3. Tag the current commit `pre-conference` so I can always get back.
4. Add `_dev/README.md` recording what you found. This is your own notes file. Update it every phase with what you tried and what surprised you.
5. Confirm both verifiers pass on a clean checkout, and record the current wall-clock time of each.

Output: the file map, the mutation list, verifier timings. Then stop.

---

## Phase 1: presenter shell

Goal: one screen, no scrolling, projector-safe, keyboard driven. The existing lab UI stays available.

- New `presenter.html` and `presenter.css`. Reuse `colors.js`, `brain.js`, `config.js`, `viz.js`, `neuronview.js` unchanged. New `presenter.js` for the shell only. Do not fork `app.js` logic by copy-paste. If shared logic is needed, extract it into `shared.js` and have both entry points use it.
- Layout, CSS grid, fills the viewport exactly with no scrollbar at 1920x1080 and at 1440x900:
  - Header row: brain name, config summary in monospace, example counter.
  - Metric row: four cards, score, hue error, confidence, neurons alive.
  - Main row, two columns at roughly 1.35 to 1: left is the prediction grid slot, right is the neuron view slot.
  - Control row: lesion slider.
  - Button row: Train, Step x1, Reset weights, A/B, Tutorial.
- Keyboard bindings, all shown in a `?` overlay: `space` train or pause, `s` step once, `r` reset weights, `l` focus lesion slider then arrow keys adjust, `t` tutorial, `a` A/B mode, `1` through `6` switch relation, `?` shortcuts overlay, `esc` close any overlay.
- Every button and slider needs a visible focus ring. I will be operating this without looking at the trackpad.

Acceptance: no scrollbar at both resolutions, all shortcuts work, both verifiers pass, `presenter.html` renders with the network training as it does today.

---

## Phase 2: metrics and the confidence widget

- Four metric cards, monospace values, label above in `--text-mid`. Values update live during training. Round every displayed number: score integer, hue error one decimal with a degree sign, confidence integer percent, alive neurons integer.
- **Confidence widget.** This is the most important panel in the whole talk and it currently does not exist. Under the confidence number, draw the actual output vote distribution: 28 vertical bars, one per output neuron, height proportional to activation, arranged in input-neuron order so the 16 hue neurons form a contiguous run.
  - On `warmer` this reads as a single tight spike.
  - On `triadic` it must visibly read as two humps with nothing winning. That picture is the thesis of the talk.
  - Add a computed readout under the bars: `unimodal` or `bimodal, peaks 47 deg apart`. Detect by finding local maxima above half the global peak in the circular hue run.
- Add a relation switcher that retrains from scratch on the selected relation, so I can go from `warmer` to `triadic` live in one keypress and let the vote distribution do the explaining.

Acceptance: switching to `triadic` produces a visibly bimodal distribution and a `bimodal` readout. Switching back to `warmer` produces a spike and `unimodal`.

---

## Phase 3: the prediction grid

The signature element.

- 64 fixed probe colours, deterministic, chosen to cover the hue wheel evenly at several saturation and brightness levels. Store them in a new `probes.js` so they never change between runs. These probes must be **excluded from the training stream** so this is a genuine held-out set. Log how you enforce that.
- Render three rows of 64 swatches: input, Brian's current answer, ground truth from `colors.js`.
- Re-render every N training examples, default 200, configurable. The middle row starts as noise and converges toward the bottom row.
- Show mean absolute hue error over the 64 probes as a monospace number beside the grid, updating with each re-render. This is the closest thing to a training curve that this architecture permits, and I want to be able to say out loud that it is not a loss curve because there is no loss.
- CSS transition on swatch background colour, about 300ms, so convergence reads as a settling rather than a flicker.

Acceptance: a full training run visibly converges the middle row. Held-out probes are provably not in the training stream. Grid renders in under 8ms so it does not stall training.

---

## Phase 4: live lesion slider

- Add a lesion mask to `brain.js`: a boolean array over hidden neurons that zeroes a neuron's contribution without deleting it, so lesions are reversible. Deterministic from a seed so the same slider position always kills the same cells.
- Slider from 0 to 95 percent, step 5. On change: apply mask, re-evaluate the 64 probes, update all four metric cards and the prediction grid. No retraining.
- Debounce to about 60ms so dragging is smooth.
- Beside the slider, a small step chart plotting score against percent killed, with the current position marked. Build it as inline SVG, no chart library.
- Add a `Retrain lesioned` button. This answers my open question about whether damage is recoverable. Show pre-lesion, post-lesion, and post-retrain scores side by side, all three persisting on screen.

Acceptance: dragging to 40 percent leaves the score near unchanged, matching my recorded figures of 86 at 0 percent and 86 at 40 percent. Dragging to 95 percent leaves it near 54. Dragging back to 0 fully restores. `Retrain lesioned` produces a third number.

---

## Phase 5: the guided tutorial

This is the feature I most want and the one most likely to be built badly, so read this whole section before starting.

**What it is.** A stepped walkthrough that takes someone who knows nothing about neural networks and, in about twelve stops, explains every visible part of this network by pointing at the real running thing. Not a slideshow. Not a modal with paragraphs. The live network stays on screen and gets progressively spotlighted.

**Mechanics.**

- New `tour.js` holding the content as a plain data array, and `tour-ui.js` holding the mechanics. Content and mechanics must be separate files so I can rewrite the script the night before without touching logic.
- Each stop is an object: `{ id, target, title, body, action, pause }` where `target` is a CSS selector or a callback returning a bounding box, `action` is an optional function run on entry, and `pause` says whether training halts here.
- Spotlight: a full-viewport overlay at 72 percent opacity of `--ink-0` with a cut-out over the target. Implement with a single SVG mask or four positioned rects, not with `box-shadow` tricks that break at the viewport edge.
- Card: positioned adjacent to the target, auto-flipping to whichever side has room. Title 18px, body 16px, maximum 60 characters per line, progress as `4 / 12` in monospace, Back and Next buttons.
- Navigation: `right arrow` or `Next`, `left arrow` or `Back`, `esc` exits and restores prior state, click anywhere on the overlay advances. Never trap focus without an escape.
- State: entering the tour snapshots training state and restores it on exit. Leaving the tour mid-way must not leave the brain in a half-trained mystery state.
- The tour must work with a freshly reset brain **and** a fully trained one. Stops that need a trained brain should train silently in their `action` if needed, with a brief `training` indicator, rather than showing an empty panel.

**The twelve stops.** Use this content as the starting draft. Every stop must point at something actually on screen. Copy is plain, second person, no jargon before it is defined.

| # | Target | Title | What it must land |
|---|---|---|---|
| 1 | whole screen | What you are looking at | 256 artificial neurons that have learned to make colours warmer. Nothing here was programmed to do that. It worked it out from examples. |
| 2 | one input swatch | A colour arrives | The colour is never stored in one place. Watch what happens to it next. |
| 3 | input layer, 28 cells | The colour gets smeared | 16 cells sit around the hue wheel, 6 watch vividness, 6 watch brightness. An orange lights its own cell brightly and its neighbours dimly. The colour is the shape of the bump. Real visual systems do this. It is called population coding. |
| 4 | hero neuron dendrites | What a neuron is | A thing that listens on a few wires, weights what it hears, adds it up, and fires only if the total clears a bar. Ten weak yeses lose to two strong ones. |
| 5 | one dendrite, weight label | What a synapse is | Just a number: how much this one wire counts. Like a fader on a mixing desk. Training slides the faders. It adds nothing and speeds nothing up. A trained brain runs at exactly the same speed. |
| 6 | membrane potential arc | The bar it has to clear | Green arc is how hard this cell is being driven. The line is the bar. Right now this cell is ranked 40th of 102, so it stays silent. Losing is what neurons mostly do. |
| 7 | crowd view | Only about 13 of 256 fire | Each pool runs its own contest and everything else is forced to zero, not because it was wrong but because it was not loudest. This is k-winners-take-all. |
| 8 | wiring indicator | Each cell hears only 2 to 4 inputs | If every cell heard every input, all 256 would respond identically and you would have paid for 256 neurons and built one, copied. Sparse random wiring makes each cell an accidental specialist. |
| 9 | axon terminals, plus a code strip showing `brain.js:314` | The one line that learns | The answer is shown at the same moment as the question. Nothing compares them. Where a cell fired and an answer cell lit up together, the wire between them grows. Neurons that fire together, wire together. Donald Hebb wrote that in 1949. |
| 10 | metric row | Why it does not collapse | A cell that fires more gets stronger wires, which makes it fire more. Left alone one cell answers every colour identically. Two brakes stop it: the contest in stop 7, and a cap on each cell's total wire strength. Biology calls that homeostasis. |
| 11 | confidence widget, with relation switched to `triadic` | When it does not know | Two answers are equally correct and nothing can choose, so it averages them and produces a colour that is neither. Watch the confidence, not the score. 51 percent is the network telling you it is torn. The same failure appears in models a million times this size. |
| 12 | lesion slider, driven to 40 then 95 in the action | Break it | Kill 40 percent of the cells and the score barely moves. Kill 95 percent and 13 survivors still score 54. Nothing in the code implements fault tolerance. It falls out of spreading the answer across many cells. Software does not normally behave this way. |

Stop 12's `action` should animate the slider to 40, hold, then to 95, so the degradation is shown rather than described.

**Narration, optional and off by default.** Do this last and only if the rest of the phase is solid.

- Add a `Narrate` toggle. When on, each stop's `body` is spoken.
- Two paths. Path one: Web Speech API, zero files, robotic, acceptable as a fallback. Path two: pre-rendered audio, one file per stop, committed to `audio/tour-01.mp3` and so on, played by a plain `<audio>` element. Path two is what I will use. Ship a `_dev/render-narration.md` note describing how to regenerate those files, but do not call any speech API at runtime.
- Never autoplay. The toggle must be off on load. A conference room is loud and unexpected audio is a disaster. Show captions from the same `body` text whether or not audio plays.

Acceptance: the tour runs start to finish on a fresh brain and on a trained brain, `esc` at any stop restores prior state cleanly, every stop's spotlight lands on the correct element at both target resolutions, and the whole thing works with narration off and no audio files present.

---

## Phase 6: A/B split screen

- Two independent brain instances, same seed, same example stream, one config difference. Requires a clean way to instantiate two brains without global state collisions. Check Phase 0's mutation list first.
- Side by side: each gets its own metric cards, prediction grid, and confidence widget. Neuron view is hidden in this mode, there is no room.
- Preset comparisons in a dropdown, since these answer my open questions:
  - `chromaFraction` 0.40 versus 0.80
  - `forgetting` 0 versus 0.001
  - `fireFraction` 0.05 versus 1.0, which is competition off
  - `connectivity` 0.15 versus 1.0, which is dense wiring
  - `hiddenNeurons` 256 versus 96
- Synchronised example stream is essential. Both brains must see the same colours in the same order, otherwise the comparison is noise and someone in the room will say so.

Acceptance: the competition-off preset visibly collapses one side. The dense-wiring preset visibly degrades one side. Both confirm the architecture claims in the tutorial.

---

## Phase 7: experiment harness

Headless, Node, writes results I can put on a slide. This is what turns the demo into a study.

Create `_dev/experiments.js` producing `_dev/results.json` and a human-readable `RESULTS.md` with markdown tables.

Experiments:

1. **Seed variance.** 20 seeds per relation, all six relations. Report mean and standard deviation of score, hue error, and confidence. This pre-empts the "you got lucky with seed 7" question.
2. **Ablations.** Baseline, then one at a time: k-winners-take-all disabled, homeostatic cap disabled, mean-input subtraction disabled, sparse wiring replaced by dense. 10 seeds each. Report the delta from baseline. Ablation tables are the language this audience speaks.
3. **chromaFraction sweep.** 0.2, 0.4, 0.6, 0.8 on `warmer`, 10 seeds each. I asserted a rationale for 0.4 in my write-up and never tested it. Find out whether it earned its place.
4. **forgetting sweep.** 0, 0.0003, 0.001, 0.003, 0.01 on `warmer`, 10 seeds each.
5. **Lesion curves.** 0 to 95 percent in steps of 5, 10 seeds, for `hiddenNeurons` 96 and 256. Confirms the redundancy claim.
6. **Lesion then retrain.** Lesion 50 percent, retrain 4000 examples, report recovery.
7. **Confidence calibration.** Across all six relations and 20 seeds, scatter confidence against actual hue error. Report the correlation coefficient. If it correlates, I have a working uncertainty estimate derived with no error signal at all, which is a real result worth stating plainly.

Every experiment is seeded and reproducible. Print total runtime. Keep the whole suite under two minutes if you can; if not, tell me what is slow.

---

## Phase 8: backprop baseline

The comparison that makes the talk land, and the one where I most need you to be honest rather than flattering.

- `_dev/baseline.js`, a plain one-hidden-layer MLP, 28 inputs to H hidden to 28 outputs, trained by gradient descent on mean squared error. Pure JS, no dependencies, dev-only, never shipped to the browser.
- Match parameter count to Brian as closely as you can and state the exact counts on both sides.
- Same 4000 training examples, same held-out 64 probes, same scoring function. Reuse the scorer from `brain.js` so there is no chance of scoring the two differently.
- Report: score, hue error, and the full lesion curve for both.
- **Expect backprop to win on score.** Say so in `RESULTS.md`. The interesting result is the lesion comparison: the MLP should fall off a cliff where Brian degrades gradually. If it does not, that is a genuine finding against my thesis and I want to know before I stand up, not after.
- Produce one comparison chart, two lesion curves on shared axes, as a standalone SVG committed to the repo so I can put it in a slide.

---

## Phase 9: attribution, docs, and cleanup

- Add a `LICENSE` note file explaining the situation plainly: the upstream repo `machinesbefree/learning` by Kara Codex carries no licence, so all rights are reserved by its author; this fork exists under GitHub's terms; permission is being sought. Do not invent a licence for someone else's work.
- Add visible attribution in `presenter.html`, in the header, reading `Original workshop by Kara Codex` and linking to the upstream repo. It stays on screen for the entire talk.
- Prepare a pull request branch containing only `neuronview.js` and the minimum hooks it needs, nothing from the conference build. Self-contained, easy to review, no changes to `brain.js`. Write the PR description.
- Fix `TEACHER.md`. It currently promises verification takes a couple of seconds. `_verify_ui.js` takes about 15 seconds now, almost all of it the fake DOM being hammered by slow-speed frames. Correct the claim and explain why.
- Extend `_verify_ui.js` to cover the new surfaces: presenter shell renders, all twelve tour stops resolve their targets without error, lesion slider applies and reverts, A/B mode instantiates two brains, relation switcher works for all six.
- Update `README.md` with a `Presenting this` section: how to launch presenter mode, the keyboard map, and what to do if something breaks mid-talk.

---

## Phase 10: pre-flight

- Test at 1920x1080 and 1440x900, and at 150 percent browser zoom in case the projector is awkward.
- Verify the whole thing runs with network access disabled. Load it with devtools set to offline and confirm nothing fails.
- Confirm the audio files, if present, are the only binary assets and note the repo size.
- Write `_dev/RUNBOOK.md`: a 60-second demo path for passers-by, a 6-minute path for people who sit down, and a recovery step for each thing that could plausibly break.

---

## How to work with me on this

Ask before you assume. If a phase needs something I have forbidden, say so and propose an alternative rather than quietly working around it. If an experiment result contradicts something I claimed in my write-up, tell me directly and put it in `RESULTS.md` anyway. A demo that survives a hostile question is worth more than one that looks tidy.

Prose in every document you write: plain, direct, no em dashes.
