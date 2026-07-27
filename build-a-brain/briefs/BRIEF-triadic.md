# Your brief: **Triadic**

## Your puzzle

Your brain has to learn to find the colour **a third of the way around** the
wheel — 120 degrees. Red goes to green. Green goes to blue.

But read this carefully, because your rule has something the others do not:
**you can go either way round.** 120 degrees clockwise is correct. 120
degrees anticlockwise is also correct. Both answers are genuinely right, and
the rule picks one of them at random each time it shows your brain an
example.

In `config.js`:

```js
relation: 'triadic',
```

## Why yours is interesting

Nobody else in the room has this. Every other brain is being taught a rule
with exactly one right answer. Yours is being taught a rule with two.

Your brain has no way to know which one is coming. So: **what should it do?**
Think about that before you train it. Genuinely make a prediction — write it
down or say it out loud. Then train it and find out.

Do not be alarmed if your score is much lower than everyone else's. That is
not you doing it wrong. Your puzzle is harder in a way that is worth
understanding, and the low score is your result, not your failure.

## Things to watch

- **The confidence number.** Watch it during training and compare it with
  your neighbours' at the end. This is the most important number on your
  screen.
- **The brain map.** Look at the middle row against the bottom row. Your
  brain's answers will not be random — they will be wrong in a very
  particular, very consistent way. Work out what that pattern is.
- **The output neurons** on the right of the network view. How many of them
  are lit up at once, compared to a neighbour's brain?

## If you finish early

You have found a real problem — the same thing happens inside much bigger AI
models, including the language model project this workshop comes from.

Try to fix it. Some starting points: does making the brain bigger help? Does
turning `fireFraction` down (fewer neurons firing, more competition) help?
What if you edited `colors.js` so your rule always went the same way round —
would your brain suddenly be as good as everyone else's? What does that tell
you about where the difficulty actually lives: in the brain, or in the task?
