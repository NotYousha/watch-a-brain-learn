# Teacher notes

Not for students. Hand out `briefs/` individually; leave this file out of it
or don't, it just spoils the endings.

## The hour

| time | what |
|---|---|
| 0:00–0:10 | You, at the front: neurons, synapses, "fire together wire together". Nothing else. |
| 0:10–0:15 | Everyone clones the repo, double-clicks `index.html`, presses **Train**. Working brain on every screen before anyone writes anything. |
| 0:15–0:35 | `claude` in the folder. Ten teach-back steps, ending in their own `config.js`. |
| 0:35–0:50 | Refresh, train their own brain, read the map, ask it colours, lesion it. |
| 0:50–1:00 | Six screens, six brains, compare. |

If you run late, cut the tutoring (step 15–35) short — tell Claude to skip to
step 4. **Do not cut the last fifteen minutes.** The playing and the
comparing is where it lands.

## Handing out the puzzles

Six students, six relations, one each:

| relation | give it to | ends up |
|---|---|---|
| `complement` | anyone — this is the control | ~4° error, 96% confidence |
| `analogous` | someone who likes catching people out | scores high, secretly suspicious |
| `triadic` | someone who won't panic at a bad score | **~60° error, 51% confidence — fails** |
| `split-complement` | pair them with the triadic student | ~30° error, 87% |
| `warmer` | someone visual | ~6° error, squashed map |
| `luminance` | **the one interested in neuroscience** | learns a fact about human eyes |

The luminance brief is the one that connects to real biology — the brain
recovers the human eye's green sensitivity from examples alone. That's the
one for the neurotech student. Their brief tells them to set
`chromaFraction: 0.8`, which is counterintuitive (all-grey answers, yet it
wants *colour* neurons) and is the point of that step.

Be aware of what their brain actually achieves: green ~0.51 vs blue ~0.32
against a truth of 0.59 vs 0.11. So the headline green-is-brighter-than-blue
result is clear and real, yellow-brightest and blue-darkest are correct, but
it confuses near neighbours (green/cyan, red/magenta) and compresses the
range. The brief asks them to find those confusions rather than pretending
the brain is perfect.

The triadic student will get a visibly bad score. Their brief tells them this
is the finding, not a failure, but check on them early anyway — and make sure
the room hears about it at the end. Two right answers, no way to choose, so
it averages them and produces a colour that is neither. That is a real
failure mode of much bigger models, and they found it themselves.

## The closing discussion

Ask in this order:

1. Whose scored highest? Whose lowest? — get the numbers on the board.
2. **Ask the triadic student what happened.** Let them explain it.
3. Ask the analogous student whether their brain actually learned anything.
4. Ask the luminance student what their brain worked out about eyes.
5. Then: *nobody wrote a rule. Nobody wrote "opposite" anywhere. Every one of
   these came out of one line — neurons that fire together, wire together.*

## Things that will happen

- **Someone opens `index.html` and gets a blank page.** They opened it from
  inside a zip file. Extract it properly.
- **Someone changed `config.js` and nothing happened.** They didn't refresh.
- **Someone sets `hiddenNeurons: 5000`.** It will chug. Anything up to about
  512 is fine on an old laptop; 4000 examples at 256 neurons takes ~260ms of
  actual compute, the rest is deliberate animation.
- **Someone asks whether this is "real AI".** It is a real neural network
  with a real learning rule. It is not a large language model. Both facts are
  worth saying.
- **Someone finishes in 20 minutes.** Stretch goals are at the bottom of
  every brief, and they're the good part — the analogous, warmer and
  luminance briefs each end with a genuinely open question.

## Checking it still works

```
node _verify.js      # trains all six relations, sweeps settings, lesion curve
node _verify_ui.js   # runs the page under a fake DOM, drives every button
```

Neither is part of the student project — they're here so you can confirm
nothing rotted before class. Both should run in a couple of seconds.

## What's actually under the hood

A colour is spread across 28 input neurons (16 hue, 6 saturation, 6
brightness) as overlapping tuning curves — population coding. Those feed a
hidden layer split into two pathways, colour and brightness, each running its
own k-winners-take-all competition. Input wiring is sparse, random, signed,
and **fixed** — it never learns. The only thing that learns is the
hidden→output matrix, by plain Hebbian outer-product updates with optional
decay and a per-neuron normalisation that stops any one neuron dominating.

That last bit is not decoration: runaway single-neuron domination is the
exact failure that killed the first version of the main BDHLM project. The
students are getting the fixed version.

No backpropagation anywhere. No gradients, no loss function, no optimiser.
