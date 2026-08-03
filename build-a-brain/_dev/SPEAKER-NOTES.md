# Speaker notes

Plain words. Read this the night before. `RUNBOOK.md` is the short operational
version for during the talk.

---

## Part 1: what the thing is, in the simplest words

### A neuron is a switch that listens

You have 256 tiny things. Call them cells. Each cell listens to a few wires.
Every wire has a number on it: how much that wire counts. The cell adds up what it
hears, and if the total is big enough, it turns on. If not, it stays off.

That is the whole thing. A neuron is a switch that listens to a few wires, adds up,
and turns on if the total is big enough.

**A synapse is just the number on one wire.** Like a slider on a music mixing desk.
Learning means moving the sliders. It does not add cells, it does not add wires, it
does not make anything faster. A fully trained network runs at exactly the same
speed as a brand new one.

### How it learns: things that happen together get wired together

Here is the whole training process.

1. Show it a colour.
2. **At the same time**, show it the right answer.
3. Some cells turn on. Some answer-lights turn on.
4. Wherever a cell was on **at the same moment** as an answer-light was on, make the
   wire between them a bit stronger.
5. Do that 4000 times.

That is it. That is the entire learning rule, and it is one line of code, at
`brain.js` line 314.

**Nothing ever measured how wrong it was.** Nothing compared its guess to the right
answer. There is no score inside it. It never got told "you were 40 degrees off".
It only ever strengthened wires between things that happened at the same time.

The name for this is **Hebb's rule**. A man called Donald Hebb wrote it down in
1949, before computers could really do anything. People say it as: *neurons that
fire together, wire together.*

### Why this is worth a room's attention

Modern AI learns by measuring how wrong it was and pushing the error backwards
through the network. That is called backpropagation. It is the basis of essentially
everything, and it works extremely well.

This has none of that. No error. No loss function. No gradient. And it still
learns. That is the point of the demo.

---

## Part 2: the four ideas behind it

You only need four. Say them in this order.

### 1. The colour is smeared across many cells

The colour does not go into one place. Sixteen cells sit around a colour wheel,
like numbers on a clock face. Show it orange, and the "orange" cell lights up
brightly, and its neighbours light up dimly. Six more cells watch how strong the
colour is, six more watch how bright it is. Twenty eight cells in total.

**The colour is not a number stored somewhere. It is the shape of that bump of
brightness across the cells.** The proper name is **population coding**, and your
own eye genuinely does this.

This matters because it is why the next three things work.

### 2. Only about 13 of the 256 cells are allowed to turn on

The cells compete. For any colour, the loudest few win and every other cell is
forced to zero. Not because it was wrong. Because it was not the loudest.

The name is **k winners take all**.

### 3. Each cell only hears 1 to 7 of the 28 inputs, picked at random

And the wiring is fixed at birth. It never learns. Only the wires on the *output*
side learn.

That randomness is the trick: because every cell hears a different random handful,
every cell accidentally becomes a specialist in something slightly different.

### 4. The answer is spread out, so damage does not kill it

Because the answer lives across many cells rather than in one, you can destroy most
of them and it still roughly works. Nobody programmed that. It falls out of the
first three things.

---

## Part 3: every panel on screen, and what to say

Go left to right, top to bottom.

### The four number cards

| card | what it means | plain words |
|---|---|---|
| **score** | out of 100, on colours it has never seen | "how right is it" |
| **hue error** | average degrees off the correct colour | "how far round the colour wheel is it wrong" |
| **confidence** | how much the answer-cells agree with each other | "how sure is it" |
| **neurons alive** | how many cells are not killed | "how much of the brain is left" |

### The bars under confidence — this is the most important panel

Those 28 bars are the answer-cells, and how loudly each one is voting.

- On **complement** you see **one tall spike**. All the cells agree. One answer.
- On **triadic** you see **two humps** and nothing winning. The readout says
  *bimodal*. Confidence collapses to about half.

**Why that happens:** triadic has *two* correct answers. Both are equally right, and
nothing in the network can pick. So it votes for both at once, and the two votes
partly cancel out. The colour it produces is neither of them.

**The line to say:** "Watch the confidence, not the score. Fifty one per cent is the
network telling you it is torn. And the same averaging failure happens in models a
million times this size."

### The 64 held-out colours

Three rows. Top is the colour shown. Middle is what it answers. Bottom is the
correct answer. Watch the middle row settle onto the bottom one.

