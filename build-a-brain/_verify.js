/* Dev-only sanity check. Not part of the student project.
   Run:  node _verify.js                                       */
const fs = require('fs');
const src = ['colors.js', 'brain.js', 'config.js']
  .map(f => fs.readFileSync(__dirname + '/' + f, 'utf8')).join('\n');

const test = `
const results = [];
for (const rel of Colors.relationNames) {
  const cfg = Object.assign({}, CONFIG, { relation: rel });
  const b = new Brain(cfg);
  const before = b.evaluate(rel, 300);
  for (let i = 0; i < cfg.trainingExamples; i++) b.learn(Colors.makeExample(rel));
  const after = b.evaluate(rel, 300);
  const les = new Brain(cfg);
  for (let i = 0; i < cfg.trainingExamples; i++) les.learn(Colors.makeExample(rel));
  les.lesion(0.2);
  const lesioned = les.evaluate(rel, 300);
  results.push({ rel, before, after, lesioned });
}
results.forEach(r => {
  const f = (x) => x === null ? ' n/a ' : x.toFixed(1).padStart(5);
  console.log(
    r.rel.padEnd(18),
    'score', String(r.before.score).padStart(3), '->', String(r.after.score).padStart(3),
    '| hue err', f(r.before.hueError), '->', f(r.after.hueError), 'deg',
    '| conf', r.after.confidence.toFixed(2),
    '| lesion20%: score', String(r.lesioned.score).padStart(3)
  );
});

// Sweep of hidden-layer sizes, to be sure every option students can pick works.
console.log('\\n-- hiddenNeurons sweep on complement --');
for (const n of [32, 64, 96, 128, 256]) {
  const cfg = Object.assign({}, CONFIG, { relation: 'complement', hiddenNeurons: n });
  const b = new Brain(cfg);
  for (let i = 0; i < cfg.trainingExamples; i++) b.learn(Colors.makeExample('complement'));
  const e = b.evaluate('complement', 300);
  console.log(String(n).padStart(4), 'score', String(e.score).padStart(3), 'hue err', e.hueError.toFixed(1));
}

console.log('\\n-- parameter extremes (students will try these) --');
const extremes = [
  { fireFraction: 0.05 }, { fireFraction: 0.25 },
  { learningRate: 0.01 }, { learningRate: 0.2 },
  { connectivity: 0.15 }, { connectivity: 0.6 },
  { forgetting: 0 }, { forgetting: 0.01 }
];
for (const ex of extremes) {
  const cfg = Object.assign({}, CONFIG, { relation: 'complement' }, ex);
  const b = new Brain(cfg);
  for (let i = 0; i < cfg.trainingExamples; i++) b.learn(Colors.makeExample('complement'));
  const e = b.evaluate('complement', 300);
  console.log(JSON.stringify(ex).padEnd(26), 'score', String(e.score).padStart(3), 'hue err', e.hueError.toFixed(1));
}

console.log('\\n-- brain damage: does it degrade gracefully? --');
for (const frac of [0, 0.2, 0.4, 0.6, 0.8, 0.95]) {
  const cfg = Object.assign({}, CONFIG, { relation: 'complement' });
  const b = new Brain(cfg);
  for (let i = 0; i < cfg.trainingExamples; i++) b.learn(Colors.makeExample('complement'));
  if (frac > 0) b.lesion(frac);
  const e = b.evaluate('complement', 300);
  console.log(
    'killed', String(Math.round(frac * 100)).padStart(3) + '%',
    '| alive', String(b.aliveCount()).padStart(3),
    '| score', String(e.score).padStart(3),
    '| hue err', e.hueError.toFixed(1).padStart(5)
  );
}

console.log('\\n-- timing (older laptop budget) --');
const t0 = Date.now();
const bt = new Brain(Object.assign({}, CONFIG, { hiddenNeurons: 256 }));
for (let i = 0; i < 4000; i++) bt.learn(Colors.makeExample('complement'));
console.log('4000 examples @ 256 neurons:', (Date.now() - t0) + 'ms');
`;

eval(src + test);
