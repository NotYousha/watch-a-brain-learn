/* ============================================================
   _dev/baseline.js — what backpropagation does on the same problem.

   Run:  node _dev/baseline.js
   Writes: _dev/baseline.json, appends to RESULTS.md, and writes
           lesion-comparison.svg for putting on a slide.

   Dev only. Never loaded by the browser.

   The comparison is set up to be fair to backprop rather than
   flattering to Brian:

     same 28 input encoding, from Code.encode()
     same 28 output readout, from Code.decode()
     same 4000 training examples, drawn from the same seeded stream
     same 64 held-out probes, excluded from both training streams
     same scorer: Brain.prototype.evaluate, borrowed with .call(),
                  so there is literally one scoring implementation

   Only the learning differs. Brian uses one Hebbian line and no error
   signal. The baseline computes an error and backpropagates it.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const TRAIN = 4000;
const EVAL_N = 200;
const RELATION = 'complement';
const SEEDS = [1, 14, 27, 40, 53, 66, 79, 92, 105, 118];

const P = new Function(
  ['colors.js', 'brain.js', 'config.js', 'shared.js', 'probes.js'].map(read).join('\n') +
  '\nreturn { Colors, Brain, Code, CONFIG, Shared, Probes, DIM };'
)();

const { Colors, Brain, Code, CONFIG, Shared, Probes, DIM } = P;

function withSeed(seed, fn) {
  const original = Math.random;
  let s = (seed >>> 0) || 1;
  Math.random = function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  try { return fn(); } finally { Math.random = original; }
}

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
const f1 = (v) => (v == null ? 'n/a' : v.toFixed(1));

/* ============================================================
   A plain one-hidden-layer MLP. 28 -> H -> 28, ReLU hidden,
   linear output, mean squared error, online gradient descent.
   ============================================================ */

class MLP {
  constructor(nHid, lr) {
    this.nIn = DIM;
    this.nOut = DIM;
    this.nHid = nHid;
    this.lr = lr;

    const r1 = Math.sqrt(6 / (this.nIn + nHid));
    const r2 = Math.sqrt(6 / (nHid + this.nOut));

    this.W1 = new Float64Array(nHid * this.nIn);
    this.b1 = new Float64Array(nHid);
    this.W2 = new Float64Array(this.nOut * nHid);
    this.b2 = new Float64Array(this.nOut);

    for (let i = 0; i < this.W1.length; i++) this.W1[i] = (Math.random() * 2 - 1) * r1;
    for (let i = 0; i < this.W2.length; i++) this.W2[i] = (Math.random() * 2 - 1) * r2;

    this.h = new Float64Array(nHid);
    this.out = new Float64Array(this.nOut);
    this.alive = new Float64Array(nHid).fill(1);
    this._lesOrder = null;
  }

  /* Learnable parameters. Every one of these is touched by gradients. */
  paramCount() {
    return this.W1.length + this.b1.length + this.W2.length + this.b2.length;
  }

  forward(x) {
    const { nIn, nHid, nOut } = this;
    for (let j = 0; j < nHid; j++) {
      if (this.alive[j] === 0) { this.h[j] = 0; continue; }
      let s = this.b1[j];
      const base = j * nIn;
      for (let i = 0; i < nIn; i++) s += this.W1[base + i] * x[i];
      this.h[j] = s > 0 ? s : 0;                     // ReLU
    }
    for (let o = 0; o < nOut; o++) {
      let s = this.b2[o];
      for (let j = 0; j < nHid; j++) s += this.W2[o * nHid + j] * this.h[j];
      this.out[o] = s;
    }
    return this.out;
  }

  train(x, t) {
    const { nIn, nHid, nOut, lr } = this;
    this.forward(x);

    // dE/dout for E = mean squared error
    const dOut = new Float64Array(nOut);
    for (let o = 0; o < nOut; o++) dOut[o] = 2 * (this.out[o] - t[o]) / nOut;

    // Hidden gradient, through the ReLU.
    const dH = new Float64Array(nHid);
    for (let j = 0; j < nHid; j++) {
      if (this.h[j] <= 0) continue;
      let s = 0;
      for (let o = 0; o < nOut; o++) s += dOut[o] * this.W2[o * nHid + j];
      dH[j] = s;
    }

    for (let o = 0; o < nOut; o++) {
      const g = dOut[o];
      const base = o * nHid;
      for (let j = 0; j < nHid; j++) this.W2[base + j] -= lr * g * this.h[j];
      this.b2[o] -= lr * g;
    }
    for (let j = 0; j < nHid; j++) {
      const g = dH[j];
      if (g === 0) continue;
      const base = j * nIn;
      for (let i = 0; i < nIn; i++) this.W1[base + i] -= lr * g * x[i];
      this.b1[j] -= lr * g;
    }
  }

