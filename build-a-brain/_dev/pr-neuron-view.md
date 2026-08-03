# Pull request: the single-cell neuron view

Prepared on branch `pr/neuron-view`, which is one commit on top of `origin/main`.
Nothing from the conference build is on it. `brain.js` and `colors.js` are
untouched.

To open it:

```
git push fork pr/neuron-view
```

then raise the pull request from `NotYousha/watch-a-brain-learn:pr/neuron-view`
into `machinesbefree/learning:main`.

## What is on the branch

```
build-a-brain/neuronview.js    new, 556 lines
build-a-brain/app.js           +86 -8    wiring, speed control, Step x1, click to spotlight
build-a-brain/index.html       +20 -1    the canvas and two controls
build-a-brain/viz.js           +26       slotColor exposed, spotlight ring in the crowd view
build-a-brain/config.js        +11 -1    trainSpeed only
build-a-brain/_verify_ui.js    +25 -4    drives the new controls
docs/superpowers/specs/...     new       the design note written before building it
```

Deliberately **not** on the branch:

- the fork's root `README.md` and `index.html`, which are fork landing pages and
  make no sense upstream
- every personal value in `config.js`. The branch keeps upstream's student
  defaults, `ownerName: 'unnamed'`, `brainName: 'Brain #1'`, `relation:
  'complement'`, `hiddenNeurons: 96` and the rest. The only config change is the
  new `trainSpeed` key.
- anything from the presenter build

---

## Suggested pull request description

### Title

Add a hero neuron view, tuning curve, and training speed control

### Body

The crowd view draws every unit as a plain circle, and a training run finishes in
about fifteen seconds. Between them, the two things the workshop spends its first
three teaching steps on, what a neuron is and what a synapse is, are the two
things a student cannot actually see. This adds a single-cell view at cell scale,
and slows training down enough that one Hebbian update is watchable.

**Everything drawn is read out of the running brain.** Nothing is illustrative:

- **Dendrites** are the cell's real `Wih` connections, one branch per connection.
  Cool for excitatory, warm for inhibitory, width by weight magnitude, brightness
  by what that input is carrying at this moment. A cell with three connections
  draws three branches.
- **The ring around the soma** is membrane potential against the live
  k-winners-take-all threshold for that cell's own pool. When the arc closes, the
  cell fires.
- **The axon** is myelinated with gaps at the nodes, and carries a spike that
  visibly travels along it when the cell fires.
- **Terminal boutons** are sized by their learned `Who` weights, and flash white
  where the training target is active at the same moment the cell fired. That
  flash is Hebb's rule, happening on screen, at the moment it happens.
- **A lesioned cell** has its axon drawn cut.

It also answers the two questions that make a neuron legible. *What makes it
fire*, by sweeping 48 colours past it and plotting the response as a tuning curve.
*What it says*, by decoding its `Who` row back into a colour through the same
`Code.decode` the brain uses on itself. Brightness-pathway cells get a brightness
sweep rather than a hue sweep, because sweeping hue past a cell that cannot hear
hue draws a flat line and teaches nothing.

Click any neuron in the crowd view to move the spotlight.

**Speed control.** `slow`, `normal`, `fast`, defaulting to `slow`, plus a `Step
x1` button. Slow is one example per animation frame, which is the setting that
makes a single synapse strengthening visible. `normal` is the original pace, so
nothing is taken away.

#### One thing worth knowing during review

`think()` writes its results into `this.hid` and returns that same array, and it
overwrites it three times on the way through: rectify, silence the losers,
normalise. By the time anything draws, the pre-competition drive is gone. So
`drives()` in `neuronview.js` recomputes the drive from `Wih` and `inp`, including
re-deriving the pool's threshold, rather than caching anything on the brain. That
is why there is arithmetic in the view that looks like it duplicates `brain.js`.
It seemed better than making `brain.js` keep a copy of state purely so that a
drawing routine could read it, but if you would rather it went the other way, say
so and I will change it.

#### Scope

`brain.js` and `colors.js` are not modified. `config.js` gains one key,
`trainSpeed`, and its existing student defaults are unchanged. Both verifiers
pass, and `_verify_ui.js` is extended to drive the new controls.

Take it or leave it, and thank you for writing the workshop.
