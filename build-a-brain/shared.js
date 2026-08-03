/* ============================================================
   shared.js — logic used by BOTH entry points.

   app.js is the student lab UI. presenter.js is the conference
   shell. Everything they genuinely have in common lives here, so
   that presenter.js is not a fork of app.js.

   Nothing in this file touches the learning rule, the competition,
   or the colour maths. It is pacing, formatting, and readout.
   ============================================================ */

const Shared = {

  /* ---- pacing ---------------------------------------------- */

  SPEEDS: ['slow', 'normal', 'fast'],

  /* How many examples to train per animation frame. Slow is one,
     so that a single Hebbian update can be watched happening. */
  perFrame(speedIdx, total) {
    const name = Shared.SPEEDS[speedIdx] || 'slow';
    if (name === 'slow') return 1;
    if (name === 'fast') return Math.max(1, Math.round(total / 120));
    return Math.max(1, Math.round(total / 900));
  },

  /* ---- number formatting ----------------------------------
     Every number either UI shows goes through here, so the lab and
     the presenter can never disagree about rounding. evaluate()
     returns hueError null for luminance, where every answer is a
     grey and hue is meaningless, so that case is handled once. */

  fmt: {
    score: (e) => String(e.score),
    hue: (e) => (e.hueError === null ? 'n/a' : e.hueError.toFixed(1) + '°'),
    conf: (e) => Math.round(e.confidence * 100) + '%',
    alive: (brain) => brain.aliveCount() + ' / ' + brain.nHid,
    int: (n) => Math.round(n).toLocaleString(),
    deg: (d) => (d === null ? 'n/a' : d.toFixed(1) + '°')
  },

  /* ---- lesion ---------------------------------------------
     One fixed seed for the whole build, so that "40 percent" always
     means the same 40 percent of cells, in the UI and in the notes.
     See brain.js lesionTo(): the built-in lesion() draws from the
     brain's own stateful generator and is not repeatable.        */

  LESION_SEED: 20260803,

  /* ---- what the output layer actually voted ----------------
     28 numbers, one per output neuron, in input-neuron order, so
     the 16 hue cells are a contiguous run.

     brain.predict() leaves exactly this in brain.out, but brain.out
     is overwritten by the next call that runs the network, which
     includes every evaluate(). So copy it out immediately.       */

  votes(brain, color) {
    brain.predict(color);
    return Float64Array.from(brain.out);
  },

  /* Is the hue vote one hump or two?

     Two correct answers with nothing to choose between them shows
     up here as two humps and a collapsed confidence. That picture
     is the whole argument, so the detection has to be honest:
     find every local maximum in the circular hue run that clears
     half the global peak, merge runs of equal neighbours so one
     wide bump is not counted twice, and report the separation
     between the two loudest. */

  bimodality(vec) {
    const n = HUE_N;
    let peak = 0;
    for (let i = 0; i < n; i++) if (vec[i] > peak) peak = vec[i];
    if (peak <= 1e-9) {
      return { mode: 'silent', humps: [], sepDeg: null, label: 'no vote yet' };
    }

    const cut = peak * 0.5;
    const cand = [];
    for (let i = 0; i < n; i++) {
      if (vec[i] < cut) continue;
      if (vec[i] >= vec[(i - 1 + n) % n] && vec[i] >= vec[(i + 1) % n]) cand.push(i);
    }

    // Runs of adjacent candidates are one hump, not several.
    const groups = [];
    for (const i of cand) {
      const last = groups.length ? groups[groups.length - 1] : null;
      if (last && (i - last[last.length - 1] + n) % n === 1) last.push(i);
      else groups.push([i]);
    }
    // The first and last group can wrap into each other round the wheel.
    if (groups.length > 1) {
      const a = groups[0], b = groups[groups.length - 1];
      if ((a[0] - b[b.length - 1] + n) % n === 1) {
        groups[0] = b.concat(a);
        groups.pop();
      }
    }

    const humps = groups.map((g) => {
      let best = g[0];
      for (const i of g) if (vec[i] > vec[best]) best = i;
      return { at: best, hue: Code.hueCenter(best), height: vec[best], width: g.length };
    }).sort((p, q) => q.height - p.height);

    if (humps.length < 2) {
      return { mode: 'unimodal', humps, sepDeg: null, label: 'unimodal' };
    }
    const sep = Colors.hueDist(humps[0].hue, humps[1].hue);
    return {
      mode: 'bimodal',
      humps,
      sepDeg: sep,
      label: 'bimodal, peaks ' + Math.round(sep) + ' deg apart'
    };
  },

  /* ---- how sparse is this brain, really -------------------
     The config says 0.15. What the audience wants to know is how
     many wires an actual cell ended up with. Read it off. */

  wiringSpread(brain) {
    let min = Infinity, max = 0, sum = 0;
    for (let j = 0; j < brain.nHid; j++) {
      const d = brain.inDeg[j];
      if (d < min) min = d;
      if (d > max) max = d;
      sum += d;
    }
    return { min, max, mean: sum / brain.nHid };
  },

  /* How many cells are firing right now. */
  firingCount(brain) {
    let n = 0;
    for (let j = 0; j < brain.nHid; j++) if (brain.hid[j] > 0) n++;
    return n;
  },

  /* ---- the training loop ----------------------------------
     One implementation, two callers. This owns pacing, pause and
     resume; the caller owns everything it wants to say on screen.

     opts: {
       total      examples in a full run
       speedIdx   () => index into SPEEDS
       example    () => a training example
       onExample  (ex) => void, called once per example
       onFrame    (trainer) => void, once per animation frame
       onDone     (trainer) => void, when a run completes
     }                                                          */

  Trainer: class {
    constructor(opts) {
      this.opts = opts;
      this.running = false;
      this.remaining = 0;
      this.frame = 0;
      this._tick = this._tick.bind(this);
    }

    start(total) {
      this.remaining = total == null ? this.opts.total : total;
      this.frame = 0;
      this.running = false;
      this.resume();
    }

    resume() {
      if (this.running || this.remaining <= 0) return;
      this.running = true;
      requestAnimationFrame(this._tick);
    }

    pause() {
      this.running = false;
    }

    /* Space bar behaviour: run, pause, resume, or start afresh if
       the last run finished. Returns whether it is now running. */
    toggle(total) {
      if (this.running) { this.pause(); return false; }
      if (this.remaining > 0) { this.resume(); return true; }
      this.start(total);
      return true;
    }

    /* Exactly one example, outside the loop. The button that makes
       a single Hebbian update visible. */
    once() {
      const ex = this.opts.example();
      this.opts.onExample(ex);
      if (this.opts.onFrame) this.opts.onFrame(this);
      this.frame++;
      return ex;
    }

    _tick() {
      if (!this.running) return;

      const n = Shared.perFrame(this.opts.speedIdx(), this.opts.total);
      for (let i = 0; i < n && this.remaining > 0; i++) {
        this.opts.onExample(this.opts.example());
        this.remaining--;
      }

      if (this.opts.onFrame) this.opts.onFrame(this);
      this.frame++;

      if (this.remaining <= 0) {
        this.running = false;
        if (this.opts.onDone) this.opts.onDone(this);
        return;
      }
      requestAnimationFrame(this._tick);
    }
  }
};
