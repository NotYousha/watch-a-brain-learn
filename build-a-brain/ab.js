/* ============================================================
   ab.js — two brains, side by side, one difference between them.

   The only honest way to argue that a design decision matters is to
   run the same colours past two networks that differ in exactly that
   decision, in the same order, and look at both.

   The stream is generated once into an array and both brains are fed
   from it in lockstep. Seeding two brains identically is NOT enough:
   the example stream comes from Math.random(), so two brains with the
   same seed get identical fixed wiring and then diverge. See
   _dev/README.md, phase 0 finding 2.

   The crowd view and the neuron view are not drawn in this mode.
   Viz and NeuronView are singletons holding one layout and one
   spotlight, so pointing them at two brains would have them fight.
   There is no room for them here anyway.
   ============================================================ */

const AB = {

  /* Each preset answers a question that was open in the write-up.
     `note` is what the difference actually measured at 4000 examples
     on complement, so the screen never promises more than it does. */

  PRESETS: [
    {
      id: 'chroma',
      label: 'colour share 0.40 vs 0.80',
      key: 'chromaFraction', a: 0.40, b: 0.80,
      note: 'more cells on colour is worse, not better: 0.40 scored 85, 0.80 scored 78'
    },
    {
      id: 'compete',
      label: 'competition on vs off',
      key: 'fireFraction', a: 0.05, b: 1.0,
      note: 'all 256 firing at once still learns, and loses about 7 points doing it'
    },
    {
      id: 'wiring',
      label: 'sparse vs dense wiring',
      key: 'connectivity', a: 0.15, b: 1.0,
      note: 'dense wiring scores the same and is measurably less precise on hue'
    },
    {
      id: 'size',
      label: '256 vs 96 neurons',
      key: 'hiddenNeurons', a: 256, b: 96,
      note: 'fewer cells, coarser answers: about 4 points and twice the hue error'
    },
    {
      id: 'forget',
      label: 'forgetting 0 vs 0.001',
      key: 'forgetting', a: 0, b: 0.001,
      note: 'no measurable difference at this rate, which is worth knowing'
    }
  ],

  live: false,
  ctx: null,
  side: { a: null, b: null },
  preset: 0,
  trainer: null,
  stream: null,
  cursor: 0,
  truth: null,

  /* ---- one side ------------------------------------------- */

  buildSide(host, tag) {
    const el = (t, cls, parent) => {
      const n = document.createElement(t);
      if (cls) n.className = cls;
      if (parent && parent.appendChild) parent.appendChild(n);
      return n;
    };

    const col = el('div', 'abcol', host);

    const head = el('div', 'abhead2', col);
    const badge = el('span', 'abbadge', head);
    badge.textContent = tag;
    const what = el('span', 'abwhat mono', head);

    const mets = el('div', 'abmets', col);
    const metric = (label) => {
      const box = el('div', 'abmet', mets);
      const l = el('label', null, box);
      l.textContent = label;
      const v = el('div', 'abvalue mono', box);
      v.textContent = '—';
      return v;
    };
    const score = metric('score');
    const hue = metric('hue error');
    const conf = metric('confidence');
    const alive = metric('alive');

    const votes = el('canvas', 'abvotes', col);
    const mode = el('div', 'abmode mono', col);
    mode.textContent = '—';

    const strips = {};
    for (const [key, caption] of [['in', 'shown'], ['got', 'it answers'], ['want', 'correct']]) {
      const row = el('div', 'abrow', col);
      const cap = el('label', null, row);
      cap.textContent = caption;
      const strip = el('div', 'strip abstrip', row);
      const cells = [];
      for (let i = 0; i < Probes.list.length; i++) cells.push(el('i', null, strip));
      strips[key] = cells;
    }

    return { col, what, score, hue, conf, alive, votes, mode, strips, brain: null };
  },

  /* ---- opening and closing -------------------------------- */

  init(ctx) {
    AB.ctx = ctx;
    const host = document.getElementById('abCols');
    AB.side.a = AB.buildSide(host, 'A');
    AB.side.b = AB.buildSide(host, 'B');

    const sel = document.getElementById('abPreset');
    if (sel) {
      sel.innerHTML = AB.PRESETS
        .map((p, i) => '<option value="' + i + '">' + p.label + '</option>').join('');
      sel.addEventListener('change', (ev) => AB.load(Number(ev.target.value)));
    }
    const run = document.getElementById('abRun');
    if (run) run.addEventListener('click', () => AB.toggleRun());
    const reset = document.getElementById('abReset');
    if (reset) reset.addEventListener('click', () => AB.load(AB.preset));
  },

  open() {
    if (AB.live) return;
    AB.live = true;
    AB.ctx.pauseTraining();
    AB.ctx.showAB(true);
    AB.load(AB.preset);
  },

  close() {
    if (!AB.live) return;
    if (AB.trainer) AB.trainer.pause();
    AB.live = false;
    AB.ctx.showAB(false);
    AB.ctx.say('back to the single brain');
  },

  /* ---- building a comparison ------------------------------ */

  load(index) {
    AB.preset = index;
    const p = AB.PRESETS[index];
    // Keep the dropdown honest when the preset was set from a URL hash
    // or a number key rather than from the dropdown itself.
    const sel = document.getElementById('abPreset');
    if (sel) sel.value = String(index);
    const rel = AB.ctx.relationName();
    const base = AB.ctx.baseConfig();

    for (const [k, v] of [['a', p.a], ['b', p.b]]) {
      const cfg = Object.assign({}, base, { relation: rel });
      cfg[p.key] = v;
      AB.side[k].brain = new Brain(cfg);
      AB.side[k].what.textContent = p.key + ' ' + v;
    }

    // One stream, both brains, same order. This is the whole point.
    AB.stream = [];
    for (let i = 0; i < base.trainingExamples; i++) AB.stream.push(Probes.example(rel));
    AB.cursor = 0;
    AB.truth = Probes.truth(rel);

    const note = document.getElementById('abNote');
    if (note) note.textContent = p.note;
    const streamEl = document.getElementById('abStream');
    if (streamEl) {
      streamEl.textContent = AB.stream.length.toLocaleString() +
        ' examples, identical order for both, seed ' + base.seed;
    }

    AB.sizeCanvases();
    AB.paintStatic();
    AB.refresh();
    AB.setRunLabel(false);
    AB.ctx.say('A/B ready: ' + p.label + '. press space or Run both');
  },

  paintStatic() {
    for (const key of ['a', 'b']) {
      const s = AB.side[key];
      for (let i = 0; i < Probes.list.length; i++) {
        const c = Probes.list[i], w = AB.truth[i];
        s.strips.in[i].style.background = Colors.css(Colors.hsv2rgb(c.h, c.s, c.v));
        s.strips.want[i].style.background = Colors.css(Colors.hsv2rgb(w.h, w.s, w.v));
      }
    }
  },

  sizeCanvases() {
    for (const key of ['a', 'b']) {
      const cv = AB.side[key].votes;
      if (!cv.getContext) continue;
      const dpr = Math.min((typeof window !== 'undefined' && window.devicePixelRatio) || 1, 2);
      const r = cv.getBoundingClientRect();
      cv.width = Math.max(1, Math.floor(r.width * dpr));
      cv.height = Math.max(1, Math.floor(r.height * dpr));
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      cv._w = r.width;
      cv._h = r.height;
    }
  },

  /* ---- readouts ------------------------------------------- */

  refresh() {
    const rel = AB.ctx.relationName();
    for (const key of ['a', 'b']) {
      const s = AB.side[key], b = s.brain;
      if (!b) continue;
      const e = b.evaluate(rel, 80);
      const r = Probes.answers(b, rel, AB.truth);
      const vec = Shared.votes(b, AB.ctx.voteProbe());
      const mode = Shared.bimodality(vec);

      s.score.textContent = Shared.fmt.score(e);
      s.hue.textContent = Shared.fmt.deg(r.hueError);
      s.conf.textContent = Shared.fmt.conf(e);
      s.alive.textContent = b.aliveCount() + '/' + b.nHid;
      s.mode.textContent = mode.mode === 'silent' ? 'no hue vote' : mode.label;

      for (let i = 0; i < r.got.length; i++) {
        const g = r.got[i];
        s.strips.got[i].style.background = Colors.css(Colors.hsv2rgb(g.h, g.s, g.v));
      }
      AB.drawVotes(s, vec);
    }
  },

  drawVotes(s, vec) {
    const cv = s.votes;
    const w = cv._w, h = cv._h;
    if (!w || !h || !cv.getContext) return;
    const ctx = cv.getContext('2d');
    ctx.clearRect(0, 0, w, h);

    const groups = [[0, HUE_N], [HUE_N, HUE_N + SAT_N], [HUE_N + SAT_N, DIM]];
    const scale = new Float64Array(vec.length);
    for (const [lo, hi] of groups) {
      let gp = 0;
      for (let i = lo; i < hi; i++) if (vec[i] > gp) gp = vec[i];
      for (let i = lo; i < hi; i++) scale[i] = gp > 1e-9 ? vec[i] / gp : 0;
    }

    const slot = w / vec.length;
    const base = h - 1;
    for (let i = 0; i < vec.length; i++) {
      const v = scale[i];
      const bh = Math.max(v > 0 ? 1 : 0, v * (base - 1));
      ctx.fillStyle = i < HUE_N ? '#F2F3F1' : '#676D70';
      ctx.globalAlpha = i < HUE_N ? 0.40 + v * 0.60 : 0.25 + v * 0.35;
      ctx.fillRect(i * slot + 0.5, base - bh, Math.max(1.5, slot - 1.5), bh);
    }
    ctx.globalAlpha = 1;
  },

  /* ---- running both in lockstep ---------------------------
     One Trainer, one example per tick, handed to both brains. That is
     what guarantees they see the same colours in the same order: it
     is not two loops that happen to agree. */

  toggleRun() {
    if (AB.trainer && AB.trainer.running) {
      AB.trainer.pause();
      AB.setRunLabel(false);
      AB.ctx.say('paused');
      return;
    }
    if (AB.cursor >= AB.stream.length) AB.load(AB.preset);

    AB.trainer = new Shared.Trainer({
      total: AB.stream.length,
      speedIdx: () => AB.ctx.speedIndex(),
      example: () => AB.stream[AB.cursor++],
      onExample: (ex) => {
        AB.side.a.brain.learn(ex);
        AB.side.b.brain.learn(ex);
      },
      onFrame: (t) => {
        if (t.frame % 6 === 0) AB.refresh();
        const c = document.getElementById('abCount');
        if (c) c.textContent = AB.cursor.toLocaleString();
      },
      onDone: () => {
        AB.refresh();
        AB.setRunLabel(false);
        AB.ctx.say('both finished on ' + AB.stream.length.toLocaleString() + ' identical examples');
      }
    });
    AB.trainer.start(AB.stream.length - AB.cursor);
    AB.setRunLabel(true);
    AB.ctx.say('running both on the same stream');
  },

  setRunLabel(running) {
    const el = document.getElementById('abRun');
    if (el) el.textContent = running ? 'Pause' : 'Run both';
  },

  key(ev) {
    if (!AB.live) return false;
    if (ev.key === ' ') { ev.preventDefault(); AB.toggleRun(); return true; }
    if (ev.key === 'Escape') { AB.close(); return true; }
    if (ev.key >= '1' && ev.key <= '5') {
      const i = Number(ev.key) - 1;
      if (i < AB.PRESETS.length) {
        const sel = document.getElementById('abPreset');
        if (sel) sel.value = String(i);
        AB.load(i);
      }
      return true;
    }
    return false;
  }
};