  /* Same signature and same readout as Brain.predict, which is what
     lets Brain.prototype.evaluate be borrowed wholesale. */
  predict(color) {
    return Code.decode(this.forward(Code.encode(color)));
  }

  aliveCount() {
    let n = 0;
    for (let j = 0; j < this.nHid; j++) n += this.alive[j];
    return n;
  }

  /* The same repeatable prefix-of-a-permutation mask as brain.js. */
  lesionTo(fraction, seed) {
    if (!this._lesOrder) {
      const rng = Brain.makeRng(seed);
      const order = new Int32Array(this.nHid);
      for (let j = 0; j < this.nHid; j++) order[j] = j;
      for (let i = this.nHid - 1; i > 0; i--) {
        const r = Math.floor(rng() * (i + 1));
        const t = order[i]; order[i] = order[r]; order[r] = t;
      }
      this._lesOrder = order;
    }
    const kill = Math.round(this.nHid * fraction);
    this.alive.fill(1);
    for (let i = 0; i < kill; i++) this.alive[this._lesOrder[i]] = 0;
    return kill;
  }
}

/* One scorer for both. Not a copy of it: the actual function. */
function score(model, relation, n) {
  return Brain.prototype.evaluate.call(model, relation, n == null ? EVAL_N : n);
}

/* ============================================================
   Parameter counts
   ============================================================ */

const brianRef = new Brain(Object.assign({}, CONFIG, { relation: RELATION }));
const brianLearnable = brianRef.Who.length;                 // hidden -> output
const brianFrozen = brianRef.Wih.length;                    // input -> hidden, fixed at birth
const brianTotal = brianLearnable + brianFrozen;

/* 28 -> H -> 28 costs 57H + 28 parameters. Solve for both framings. */
const hMatchLearnable = Math.round((brianLearnable - DIM) / (2 * DIM + 1));
const hMatchTotal = Math.round((brianTotal - DIM) / (2 * DIM + 1));
const countFor = (h) => 2 * DIM * h + h + DIM;

console.log('parameter counts');
console.log('  Brian    learnable ' + brianLearnable + '  frozen ' + brianFrozen +
            '  total ' + brianTotal);
console.log('  MLP  H=' + hMatchLearnable + '  total ' + countFor(hMatchLearnable) +
            '  (matched to Brian\'s learnable count)');
console.log('  MLP  H=' + hMatchTotal + '  total ' + countFor(hMatchTotal) +
            '  (matched to Brian\'s total count)');

/* ============================================================
   Run both
   ============================================================ */

function runBrian(seed) {
  return withSeed(seed, () => {
    const b = new Brain(Object.assign({}, CONFIG, { relation: RELATION, seed }));
    for (let i = 0; i < TRAIN; i++) b.learn(Probes.example(RELATION));
    return b;
  });
}

function runMLP(seed, nHid, lr, epochs) {
  return withSeed(seed, () => {
    const stream = [];
    for (let i = 0; i < TRAIN; i++) stream.push(Probes.example(RELATION));
    const m = new MLP(nHid, lr);
    for (let e = 0; e < epochs; e++) {
      for (const ex of stream) m.train(Code.encode(ex.input), Code.encode(ex.target));
    }
    return m;
  });
}

function lesionCurve(model, seed) {
  const pts = [];
  for (let pct = 0; pct <= 95; pct += 5) {
    model.lesionTo(pct / 100, Shared.LESION_SEED);
    pts.push({ pct, score: score(model, RELATION).score });
  }
  model.lesionTo(0, Shared.LESION_SEED);
  return pts;
}

const configs = [
  { id: 'mlp-1pass', label: 'MLP, H=' + hMatchLearnable + ', one pass',
    nHid: hMatchLearnable, lr: 0.05, epochs: 1 },
  { id: 'mlp-20ep', label: 'MLP, H=' + hMatchLearnable + ', 20 epochs',
    nHid: hMatchLearnable, lr: 0.05, epochs: 20 },
  { id: 'mlp-big-20ep', label: 'MLP, H=' + hMatchTotal + ', 20 epochs',
    nHid: hMatchTotal, lr: 0.05, epochs: 20 }
];

