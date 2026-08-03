/* Dev-only. Runs the browser code under a fake DOM to catch
   reference errors and missing element IDs.  node _verify_ui.js

   Two pages are checked: index.html, the student lab UI, and
   presenter.html, the conference shell. Each gets its own fake DOM,
   because Viz and NeuronView are singletons and booting both pages
   into one scope would have them fight over the same canvases. */

const fs = require('fs');
const D = __dirname + '/';
const read = (f) => fs.readFileSync(D + f, 'utf8');

/* ---- 1. static consistency -------------------------------
   Every element id referenced by ANY script a page loads must exist
   in that page. Scanning app.js on its own stopped being enough the
   moment shared logic moved into shared.js, and it would miss
   presenter.js entirely. */

function idsReferencedBy(files) {
  const out = [];
  for (const f of files) {
    const s = read(f);
    out.push(...[...s.matchAll(/getElementById\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));
    out.push(...[...s.matchAll(/\$\(['"]([^'"]+)['"]\)/g)].map(m => m[1]));   // the $() helper
  }
  return out;
}

function checkPage(htmlFile) {
  const page = read(htmlFile);
  const ids = new Set([...page.matchAll(/id="([^"]+)"/g)].map(m => m[1]));
  const srcs = [...page.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]);
  const badSrc = srcs.filter(s => !fs.existsSync(D + s));
  const wanted = new Set(idsReferencedBy(srcs.filter(s => fs.existsSync(D + s))));
  const missing = [...wanted].filter(id => !ids.has(id));
  console.log(htmlFile.padEnd(15),
              String(wanted.size).padStart(3) + ' ids across ' + srcs.length + ' scripts',
              '| missing ids:', missing.length ? missing.join(', ') : 'none',
              '| missing scripts:', badSrc.length ? badSrc.join(', ') : 'none');
  if (missing.length || badSrc.length) throw new Error(htmlFile + ' is inconsistent');
  return srcs;
}

const labScripts = checkPage('index.html');
const presScripts = fs.existsSync(D + 'presenter.html') ? checkPage('presenter.html') : null;

/* ---- 2. a fake DOM --------------------------------------- */

const gradStub = { addColorStop() {} };
const ctxStub = new Proxy({}, {
  get: (t, k) => {
    if (k in t) return t[k];
    if (k === 'createRadialGradient' || k === 'createLinearGradient') return () => gradStub;
    if (k === 'measureText') return () => ({ width: 20 });
    return () => {};
  },
  set: (t, k, v) => { t[k] = v; return true; }
});

/* Which ids carry the hidden attribute in the markup. Without this
   the fake DOM reports every overlay as already open, and a keydown
   handler that ignores keys while an overlay is up looks broken. */
function hiddenIds(html) {
  const set = new Set();
  for (const m of html.matchAll(/<[^>]*\sid="([^"]+)"[^>]*>/g)) {
    if (/\shidden(\s|=|>|\/)/.test(m[0])) set.add(m[1]);
  }
  return set;
}

