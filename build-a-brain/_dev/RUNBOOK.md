# Runbook

For standing in front of the thing. Keep this on your phone, not on the projector.

## Before you start

1. Open `build-a-brain/presenter.html` by double-clicking it. No server, no
   network.
2. `F11` for fullscreen. `Ctrl` and `+` two or three times.
3. Check the bottom row of buttons is still on screen after zooming.
4. Press `space`. Watch the score climb past 80. Press `space` again to stop.
5. Press `r`. You now have a blank brain and a working demo.

If step 4 does not reach 80 within a few seconds, reload and try once more before
worrying. Nothing is saved, so a reload is always safe.

---

## The 60-second path, for someone passing by

They have not sat down. You have one idea to land and it is not the architecture.

1. **Press `space`.** "This is 256 artificial neurons learning to find the
   opposite colour. Nobody programmed the rule. Watch the middle row."
2. **Point at the grid.** The middle row settles onto the bottom row. "Those 64
   colours are held out. It has never been shown any of them."
3. **Say the thing.** "There is no loss function in this code. No error signal.
   Nothing ever compares its answer to the right answer. One line does the
   learning: where two cells fire at the same time, the wire between them grows."
4. **Drag the lesion slider to 40, then 95.** "Kill 40 per cent of the neurons and
   the score barely moves. Kill 95 per cent, thirteen cells left, and it still
   scores about half. Nothing in the code implements that."
5. **Drag back to 0.** It fully restores. Let them ask the next question.

If they ask only one thing it is usually "does it actually work" and the answer is
the grid.

---

## The 6-minute path, for someone who sits down

Press `t` and let the tutorial do it. Twelve stops, arrow keys or click the dim to
advance. It trains silently where it needs to and puts everything back when you
press `esc`.

If you would rather drive it yourself:

| time | do | say |
|---|---|---|
| 0:00 | `r` then `space` | blank brain, watch the grid converge |
| 0:45 | point at the input column in the network panel | one colour becomes a bump across 28 cells. Population coding. Your own eye does this |
| 1:30 | point at the single cell view | a neuron listens on a few wires, adds up, fires if it clears a bar. Those dendrites are its real connections |
| 2:15 | `space` to pause, then `s` a few times | one example, one Hebbian update. The boutons that flash are the wires growing |
| 3:00 | point at "13 of 256 firing" | each pool runs a contest, everything else is forced to zero |
| 3:45 | `3` for triadic, let it train | two correct answers, nothing can choose, so it answers with both. Two humps. Watch the confidence, not the score |
| 4:45 | `1` back to complement, then lesion 40 and 95 | graceful degradation, and it is not a feature anyone wrote |
| 5:30 | `a` for A/B, pick "competition on vs off", `space` | same colours, same order, one difference |

**The line worth saving for the end:** confidence correlates with actual error at
r = -0.97 across 100 runs. A usable uncertainty estimate out of a network with no
error signal at all. That is in `RESULTS.md` if anyone wants the table.

---

## Hostile questions, and the honest answers

**"You got lucky with the seed."** 20 seeds, `complement` is 85.3 ± 1.2, range 84
to 88. `RESULTS.md` section 1.

**"Backprop would crush this."** It does. 96.6 against 84.8, and 95.6 even when
limited to the same single pass over the same 4000 examples. Say it before they do.
The interesting number is the lesion curve: the two cross at about 25 per cent
damage, and at 95 per cent the Hebbian network keeps 61 per cent of its score while
the matched MLP keeps 27. `lesion-comparison.svg`.

**"Sparse wiring is doing the work."** It is not, on score. Dense wiring scores
slightly better, 86.5 against 85.3. It costs hue precision. Do not oversell this
one; the ablation table is in `RESULTS.md` section 2 and someone can run it live in
A/B mode.

**"Isn't the homeostatic cap load bearing?"** Less than the code comment claims.
Removing it costs 0.9 points, even though 103 of 256 cells sit pressed against it.
The readout is a weighted circular mean, so it is largely blind to weight
magnitude. Removing the cap and the competition together still gives 79.

**"Does the damage heal if you retrain?"** Barely. At 90 and 95 per cent killed,
retraining the survivors regains about 19 and 16 per cent of what was lost. It
cannot do better because the input wiring is fixed at birth, so retraining can only
readjust the output weights, not rebuild the tuning curves the dead cells took with
them.

**"Is the confidence just the score in disguise?"** No. It is computed from the
spread of the output population, with no reference to any target. That is why it
still reads 51 per cent on triadic where the score is 51 but for a different
reason, and why it correlates with error across relations it was never tuned on.

---

## When something breaks

| symptom | fix |
|---|---|
| score stuck at 0 | `r` then `space`. If still stuck, reload. |
| a panel looks stale or blank | `space` twice; every panel redraws on a training frame |
| tutorial spotlight in the wrong place | `esc`, then `t` again. Targets are measured live, so a zoom or resize mid-tour needs a reopen. |
| clipped layout, button off screen | `Ctrl 0` to reset zoom, then zoom back one step at a time |
| A/B looks frozen | `space`. Opening A/B does not start the run, it waits for you. |
| lesion slider will not restore | drag to 0, or press `r`. The mask is reversible and 0 always fully restores. |
| relation switch left it looking wrong | it retrains from scratch on switch, so give it a few seconds, or `space` |
| you dropped into the wrong mode | `esc` gets out of anything. Two `esc` presses gets you to the plain screen. |
| the whole page is wrong | reload. Nothing persists. You lose only the current training run. |
| the presenter build itself is broken | open `build-a-brain/index.html`. It is the original lab UI, shares the same brain code, and has Train, a lesion slider and a brain map. You can give the talk from it. |

Nothing loads from the network. Conference wifi failing changes nothing. This was
tested with every network request forced to fail.

---

## Facts you might be asked for

- 256 hidden neurons, split into a colour pool of about 107 and a brightness pool
  of about 149
- 28 input and 28 output neurons: 16 hue, 6 vividness, 6 brightness
- each hidden cell hears 1 to 7 of the 28 inputs, wired at random, fixed at birth
- about 12 or 13 of 256 fire for any given colour
- 7168 learnable parameters, and 7168 more that are frozen at birth
- the learning is one line, `brain.js:314`
- 4000 training examples per run, about 400ms of actual compute
- no binary assets, 472K of tracked files, nothing fetched at runtime
