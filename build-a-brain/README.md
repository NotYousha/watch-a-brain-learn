# Build a Brain

You are going to build a small brain that learns to match colours, watch it
learn in real time, and then damage it to see what happens.

It is not a metaphor. There are neurons, there are synapses between them, and
the synapses change according to a rule a neuroscientist wrote down in 1949.

## Getting started

1. Get the code onto your computer.
2. **Double-click `index.html`.** It opens in your browser. That is the whole
   setup — there is nothing to install, no Python, no build step, and it does
   not need the internet.
3. Press **Train** and watch. This is the brain that comes with the project.
4. Now open a terminal in this folder and run `claude`.
5. Tell it: **"I'm ready to build my brain"** — and read your brief.

Claude will teach you ten things and ask you to explain each one back before
moving on. Then it will turn your answers into your own brain.

## Your brief

Look in `briefs/` and open the one with your name on it from your teacher.
Everyone in the room has a **different colour puzzle**, so everyone's brain
will come out differently. That is the point — you will compare at the end.

## What the screen is showing you

- **Left column** — input neurons. The colour you showed it, spread across
  many neurons instead of stored in one place. Real brains do this too.
- **Middle, two blobs** — the thinking neurons. The top blob handles colour,
  the bottom handles brightness. Your visual system is split the same way.
  Only the loudest few are allowed to fire at once; the rest are silenced by
  their neighbours.
- **Right column** — output neurons. The answer.
- **The lines** — synapses. The bright ones are strong. Training is nothing
  more than these numbers changing.
- **Brain map** — every colour swept through your brain at once. Middle row
  is what your brain says, bottom row is the right answer. When they match,
  it has learned.
- **Score** — 0 to 100. But read your brief before you judge your score.
  Some of these puzzles are supposed to be hard, and a low score can be the
  more interesting result.

## The files

| file | what it is |
|---|---|
| `config.js` | **yours** — every decision about your brain lives here |
| `colors.js` | the colour maths and the six puzzles |
| `brain.js` | the neurons, the synapses, and Hebb's rule |
| `viz.js` | the drawing |
| `app.js` | the buttons |

You only need to change `config.js`. Change a number, save, **refresh the
browser**, train again. That loop takes about three seconds, so experiment
freely — you cannot break anything that a refresh will not fix.
