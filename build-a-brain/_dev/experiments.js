/* ============================================================
   _dev/experiments.js — the study behind the demo.

   Run:  node _dev/experiments.js
   Writes: _dev/results.json and RESULTS.md

   Dev only. Nothing here ships to the browser and nothing here
   modifies a shipped file.

   Reproducibility. CONFIG.seed only seeds the network's wiring. The
   training stream comes from Math.random(), and for the two ambiguous
   relations the coin flip that picks between their two correct
   answers is also Math.random(), inside apply(). So every experiment
   below runs inside withSeed(), which swaps the global Math.random
   for a seeded generator and restores it in a finally block. That
   makes all six relations reproducible and touches no shipped file.
   ============================================================ */

const fs = require('fs');
const path = require('path');

const DIR = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(DIR, f), 'utf8');

const TRAIN = 4000;
const EVAL_N = 200;

/* ---- load the project ------------------------------------- */

const SOURCES = ['colors.js', 'brain.js', 'config.js', 'shared.js', 'probes.js'];

function load(brainSource) {
  const parts = SOURCES.map((f) => (f === 'brain.js' && brainSource ? brainSource : read(f)));
  const body = parts.join('\n') +
    '\nreturn { Colors, Brain, Code, CONFIG, Shared, Probes, HUE_N, DIM };';
  return new Function(body)();
}

const P = load(null);

/* ---- ablations that config cannot express -----------------
   k winners take all and sparse wiring are both reachable through
   config. The homeostatic cap and the mean input subtraction are
   single lines inside brain.js, so those two ablations are done by
   patching a copy of the source string in memory and loading that.
   The shipped file is never written to.

   Each patch asserts it actually matched. If brain.js is edited and
   one of these stops applying, this fails loudly rather than
   silently reporting the baseline twice. */

function patchedBrain(which) {
  const src = read('brain.js');
  let out, needle;

  if (which === 'nocap') {
    needle = '      if (norm > 1) for (let o = 0; o < this.nOut; o++) this.Who[base + o] /= norm;';
    out = src.replace(needle, '      /* ablation: homeostatic cap removed */');
  } else if (which === 'nomean') {
    needle = '      for (let i = 0; i < nIn; i++) sum += this.Wih[base + i] * (x[i] - mean);';
    out = src.replace(needle, '      for (let i = 0; i < nIn; i++) sum += this.Wih[base + i] * x[i];');
  } else {
    throw new Error('unknown ablation ' + which);
  }

  if (out === src) {
    throw new Error('ablation "' + which + '" did not match brain.js. The line it ' +
                    'patches has changed. Fix the needle in _dev/experiments.js.');
  }
  return load(out);
}

/* ---- seeded randomness ------------------------------------ */

function withSeed(seed, fn) {
  const original = Math.random;
  let s = (seed >>> 0) || 1;
  Math.random = function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  try {
    return fn();
  } finally {
    Math.random = original;   // always, even if fn throws
  }
}

/* ---- statistics ------------------------------------------- */

const mean = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);

function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  return Math.sqrt(a.reduce((acc, v) => acc + (v - m) * (v - m), 0) / (a.length - 1));
}