**Held out** means those 64 colours are banned from training. The trainer refuses
them. So the middle row is it answering colours it has genuinely never seen. That
is what makes the number honest.

**Important thing to say:** that falling number is **not a loss curve**. Nothing in
the code computes a loss. It is measured from the outside, by me, after the fact.
The network has no idea it is being marked.

### The network view (top right)

- Left column: the 28 input cells. You can see the bump.
- Middle: the 256 cells in two clouds. Blue is the colour pathway, orange is the
  brightness pathway. Your real visual system has two separate pathways like this.
- Right column: the 28 answer cells.
- Bright dots are the ~13 firing right now. Everything else is silenced.

### The single cell view (bottom right)

One cell, blown up. Everything here is real, read out of the running network:

- **Dendrites** (branches on the left) are its actual wires. Blue means "this input
  pushes me on", orange-red means "this input pushes me off". Thicker means counts
  more.
- **Soma** is the cell body. The ring around it is how close it is to turning on.
  When the ring closes, it fires.
- **Axon** is the long wire out. When it fires you see a spark travel along it.
- **Terminals** on the right are the wires that learn. They grow as it trains, and
  they flash white at the exact moment a wire is being strengthened.

**This is the panel to point at when you say "that flash is the learning".**

---

## Part 4: every feature, and how to demo it

### `space` — Train / Pause

Press it. The score climbs. The grid converges. Press again to stop.

### `s` — Step once

Shows it exactly one colour, one time. Use this after pausing. Say: "one example,
one wire getting stronger." Watch the terminals flash on the big cell.

### `r` — Reset

Wipes every learned wire back to blank. The wiring stays, the learning goes. Use it
to start a demo cleanly.

### `1` to `6` — switch the puzzle

Six different colour rules. It forgets everything and learns the new one from
scratch.

| key | puzzle | result | why |
|---|---|---|---|
| 1 | complement | good, ~86 | one clear answer |
| 2 | analogous | good, ~86 | one clear answer |
| 3 | **triadic** | **bad, ~51** | **two right answers, it cannot choose** |
| 4 | split-complement | middling, ~69 | two right answers, close together |
| 5 | warmer | good, ~85 | one clear answer |
| 6 | luminance | good, ~84 | answers are greys, so hue error means nothing |

**Key 3 is your best moment.** The failure is the finding. Say: "It did not break.
It is telling you the question has two answers."

### The lesion slider — "break it"

Drag it. It kills that percentage of cells.

- 40 per cent gone: score **barely moves**
- 95 per cent gone: 13 cells left out of 256, still scores about **half**
- drag back to 0: **fully restores**, because the cells are switched off, not deleted

The little chart beside it plots score against damage. The three numbers are before,
lesioned, and after retraining.

**The line to say:** "Nothing in this code implements fault tolerance. There is no
backup, no redundancy feature, no error correction. It falls out of having spread
the answer across many cells. Normal software does not behave like this. Delete 40
per cent of a program and it does not run 99 per cent as well."

### `Retrain lesioned` — does damage heal?

Mostly **no**, and that is the honest answer. At 90 and 95 per cent killed,
retraining the survivors wins back only about 19 and 16 per cent of what was lost.

**Why:** the input wiring is fixed at birth and never learns. Retraining can only
adjust the output wires. So once cells are dead, the *specialisms* they carried are
gone for good and cannot be rebuilt.

### `t` — the tutorial

Twelve stops. It spotlights each part of the live network and explains it. Arrow
keys move, `esc` leaves and puts everything back exactly as it was.

**Use this if you freeze.** It contains this entire explanation, in order, on
screen.

### `a` — A/B mode

Two networks, side by side, **fed the same colours in the same order**, with exactly
one setting different. Five comparisons to pick from.

Say: "Same colours, same order, one difference. So the difference you see is the
setting, not luck."

### `b` — Bigger

Gives the network view the whole screen so the room can actually see the cell and
its wires. Safe to press while it is training.

---

## Part 5: your results, and the three that went against you

`RESULTS.md` has the tables. Know these.

### The best result you have

**Confidence predicts actual error, with a correlation of −0.97 across 100 runs.**

In plain words: when it says it is sure, it is right. When it says it is unsure, it
is wrong. It is genuinely reliable about its own reliability.

**Why that is remarkable:** it was never told what "wrong" means. There is no error
signal anywhere. The confidence number is just "how much do the answer-cells agree
with each other". And that turns out to be an excellent predictor of being wrong.

**Say it like this:** "This network has a working uncertainty estimate, and it got
one for free, without ever being shown an error."

