/* ============================================================
   neuronview.js — one neuron, drawn properly.

   The main view shows the whole crowd. This shows a SINGLE
   hidden neuron at the size of an actual cell, so you can see
   the parts a biologist would name:

     dendrites  the branches that listen
     soma       the cell body, where the adding up happens
     axon       the wire that carries the answer out
     terminals  the endings that touch the next cells

   Everything drawn here is read straight out of the brain. The
   dendrites are its real connections, the bouton sizes are its
   real learned weights. Nothing is decorative.

   Click any neuron in the view above to move the spotlight.
   ============================================================ */

const NeuronView = {

  canvas: null,
  ctx: null,
  theme: null,
  cfg: null,

  spikeAt: -1e9,     // when the last spike was launched
  spikeMs: 650,      // how long it takes to travel the axon
  wasFiring: false,

  prof: null,        // cached tuning curve — see profile()
  profFor: -1,
  profAge: 0,

  init(canvas, cfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.cfg = cfg;
    this.theme = Viz.themes[cfg.theme] || Viz.themes.dark;
    this.resize();
  },

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    this.canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.w = rect.width;
    this.h = rect.height;
  },

  now() {
    return (typeof performance !== 'undefined' && performance.now)
      ? performance.now() : 0;
  },

  /* Force the tuning curve to be recomputed on the next draw.
     Call after anything that changes the brain in one go —
     a reset, a lesion, a single step. */
  invalidate() {
    this.profAge = 0;
  },

  /* ---- how excited is this neuron, and did it win? ---------
     brain.think() overwrites its own working array, so the raw
     drive is gone by the time we draw. Recompute it here, the
     same way brain.js does, and work out the competition
     threshold its pathway is currently applying.              */

  drives(brain, j) {
    const nIn = brain.nIn;

    let mean = 0;
    for (let i = 0; i < nIn; i++) mean += brain.inp[i];
    mean /= nIn;

    const raw = (k) => {
      let s = 0;
      const base = k * nIn;
      for (let i = 0; i < nIn; i++) s += brain.Wih[base + i] * (brain.inp[i] - mean);
      return s > 0 ? s : 0;
    };

    const mine = brain.alive[j] === 0 ? 0 : raw(j);

    const pool = brain.pool[j];
    const vals = [];
    for (let k = 0; k < brain.nHid; k++) {
      if (brain.pool[k] !== pool || brain.alive[k] === 0) continue;
      vals.push(raw(k));
    }
    vals.sort((a, b) => b - a);

    const k = Math.max(1, Math.round(vals.length * brain.cfg.fireFraction));
    const thresh = vals.length ? vals[Math.min(k, vals.length) - 1] : 0;

    let rank = 1;
    for (const v of vals) if (v > mine) rank++;

    return { mine, thresh, rank, of: vals.length, winners: k };
  },

  /* ---- what has this cell become? --------------------------
     Two questions, and between them they are the neuron's whole
     job:

       what makes it fire?      sweep every colour past it and
                                see which one drives it hardest
       what does it say?        read its learned output weights
                                back out as a colour

     Sweeping is not free, so the answer is cached and refreshed
     every 30 frames or whenever the spotlight moves.           */

  rawFor(brain, j, x) {
    const nIn = brain.nIn;
    let mean = 0;
    for (let i = 0; i < nIn; i++) mean += x[i];
    mean /= nIn;
    let s = 0;
    const base = j * nIn;
    for (let i = 0; i < nIn; i++) s += brain.Wih[base + i] * (x[i] - mean);
    return s > 0 ? s : 0;
  },

  profile(brain, j) {
    // A brightness-pathway neuron is deaf to hue, so sweeping hues
    // past it would draw a flat line and teach nothing. Sweep the
    // thing it can actually hear.
    const chroma = brain.pool[j] === POOL_CHROMA;
    const N = 48;
    const curve = new Float64Array(N);
    const cols = [];

    for (let k = 0; k < N; k++) {
      const c = chroma
        ? { h: (k * 360) / N, s: 0.9, v: 0.9 }
        : { h: 0, s: 0, v: k / (N - 1) };
      cols.push(c);
      curve[k] = this.rawFor(brain, j, Code.encode(c));
    }

    let pk = 0;
    for (let k = 1; k < N; k++) if (curve[k] > curve[pk]) pk = k;

    // Its learned output weights, decoded the same way the brain
    // decodes its own answer.
    const y = new Float64Array(brain.nOut);
    const base = j * brain.nOut;
    let sum = 0;
    for (let o = 0; o < brain.nOut; o++) { y[o] = brain.Who[base + o]; sum += y[o]; }

    return {
      curve, chroma, max: curve[pk],
      peak: cols[pk],
      says: sum > 1e-6 ? Code.decode(y) : null
    };
  },

  drawProfile(brain, j, dead) {
    const ctx = this.ctx, th = this.theme;
    const p = this.prof;
    if (!p) return;

    const x0 = this.w * 0.375, pw = this.w * 0.19;
    const y0 = 12, ph = 42;
    if (pw < 60) return;   // too narrow to be worth drawing

    ctx.strokeStyle = th.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x0, y0 + ph);
    ctx.lineTo(x0 + pw, y0 + ph);
    ctx.stroke();

    // The colours it was swept with, as a thin strip under the axis.
    const N = p.curve.length;
    for (let k = 0; k < N; k++) {
      const c = p.chroma
        ? { h: (k * 360) / N, s: 0.9, v: 0.9 }
        : { h: 0, s: 0, v: k / (N - 1) };
      ctx.fillStyle = Colors.css(Colors.hsv2rgb(c.h, c.s, c.v));
      ctx.globalAlpha = dead ? 0.25 : 0.8;
      ctx.fillRect(x0 + (k / N) * pw, y0 + ph + 2, pw / N + 0.6, 4);
    }
    ctx.globalAlpha = 1;

    // The tuning curve itself.
    if (p.max > 1e-9) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + ph);
      for (let k = 0; k < N; k++) {
        const x = x0 + (k / (N - 1)) * pw;
        const y = y0 + ph - (p.curve[k] / p.max) * ph;
        ctx.lineTo(x, y);
      }
      ctx.lineTo(x0 + pw, y0 + ph);
      ctx.closePath();
      ctx.fillStyle = dead ? 'rgba(120,130,150,0.15)' : 'rgba(127,212,255,0.22)';
      ctx.fill();
      ctx.strokeStyle = dead ? th.dim : '#7fd4ff';
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }

    ctx.fillStyle = th.dim;
    ctx.font = '9.5px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText(p.chroma ? 'what makes it fire (hue swept)'
                          : 'what makes it fire (brightness swept)', x0, y0 - 3);

    // Two swatches: what drives it, and what it votes for.
    const sx = x0 + pw + 16, sy = y0 + 2, sw = 30;
    const box = (x, fill, caption) => {
      ctx.fillStyle = fill;
      ctx.fillRect(x, sy, sw, sw);
      ctx.strokeStyle = th.axis;
      ctx.lineWidth = 1;
      ctx.strokeRect(x, sy, sw, sw);
      ctx.fillStyle = th.dim;
      ctx.textAlign = 'center';
      ctx.fillText(caption, x + sw / 2, sy + sw + 11);
      ctx.textAlign = 'left';
    };

    box(sx, Colors.css(Colors.hsv2rgb(p.peak.h, p.peak.s, p.peak.v)), 'likes');
    box(sx + sw + 10,
        p.says ? Colors.css(Colors.hsv2rgb(p.says.h, p.says.s, p.says.v)) : th.panel,
        p.says ? 'says' : 'blank');
  },

  /* ---- main draw ------------------------------------------ */

  draw(brain, j, opts) {
    const ctx = this.ctx, th = this.theme;
    if (!ctx) return;
    opts = opts || {};

    ctx.fillStyle = th.panel;
    ctx.fillRect(0, 0, this.w, this.h);

    if (j == null || j < 0 || j >= brain.nHid) return;

    const dead = brain.alive[j] === 0;
    const firing = !dead && brain.hid[j] > 0;
    const d = this.drives(brain, j);

    // Launch a spike the moment it starts firing.
    if (firing && !this.wasFiring) this.spikeAt = this.now();
    this.wasFiring = firing;

    if (this.profFor !== j || this.profAge <= 0 || !this.prof) {
      this.prof = this.profile(brain, j);
      this.profFor = j;
      this.profAge = 30;
    }
    this.profAge--;

    const cy = this.h * 0.52;
    const somaX = this.w * 0.34;
    const somaR = Math.max(16, Math.min(this.h * 0.19, 46));
    const trunkX = this.w * 0.70;
    const termX = this.w * 0.86;

    this.drawDendrites(brain, j, somaX, cy, somaR, dead);
    this.drawAxon(brain, j, somaX, cy, somaR, trunkX, termX, firing, dead);
    this.drawTerminals(brain, j, trunkX, termX, cy, firing, dead, opts.target);
    this.drawSoma(brain, j, somaX, cy, somaR, d, firing, dead);
    this.drawProfile(brain, j, dead);
    this.drawLabels(brain, j, somaX, cy, somaR, trunkX, termX, d, firing, dead);
  },

  /* ---- dendrites -------------------------------------------
     One branch per real connection. Cool = excitatory, warm =
     inhibitory, thickness = how strong, brightness = what it is
     hearing right now.                                        */

  drawDendrites(brain, j, sx, sy, sr, dead) {
    const ctx = this.ctx, th = this.theme;
    const nIn = brain.nIn;

    const conns = [];
    for (let i = 0; i < nIn; i++) {
      const w = brain.Wih[j * nIn + i];
      if (w !== 0) conns.push({ i, w });
    }
    if (!conns.length) return;

    const reach = sx - this.w * 0.045;
    const spread = conns.length === 1 ? 0 : 1;

    conns.forEach((c, k) => {
      const t = conns.length === 1 ? 0.5 : (k + 0.5) / conns.length;
      const ang = Math.PI - 0.62 * spread + 1.24 * spread * t;
      const tipX = sx + reach * Math.cos(ang);
      const tipY = sy + reach * 0.62 * Math.sin(ang);

      const rootX = sx + sr * 0.92 * Math.cos(ang);
      const rootY = sy + sr * 0.92 * Math.sin(ang);

      const act = dead ? 0 : Math.min(1, (brain.inp[c.i] || 0) / 1.6);
      const mag = Math.abs(c.w);

      // Excitatory branches run cool, inhibitory run warm.
      const hue = c.w > 0 ? '120,190,255' : '255,140,120';
      const alpha = dead ? 0.10 : 0.20 + act * 0.65;

      // A gentle bow so it does not look like a fan of spokes.
      const midX = (rootX + tipX) / 2 + (sy - tipY) * 0.10;
      const midY = (rootY + tipY) / 2 + (tipX - sx) * 0.10;

      ctx.strokeStyle = 'rgba(' + hue + ',' + alpha.toFixed(3) + ')';
      ctx.lineWidth = 1 + mag * 5;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(rootX, rootY);
      ctx.quadraticCurveTo(midX, midY, tipX, tipY);
      ctx.stroke();

      // Two small branchlets near the tip. Real dendrites fork.
      for (const s of [-1, 1]) {
        const bx = tipX + Math.cos(ang + s * 0.75) * reach * 0.13;
        const by = tipY + Math.sin(ang + s * 0.75) * reach * 0.10;
        ctx.lineWidth = Math.max(0.6, (1 + mag * 5) * 0.45);
        ctx.beginPath();
        ctx.moveTo(tipX, tipY);
        ctx.lineTo(bx, by);
        ctx.stroke();
      }

      // The tip is coloured by WHICH input it listens to.
      ctx.globalAlpha = dead ? 0.25 : 0.45 + act * 0.55;
      ctx.fillStyle = Viz.slotColor(c.i);
      ctx.beginPath();
      ctx.arc(tipX, tipY, 3 + act * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    });

    ctx.fillStyle = th.dim;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('dendrites — ' + conns.length + ' inputs it can hear', 8, this.h - 8);
  },

  /* ---- axon ------------------------------------------------
     Myelinated, with gaps at the nodes of Ranvier, and a spike
     that visibly travels when the neuron fires.               */

  drawAxon(brain, j, sx, sy, sr, trunkX, termX, firing, dead) {
    const ctx = this.ctx, th = this.theme;
    const x0 = sx + sr * 0.95;
    const len = trunkX - x0;
    if (len <= 0) return;

    const wob = (t) => sy + Math.sin(t * Math.PI * 1.4) * this.h * 0.035;

    if (dead) {
      // A lesioned neuron: the axon is cut. Nothing gets through.
      ctx.strokeStyle = th.axis;
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 7]);
      ctx.beginPath();
      ctx.moveTo(x0, sy);
      ctx.lineTo(x0 + len * 0.35, sy);
      ctx.stroke();
      ctx.setLineDash([]);
      return;
    }

    // Myelin sheath: segments with small bare gaps between them.
    const segs = 7;
    for (let s = 0; s < segs; s++) {
      const a = s / segs, b = (s + 0.82) / segs;
      ctx.strokeStyle = firing ? 'rgba(190,225,255,0.85)' : th.wire + '0.45)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(x0 + len * a, wob(a));
      ctx.lineTo(x0 + len * b, wob(b));
      ctx.stroke();

      ctx.strokeStyle = firing ? 'rgba(255,255,255,0.55)' : th.wire + '0.22)';
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.moveTo(x0 + len * a, wob(a));
      ctx.lineTo(x0 + len * b, wob(b));
      ctx.stroke();
    }

    // The action potential itself, travelling.
    const age = this.now() - this.spikeAt;
    if (age >= 0 && age < this.spikeMs) {
      const t = age / this.spikeMs;
      const px = x0 + len * t, py = wob(t);
      const g = ctx.createRadialGradient(px, py, 0, px, py, 16);
      g.addColorStop(0, 'rgba(255,255,255,0.95)');
      g.addColorStop(0.45, 'rgba(140,215,255,0.55)');
      g.addColorStop(1, 'rgba(140,215,255,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, 16, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = th.dim;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('axon', x0 + len * 0.5, sy - this.h * 0.13);
    ctx.textAlign = 'left';
  },

  /* ---- synaptic terminals ----------------------------------
     One bouton per output neuron. The radius is the learned
     weight. THIS is the part that training changes — everything
     to the left of here is fixed at birth.                    */

  drawTerminals(brain, j, trunkX, termX, cy, firing, dead, target) {
    const ctx = this.ctx, th = this.theme;
    const nOut = brain.nOut;
    const base = j * nOut;

    let maxw = 0;
    for (let o = 0; o < nOut; o++) if (brain.Who[base + o] > maxw) maxw = brain.Who[base + o];

    const top = this.h * 0.14, bot = this.h * 0.86;
    const step = (bot - top) / (nOut - 1);
    const arrived = !dead && (this.now() - this.spikeAt) > this.spikeMs * 0.8;

    for (let o = 0; o < nOut; o++) {
      const w = brain.Who[base + o];
      const rel = maxw > 1e-9 ? w / maxw : 0;
      const y = top + o * step;
      if (rel < 0.06) continue;

      // Branch from the axon trunk out to this bouton.
      ctx.strokeStyle = th.wire + (dead ? 0.08 : 0.15 + rel * 0.35).toFixed(3) + ')';
      ctx.lineWidth = 0.8 + rel * 2.2;
      ctx.beginPath();
      ctx.moveTo(trunkX, cy);
      ctx.quadraticCurveTo((trunkX + termX) / 2, y, termX, y);
      ctx.stroke();

      // Is the correct answer lighting this output up right now?
      // If so, and this neuron fired, the synapse is strengthening
      // as you watch. Fire together, wire together.
      const co = target ? Math.min(1, (target[o] || 0) / 1.6) : 0;
      const hot = firing && arrived && co > 0.25;

      ctx.globalAlpha = dead ? 0.2 : 0.35 + rel * 0.65;
      ctx.fillStyle = Viz.slotColor(o);
      ctx.beginPath();
      ctx.arc(termX, y, 2.5 + rel * 7, 0, Math.PI * 2);
      ctx.fill();

      if (hot) {
        ctx.globalAlpha = 0.9;
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1.6;
        ctx.beginPath();
        ctx.arc(termX, y, 4.5 + rel * 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    ctx.fillStyle = th.dim;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'right';
    ctx.fillText('synaptic terminals — these are what learn', this.w - 8, this.h - 8);
    ctx.textAlign = 'left';
  },

  /* ---- soma ------------------------------------------------
     The ring around the cell body is how close it is to the
     threshold its pathway is currently demanding.             */

  drawSoma(brain, j, sx, sy, sr, d, firing, dead) {
    const ctx = this.ctx, th = this.theme;
    const chroma = brain.pool[j] === POOL_CHROMA;
    const tint = dead ? '90,96,112' : (chroma ? '127,212,255' : '255,210,127');

    if (firing) {
      const g = ctx.createRadialGradient(sx, sy, sr * 0.4, sx, sy, sr * 2.1);
      g.addColorStop(0, 'rgba(' + tint + ',0.40)');
      g.addColorStop(1, 'rgba(' + tint + ',0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(sx, sy, sr * 2.1, 0, Math.PI * 2);
      ctx.fill();
    }

    // Cell body. Slightly egg-shaped — a real soma is not a circle.
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(1, 0.88);
    ctx.fillStyle = 'rgba(' + tint + ',' + (dead ? 0.12 : firing ? 0.55 : 0.26) + ')';
    ctx.beginPath();
    ctx.arc(0, 0, sr, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(' + tint + ',' + (dead ? 0.3 : 0.85) + ')';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // Nucleus.
    ctx.fillStyle = 'rgba(' + tint + ',' + (dead ? 0.2 : 0.6) + ')';
    ctx.beginPath();
    ctx.arc(sx - sr * 0.12, sy - sr * 0.08, sr * 0.3, 0, Math.PI * 2);
    ctx.fill();

    // Membrane potential: how far to threshold.
    const frac = d.thresh > 1e-12 ? Math.min(1.35, d.mine / d.thresh) : 0;
    const start = -Math.PI / 2;
    ctx.strokeStyle = th.axis;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, sr + 9, start, start + Math.PI * 2);
    ctx.stroke();

    ctx.strokeStyle = firing ? '#4fd1a5' : 'rgba(' + tint + ',0.9)';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(sx, sy, sr + 9, start, start + Math.PI * 2 * Math.min(1, frac));
    ctx.stroke();
  },

  /* ---- the readout ----------------------------------------- */

  drawLabels(brain, j, sx, sy, sr, trunkX, termX, d, firing, dead) {
    const ctx = this.ctx, th = this.theme;
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';

    ctx.fillStyle = th.dim;
    ctx.fillText('soma', sx, sy + sr + 26);

    const pool = brain.pool[j] === POOL_CHROMA ? 'colour' : 'brightness';
    ctx.textAlign = 'left';
    ctx.fillStyle = th.text;
    ctx.fillText('neuron #' + j + '  ·  ' + pool + ' pathway', 8, 18);

    ctx.fillStyle = dead ? '#ff8f7a' : firing ? '#4fd1a5' : th.dim;
    const state = dead
      ? 'LESIONED — dead, axon cut'
      : firing
        ? 'FIRING — won its competition'
        : 'silent — ranked ' + d.rank + ' of ' + d.of + ', only top ' + d.winners + ' may fire';
    ctx.fillText(state, 8, 34);

    ctx.fillStyle = th.dim;
    ctx.fillText('fired ' + Math.round(brain.fireCount[j]).toLocaleString() +
                 ' times in ' + brain.stepsTrained.toLocaleString() + ' examples', 8, 50);
  }
};
