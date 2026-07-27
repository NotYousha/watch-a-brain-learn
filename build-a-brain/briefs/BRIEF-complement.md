# Your brief: **Complement**

## Your puzzle

Your brain has to learn to find the colour **directly opposite** on the
colour wheel. Red goes to cyan. Yellow goes to blue. Half a turn, every time.

In `config.js`:

```js
relation: 'complement',
```

## Why yours is interesting

Yours is the clean one. There is exactly one right answer for every colour,
and the rule never changes. That makes your brain the **control** for the
whole room — when someone's brain does something strange, yours is what
they will compare it against.

So your job is partly to get a really good score, and partly to be able to
say *why* yours worked when you compare notes at the end.

## Things to watch

- **How quickly does it learn?** Watch the brain map while training. It does
  not improve smoothly everywhere at once — see if some parts of the colour
  wheel lock in before others.
- **How few neurons can you get away with?** Try `hiddenNeurons: 32`, then
  256. Does 8× the neurons make it 8× better? (It does not. Why not?)
- **Confidence should end up very high.** Remember that number. Someone
  else's brain in this room will have a much lower one, and you will be able
  to explain why.

## If you finish early

Train it, then damage it with the lesion slider — and then **train it
again** while it is damaged. Does it recover? What does that tell you about
where the knowledge is stored?