### Other things that held up

- **Seed variance:** 20 different random starting wirings give 85.3 ± 1.2. So it was
  not luck.
- **`chromaFraction` 0.40 is genuinely the best** of the four values tested.
- **Redundancy scales with size:** 256 cells lose 0.9 points at 40 per cent damage;
  96 cells lose 7.4. More cells, more robustness.

### Three things that did NOT hold up. Know these cold.

Somebody sharp will ask, and A/B mode lets them check live. Being the person who
already knows is much stronger than being corrected.

**1. The homeostatic cap barely matters.** The code comment says without it "the
brain collapses". Removing it costs **0.9 points**. It is not idle either: 103 of
256 cells are pressed right against it. The reason it can be busy and still not
matter is that the answer is read out as a *direction* on the colour wheel, and
directions do not care how big the numbers were.

**2. Sparse wiring does not help the score.** Wiring everything to everything scores
**86.5 against 85.3** — slightly *better*. It only costs a bit of precision. The
claim that dense wiring makes all the cells identical is wrong, because each cell
still gets its own random numbers.

**3. Competition off does not cause a collapse.** Letting all 256 fire costs about 5
points. Real, but not a collapse. What actually stops it running away is a different
line: the whole layer gets divided by its own total activity, so the layer always
fires with the same total energy.

**How to say all three:** "I tested my own claims and three of them were wrong. Here
is what is actually doing the work." That answer wins the room. Defending a claim
the audience can disprove on your own laptop loses it.

### Backpropagation beats it, and say so first

| | score |
|---|---|
| this network | 84.8 |
| a normal backprop network, same size, same data | **96.6** |

It wins even given exactly the same single pass over the same 4000 examples: 95.6.

**Do not hide this. Lead with it.** Then give the interesting half:

| cells killed | this network keeps | backprop keeps |
|---|---|---|
| 40% | 99.6% of its score | 78.8% |
| 80% | 89.2% | 44.4% |
| 95% | **61.3%** | **27.4%** |

The two cross at about 25 per cent damage. Below that, backprop is simply better.
Above it, this one is, and the gap grows.

**The line:** "Backpropagation is far better at the task. This is far better at
surviving damage. Neither was asked for either property. They fell out of how each
one learns." The chart is `lesion-comparison.svg`.

---

## Part 6: questions you will get

**"So is this better than normal AI?"**
No, and I would not claim it. It is worse at the task by a wide margin. It is
better at surviving damage, and it needs no error signal. It is interesting, not
superior.

**"What is it actually useful for?"**
Honestly, as it stands, teaching. The useful ideas in it are the free uncertainty
estimate and the graceful degradation, both of which came from spreading the
representation out rather than from any clever algorithm.

**"Did you write the network?"**
No, and this matters. The network, the colour maths and the workshop were written by
Kara Codex. Her name is on screen for the whole talk. I added the single-cell view,
the presenter interface, the tutorial, and the experiments that tested her claims
and mine.

**"How is confidence computed?"**
Each answer-cell votes for a direction on the colour wheel. Add the votes as arrows.
If they all point the same way the total is long, which is high confidence. If they
point in two directions they partly cancel, which gives a short total and low
confidence. No target is involved anywhere.

**"Is confidence just the score in disguise?"**
No. It is computed only from the network's own output, with no reference to the
right answer. That is exactly why it is interesting that it predicts the error.

**"Why 256 cells?"**
It is a workshop setting you can change. The experiments cover 96 and 256. More
cells give more robustness, and the difference is measured.

**"What happens with more training?"**
It plateaus fast, in a few hundred examples. There is no gradual convergence,
because there is no gradient. Wires reach their cap and stop.

**"Could this scale?"**
I would not claim it. Nothing here tests scale. What I can say is that the
two-answers-averaged failure mode you see on triadic is a real failure mode in very
large models too.

**If you do not know an answer:** "I do not know, and I did not test that." Then say
what you did test. That is a strong answer, not a weak one.

---

## The 30 seconds that matter most

If you remember one paragraph, this one:

> These 256 cells learned to turn a colour into its opposite. Nobody programmed the
> rule. There is no error signal in this code, no loss function, and nothing that
> compares its answer to the right answer. All it does is strengthen the wire
> between two cells that happened to be on at the same moment. Donald Hebb
> suggested that in 1949. And out of that alone you get two things nobody asked
> for: it knows when it does not know, and you can destroy 95 per cent of it and it
> still half works.