function harness(pageHtml) {
  const els = {};
  const rafQueue = [];
  const startsHidden = hiddenIds(pageHtml || '');

  function makeEl(id) {
    return {
      id, style: {}, textContent: '', innerHTML: '', value: '#e03c3c',
      hidden: startsHidden.has(id), width: 800, height: 400, tagName: 'DIV',
      children: [], dataset: {},
      classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
      setAttribute() {}, removeAttribute() {}, getAttribute: () => null,
      focus() { this._focused = true; }, blur() { this._focused = false; },
      appendChild(c) { this.children.push(c); return c; },
      querySelector: () => null,
      querySelectorAll: () => [],
      addEventListener(ev, fn) { (this._h ||= {})[ev] = fn; },
      removeEventListener() {},
      getContext: () => ctxStub,
      getBoundingClientRect: () => ({ width: 800, height: 400, left: 0, top: 0, right: 800, bottom: 400 })
    };
  }

  const document = {
    body: {
      classList: { add() {}, remove() {} },
      appendChild(c) { return c; },
      set innerHTML(v) { throw new Error('page bailed out: ' + v.slice(0, 140)); }
    },
    documentElement: makeEl('html'),
    getElementById: (id) => (els[id] ||= makeEl(id)),
    createElement: (tag) => { const e = makeEl('new-' + tag); e.tagName = tag.toUpperCase(); return e; },
    createElementNS: (ns, tag) => { const e = makeEl('new-' + tag); e.tagName = tag; return e; },
    querySelector: (sel) => els[String(sel).replace(/^#/, '')] || null,
    querySelectorAll: () => [],
    addEventListener(ev, fn) { (this._h ||= {})[ev] = fn; }
  };

  const window = {
    devicePixelRatio: 2,
    innerWidth: 1920, innerHeight: 1080,
    addEventListener: (ev, fn) => { window['_' + ev] = fn; },
    removeEventListener: () => {},
    getComputedStyle: () => ({ getPropertyValue: () => '' }),
    matchMedia: () => ({ matches: false, addEventListener() {} })
  };

  const requestAnimationFrame = (fn) => { rafQueue.push(fn); };

  return {
    els, document, window, rafQueue, requestAnimationFrame,
    run(files) {
      const src = files.map(read).join('\n');
      const ret = '\nreturn { Colors, Brain, Viz, NeuronView, CONFIG, Shared,' +
        ' Probes: typeof Probes !== "undefined" ? Probes : null,' +
        ' Tour: typeof Tour !== "undefined" ? Tour : null,' +
        ' TourUI: typeof TourUI !== "undefined" ? TourUI : null,' +
        ' AB: typeof AB !== "undefined" ? AB : null };';
      return new Function('document', 'window', 'requestAnimationFrame', src + ret)(
        document, window, requestAnimationFrame);
    },
    pump(max) {
      let n = 0;
      while (rafQueue.length && n < max) { rafQueue.shift()(); n++; }
      return n;
    }
  };
}

/* ---- 3. the student lab UI ------------------------------- */

console.log('\n-- index.html, the student lab --');

const lab = harness(read('index.html'));
const globals = lab.run(labScripts);
const { Colors, Brain, Viz, NeuronView, CONFIG } = globals;
const els = lab.els;

console.log('page loaded without error');
console.log('  header:', els.brainName.textContent, '/', els.ownerLine.textContent);
console.log('  task  :', els.taskLine.textContent.slice(0, 60));
console.log('  score :', els.bigScore.innerHTML);

els.btnTrain._h.click();
const frames = lab.pump(4000);
console.log('train run: ' + frames + ' frames, ' + els.stSteps.textContent +
            ' examples, score ' + els.bigScore.innerHTML);

els.btnStep._h.click();
console.log('step x1:    ' + els.progress.textContent);

els.speed._h.input({ target: { value: 2 } });
console.log('speed:      ' + els.spdLabel.textContent);

els.net._h.click({ clientX: 400, clientY: 120 });
console.log('clicked the crowd: spotlight moved without error');

els.btnRandom._h.click();
console.log('ask random: shown=' + els.swIn.style.background +
            ' says=' + els.swGot.style.background +
            ' correct=' + els.swWant.style.background);

els.pick.value = '#3ca0e0';
els.btnAsk._h.click();
console.log('ask picked colour: says=' + els.swGot.style.background);

els.lesion._h.input({ target: { value: 60 } });
console.log('lesion 60%: alive ' + els.stAlive.textContent + ', score ' + els.bigScore.innerHTML);
els.btnHeal._h.click();
console.log('healed:     alive ' + els.stAlive.textContent + ', score ' + els.bigScore.innerHTML);

els.btnReset._h.click();
console.log('reset:      ' + els.progress.textContent + ' score ' + els.bigScore.innerHTML);

lab.window._resize();
console.log('resize handled');

/* ---- 4. every relation, through the same path ------------ */

for (const name of Colors.relationNames) {
  const b = new Brain(Object.assign({}, CONFIG, { relation: name }));
  for (let i = 0; i < 500; i++) b.learn(Colors.makeExample(name));
  const e = b.evaluate(name, 60);
  if (!isFinite(e.score) || !isFinite(e.rgbError)) throw new Error('bad numbers for ' + name);
  Viz.drawMap({ getContext: () => ctxStub, getBoundingClientRect: () => ({ width: 300, height: 80 }) }, b, name);
}
console.log('all ' + Colors.relationNames.length + ' relations train + render cleanly');

/* ---- 5. the repeatable lesion mask ----------------------- */

{
  const b = new Brain(CONFIG);
  for (let i = 0; i < 4000; i++) b.learn(Colors.makeExample(CONFIG.relation));
  const sig = () => Array.from(b.alive).join('');
  b.lesionTo(0.4, 20260803); const a1 = sig();
  b.lesionTo(0.0, 20260803);
  b.lesionTo(0.4, 20260803); const a2 = sig();
  if (a1 !== a2) throw new Error('lesionTo is not repeatable');
  b.lesionTo(0.2, 20260803); const small = sig();
  b.lesionTo(0.4, 20260803); const big = sig();
  for (let j = 0; j < b.nHid; j++) {
    if (small[j] === '0' && big[j] !== '0') throw new Error('lesion sets are not nested');
  }
  b.lesionTo(0, 20260803);
  if (b.aliveCount() !== b.nHid) throw new Error('lesion did not fully revert');
  const snap = b.snapshot();
  const before = b.evaluate(CONFIG.relation, 60).score;
  b.reset();
  b.restore(snap);
  const after = b.evaluate(CONFIG.relation, 60).score;
  if (Math.abs(before - after) > 6) throw new Error('snapshot/restore lost the weights');
  console.log('lesion mask: repeatable, nested, fully reversible | snapshot restores (' +
              before + ' -> ' + after + ')');

  /* Graceful degradation is the claim the whole last third of the
     talk rests on, so assert its shape rather than trusting it. */
  b.lesionTo(0, 20260803);
  const at0 = b.evaluate(CONFIG.relation, 300).score;
  b.lesionTo(0.4, 20260803);
  const at40 = b.evaluate(CONFIG.relation, 300).score;
  b.lesionTo(0.95, 20260803);
  const at95 = b.evaluate(CONFIG.relation, 300).score;
  b.lesionTo(0, 20260803);
  const back = b.evaluate(CONFIG.relation, 300).score;
  console.log('lesion curve: 0% ' + at0 + ' | 40% ' + at40 + ' | 95% ' + at95 +
              ' | back to 0% ' + back + ' (' + b.aliveCount() + ' alive)');
  if (Math.abs(at40 - at0) > 6) throw new Error('40% should barely move the score');
  if (at95 > at0 - 15) throw new Error('95% should visibly degrade the score');
  if (at95 < 30) throw new Error('95% should degrade, not collapse');
  if (Math.abs(back - at0) > 4) throw new Error('lesion did not fully reverse');
}

/* ---- 6. what the confidence widget claims ----------------
   The talk rests on this: an unambiguous relation votes as one
   spike, an ambiguous one visibly votes for two answers at once and
   the confidence collapses. If that ever stops being true, the
   verifier should say so before a room full of engineers does. */

{
  const Shared = globals.Shared;
  const probe = { h: 0, s: 0.95, v: 0.95 };

  function shapeOf(rel) {
    const b = new Brain(Object.assign({}, CONFIG, { relation: rel }));
    for (let i = 0; i < 4000; i++) b.learn(Colors.makeExample(rel));
    return {
      mode: Shared.bimodality(Shared.votes(b, probe)),
      conf: b.evaluate(rel, 200).confidence
    };
  }

  const one = shapeOf('complement');
  const two = shapeOf('triadic');
  console.log('vote shape  complement: ' + one.mode.label +
              ', confidence ' + Math.round(one.conf * 100) + '%');
  console.log('vote shape  triadic:    ' + two.mode.label +
              ', confidence ' + Math.round(two.conf * 100) + '%');
  if (one.mode.mode !== 'unimodal') throw new Error('complement should vote as one spike');
  if (two.mode.mode !== 'bimodal') throw new Error('triadic should vote for two answers');
  if (two.conf >= one.conf) throw new Error('ambiguity should collapse confidence');
}

/* ---- 7. the presenter shell ------------------------------ */

if (presScripts) (async () => {
  console.log('\n-- presenter.html, the conference shell --');

  const p = harness(read('presenter.html'));
  const g = p.run(presScripts);
  const pe = p.els;
  console.log('shell loaded without error');
  console.log('  header:', pe.pBrainName.textContent, '|', pe.pOwner.textContent);
  console.log('  metrics: score', pe.mScore.textContent, '| hue', pe.mHue.textContent,
              '| conf', pe.mConf.textContent, '| alive', pe.mAlive.textContent);

  /* The held-out set has to be provably held out, not just described
     as held out, because that is the whole basis for the numbers. */
  const P = g.Probes;
  if (P.list.length !== 64) throw new Error('expected 64 probes, got ' + P.list.length);
  if (!P.list.every((c) => P.isHeldOut(c))) throw new Error('a probe is not recognised as held out');
  let leaked = 0;
  for (let i = 0; i < 20000; i++) {
    if (P.isHeldOut(P.example(g.CONFIG.relation).input)) leaked++;
  }
  if (leaked) throw new Error(leaked + ' probe colours leaked into the training stream');
  console.log('held-out set: 64 probes, 0 of 20000 training colours landed on one, ' +
              P.rejected + ' refused');

  {
    const b = new g.Brain(g.CONFIG);
    const before = P.answers(b, 'complement').hueError;
    for (let i = 0; i < 4000; i++) b.learn(P.example('complement'));
    const after = P.answers(b, 'complement').hueError;
    console.log('held-out hue error: ' + before.toFixed(1) + ' deg -> ' + after.toFixed(1) + ' deg');
    if (!(after < before / 3)) throw new Error('held-out error did not converge');
  }

  const key = (k, extra) => p.window._keydown(Object.assign(
    { key: k, target: { tagName: 'BODY' }, preventDefault() {} }, extra || {}));

  key(' ');
  const pf = p.pump(600);
  console.log('space train: ' + pf + ' frames, ' + pe.pSteps.textContent + ' examples, score ' +
              pe.mScore.textContent + ', mode ' + pe.mMode.textContent);
  key(' ');
  console.log('space pause: ' + pe.status.textContent);

  key('s');
  console.log('s step:      ' + pe.status.textContent);

  key('?');
  if (pe.help.hidden) throw new Error('? did not open the shortcuts overlay');
  key('Escape');
  if (!pe.help.hidden) throw new Error('esc did not close the overlay');
  console.log('? and esc:   overlay opens and closes');

  key('l');
  if (!pe.pLesion._focused) throw new Error('l did not focus the lesion slider');
  console.log('l:           lesion slider focused');

  /* Big mode must be safe to press mid-run: it resizes canvases and
     must not touch the trainer, the example count, or the brain. */
  key(' ');                                   // start a run
  const runningBefore = pe.pTrain.innerHTML.indexOf('Pause') >= 0;
  p.pump(60);
  const stepsBeforeBig = pe.pSteps.textContent;
  key('b');
  if (pe.pBig.innerHTML.indexOf('Smaller') < 0) throw new Error('b did not enter big mode');
  p.pump(60);
  if (pe.pSteps.textContent === stepsBeforeBig) {
    throw new Error('training stopped when big mode was toggled');
  }
  if (pe.pTrain.innerHTML.indexOf('Pause') < 0 || !runningBefore) {
    throw new Error('big mode changed the training state');
  }
  key('b');
  if (pe.pBig.innerHTML.indexOf('Bigger') < 0) throw new Error('b did not leave big mode');
  p.pump(60);
  console.log('b:           big mode toggles both ways mid-run, ' +
              stepsBeforeBig + ' -> ' + pe.pSteps.textContent + ' examples, run still going');
  key(' ');                                   // pause again

  /* All six relations must switch, retrain and read out cleanly, not
     just the three that were spot-checked. Keys 1 to 6 in order. */
  for (let i = 1; i <= 6; i++) {
    key(String(i));
    p.pump(120);
    const want = g.Colors.relationNames[i - 1];
    if (pe.pRelation.value !== want) {
      throw new Error('key ' + i + ' selected ' + pe.pRelation.value + ', expected ' + want);
    }
    if (!pe.mScore.textContent || pe.mScore.textContent === '—') {
      throw new Error('relation ' + want + ' produced no score');
    }
    if (!pe.mMode.textContent || /\{/.test(pe.mMode.textContent)) {
      throw new Error('relation ' + want + ' produced no vote readout');
    }
    console.log('  key ' + i + ' ' + want.padEnd(17) + 'score ' + pe.mScore.textContent.padStart(3) +
                ' | hue ' + pe.mHue.textContent.padStart(6) + ' | ' + pe.mMode.textContent);
  }

  // Back to a trained brain, then drive the lesion slider. It
  // debounces at 60ms, so each change needs a moment to land.
  // Switching relation starts its own run, so do not also press space:
  // that would toggle the run it just started straight back off.
  key('1');
  p.pump(2500);

  pe.pLesion._h.input({ target: { value: 40 } });
  await new Promise(r => setTimeout(r, 140));
  console.log('lesion 40%:  alive ' + pe.mAlive.textContent + ', ' + pe.status.textContent);
  if (!/<path/.test(pe.lesionChart.innerHTML)) {
    throw new Error('the lesion step chart drew no curve');
  }
  if (pe.sBefore.textContent === '—' || pe.sAfter.textContent === '—') {
    throw new Error('before/lesioned scores did not populate');
  }
  console.log('step chart:  curve drawn | before ' + pe.sBefore.textContent +
              ' | lesioned ' + pe.sAfter.textContent);

  pe.pRetrain._h.click();
  p.pump(4000);
  await new Promise(r => setTimeout(r, 20));
  console.log('retrain:     ' + pe.status.textContent);
  if (pe.sRetrain.textContent === '—') throw new Error('retrain produced no third number');
  console.log('three scores: before ' + pe.sBefore.textContent + ' | lesioned ' +
              pe.sAfter.textContent + ' | retrained ' + pe.sRetrain.textContent);

  pe.pLesion._h.input({ target: { value: 0 } });
  await new Promise(r => setTimeout(r, 140));
  console.log('lesion 0%:   alive ' + pe.mAlive.textContent + ', ' + pe.status.textContent);

  /* ---- the tutorial ----------------------------------------
     Every stop must resolve a target without throwing, must leave no
     unresolved {placeholder} in its copy, and escaping out must put
     the brain back exactly as it was found. */

  const T = g.TourUI, Stops = g.Tour;
  key('1');
  p.pump(2500);
  const wasRel = pe.pRelation.value;
  const wasSteps = pe.pSteps.textContent;

  T.enter();
  for (let i = 0; i < Stops.stops.length; i++) {
    await T.go(i);
    p.pump(60);
    const stop = Stops.stops[i];
    const title = pe.tourTitle.textContent;
    const body = pe.tourBody.textContent;
    if (!title || !body) throw new Error('stop ' + (i + 1) + ' (' + stop.id + ') has no copy');
    if (/\{\w+\}/.test(title + body)) {
      throw new Error('stop ' + (i + 1) + ' (' + stop.id + ') left an unresolved placeholder');
    }
    if (pe.tourProgress.textContent !== (i + 1) + ' / ' + Stops.stops.length) {
      throw new Error('stop ' + (i + 1) + ' progress label is wrong');
    }
    console.log('  ' + String(i + 1).padStart(2) + '/' + Stops.stops.length + ' ' +
                stop.id.padEnd(13) + title.slice(0, 46));
  }
  T.exit();
  if (pe.pRelation.value !== wasRel) throw new Error('exiting the tour changed the relation');
  if (pe.pSteps.textContent !== wasSteps) {
    throw new Error('exiting the tour left the brain at ' + pe.pSteps.textContent +
                    ' examples instead of ' + wasSteps);
  }
  if (!pe.tourCard.hidden || !pe.spot.hidden) throw new Error('the tour did not close');
  console.log('tour: all ' + Stops.stops.length + ' stops resolved, esc restored ' +
              wasSteps + ' examples on ' + wasRel);

  /* ---- A/B mode --------------------------------------------
     Two real brains, and both must see the same examples in the same
     order. If the streams drift the comparison is noise and someone
     in the room will say so. */

  const ABm = g.AB;
  key('a');
  if (!ABm.live) throw new Error('a did not open A/B mode');
  if (!ABm.side.a.brain || !ABm.side.b.brain) throw new Error('A/B did not build two brains');
  if (ABm.side.a.brain === ABm.side.b.brain) throw new Error('A/B is showing one brain twice');

  ABm.toggleRun();
  p.pump(1500);
  const sa = ABm.side.a.brain.stepsTrained, sb = ABm.side.b.brain.stepsTrained;
  if (sa !== sb) throw new Error('A saw ' + sa + ' examples and B saw ' + sb);
  if (sa === 0) throw new Error('A/B trained nothing');
  console.log('A/B: two brains, both at ' + sa + ' identical examples | A score ' +
              ABm.side.a.score.textContent + ' hue ' + ABm.side.a.hue.textContent +
              ' | B score ' + ABm.side.b.score.textContent + ' hue ' + ABm.side.b.hue.textContent);

  for (let i = 0; i < ABm.PRESETS.length; i++) {
    ABm.load(i);
    if (!ABm.side.a.brain || !ABm.side.b.brain) {
      throw new Error('preset ' + ABm.PRESETS[i].id + ' failed to build');
    }
  }
  console.log('A/B: all ' + ABm.PRESETS.length + ' presets build two brains and a shared stream');

  key('Escape');
  if (ABm.live) throw new Error('escape did not leave A/B mode');
  if (!pe.ab.hidden) throw new Error('A/B section stayed visible');
  console.log('A/B: escape returns to the single brain');

  key('r');
  console.log('r reset:     ' + pe.status.textContent);

  p.window._resize();
  console.log('resize handled');
  console.log('\npresenter shell OK');
})().catch(e => { console.error('\nPRESENTER CHECK FAILED:', e.message); process.exit(1); });
