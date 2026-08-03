/* ============================================================
   brain.js — the brain itself.

   Three populations of neurons:

     INPUT  (28)  a colour, spread across many neurons
     HIDDEN (you choose)  the thinking layer
     OUTPUT (28)  the answer, spread across many neurons

   Nothing here is backpropagation. The only learning rule is
   Hebb's rule from 1949:

       neurons that fire together, wire together.

   ============================================================ */

/* How the colour is spread across neurons ("population coding").
   Real brains do this: no single neuron means "red", but a whole
   population of neurons each prefer a slightly different hue, and
   the bump of activity across them is the colour. */
const HUE_N = 16;   // neurons around the colour wheel
const SAT_N = 6;    // neurons for "how vivid"
const VAL_N = 6;    // neurons for "how bright"
const DIM   = HUE_N + SAT_N + VAL_N;   // 28

const HUE_SIGMA = 360 / HUE_N * 0.9;
const LIN_SIGMA = 1 / SAT_N * 1.1;

/* Hue neurons shout a little louder than the "how vivid" / "how
   bright" ones, because hue is the interesting part of most of
   these puzzles. */
const HUE_GAIN = 2.0;

/* Your visual system has two separate pathways: one that cares
   about COLOUR and one that cares about BRIGHTNESS. They run
   side by side and are combined at the end. We do the same here.
   Each pathway holds its own competition, so the colour neurons
   can never shout down the brightness neurons. */
const POOL_CHROMA = 0;   // listens to hue
const POOL_LUMA   = 1;   // listens to vividness and brightness

/* When we read the answer off the output neurons, quiet neurons
   are ignored entirely — only the ones voting loudest are counted.
   Without this, thousands of barely-firing neurons all whispering
   "maybe?" drag every answer toward a boring middle grey. */
const READOUT_SHARPNESS = 0.5;

/* Read a value off a row of neurons by finding the loudest one and
   then looking at its two neighbours to see which side it leans.

   The obvious method — averaging all the neurons — quietly drags
   every answer toward the middle, so the brain could never say
   "almost black" or "almost white". This one can. */
function readPeak(y, from, to, n) {
  let best = from;
  for (let i = from; i < to; i++) if (y[i] > y[best]) best = i;
  const idx = best - from;

  let shift = 0;
  if (idx > 0 && idx < n - 1) {
    const a = y[best - 1], b = y[best], c = y[best + 1];
    const denom = a - 2 * b + c;
    if (Math.abs(denom) > 1e-9) shift = (0.5 * (a - c)) / denom;
    shift = Math.max(-1, Math.min(1, shift));
  }
  return Math.max(0, Math.min(1, Code.linCenter(idx + shift, n)));
}

/* Ignore output neurons firing below this share of the loudest one. */
function sharpen(y, from, to) {
  let peak = 0;
  for (let i = from; i < to; i++) if (y[i] > peak) peak = y[i];
  const cut = peak * READOUT_SHARPNESS;
  const w = new Float64Array(to - from);
  for (let i = from; i < to; i++) w[i - from] = Math.max(0, y[i] - cut);
  return w;
}

const Code = {
  dim: DIM,

  hueCenter: (i) => (i * 360) / HUE_N,
  // Spread the preferred values right across 0..1, ends included, so
  // the brain can actually say "fully bright" and not just "quite bright".
  linCenter: (i, n) => i / (n - 1),

  /* colour -> 28 neuron activations */
  encode(c) {
    const x = new Float64Array(DIM);
    for (let i = 0; i < HUE_N; i++) {
      const d = Colors.hueDist(c.h, Code.hueCenter(i));
      // Hue only carries information when the colour is saturated.
      // A grey has no hue, so it should excite no hue neuron.
      x[i] = HUE_GAIN * c.s * Math.exp(-(d * d) / (2 * HUE_SIGMA * HUE_SIGMA));
    }
    for (let i = 0; i < SAT_N; i++) {
      const d = c.s - Code.linCenter(i, SAT_N);
      x[HUE_N + i] = Math.exp(-(d * d) / (2 * LIN_SIGMA * LIN_SIGMA));
    }
    for (let i = 0; i < VAL_N; i++) {
      const d = c.v - Code.linCenter(i, VAL_N);
      x[HUE_N + SAT_N + i] = Math.exp(-(d * d) / (2 * LIN_SIGMA * LIN_SIGMA));
    }
    return x;
  },

  /* 28 neuron activations -> colour, plus how sure the brain is */
  decode(y) {
    // Hue: average the preferred hues, going round the circle properly.
    const hv = sharpen(y, 0, HUE_N);
    let sx = 0, sy = 0, hw = 0;
    for (let i = 0; i < HUE_N; i++) {
      const w = hv[i];
      const a = (Code.hueCenter(i) * Math.PI) / 180;
      sx += w * Math.cos(a);
      sy += w * Math.sin(a);
      hw += w;
    }
    let h = (Math.atan2(sy, sx) * 180) / Math.PI;
    if (h < 0) h += 360;

    // CONFIDENCE. If the brain votes for one hue, this is near 1.
    // If it is torn between two opposite hues, the votes cancel out
    // and this collapses toward 0. Watch this number.
    const confidence = hw > 1e-9 ? Math.sqrt(sx * sx + sy * sy) / hw : 0;

    let sPeak = 0, vPeak = 0;
    for (let i = HUE_N; i < HUE_N + SAT_N; i++) if (y[i] > sPeak) sPeak = y[i];
    for (let i = HUE_N + SAT_N; i < DIM; i++) if (y[i] > vPeak) vPeak = y[i];

    return {
      h,
      s: sPeak > 1e-9 ? readPeak(y, HUE_N, HUE_N + SAT_N, SAT_N) : 0,
      v: vPeak > 1e-9 ? readPeak(y, HUE_N + SAT_N, DIM, VAL_N) : 0,
      confidence
    };
  }
};


