/* ============================================================
   viz.js — draws the brain.

   >>> YOU DO NOT NEED TO EDIT THIS FILE. <<<
   Change config.js instead. Come back here at the end if you
   want to make your brain look different from everyone else's.
   ============================================================ */

const Viz = {

  themes: {
    dark:  { bg: '#0b0d14', panel: '#141824', text: '#e8eaf0', dim: '#7c86a0',
             axis: '#2a3145', glow: 'rgba(120,190,255,', wire: 'rgba(140,160,200,' },
    light: { bg: '#f4f5f8', panel: '#ffffff', text: '#1a1d26', dim: '#6a7183',
             axis: '#d3d7e0', glow: 'rgba(40,110,220,',  wire: 'rgba(90,110,150,' }
  },

  theme: null,
  layout: null,
  synCache: [],
  synCacheAge: 0,

  init(canvas, cfg) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.theme = this.themes[cfg.theme] || this.themes.dark;
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
    this.layout = null;
  },

  /* Where every neuron sits on screen. Computed once. */
  buildLayout(brain) {
    const w = this.w, h = this.h;
    const inX = w * 0.10, outX = w * 0.90;
    const top = h * 0.10, bot = h * 0.90;

    const colStep = (bot - top) / (DIM - 1);
    const input = [], output = [];
    for (let i = 0; i < DIM; i++) {
      input.push({ x: inX, y: top + i * colStep });
      output.push({ x: outX, y: top + i * colStep });
    }

    // Hidden neurons sit in two blobs: colour above, brightness below.
    const hidden = [];
    const pools = [[], []];
    for (let j = 0; j < brain.nHid; j++) pools[brain.pool[j]].push(j);

    pools.forEach((members, p) => {
      const cx = w * 0.5;
      const cy = p === POOL_CHROMA ? h * 0.30 : h * 0.72;
      const maxR = Math.min(w * 0.16, h * 0.19);
      const n = members.length;
      members.forEach((j, idx) => {
        // Sunflower packing — even spread, looks organic.
        const t = (idx + 0.5) / n;
        const r = maxR * Math.sqrt(t);
        const a = idx * 2.399963;
        hidden[j] = { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
      });
    });

    this.layout = { input, output, hidden };
  },

  /* What colour is this input/output neuron "about"? */
  slotColor(i) {
    if (i < HUE_N) {
      const c = Colors.hsv2rgb(Code.hueCenter(i), 0.95, 1);
      return Colors.css(c);
    }
    if (i < HUE_N + SAT_N) {
      const s = Code.linCenter(i - HUE_N, SAT_N);
      return Colors.css(Colors.hsv2rgb(210, s, 0.9));
    }
    const v = Code.linCenter(i - HUE_N - SAT_N, VAL_N);
    return Colors.css({ r: v, g: v, b: v });
  },

  /* ---- main draw ------------------------------------------ */

  draw(brain, state) {
    const ctx = this.ctx, th = this.theme;
    if (!this.layout || this.layout.hidden.length !== brain.nHid) this.buildLayout(brain);
    const L = this.layout;

    ctx.fillStyle = th.bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // Refresh the "which synapses are strongest" list occasionally —
    // doing it every frame would be too slow on an older laptop.
    if (this.synCacheAge <= 0) {
      this.synCache = brain.topSynapses(700);
      this.synCacheAge = 12;
    }
    this.synCacheAge--;

    // Fixed input wiring, very faint. This never changes.
    ctx.lineWidth = 1;
    for (let j = 0; j < brain.nHid; j += 1) {
      if (brain.alive[j] === 0) continue;
      const hp = L.hidden[j];
      const lit = brain.hid[j] > 0;
      if (!lit) continue;
      for (let i = 0; i < brain.nIn; i++) {
        const wv = brain.Wih[j * brain.nIn + i];
        if (Math.abs(wv) < 0.25) continue;
        ctx.strokeStyle = th.wire + (0.10 + Math.abs(wv) * 0.10) + ')';
        ctx.beginPath();
        ctx.moveTo(L.input[i].x, L.input[i].y);
        ctx.lineTo(hp.x, hp.y);
        ctx.stroke();
      }
    }

    // Learned synapses, hidden -> output. These are what training builds.
    for (const s of this.synCache) {
      const a = Math.min(0.55, s.w * 0.7);
      const hp = L.hidden[s.j], op = L.output[s.o];
      const firing = brain.hid[s.j] > 0;
      ctx.strokeStyle = firing
        ? th.glow + Math.min(0.8, a + 0.3) + ')'
        : th.wire + a * 0.5 + ')';
      ctx.lineWidth = firing ? 1.4 : 0.8;
      ctx.beginPath();
      ctx.moveTo(hp.x, hp.y);
      ctx.lineTo(op.x, op.y);
      ctx.stroke();
    }

    // Input neurons.
    for (let i = 0; i < brain.nIn; i++) {
      const act = brain.inp[i] || 0;
      this.neuron(L.input[i], 4 + act * 4, this.slotColor(i), act > 0.05 ? 0.95 : 0.28);
    }

    // Hidden neurons.
    let peak = 0;
    for (let j = 0; j < brain.nHid; j++) if (brain.hid[j] > peak) peak = brain.hid[j];
    for (let j = 0; j < brain.nHid; j++) {
      const dead = brain.alive[j] === 0;
      const act = peak > 0 ? brain.hid[j] / peak : 0;
      if (dead) {
        this.neuron(L.hidden[j], 3, '#000', 0.22, th.dim);
      } else if (act > 0) {
        this.neuron(L.hidden[j], 3.5 + act * 5, brain.pool[j] === POOL_CHROMA ? '#7fd4ff' : '#ffd27f', 0.35 + act * 0.65);
      } else {
        this.neuron(L.hidden[j], 3, th.dim, 0.30);
      }
    }

    // Output neurons.
    for (let i = 0; i < brain.nOut; i++) {
      const act = Math.max(0, brain.out[i]);
      const rel = peak > 0 ? Math.min(1, act / (this.outPeak(brain) || 1)) : 0;
      this.neuron(L.output[i], 4 + rel * 5, this.slotColor(i), 0.25 + rel * 0.75);
    }

    this.labels(brain, state);
  },

  outPeak(brain) {
    let p = 0;
    for (let i = 0; i < brain.nOut; i++) if (brain.out[i] > p) p = brain.out[i];
    return p;
  },

  neuron(pos, r, fill, alpha, stroke) {
    const ctx = this.ctx;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = fill;
    ctx.beginPath();
    ctx.arc(pos.x, pos.y, r, 0, Math.PI * 2);
    ctx.fill();
    if (stroke) {
      ctx.globalAlpha = 0.6;
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    ctx.globalAlpha = 1;
  },

  labels(brain, state) {
    const ctx = this.ctx, th = this.theme;
    ctx.fillStyle = th.dim;
    ctx.font = '11px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.fillText('INPUT', this.w * 0.10, this.h * 0.06);
    ctx.fillText('OUTPUT', this.w * 0.90, this.h * 0.06);
    ctx.fillText('colour pathway', this.w * 0.5, this.h * 0.30 - Math.min(this.w * 0.16, this.h * 0.19) - 10);
    ctx.fillText('brightness pathway', this.w * 0.5, this.h * 0.72 - Math.min(this.w * 0.16, this.h * 0.19) - 10);
    ctx.textAlign = 'left';
  },

  /* ---- the brain map -------------------------------------
     Sweep every hue through the brain and show what comes out.
     Top row  = the colour we showed it.
     Middle   = what the brain answered.
     Bottom   = the correct answer.
     If the middle row matches the bottom row, it has learned. */

  drawMap(mapCanvas, brain, relationName) {
    const ctx = mapCanvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = mapCanvas.getBoundingClientRect();
    if (mapCanvas.width !== Math.floor(rect.width * dpr)) {
      mapCanvas.width = Math.floor(rect.width * dpr);
      mapCanvas.height = Math.floor(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;

    const rel = Colors.relations[relationName];
    const N = 36;
    const cw = w / N;
    const rowH = (h - 16) / 3;

    ctx.clearRect(0, 0, w, h);
    for (let i = 0; i < N; i++) {
      const input = { h: (i * 360) / N, s: 0.9, v: 0.9 };
      const got = brain.predict(input);
      const want = rel.apply(input);

      ctx.fillStyle = Colors.css(Colors.hsv2rgb(input.h, input.s, input.v));
      ctx.fillRect(i * cw, 0, cw + 0.5, rowH);

      ctx.fillStyle = Colors.css(Colors.hsv2rgb(got.h, got.s, got.v));
      ctx.fillRect(i * cw, rowH + 2, cw + 0.5, rowH);

      ctx.fillStyle = Colors.css(Colors.hsv2rgb(want.h, want.s, want.v));
      ctx.fillRect(i * cw, rowH * 2 + 4, cw + 0.5, rowH);
    }

    ctx.fillStyle = this.theme.dim;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'left';
    ctx.fillText('shown ↓   brain says ↓   correct ↓', 2, h - 3);
  },

  /* ---- score history sparkline ---------------------------- */

  drawHistory(canvas, history) {
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = canvas.getBoundingClientRect();
    if (canvas.width !== Math.floor(rect.width * dpr)) {
      canvas.width = Math.floor(rect.width * dpr);
      canvas.height = Math.floor(rect.height * dpr);
    }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const w = rect.width, h = rect.height;
    ctx.clearRect(0, 0, w, h);
    if (history.length < 2) return;

    ctx.strokeStyle = this.theme.axis;
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, h - 1); ctx.lineTo(w, h - 1); ctx.stroke();

    ctx.strokeStyle = '#4fd1a5';
    ctx.lineWidth = 2;
    ctx.beginPath();
    history.forEach((v, i) => {
      const x = (i / (history.length - 1)) * w;
      const y = h - (v / 100) * (h - 4) - 2;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.stroke();
  }
};
