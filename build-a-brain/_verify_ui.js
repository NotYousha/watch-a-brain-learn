/* Dev-only. Runs the browser code under a fake DOM to catch
   reference errors and missing element IDs.  node _verify_ui.js */
const fs = require('fs');
const D = __dirname + '/';
const read = (f) => fs.readFileSync(D + f, 'utf8');

const html = read('index.html');
const app = read('app.js');

/* 1. Every getElementById in app.js must exist in index.html */
const htmlIds = new Set([...html.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
const wanted = [
  ...[...app.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]),
  ...[...app.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1])   // the $() helper
];
const missing = [...new Set(wanted)].filter(id => !htmlIds.has(id));
console.log('element ids referenced:', new Set(wanted).size,
            '| missing from index.html:', missing.length ? missing.join(', ') : 'none');

/* 2. Every <script src> must exist on disk */
const srcs = [...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
const badSrc = srcs.filter(s => !fs.existsSync(D + s));
console.log('script tags:', srcs.join(' '), '| missing:', badSrc.length ? badSrc.join(', ') : 'none');

/* 3. Actually run it all under a fake DOM. */
const ctxStub = new Proxy({}, {
  get: (t, k) => (k in t ? t[k] : () => {}),
  set: (t, k, v) => { t[k] = v; return true; }
});
function makeEl(id) {
  return {
    id, style: {}, textContent: '', innerHTML: '', value: '#e03c3c',
    width: 800, height: 400,
    classList: { add() {}, remove() {} },
    addEventListener(ev, fn) { (this._h ||= {})[ev] = fn; },
    getContext: () => ctxStub,
    getBoundingClientRect: () => ({ width: 800, height: 400 })
  };
}
const els = {};
const document = {
  body: { classList: { add() {} }, set innerHTML(v) { throw new Error('app.js bailed out: ' + v.slice(0, 120)); } },
  getElementById: (id) => (els[id] ||= makeEl(id))
};
let rafQueue = [];
const window = {
  devicePixelRatio: 2,
  addEventListener: (ev, fn) => { window['_' + ev] = fn; }
};
const requestAnimationFrame = (fn) => { rafQueue.push(fn); };

const src = ['colors.js', 'brain.js', 'config.js', 'viz.js', 'app.js'].map(read).join('\n');
const globals = new Function('document', 'window', 'requestAnimationFrame',
  src + '\nreturn { Colors, Brain, Viz, CONFIG };')(document, window, requestAnimationFrame);
const { Colors, Brain, Viz, CONFIG } = globals;
console.log('page loaded without error');
console.log('  header:', els.brainName.textContent, '/', els.ownerLine.textContent);
console.log('  task  :', els.taskLine.textContent.slice(0, 60));
console.log('  score :', els.bigScore.innerHTML);

/* 4. Drive the controls the way a student would. */
els.btnTrain._h.click();
let frames = 0;
while (rafQueue.length && frames < 4000) { const f = rafQueue.shift(); f(); frames++; }
console.log('train run: ' + frames + ' frames, ' + els.stSteps.textContent + ' examples, score ' + els.bigScore.innerHTML);

els.btnRandom._h.click();
console.log('ask random: shown=' + els.swIn.style.background + ' says=' + els.swGot.style.background + ' correct=' + els.swWant.style.background);

els.pick.value = '#3ca0e0';
els.btnAsk._h.click();
console.log('ask picked colour: says=' + els.swGot.style.background);

els.lesion._h.input({ target: { value: 60 } });
console.log('lesion 60%: alive ' + els.stAlive.textContent + ', score ' + els.bigScore.innerHTML);
els.btnHeal._h.click();
console.log('healed:     alive ' + els.stAlive.textContent + ', score ' + els.bigScore.innerHTML);

els.btnReset._h.click();
console.log('reset:      ' + els.progress.textContent + ' score ' + els.bigScore.innerHTML);

window._resize();
console.log('resize handled');

/* 5. Every relation must load and train through the same path. */
for (const name of Colors.relationNames) {
  const b = new Brain(Object.assign({}, CONFIG, { relation: name }));
  for (let i = 0; i < 500; i++) b.learn(Colors.makeExample(name));
  const e = b.evaluate(name, 60);
  if (!isFinite(e.score) || !isFinite(e.rgbError)) throw new Error('bad numbers for ' + name);
  Viz.drawMap(makeEl('m'), b, name);
}
console.log('all ' + Colors.relationNames.length + ' relations train + render cleanly');
