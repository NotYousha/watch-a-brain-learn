# Your brief: **Analogous**

## Your puzzle

Your brain has to learn to find the **neighbouring colour** — 30 degrees
around the wheel. Red goes to orange. Orange goes to yellow. A small step.

In `config.js`:

```js
relation: 'analogous',
```

## Why yours is interesting

Yours is going to score brilliantly, almost immediately. Which should make
you suspicious.

Here is the awkward question you get to answer for the room: **how would you
know the difference between a brain that has genuinely learned "shift by 30
degrees" and a brain that has just learned to copy its input?** The answer
it gives is only a little different from the colour it was shown. A lazy
brain that did nothing at all would still look nearly right.

This is a real problem in AI research. A model can score well by finding a
shortcut instead of learning the thing you wanted.

## Things to watch

- Look at the **brain map** closely. The middle row is your brain's answer
  and the bottom row is the correct answer. Now compare the middle row to
  the **top** row — the colour it was shown. Can you see the shift?
- Try shrinking your brain to `hiddenNeurons: 32`. If it is taking a
  shortcut, does the shortcut survive?

## If you finish early

Design a test that would catch a lazy brain. One option: open `colors.js`,
copy the `analogous` block, rename it to `copycat`, and make it return the
input completely unchanged (`h: c.h`). Point `config.js` at `copycat` and
train it. **What score does a brain that does nothing at all get?** That
number is the bar your real brain has to beat.
