/* ============================================================
   probes.js — 64 fixed colours the network is never trained on.

   The point of these is that they are HELD OUT. Every number the
   prediction grid shows is the network answering a colour it has
   never been shown, which is the only kind of number worth putting
   on a slide.

   They are written down here rather than generated at random so
   that they are identical between runs, between machines, and
   between the browser and the experiment harness in _dev.
   ============================================================ */

const Probes = {

  /* 16 hues around the wheel, at four combinations of vividness and
     brightness. Read as four hue sweeps, which is why the grid looks
     like four bands rather than noise.

     All four levels sit inside the range Colors.randomColor() draws
     from, s and v both 0.45 to 1.0. If they sat outside it, the
     network would be being tested on a kind of colour it had never
     seen the like of, and a bad score would mean nothing.          */

  LEVELS: [
    { s: 0.95, v: 0.95 },
    { s: 0.62, v: 0.92 },
    { s: 0.92, v: 0.58 },
    { s: 0.55, v: 0.62 }
  ],

  HUES: 16,

  /* How close a training colour has to be to a probe to count as the
     same colour and be thrown away. Tight, because hue matters at
     roughly the 4 degree scale here and the whole grid would drift
     if this were loose. */
  RADIUS: { h: 1.2, s: 0.02, v: 0.02 },

  list: [],

  build() {
    const out = [];
    for (const lv of Probes.LEVELS) {
      for (let i = 0; i < Probes.HUES; i++) {
        out.push({ h: (i * 360) / Probes.HUES, s: lv.s, v: lv.v });
      }
    }
    Probes.list = out;
    return out;
  },

  /* ---- enforcing the hold-out ------------------------------
     Two things make this real rather than a claim.

     First, the training stream is filtered: any candidate colour
     that lands inside RADIUS of any probe is thrown away and
     redrawn. Probes.rejected counts how many times that happened,
     and the presenter shows the count, so the enforcement is
     visible rather than asserted.

     Second, nothing ever calls learn() with a probe. The grid only
     ever calls predict(), which does not write to Who.            */

  rejected: 0,

  isHeldOut(c) {
    const R = Probes.RADIUS;
    for (const p of Probes.list) {
      if (Math.abs(c.s - p.s) > R.s) continue;
      if (Math.abs(c.v - p.v) > R.v) continue;
      if (Colors.hueDist(c.h, p.h) > R.h) continue;
      return true;
    }
    return false;
  },

  /* A training example guaranteed not to be one of the 64. Same
     shape as Colors.makeExample(), so it drops straight in. */
  example(relationName) {
    for (let tries = 0; tries < 64; tries++) {
      const ex = Colors.makeExample(relationName);
      if (!Probes.isHeldOut(ex.input)) return ex;
      Probes.rejected++;
    }
    // Cannot happen with a radius this small, but never hang a demo.
    return Colors.makeExample(relationName);
  },

  /* ---- the three rows -------------------------------------- */

  truth(relationName) {
    const rel = Colors.relations[relationName];
    return Probes.list.map((c) => rel.apply(c));
  },

  /* What the network answers for all 64, and how wrong it is.

     Ambiguous relations pick one of their two correct answers at
     random each time apply() is called, so ground truth for those is
     passed in rather than recomputed here. Otherwise the error would
     jump about for reasons that have nothing to do with learning. */

  answers(brain, relationName, truthRows) {
    const want = truthRows || Probes.truth(relationName);
    const got = [];
    let err = 0, n = 0;
    for (let i = 0; i < Probes.list.length; i++) {
      const g = brain.predict(Probes.list[i]);
      got.push({ h: g.h, s: g.s, v: g.v, confidence: g.confidence });
      if (want[i].s > 0.15) { err += Colors.hueDist(g.h, want[i].h); n++; }
    }
    return { got, want, hueError: n ? err / n : null };
  }
};

Probes.build();