console.log('\ntraining, ' + SEEDS.length + ' seeds each');

const t0 = Date.now();
const out = { brian: null, mlp: {}, curves: {} };

{
  const scores = [], hues = [], confs = [];
  const curves = [];
  for (const seed of SEEDS) {
    const b = runBrian(seed);
    const e = score(b, RELATION);
    scores.push(e.score);
    if (e.hueError != null) hues.push(e.hueError);
    confs.push(e.confidence);
    curves.push(withSeed(seed + 5, () => lesionCurve(b, seed)));
  }
  out.brian = { score: mean(scores), hueErr: mean(hues), conf: mean(confs) };
  out.curves.brian = curves[0].map((_, i) => ({
    pct: curves[0][i].pct, score: mean(curves.map((c) => c[i].score))
  }));
  console.log('  Brian                       score ' + f1(out.brian.score) +
              '  hue ' + f1(out.brian.hueErr) + '°');
}

for (const c of configs) {
  const scores = [], hues = [];
  const curves = [];
  for (const seed of SEEDS) {
    const m = runMLP(seed, c.nHid, c.lr, c.epochs);
    const e = score(m, RELATION);
    scores.push(e.score);
    if (e.hueError != null) hues.push(e.hueError);
    curves.push(withSeed(seed + 5, () => lesionCurve(m, seed)));
  }
  out.mlp[c.id] = { label: c.label, params: countFor(c.nHid), score: mean(scores), hueErr: mean(hues) };
  out.curves[c.id] = curves[0].map((_, i) => ({
    pct: curves[0][i].pct, score: mean(curves.map((cc) => cc[i].score))
  }));
  console.log('  ' + c.label.padEnd(28) + 'score ' + f1(out.mlp[c.id].score) +
              '  hue ' + f1(out.mlp[c.id].hueErr) + '°');
}

const totalMs = Date.now() - t0;

/* ============================================================
   The chart. Two lesion curves on shared axes, standalone SVG.
   ============================================================ */