/* ---------------------------------------------------------- */

class Brain {

  constructor(cfg) {
    this.cfg = cfg;
    this.nIn = DIM;
    this.nOut = DIM;
    this.nHid = cfg.hiddenNeurons;

    // A fixed random seed means your brain is reproducible:
    // reset it and you get the exact same starting wiring.
    this.rng = Brain.makeRng(cfg.seed);

    this.buildWiring();
    this.reset();

    this.stepsTrained = 0;
  }

  /* Small reproducible random number generator. */
  static makeRng(seed) {
    let s = (seed >>> 0) || 1;
    return function () {
      s ^= s << 13; s >>>= 0;
      s ^= s >> 17;
      s ^= s << 5;  s >>>= 0;
      return s / 4294967296;
    };
  }

  /* ---- wiring ---------------------------------------------
     INPUT -> HIDDEN is sparse and random, and never changes.
     This is the "some-to-some" connectivity of a real brain:
     each hidden neuron listens to only a handful of inputs,
     not all of them. It is fixed at birth. It does not learn.
  */
  buildWiring() {
    const p = this.cfg.connectivity;
    this.Wih = new Float64Array(this.nHid * this.nIn);   // fixed
    this.inDeg = new Int32Array(this.nHid);
    this.pool = new Int8Array(this.nHid);

    const chromaShare = this.cfg.chromaFraction;
    for (let j = 0; j < this.nHid; j++) {
      // Which pathway does this neuron belong to?
      this.pool[j] = this.rng() < chromaShare ? POOL_CHROMA : POOL_LUMA;
      // ...and therefore which inputs is it even allowed to hear?
      const lo = this.pool[j] === POOL_CHROMA ? 0 : HUE_N;
      const hi = this.pool[j] === POOL_CHROMA ? HUE_N : this.nIn;

      for (let i = lo; i < hi; i++) {
        if (this.rng() < p) {
          // Signed weights: some inputs excite a neuron, some quieten it.
          this.Wih[j * this.nIn + i] = this.rng() * 2 - 1;
          this.inDeg[j]++;
        }
      }
      // A neuron wired to nothing can never fire. Give it one connection.
      if (this.inDeg[j] === 0) {
        const i = lo + Math.floor(this.rng() * (hi - lo));
        this.Wih[j * this.nIn + i] = this.rng() * 2 - 1;
        this.inDeg[j] = 1;
      }
      // Give every neuron the same total say, so that a neuron which
      // happened to get more connections cannot bully the rest.
      let norm = 0;
      for (let i = 0; i < this.nIn; i++) norm += this.Wih[j * this.nIn + i] ** 2;
      norm = Math.sqrt(norm) || 1;
      for (let i = 0; i < this.nIn; i++) this.Wih[j * this.nIn + i] /= norm;
    }
  }

  /* ---- state ---------------------------------------------- */
  reset() {
    // HIDDEN -> OUTPUT starts blank. This is what learning writes on.
    this.Who = new Float64Array(this.nHid * this.nOut);
    this.alive = new Float64Array(this.nHid).fill(1);   // 0 = lesioned
    this.hid = new Float64Array(this.nHid);
    this.out = new Float64Array(this.nOut);
    this.inp = new Float64Array(this.nIn);
    this.fireCount = new Float64Array(this.nHid);
    this.stepsTrained = 0;
  }

