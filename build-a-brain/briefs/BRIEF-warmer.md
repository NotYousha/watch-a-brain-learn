# Your brief: **Warmer**

## Your puzzle

Your brain has to learn to make a colour **warmer** — drag it towards
firelight orange, and make it a bit richer and brighter while it is at it.

In `config.js`:

```js
relation: 'warmer',
```

## Why yours is interesting

Everyone else has a rule that is a clean spin around the colour wheel: go
180 degrees, go 30 degrees, go 120 degrees. Yours is not a spin at all.

Yours is a **pull towards a destination**. A blue moves a long way. An orange
barely moves, because it is already there. So the size of the change depends
on where the colour started — and your brain has to work that out for itself,
because nobody tells it.

Your rule also changes **saturation and brightness**, not just hue. You are
the only person whose brain has to use both of its pathways properly.

## Things to watch

- **Test the extremes.** Ask it for a deep blue (a long journey) and then ask
  it for an orange (almost no journey). Does it handle both, or is it good at
  one and bad at the other?
- **The brain map.** Everyone else's middle row is a smooth rainbow, shifted
  along. Yours will not be. Colours will get **squashed together** near the
  orange end. Find that squashing and be ready to explain it.
- **`chromaFraction`** matters more for you than for anyone else, because
  your rule needs the brightness pathway too. Try 0.4 and 0.8 and compare.

## If you finish early

Open `colors.js`, find your relation, and change the strength of the pull —
the `0.45`. Set it to `1.0` and every colour becomes exactly orange.

Train that. Your brain will score **very well**. Now think about whether that
brain is actually cleverer than the one you built first, or whether you have
just given it an easier exam. This distinction matters enormously in real AI
research, and most benchmark arguments are secretly about exactly this.
