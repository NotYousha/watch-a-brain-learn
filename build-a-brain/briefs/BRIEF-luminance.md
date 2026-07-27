# Your brief: **Luminance**

## Your puzzle

Your brain has to learn to turn a colour into **the grey that looks equally
bright**. Every answer your brain gives is a shade of grey. The colour is
thrown away.

In `config.js`:

```js
relation: 'luminance',
```

## Why yours is interesting

This sounds like the boring one. It is the sneakiest one.

Because "how bright does this look" is **not** the same as "how much light is
there". Your eye is far more sensitive to green than to blue. A pure green
and a pure blue, at exactly the same physical brightness, do not look
remotely equally bright — the green looks much lighter.

The real formula weights them like this:

```
brightness = 0.299 x red + 0.587 x green + 0.114 x blue
```

Green counts about **five times more than blue**. Nobody tells your brain
this. It has to discover it from examples alone.

So your brain is not learning a colour trick. It is learning something about
**human eyes** — a fact about biology, recovered from data.

## Set this one differently from everyone else

```js
chromaFraction: 0.8,
```

Here is the twist, and it is worth pausing on. Your answers are all grey, so
you would think you want mostly *brightness* neurons and hardly any *colour*
neurons. **The opposite is true.** The brain cannot possibly know how bright
a colour looks until it knows what colour it is — so it needs the colour
pathway to do a brightness job.

Do not take my word for it. Train it at `0.4`, write down the numbers, then
train it at `0.8` and compare. Then you will actually know.

## Things to watch

- **The test that matters.** Use the colour picker to ask for pure green
  (`#00ff00`), then pure blue (`#0000ff`). Same brightness, wildly different
  colours. Green should come back a **clearly lighter grey** than blue. Do
  that test — it is the whole point of your puzzle.
- **Then rank all six.** Ask it for red, yellow, green, cyan, blue and
  magenta, and write down the grey it returns for each. Put them in order,
  lightest to darkest. Compare with the truth:
  `yellow > cyan > green > magenta > red > blue`.
- **You will not get that ranking exactly right, and that is the good bit.**
  Your brain gets the big structure right — yellow at the top, blue at the
  bottom, green far brighter than blue. But it muddles colours that are close
  together, and it **understates the spread**: it will say blue is a middling
  grey when really blue is nearly black. Work out which pairs it confuses.
  That is a genuine finding about what this brain can and cannot resolve, and
  nobody has written the answer down for you.
- **Hue error says `n/a`** on your screen, and that is correct — your answers
  are grey, and grey has no hue. Ignore that number entirely.

## If you finish early

Open `colors.js` and change the weights to `0.333 / 0.333 / 0.333` — treating
all three colours as equally bright, which is what a camera does and an eye
does not. Retrain, then redo the green-vs-blue test.

You now have two brains: one that sees like a human, one that sees like a
machine. Get them both on screen and show someone the difference.
