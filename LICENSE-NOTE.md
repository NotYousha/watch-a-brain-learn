# Licence situation

Read this before reusing anything here.

## The short version

The upstream project carries no licence file. That means all rights are reserved
by its author. This fork exists under GitHub's Terms of Service, which permit
forking and viewing within GitHub, and nothing beyond that. Permission for wider
use is being sought and has not yet been granted.

This file is a statement of the position. It is not a licence and it does not
grant anyone any rights.

## What was written by whom

The original workshop is **Build a Brain**, by **Kara Codex**
(kara@freethemachines.ai), at
[machinesbefree/learning](https://github.com/machinesbefree/learning).

That is where the substance came from: the network in `brain.js`, the colour maths
and the six relations in `colors.js`, the crowd view in `viz.js`, the student
configuration file, the teaching script in `TEACHER.md` and `CLAUDE.md`, and the
briefs. All of it hers.

Added in this fork, by Yousha Ahmed:

- `neuronview.js`, the single-cell view, and its hooks in `app.js`, `index.html`
  and `viz.js`
- the presenter build: `presenter.html`, `presenter.css`, `presenter.js`,
  `shared.js`, `probes.js`, `ab.js`, `tour.js`, `tour-ui.js`
- the dev harnesses in `_dev/`, and `RESULTS.md`

`brain.js` and `colors.js` are unmodified from upstream apart from three additions
to `brain.js` that add no behaviour to the existing code paths: a repeatable
lesion mask, and a snapshot and restore pair. The learning rule, the competition,
the normalisation cap and the readout are untouched.

## Why there is no LICENSE file in this repository

Because inventing one would be claiming a right that is not mine to grant. A
licence on this fork could only cover the parts written here, and separating them
cleanly from Kara's work is not possible in files like `app.js` and `index.html`
that are edits to hers. So there is no licence, and this note explains why rather
than papering over it.

## If you are Kara

Thank you for writing this. It is a genuinely good piece of teaching. If you would
prefer this fork private, taken down, changed, or credited differently, say so and
it will be done. If you would like any of the additions above, the single-cell
view is prepared as a self-contained pull request on the `pr/neuron-view` branch,
with no changes to `brain.js` or `colors.js`, and it is yours to take or ignore.

## If you are anyone else

Do not treat anything here as reusable. Go to
[machinesbefree/learning](https://github.com/machinesbefree/learning) and ask the
author.