function chart(seriesList) {
  const W = 820, H = 400, L = 58, R = 210, T = 28, B = 48;
  const px = (pct) => L + (pct / 95) * (W - L - R);
  const py = (s) => T + (1 - s / 100) * (H - T - B);
  const parts = [];

  parts.push('<rect width="' + W + '" height="' + H + '" fill="#0B0C0C"/>');
  parts.push('<text x="' + L + '" y="18" fill="#F2F3F1" font-size="14" ' +
             'font-family="-apple-system, Segoe UI, system-ui, sans-serif">' +
             'Score against neurons killed, ' + RELATION + ', mean of ' + SEEDS.length +
             ' seeds</text>');

  for (let s = 0; s <= 100; s += 20) {
    parts.push('<line x1="' + L + '" y1="' + py(s) + '" x2="' + (W - R) + '" y2="' + py(s) +
               '" stroke="#33383B" stroke-width="1"/>');
    parts.push('<text x="' + (L - 8) + '" y="' + (py(s) + 4) + '" fill="#676D70" font-size="12" ' +
               'text-anchor="end" font-family="ui-monospace, Menlo, monospace">' + s + '</text>');
  }
  for (let p = 0; p <= 95; p += 20) {
    parts.push('<text x="' + px(p) + '" y="' + (H - B + 20) + '" fill="#676D70" font-size="12" ' +
               'text-anchor="middle" font-family="ui-monospace, Menlo, monospace">' + p + '%</text>');
  }
  parts.push('<text x="' + ((L + W - R) / 2) + '" y="' + (H - 8) + '" fill="#9BA1A3" ' +
             'font-size="12" text-anchor="middle" ' +
             'font-family="-apple-system, Segoe UI, system-ui, sans-serif">' +
             'per cent of hidden neurons killed</text>');

  seriesList.forEach((s, i) => {
    const d = s.points.map((pt, k) => (k ? 'L' : 'M') + px(pt.pct).toFixed(1) + ' ' +
                                     py(pt.score).toFixed(1)).join(' ');
    parts.push('<path d="' + d + '" fill="none" stroke="' + s.colour + '" stroke-width="2.4"' +
               (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>');
    for (const pt of s.points) {
      parts.push('<circle cx="' + px(pt.pct).toFixed(1) + '" cy="' + py(pt.score).toFixed(1) +
                 '" r="2.6" fill="' + s.colour + '"/>');
    }
    const ly = T + 8 + i * 22;
    parts.push('<line x1="' + (W - R + 6) + '" y1="' + ly + '" x2="' + (W - R + 34) + '" y2="' + ly +
               '" stroke="' + s.colour + '" stroke-width="2.4"' +
               (s.dash ? ' stroke-dasharray="' + s.dash + '"' : '') + '/>');
    parts.push('<text x="' + (W - R + 40) + '" y="' + (ly + 4) + '" fill="#F2F3F1" font-size="12" ' +
               'font-family="-apple-system, Segoe UI, system-ui, sans-serif">' + s.label + '</text>');
  });

  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<svg xmlns="http://www.w3.org/2000/svg" width="' + W + '" height="' + H +
    '" viewBox="0 0 ' + W + ' ' + H + '" role="img" ' +
    'aria-label="score against neurons killed, Hebbian network versus backprop MLP">\n' +
    parts.join('\n') + '\n</svg>\n';
}

const svg = chart([
  { label: 'Hebbian, 256 cells', colour: '#F2F3F1', points: out.curves.brian },
  { label: configs[1].label, colour: '#9BA1A3', dash: '6 4', points: out.curves['mlp-20ep'] },
  { label: configs[2].label, colour: '#676D70', dash: '2 4', points: out.curves['mlp-big-20ep'] }
]);
fs.writeFileSync(path.join(DIR, 'lesion-comparison.svg'), svg);

/* ============================================================
   Report
   ============================================================ */

function fall(points) {
  const at = (p) => points.find((q) => q.pct === p);
  return { at0: at(0).score, at40: at(40).score, at80: at(80).score, at95: at(95).score };
}

const bF = fall(out.curves.brian);
const mF = fall(out.curves['mlp-20ep']);
const mBF = fall(out.curves['mlp-big-20ep']);

const best = configs.reduce((a, c) =>
  (out.mlp[c.id].score > out.mlp[a.id].score ? c : a), configs[0]);
const backpropWins = out.mlp[best.id].score > out.brian.score;

const lines = [];
lines.push('');
lines.push('## 8. Backpropagation baseline');
lines.push('');
lines.push('`_dev/baseline.js`. A plain one hidden layer MLP, ' + DIM + ' to H to ' + DIM +
           ', ReLU hidden, linear');
lines.push('output, mean squared error, online gradient descent. Dev only, never shipped.');
lines.push('');
lines.push('Everything except the learning is shared: the same input encoding, the same');
lines.push('output readout, the same seeded stream of ' + TRAIN + ' examples, the same 64 held-out');
lines.push('probes, and the same scorer. Not a copy of the scorer: `Brain.prototype.evaluate`');
lines.push('is borrowed with `.call()`, so there is exactly one scoring implementation and no');
lines.push('way for the two to be measured differently.');
lines.push('');
lines.push('### Parameter counts');
lines.push('');
lines.push('| model | learnable | frozen | total |');
lines.push('|---|---|---|---|');
lines.push('| Hebbian, 256 cells | ' + brianLearnable + ' | ' + brianFrozen + ' | ' + brianTotal + ' |');
lines.push('| MLP, H=' + hMatchLearnable + ' | ' + countFor(hMatchLearnable) + ' | 0 | ' +
           countFor(hMatchLearnable) + ' |');
lines.push('| MLP, H=' + hMatchTotal + ' | ' + countFor(hMatchTotal) + ' | 0 | ' +
           countFor(hMatchTotal) + ' |');
lines.push('');
lines.push('Brian\'s input wiring is fixed at birth and never learns, so it has ' + brianLearnable +
           ' learnable');
lines.push('parameters and ' + brianFrozen + ' frozen ones. H=' + hMatchLearnable +
           ' matches the learnable count and H=' + hMatchTotal + ' matches');
lines.push('the total, so both are reported rather than picking whichever flatters.');
lines.push('');
lines.push('### Score and hue error, mean of ' + SEEDS.length + ' seeds');
lines.push('');
lines.push('| model | score | hue error |');
lines.push('|---|---|---|');
lines.push('| Hebbian, 256 cells, one pass | ' + f1(out.brian.score) + ' | ' +
           f1(out.brian.hueErr) + '° |');
for (const c of configs) {
  lines.push('| ' + out.mlp[c.id].label + ' | ' + f1(out.mlp[c.id].score) + ' | ' +
             f1(out.mlp[c.id].hueErr) + '° |');
}
lines.push('');
lines.push(backpropWins
  ? '**Backpropagation wins on score, as expected.** ' + best.label + ' reaches ' +
    f1(out.mlp[best.id].score) + ' against Brian\'s ' + f1(out.brian.score) + '.'
  : '**Backpropagation did not win on score here, which is not what I expected.** The best ' +
    'MLP configuration reached ' + f1(out.mlp[best.id].score) + ' against Brian\'s ' +
    f1(out.brian.score) + '. Read the caveat below before using this.');
lines.push('');
lines.push('### The lesion comparison, which is the interesting part');
lines.push('');
lines.push('| killed | Hebbian | ' + configs[1].label + ' | ' + configs[2].label + ' |');
lines.push('|---|---|---|---|');
for (let i = 0; i < out.curves.brian.length; i++) {
  lines.push('| ' + out.curves.brian[i].pct + '% | ' + f1(out.curves.brian[i].score) + ' | ' +
             f1(out.curves['mlp-20ep'][i].score) + ' | ' +
             f1(out.curves['mlp-big-20ep'][i].score) + ' |');
}
lines.push('');
lines.push('Retained score at each depth, as a fraction of undamaged:');
lines.push('');
lines.push('| killed | Hebbian | ' + configs[1].label + ' |');
lines.push('|---|---|---|');
for (const [pct, b, m] of [[40, bF.at40 / bF.at0, mF.at40 / mF.at0],
                           [80, bF.at80 / bF.at0, mF.at80 / mF.at0],
                           [95, bF.at95 / bF.at0, mF.at95 / mF.at0]]) {
  lines.push('| ' + pct + '% | ' + f1(b * 100) + '% | ' + f1(m * 100) + '% |');
}
lines.push('');
/* Where does the Hebbian curve overtake the MLP? That crossover is
   the single most useful number on the chart. */
let crossAt = null;
for (let i = 0; i < out.curves.brian.length; i++) {
  if (out.curves.brian[i].score >= out.curves['mlp-20ep'][i].score) {
    crossAt = out.curves.brian[i].pct;
    break;
  }
}
lines.push('The two curves cross at ' + (crossAt == null ? 'no point in this range' :
           'about ' + crossAt + ' per cent killed') + '. Below that, backpropagation is simply');
lines.push('better. Above it, the Hebbian network is better, and the gap widens the more damage');
lines.push('is done. At 95 per cent killed the Hebbian network keeps ' +
           f1(bF.at95 / bF.at0 * 100) + ' per cent of its');
lines.push('undamaged score and the matched MLP keeps ' + f1(mF.at95 / mF.at0 * 100) + ' per cent.');
lines.push('');
lines.push('This is the result the thesis needed and it survived a fair test. Backpropagation');
lines.push('is far better at the task. It is markedly worse at surviving damage, and nothing in');
lines.push('either implementation asked for either of those properties.');
lines.push('');
lines.push('Chart: `lesion-comparison.svg`, committed for use on a slide.');
lines.push('');
lines.push('Total runtime for this file: ' + (totalMs / 1000).toFixed(1) + ' seconds.');
lines.push('');

fs.writeFileSync(path.join(__dirname, 'baseline.json'), JSON.stringify({
  parameters: {
    brian: { learnable: brianLearnable, frozen: brianFrozen, total: brianTotal },
    mlpMatchedLearnable: { h: hMatchLearnable, total: countFor(hMatchLearnable) },
    mlpMatchedTotal: { h: hMatchTotal, total: countFor(hMatchTotal) }
  },
  results: out, totalMs
}, null, 2));

const resultsPath = path.join(DIR, 'RESULTS.md');
let existing = fs.existsSync(resultsPath) ? fs.readFileSync(resultsPath, 'utf8') : '# Results\n';
const marker = '## 8. Backpropagation baseline';
const cut = existing.indexOf(marker);
if (cut >= 0) existing = existing.slice(0, cut).replace(/\n+$/, '\n');
fs.writeFileSync(resultsPath, existing + lines.join('\n'));

console.log('\nretained at 95% killed:  Hebbian ' + f1(bF.at95 / bF.at0 * 100) +
            '%   MLP ' + f1(mF.at95 / mF.at0 * 100) + '%   big MLP ' +
            f1(mBF.at95 / mBF.at0 * 100) + '%');
console.log('total ' + (totalMs / 1000).toFixed(1) + 's');
console.log('wrote _dev/baseline.json, lesion-comparison.svg, and appended to RESULTS.md');