  /* ---- thinking -------------------------------------------
     Input neurons drive hidden neurons. Then the hidden neurons
     COMPETE: only the loudest few are allowed to fire, and the
     rest fall silent. This is k-winners-take-all, and it is what
     stops one loud neuron from dominating everything.
  */
  think(x) {
    const nIn = this.nIn, nHid = this.nHid;
    this.inp.set(x);
    const pre = this.hid;

    // Subtract the average. Neurons care about the PATTERN of their
    // input, not how loud it is overall — otherwise every bright
    // colour would look the same to them.
    let mean = 0;
    for (let i = 0; i < nIn; i++) mean += x[i];
    mean /= nIn;

    for (let j = 0; j < nHid; j++) {
      if (this.alive[j] === 0) { pre[j] = 0; continue; }
      let sum = 0;
      const base = j * nIn;
      for (let i = 0; i < nIn; i++) sum += this.Wih[base + i] * (x[i] - mean);
      pre[j] = sum > 0 ? sum : 0;             // a neuron cannot fire negatively
    }

    // Competition, held separately inside each pathway so that the
    // colour neurons cannot silence the brightness neurons.
    let total = 0;
    for (const which of [POOL_CHROMA, POOL_LUMA]) {
      const members = [];
      for (let j = 0; j < nHid; j++) if (this.pool[j] === which) members.push(pre[j]);
      if (members.length === 0) continue;
      const k = Math.max(1, Math.round(members.length * this.cfg.fireFraction));
      members.sort((a, b) => b - a);
      const thresh = members[Math.min(k, members.length) - 1];
      for (let j = 0; j < nHid; j++) {
        if (this.pool[j] !== which) continue;
        if (pre[j] < thresh) pre[j] = 0;
        total += pre[j];
      }
    }
    // Normalise so the whole layer always fires with the same total
    // energy. Loud inputs do not get a louder brain — just a
    // different set of winners.
    if (total > 1e-12) for (let j = 0; j < nHid; j++) pre[j] /= total;

    return pre;
  }

  predict(color) {
    const h = this.think(Code.encode(color));
    const y = this.out;
    y.fill(0);
    for (let j = 0; j < this.nHid; j++) {
      const a = h[j];
      if (a === 0) continue;
      const base = j * this.nOut;
      for (let o = 0; o < this.nOut; o++) y[o] += a * this.Who[base + o];
    }
    return Code.decode(y);
  }

  /* ---- learning -------------------------------------------
     We show the brain the input AND the right answer at the same
     time, and let both fire together. Every hidden neuron that
     fired gets a stronger connection to every output neuron that
     fired. That is the entire learning rule.
  */
  learn(example) {
    const h = this.think(Code.encode(example.input));
    const t = Code.encode(example.target);
    const lr = this.cfg.learningRate;
    const decay = this.cfg.forgetting;

    for (let j = 0; j < this.nHid; j++) {
      const a = h[j];
      const base = j * this.nOut;

      if (a > 0) this.fireCount[j]++;

      if (decay > 0) {
        // Unused synapses slowly fade. "Use it or lose it."
        for (let o = 0; o < this.nOut; o++) this.Who[base + o] *= (1 - decay);
      }
      if (a === 0) continue;

      // Hebb's rule: fire together, wire together.
      for (let o = 0; o < this.nOut; o++) this.Who[base + o] += lr * a * t[o];

      // Homeostasis. Real neurons cap their own total synaptic
      // strength, which stops any one neuron running away and
      // drowning out the rest. Without this the brain collapses
      // into shouting the same answer at everything.
      let norm = 0;
      for (let o = 0; o < this.nOut; o++) norm += this.Who[base + o] ** 2;
      norm = Math.sqrt(norm);
      if (norm > 1) for (let o = 0; o < this.nOut; o++) this.Who[base + o] /= norm;
    }

    this.stepsTrained++;
  }

  /* ---- damage ---------------------------------------------
     Kill a fraction of the hidden neurons, permanently, at random.
     A brain is not a program: breaking bits of it does not crash
     it, it just makes it worse. Try it.
  */
  lesion(fraction) {
    const order = [];
    for (let j = 0; j < this.nHid; j++) if (this.alive[j] === 1) order.push(j);
    // Shuffle, then kill the first slice.
    for (let i = order.length - 1; i > 0; i--) {
      const r = Math.floor(this.rng() * (i + 1));
      [order[i], order[r]] = [order[r], order[i]];
    }
    const kill = Math.round(this.nHid * fraction);
    let killed = 0;
    for (let i = 0; i < order.length && killed < kill; i++, killed++) {
      this.alive[order[i]] = 0;
    }
    return killed;
  }