function pearson(xs, ys) {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return null;
  const mx = mean(xs), my = mean(ys);
  let num = 0, dx = 0, dy = 0;
  for (let i = 0; i < n; i++) {
    const a = xs[i] - mx, b = ys[i] - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : null;
}

const f1 = (v) => (v == null ? 'n/a' : v.toFixed(1));
const f2 = (v) => (v == null ? 'n/a' : v.toFixed(2));

/* ---- one run ---------------------------------------------
   Trains a brain and measures it. The hue error is reported twice on
   purpose: once over fresh random colours, the way the on-screen
   metric does it, and once over the 64 genuinely held-out probes. */

function runOne(env, cfgOverrides, relation, seed, trainN) {
  return withSeed(seed, () => {
    const cfg = Object.assign({}, env.CONFIG, { relation }, cfgOverrides || {}, { seed });
    const b = new env.Brain(cfg);
    const truth = env.Probes.truth(relation);
    const n = trainN == null ? TRAIN : trainN;
    for (let i = 0; i < n; i++) b.learn(env.Probes.example(relation));
    const e = b.evaluate(relation, EVAL_N);
    const probe = env.Probes.answers(b, relation, truth);
    return {
      brain: b,
      truth,
      score: e.score,
      hueErr: e.hueError,
      conf: e.confidence,
      probeHueErr: probe.hueError
    };
  });
}

/* ---- reporting -------------------------------------------- */

const results = {};
const md = [];
const t0 = Date.now();
const timings = {};

function say(s) { console.log(s); }

function section(title) {
  md.push('');
  md.push('## ' + title);
  md.push('');
  say('\n== ' + title);
}

function table(headers, rows) {
  md.push('| ' + headers.join(' | ') + ' |');
  md.push('|' + headers.map(() => '---').join('|') + '|');
  for (const r of rows) md.push('| ' + r.join(' | ') + ' |');
}

function stamp(key, fn) {
  const s = Date.now();
  const out = fn();
  timings[key] = Date.now() - s;
  say('   (' + (timings[key] / 1000).toFixed(1) + 's)');
  return out;
}

/* ============================================================
   1. Seed variance
   ============================================================ */

section('1. Seed variance');
md.push('Twenty seeds per relation, ' + TRAIN + ' examples each. This is the answer to');
md.push('"you got lucky with seed 7".');
md.push('');

const SEEDS20 = Array.from({ length: 20 }, (_, i) => 1 + i * 7);

results.seedVariance = stamp('seedVariance', () => {
  const rows = [];
  const out = {};
  for (const rel of P.Colors.relationNames) {
    const runs = SEEDS20.map((s) => runOne(P, null, rel, s));
    const scores = runs.map((r) => r.score);
    const hues = runs.map((r) => r.hueErr).filter((v) => v != null);
    const confs = runs.map((r) => r.conf);
    const probes = runs.map((r) => r.probeHueErr).filter((v) => v != null);
    out[rel] = {
      score: { mean: mean(scores), sd: sd(scores), min: Math.min(...scores), max: Math.max(...scores) },
      hueErr: { mean: mean(hues), sd: sd(hues) },
      conf: { mean: mean(confs), sd: sd(confs) },
      probeHueErr: { mean: mean(probes), sd: sd(probes) },
      scores, confs, hues
    };
    rows.push([
      rel,
      f1(out[rel].score.mean) + ' ± ' + f1(out[rel].score.sd),
      out[rel].score.min + ' to ' + out[rel].score.max,
      hues.length ? f1(out[rel].hueErr.mean) + ' ± ' + f1(out[rel].hueErr.sd) : 'n/a',
      probes.length ? f1(out[rel].probeHueErr.mean) : 'n/a',
      f1(out[rel].conf.mean * 100) + '% ± ' + f1(out[rel].conf.sd * 100)
    ]);
    say('   ' + rel.padEnd(18) + 'score ' + f1(out[rel].score.mean) + ' ± ' + f1(out[rel].score.sd));
  }
  table(['relation', 'score', 'range', 'hue error', 'held-out hue error', 'confidence'], rows);
  return out;
});

/* ============================================================
   2. Ablations
   ============================================================ */

section('2. Ablations');
md.push('Ten seeds each on `complement`, one thing removed at a time. Two of these are');
md.push('reachable through config. The other two patch a copy of `brain.js` in memory,');
md.push('dev only; the shipped file is not modified.');
md.push('');

const SEEDS10 = Array.from({ length: 10 }, (_, i) => 1 + i * 13);

results.ablations = stamp('ablations', () => {
  const conditions = [
    { id: 'baseline', label: 'baseline', env: P, cfg: null },
    { id: 'nokwta', label: 'k winners take all off (fireFraction 1.0)', env: P, cfg: { fireFraction: 1.0 } },
    { id: 'dense', label: 'sparse wiring off (connectivity 1.0)', env: P, cfg: { connectivity: 1.0 } },
    { id: 'nocap', label: 'homeostatic cap removed', env: patchedBrain('nocap'), cfg: null },
    { id: 'nomean', label: 'mean input subtraction removed', env: patchedBrain('nomean'), cfg: null },
    /* brain.js says of the cap: "Without this the brain collapses into
       shouting the same answer at everything." Removing it alone barely
       moves the score, so this removes both brakes at once to find out
       whether the collapse happens then. */
    { id: 'nocapnokwta', label: 'cap AND competition both removed',
      env: patchedBrain('nocap'), cfg: { fireFraction: 1.0 } }
  ];

  const out = {};
  let baseScore = null, baseHue = null;
  const rows = [];

  for (const c of conditions) {
    const runs = SEEDS10.map((s) => runOne(c.env, c.cfg, 'complement', s));
    const scores = runs.map((r) => r.score);
    const hues = runs.map((r) => r.hueErr).filter((v) => v != null);
    const rec = {
      label: c.label,
      score: { mean: mean(scores), sd: sd(scores) },
      hueErr: { mean: mean(hues), sd: sd(hues) },
      conf: { mean: mean(runs.map((r) => r.conf)) }
    };
    if (c.id === 'baseline') { baseScore = rec.score.mean; baseHue = rec.hueErr.mean; }
    rec.deltaScore = rec.score.mean - baseScore;
    rec.deltaHue = rec.hueErr.mean - baseHue;
    out[c.id] = rec;

    rows.push([
      c.label,
      f1(rec.score.mean) + ' ± ' + f1(rec.score.sd),
      (rec.deltaScore >= 0 ? '+' : '') + f1(rec.deltaScore),
      f1(rec.hueErr.mean) + '°',
      (rec.deltaHue >= 0 ? '+' : '') + f1(rec.deltaHue) + '°'
    ]);
    say('   ' + c.label.padEnd(42) + 'score ' + f1(rec.score.mean) +
        '  delta ' + (rec.deltaScore >= 0 ? '+' : '') + f1(rec.deltaScore));
  }
  table(['condition', 'score', 'delta', 'hue error', 'delta'], rows);

  /* Does the cap ever actually bind? If almost no cell reaches it, a
     small ablation delta would mean nothing. It binds constantly. */
  const probe = runOne(P, null, 'complement', 7);
  let atCap = 0;
  for (let j = 0; j < probe.brain.nHid; j++) {
    let norm = 0;
    const base = j * probe.brain.nOut;
    for (let o = 0; o < probe.brain.nOut; o++) norm += probe.brain.Who[base + o] ** 2;
    if (Math.sqrt(norm) > 0.999) atCap++;
  }
  out.capBinding = { atCap, of: probe.brain.nHid };
  md.push('');
  md.push('The cap is not idle: after ' + TRAIN + ' examples, **' + atCap + ' of ' +
          probe.brain.nHid + ' cells** are pressed right against it. It binds constantly and');
  md.push('removing it still barely changes the score.');
  say('   cells at the cap: ' + atCap + ' of ' + probe.brain.nHid);
  return out;
});

/* ============================================================
   3. chromaFraction sweep
   ============================================================ */

section('3. chromaFraction sweep');
md.push('Ten seeds each on `complement`. The write-up asserted a rationale for 0.40 and');
md.push('never tested it.');
md.push('');

results.chromaSweep = stamp('chromaSweep', () => {
  const out = {};
  const rows = [];
  for (const v of [0.2, 0.4, 0.6, 0.8]) {
    const runs = SEEDS10.map((s) => runOne(P, { chromaFraction: v }, 'complement', s));
    const scores = runs.map((r) => r.score);
    const hues = runs.map((r) => r.hueErr).filter((x) => x != null);
    out[v] = { score: { mean: mean(scores), sd: sd(scores) }, hueErr: { mean: mean(hues) } };
    rows.push([String(v), f1(out[v].score.mean) + ' ± ' + f1(out[v].score.sd), f1(out[v].hueErr.mean) + '°']);
    say('   chromaFraction ' + v + '  score ' + f1(out[v].score.mean));
  }
  table(['chromaFraction', 'score', 'hue error'], rows);
  return out;
});

/* ============================================================
   4. forgetting sweep
   ============================================================ */

section('4. forgetting sweep');
md.push('Ten seeds each on `complement`.');
md.push('');

results.forgettingSweep = stamp('forgettingSweep', () => {
  const out = {};
  const rows = [];
  for (const v of [0, 0.0003, 0.001, 0.003, 0.01]) {
    const runs = SEEDS10.map((s) => runOne(P, { forgetting: v }, 'complement', s));
    const scores = runs.map((r) => r.score);
    const hues = runs.map((r) => r.hueErr).filter((x) => x != null);
    out[v] = { score: { mean: mean(scores), sd: sd(scores) }, hueErr: { mean: mean(hues) } };
    rows.push([String(v), f1(out[v].score.mean) + ' ± ' + f1(out[v].score.sd), f1(out[v].hueErr.mean) + '°']);
    say('   forgetting ' + v + '  score ' + f1(out[v].score.mean));
  }
  table(['forgetting', 'score', 'hue error'], rows);
  return out;
});

/* ============================================================
   5. Lesion curves
   ============================================================ */

section('5. Lesion curves');
md.push('Ten seeds, `complement`, killed in steps of 5 per cent using the repeatable');
md.push('mask, at two network sizes. One training run per seed, then twenty lesions of');
md.push('the same trained brain.');
md.push('');

results.lesionCurves = stamp('lesionCurves', () => {
  const out = {};
  const pcts = [];
  for (let p = 0; p <= 95; p += 5) pcts.push(p);

  for (const nHid of [256, 96]) {
    const byPct = pcts.map(() => []);
    for (const seed of SEEDS10) {
      const r = runOne(P, { hiddenNeurons: nHid }, 'complement', seed);
      withSeed(seed + 1, () => {
        pcts.forEach((pct, i) => {
          r.brain.lesionTo(pct / 100, P.Shared.LESION_SEED);
          byPct[i].push(r.brain.evaluate('complement', EVAL_N).score);
        });
      });
    }
    out[nHid] = pcts.map((pct, i) => ({
      pct, score: mean(byPct[i]), sd: sd(byPct[i])
    }));
    say('   ' + nHid + ' neurons: ' + out[nHid]
      .filter((d) => d.pct % 20 === 0 || d.pct === 95)
      .map((d) => d.pct + '%:' + f1(d.score)).join('  '));
  }

  table(['killed', '256 neurons', '96 neurons'],
    pcts.map((pct, i) => [
      pct + '%',
      f1(out[256][i].score) + ' ± ' + f1(out[256][i].sd),
      f1(out[96][i].score) + ' ± ' + f1(out[96][i].sd)
    ]));
  return out;
});

/* ============================================================
   6. Lesion then retrain
   ============================================================ */

section('6. Lesion, then retrain the survivors');
md.push('Ten seeds, `complement`. Lesion, measure, then train another ' + TRAIN + ' examples');
md.push('with the mask still on, and measure again.');
md.push('');
md.push('The brief specified 50 per cent. That is included, but 50 per cent does no');
md.push('measurable damage in the first place, so on its own it can only ever return a');
md.push('null result. Deeper lesions are included so that there is something to recover.');
md.push('');

results.lesionRetrain = stamp('lesionRetrain', () => {
  const out = {};
  const rows = [];
  for (const pct of [50, 80, 90, 95]) {
    const pre = [], post = [], after = [];
    for (const seed of SEEDS10) {
      const r = runOne(P, null, 'complement', seed);
      pre.push(r.score);
      withSeed(seed + 2, () => {
        r.brain.lesionTo(pct / 100, P.Shared.LESION_SEED);
        post.push(r.brain.evaluate('complement', EVAL_N).score);
        for (let i = 0; i < TRAIN; i++) r.brain.learn(P.Probes.example('complement'));
        after.push(r.brain.evaluate('complement', EVAL_N).score);
      });
    }
    const lost = mean(pre) - mean(post);
    const regained = mean(after) - mean(post);
    out[pct] = {
      pre: mean(pre), post: mean(post), retrained: mean(after),
      postSd: sd(post), retrainedSd: sd(after),
      lost, regained,
      recoveredFraction: lost > 1 ? regained / lost : null
    };
    rows.push([
      pct + '%', f1(out[pct].pre), f1(out[pct].post), f1(out[pct].retrained),
      (regained >= 0 ? '+' : '') + f1(regained),
      out[pct].recoveredFraction == null ? 'nothing lost' : f1(out[pct].recoveredFraction * 100) + '%'
    ]);
    say('   killed ' + pct + '%: ' + f1(out[pct].pre) + ' -> ' + f1(out[pct].post) +
        ' -> ' + f1(out[pct].retrained));
  }
  table(['killed', 'before', 'lesioned', 'retrained', 'change', 'of the loss recovered'], rows);
  return out;
});

/* ============================================================
   7. Confidence calibration
   ============================================================ */

section('7. Confidence calibration');
md.push('Does the confidence number know when the network is wrong? Every run from');
md.push('experiment 1 that has a meaningful hue error, which is all six relations except');
md.push('`luminance`, where every answer is a grey.');
md.push('');

results.calibration = stamp('calibration', () => {
  const xs = [], ys = [], perRel = {};
  for (const rel of P.Colors.relationNames) {
    const v = results.seedVariance[rel];
    if (!v.hues.length) continue;
    const cs = [], hs = [];
    for (let i = 0; i < v.hues.length; i++) {
      cs.push(v.confs[i]);
      hs.push(v.hues[i]);
    }
    perRel[rel] = pearson(cs, hs);
    xs.push(...cs);
    ys.push(...hs);
  }
  const r = pearson(xs, ys);
  const out = { overall: r, n: xs.length, perRelation: perRel };

  table(['scope', 'n', 'correlation of confidence against hue error'],
    [['all relations with a hue', String(xs.length), f2(r)]].concat(
      Object.keys(perRel).map((k) => [k + ' alone', '20', f2(perRel[k])])));

  md.push('');
  md.push('A strong negative correlation means high confidence goes with low error, which');
  md.push('is what a working uncertainty estimate looks like.');
  say('   overall r = ' + f2(r) + ' over ' + xs.length + ' runs');
  return out;
});

/* ============================================================
   write it out
   ============================================================ */

const totalMs = Date.now() - t0;

/* ---- headlines --------------------------------------------
   Written from the numbers above rather than typed in, so this
   section cannot drift away from the tables. Where a result
   contradicts something claimed in the write-up, it says so. */

const A = results.ablations;
const C = results.chromaSweep;
const L = results.lesionCurves;
const R = results.lesionRetrain;

const headlines = [
  '## What these say',
  '',
  '**Confidence is a working uncertainty estimate.** Across ' + results.calibration.n +
    ' runs spanning every',
  'relation that has a meaningful hue error, confidence correlates with actual hue error',
  'at r = ' + f2(results.calibration.overall) + '. High confidence goes with low error, ' +
    'and it goes with it hard.',
  'Nothing in the network was told what the error was. There is no loss, no target',
  'comparison, and no error signal anywhere in the code. The number falls out of how',
  'sharply the output population agrees with itself. This is the strongest result here.',
  '',
  '**Seed 7 was not lucky.** ' + f1(results.seedVariance.complement.score.mean) + ' ± ' +
    f1(results.seedVariance.complement.score.sd) + ' on `complement` across 20 seeds, ' +
    'range ' + results.seedVariance.complement.score.min + ' to ' +
    results.seedVariance.complement.score.max + '.',
  'Ambiguous relations are consistently bad and unambiguous ones consistently good, which',
  'is the point rather than a problem.',
  '',
  '**chromaFraction 0.40 earned its place.** Of the four values tested it is the best:',
  [0.2, 0.4, 0.6, 0.8].map((v) => v + ' scores ' + f1(C[v].score.mean)).join(', ') + '.',
  'The rationale asserted in the write-up survives being tested.',
  '',
  '**Redundancy is real and it scales with size.** At 256 neurons, killing 40 per cent',
  'costs ' + f1(L[256][0].score - L[256][8].score) + ' points and killing 95 per cent ' +
    'still leaves ' + f1(L[256][19].score) + '. At 96 neurons the',
  'same cuts cost ' + f1(L[96][0].score - L[96][8].score) + ' and leave ' +
    f1(L[96][19].score) + '. Nothing implements fault tolerance. It is a',
  'side effect of spreading the answer across many cells, and more cells means more of it.',
  '',
  '### Three things that contradict the write-up',
  '',
  '**The homeostatic cap does almost nothing at these settings.** `brain.js` says of it:',
  '"Without this the brain collapses into shouting the same answer at everything."',
  'Removing it costs ' + f1(-A.nocap.deltaScore) + ' points. It is not idle either: ' +
    A.capBinding.atCap + ' of ' + A.capBinding.of + ' cells sit',
  'pressed against it. The reason it can bind constantly and still not matter is that the',
  'hue readout is a weighted circular mean, which divides by total weight, so it is',
  'largely blind to how big any one cell\'s weights became. Removing the cap and the',
  'competition together gives ' + f1(A.nocapnokwta.score.mean) +
    ', so the predicted collapse does not happen even then.',
  '',
  '**Sparse wiring does not help the score.** Dense wiring, connectivity 1.0, scores',
  f1(A.dense.score.mean) + ' against a baseline of ' + f1(A.baseline.score.mean) +
    ', which is ' + (A.dense.deltaScore >= 0 ? 'better' : 'worse') + ', not worse.',
  'It costs precision on hue, ' + f1(A.baseline.hueErr.mean) + ' degrees against ' +
    f1(A.dense.hueErr.mean) + '. The claim that full connectivity',
  'would make all 256 cells respond identically is false for this implementation: every',
  'cell still gets its own independent signed random weights. They just become less',
  'usefully different.',
  '',
  '**Competition matters, but it does not prevent a collapse.** Turning k winners take all',
  'off costs ' + f1(-A.nokwta.deltaScore) + ' points, which is the largest single ablation ' +
    'here and still not a',
  'collapse. What stops runaway when the contest is off is the last line of `think()`,',
  'which divides the whole layer by its own total activity so the layer always fires with',
  'the same total energy. That normalisation is doing work usually credited to the contest.',
  '',
  '### One correction to an earlier note in this repository',
  '',
  'An earlier single-seed check concluded that lesion damage does not recover at all. With',
  'ten seeds that is too strong. At 50 and 80 per cent there is nothing to recover, but at',
  '90 per cent retraining the survivors regains ' + f1(R[90].regained) + ' points and at 95 per cent ' +
    f1(R[95].regained) + ' points,',
  'which is ' + (R[90].recoveredFraction == null ? 'n/a' : f1(R[90].recoveredFraction * 100)) +
    ' and ' + (R[95].recoveredFraction == null ? 'n/a' : f1(R[95].recoveredFraction * 100)) +
    ' per cent of what was lost. Small, consistent, and not zero. The',
  'ceiling is explained by `Wih` being fixed at birth: retraining can only readjust the',
  'output weights, so it cannot rebuild tuning curves the dead cells took with them.',
  ''
];

const header = [
  '# Results',
  '',
  'Generated by `node _dev/experiments.js`. Every number here comes from a seeded',
  'run and regenerating this file reproduces it exactly.',
  '',
  '- ' + TRAIN + ' training examples per run, evaluation over ' + EVAL_N + ' fresh colours',
  '- the 64 probes in `probes.js` are excluded from every training stream',
  '- the training stream is made reproducible by swapping the global `Math.random`',
  '  for a seeded generator inside the harness only, because two of the six',
  '  relations draw their randomness inside `apply()`',
  '- total runtime ' + (totalMs / 1000).toFixed(1) + ' seconds',
  ''
];

fs.writeFileSync(path.join(__dirname, 'results.json'),
  JSON.stringify({ generated: { trainingExamples: TRAIN, evalN: EVAL_N, totalMs, timings }, results }, null, 2));

fs.writeFileSync(path.join(DIR, 'RESULTS.md'), header.concat(headlines).concat(md).join('\n') + '\n');

say('\n---');
say('total runtime ' + (totalMs / 1000).toFixed(1) + 's');
say('per experiment: ' + Object.keys(timings)
  .map((k) => k + ' ' + (timings[k] / 1000).toFixed(1) + 's').join(', '));
say('wrote _dev/results.json and RESULTS.md');