  heal() { this.alive.fill(1); }

  /* ---- a repeatable lesion mask ---------------------------
     lesion() above shuffles using this.rng, which is a stateful
     closure that is never rewound, so asking for 40 percent twice
     kills two different sets of cells. That is fine for a student
     poking at it once. It is wrong for a slider you drag back and
     forth in front of a room.

     So: build ONE kill order from its own independent generator,
     and take a prefix of it. Same seed and same percentage always
     kills the same cells, 40 percent is always a superset of 20
     percent, and dragging back to zero restores exactly.

     Nothing here changes the learning rule, the competition, or
     the readout. It only writes this.alive, the same flag that
     lesion() and heal() already write.                         */

  lesionOrder(seed) {
    if (this._lesOrder && this._lesSeed === seed && this._lesOrder.length === this.nHid) {
      return this._lesOrder;
    }
    const rng = Brain.makeRng(seed);
    const order = new Int32Array(this.nHid);
    for (let j = 0; j < this.nHid; j++) order[j] = j;
    for (let i = this.nHid - 1; i > 0; i--) {
      const r = Math.floor(rng() * (i + 1));
      const t = order[i]; order[i] = order[r]; order[r] = t;
    }
    this._lesOrder = order;
    this._lesSeed = seed;
    return order;
  }

  /* Kill exactly this fraction, reversibly and repeatably. */
  lesionTo(fraction, seed) {
    const order = this.lesionOrder(seed == null ? 1 : seed);
    const kill = Math.round(this.nHid * fraction);
    this.alive.fill(1);
    for (let i = 0; i < kill && i < order.length; i++) this.alive[order[i]] = 0;
    return kill;
  }

  /* ---- snapshot and restore -------------------------------
     Everything training changes, and nothing it does not. The fixed
     input wiring is left out on purpose: it is built once at birth
     and never learns, so there is nothing to save.

     The tutorial uses this so that walking into it, training
     silently to make a point, and pressing escape leaves the brain
     exactly as the presenter left it.                           */

  snapshot() {
    return {
      Who: Float64Array.from(this.Who),
      alive: Float64Array.from(this.alive),
      fireCount: Float64Array.from(this.fireCount),
      stepsTrained: this.stepsTrained
    };
  }

  restore(s) {
    if (!s || s.Who.length !== this.Who.length) return false;
    this.Who.set(s.Who);
    this.alive.set(s.alive);
    this.fireCount.set(s.fireCount);
    this.stepsTrained = s.stepsTrained;
    return true;
  }

  aliveCount() {
    let n = 0;
    for (let j = 0; j < this.nHid; j++) n += this.alive[j];
    return n;
  }

  /* ---- helpers -------------------------------------------- */

  static kthLargest(arr, k) {
    const copy = Array.from(arr);
    copy.sort((a, b) => b - a);
    return copy[Math.min(k, copy.length) - 1];
  }

  /* How wrong is the brain right now? Averaged over n fresh colours
     it has never seen. Returns error in RGB distance (0 = perfect)
     and in degrees of hue. */
  evaluate(relationName, n = 120) {
    const rel = Colors.relations[relationName];
    let rgbErr = 0, hueErr = 0, conf = 0, hueSamples = 0;
    for (let i = 0; i < n; i++) {
      const input = Colors.randomColor();
      const target = rel.apply(input);
      const got = this.predict(input);
      rgbErr += Colors.rgbDist(
        Colors.hsv2rgb(got.h, got.s, got.v),
        Colors.hsv2rgb(target.h, target.s, target.v)
      );
      // Hue error is only meaningful for colours that have a hue.
      if (target.s > 0.15) { hueErr += Colors.hueDist(got.h, target.h); hueSamples++; }
      conf += got.confidence;
    }
    return {
      rgbError: rgbErr / n,
      hueError: hueSamples ? hueErr / hueSamples : null,
      confidence: conf / n,
      score: Math.max(0, Math.round(100 * (1 - (rgbErr / n) / 0.5)))
    };
  }

  /* The strongest learned synapses, for drawing. */
  topSynapses(limit) {
    const out = [];
    for (let j = 0; j < this.nHid; j++) {
      if (this.alive[j] === 0) continue;
      const base = j * this.nOut;
      for (let o = 0; o < this.nOut; o++) {
        const w = this.Who[base + o];
        if (w > 0.02) out.push({ j, o, w });
      }
    }
    out.sort((a, b) => b.w - a.w);
    return out.slice(0, limit);
  }
}
