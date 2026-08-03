/* ============================================================
   presenter.js — the conference shell.

   Owns layout wiring, the keyboard, and the panels. It owns no
   learning: every number on screen is read out of the same Brain
   the student lab UI runs, through the same helpers in shared.js.

   The lab UI at index.html still works and is untouched.
   ============================================================ */

(function () {

  const $ = (id) => document.getElementById(id);

  /* ---- a colourless palette for the canvases ---------------
     viz.js and neuronview.js take their greys from Viz.themes.
     The shipped dark theme is blue-black, which is a hue, and the
     whole point of this build is that no chrome competes with the
     colours under test. So swap the palette on the singletons
     after init rather than editing viz.js, which the brief says to
     reuse unchanged.

     The neuron fill colours stay as they are: those are data, not
     chrome. They say which pathway a cell is on and whether it
     just fired.                                                */

  const RIG = {
    bg:    '#0B0C0C',
    panel: '#17191A',
    text:  '#F2F3F1',
    dim:   '#676D70',
    axis:  '#33383B',
    glow:  'rgba(232,234,230,',
    wire:  'rgba(155,161,163,'
  };

  /* ---- state ----------------------------------------------- */

  let relation = CONFIG.relation;
  if (!Colors.relations[relation]) relation = Colors.relationNames[0];

  const brain = new Brain(CONFIG);

  /* The vote distribution is drawn for ONE fixed colour, so the bars
     are comparable from second to second instead of jumping about
     with whatever example happened to arrive last. */
  const VOTE_PROBE = { h: 0, s: 0.95, v: 0.95 };

  let lesionPct = 0;
  let lastInput = VOTE_PROBE;
  let lastTarget = null;
  let speedIdx = Math.max(0, Shared.SPEEDS.indexOf(CONFIG.trainSpeed || 'slow'));

  /* Spotlight the cell with the most dendrites: the most to look at. */
  let selected = 0;
  for (let j = 1; j < brain.nHid; j++) {
    if (brain.inDeg[j] > brain.inDeg[selected]) selected = j;
  }

  /* ---- canvases -------------------------------------------- */

  Viz.init($('net'), CONFIG);
  NeuronView.init($('cell'), CONFIG);
  Viz.theme = RIG;
  NeuronView.theme = RIG;

  const votesCanvas = $('votes');
  const votesCtx = votesCanvas.getContext('2d');

  function sizeVotes() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = votesCanvas.getBoundingClientRect();
    votesCanvas.width = Math.max(1, Math.floor(rect.width * dpr));
    votesCanvas.height = Math.max(1, Math.floor(rect.height * dpr));
    votesCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
    votesCanvas._w = rect.width;
    votesCanvas._h = rect.height;
  }

  window.addEventListener('resize', () => {
    Viz.resize();
    NeuronView.resize();
    sizeVotes();
    refresh();
  });

  /* ---- header ---------------------------------------------- */

  $('pBrainName').textContent = CONFIG.brainName;
  $('pOwner').textContent = 'built by ' + CONFIG.ownerName;

  function paintConfig() {
    const spread = Shared.wiringSpread(brain);
    const rel = Colors.relations[relation];
    const chips = [
      ['task', rel.label],
      ['neurons', String(brain.nHid)],
      ['wiring', 'each cell hears ' + spread.min + '–' + spread.max + ' of 28'],
      ['fires', Math.round(brain.cfg.fireFraction * 100) + '%'],
      ['learn rate', String(brain.cfg.learningRate)],
      ['seed', String(brain.cfg.seed)]
    ];
    $('pConfig').innerHTML = chips
      .map(([k, v]) => '<span class="chip" data-k="' + k + '">' + k + ' <b>' + v + '</b></span>')
      .join('');
  }

  /* ---- readouts -------------------------------------------
     Every one of these calls runs the network, which overwrites the
     brain's working arrays. So gather everything in one pass and
     then put the display state back before anything draws.
     See _dev/README.md, the mutation list.                     */

  function restoreDisplay() {
    brain.predict(lastInput);
  }

  function refresh() {
    const e = brain.evaluate(relation, 80);
    const vec = Shared.votes(brain, VOTE_PROBE);
    const mode = Shared.bimodality(vec);
    restoreDisplay();

    $('mScore').textContent = Shared.fmt.score(e);
    $('mHue').textContent = Shared.fmt.hue(e);
    $('mConf').textContent = Shared.fmt.conf(e);
    $('mAlive').textContent = Shared.fmt.alive(brain);
    $('mFiring').textContent = Shared.firingCount(brain) + ' firing right now';
    $('pSteps').textContent = Shared.fmt.int(brain.stepsTrained);

    /* "silent" means no hue cell is voting at all. That is two very
       different situations and saying the wrong one is confusing in
       front of a room: an untrained brain has not learned yet, but on
       luminance every correct answer is a grey, so no hue vote is the
       right answer rather than a failure. */
    $('mMode').textContent = mode.mode !== 'silent' ? mode.label
      : brain.stepsTrained === 0 ? 'nothing learned yet'
      : 'no hue vote, every correct answer here is a grey';
    $('mMode').style.color = mode.mode === 'bimodal' ? 'var(--signal)' : 'var(--text-mid)';

    drawVotes(vec, mode);
    draw();
    return e;
  }

  function draw() {
    Viz.draw(brain, { selected });
    NeuronView.draw(brain, selected, { target: lastTarget });
    $('fireNote').innerHTML =
      '<b>' + Shared.firingCount(brain) + '</b> of ' + brain.nHid + ' firing';
  }

  /* ---- the vote distribution -------------------------------
     28 bars, one per output neuron, in input-neuron order so the 16
     hue cells are a contiguous run. One tight spike means the
     network has an answer. Two humps means two answers are equally
     correct and nothing can choose between them.               */

  function drawVotes(vec, mode) {
    const w = votesCanvas._w, h = votesCanvas._h;
    if (!w || !h) return;
    const ctx = votesCtx;
    ctx.clearRect(0, 0, w, h);

    /* Each of the three populations is normalised against its own
       loudest cell, not against all 28 together. That is not a
       flattering choice, it is how decode() actually reads them: hue
       by circular mean across the hue run, vividness and brightness
       each by a peak within their own run. Normalising all 28
       together would let the brightness cells, which carry more
       total weight, visually crush the hue spike that is the whole
       point of this panel. */
    const groups = [[0, HUE_N], [HUE_N, HUE_N + SAT_N], [HUE_N + SAT_N, DIM]];
    const scale = new Float64Array(vec.length);
    for (const [lo, hi] of groups) {
      let gp = 0;
      for (let i = lo; i < hi; i++) if (vec[i] > gp) gp = vec[i];
      for (let i = lo; i < hi; i++) scale[i] = gp > 1e-9 ? vec[i] / gp : 0;
    }

    const n = vec.length;
    const slot = w / n;
    const barW = Math.max(2, slot - 2);
    const base = h - 11;

    // The boundary between the hue run and the two linear runs.
    ctx.strokeStyle = RIG.axis;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, base + 0.5);
    ctx.lineTo(w, base + 0.5);
    ctx.stroke();

    for (const edge of [HUE_N, HUE_N + SAT_N]) {
      const x = Math.round(edge * slot) + 0.5;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, base);
      ctx.stroke();
    }

    for (let i = 0; i < n; i++) {
      const v = scale[i];
      const bh = Math.max(v > 0 ? 1 : 0, v * (base - 2));
      // The hue run is the story, so it is the bright one.
      ctx.fillStyle = i < HUE_N ? RIG.text : RIG.dim;
      ctx.globalAlpha = i < HUE_N ? 0.40 + v * 0.60 : 0.25 + v * 0.35;
      ctx.fillRect(i * slot + 1, base - bh, barW, bh);
    }
    ctx.globalAlpha = 1;

    // Mark each hump so "two answers" is visible, not just asserted.
    if (mode && mode.humps) {
      ctx.fillStyle = RIG.text;
      ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
      ctx.textAlign = 'center';
      for (const hp of mode.humps.slice(0, 2)) {
        const x = hp.at * slot + slot / 2;
        ctx.fillRect(x - 3, base + 3, 6, 2);
        ctx.fillText(Math.round(hp.hue) + '°', x, h - 1);
      }
      ctx.textAlign = 'left';
    }

    ctx.fillStyle = RIG.dim;
    ctx.font = '10px ui-monospace, Menlo, Consolas, monospace';
    ctx.fillText('hue', 2, 9);
    ctx.fillText('vivid', HUE_N * slot + 3, 9);
    ctx.fillText('bright', (HUE_N + SAT_N) * slot + 3, 9);
  }

  /* ---- training -------------------------------------------- */

  const trainer = new Shared.Trainer({
    total: CONFIG.trainingExamples,
    speedIdx: () => speedIdx,
    /* Probes.example() rather than Colors.makeExample(): the 64
       held-out colours are filtered out of the training stream. */
    example: () => Probes.example(relation),
    onExample: (ex) => {
      brain.learn(ex);
      lastInput = ex.input;
      lastTarget = Code.encode(ex.target);
      sinceGrid++;
    },
    onFrame: (t) => {
      if (t.frame % 8 === 0) refresh();
      else draw();
      // Convergence happens fastest in the first few hundred examples,
      // which is exactly when a 200-example cadence leaves a stale
      // number on screen. Re-render often early, then settle down.
      const due = brain.stepsTrained < 600 ? 50 : GRID_EVERY;
      if (sinceGrid >= due) { sinceGrid = 0; renderGrid(); }
      $('pSteps').textContent = Shared.fmt.int(brain.stepsTrained);
    },
    onDone: () => {
      setTrainLabel(false);
      refresh();
      renderGrid();
      if (pendingRetrain) {
        pendingRetrain = false;
        setScore('sRetrain', brain.evaluate(relation, 120).score);
        restoreDisplay();
        say('retrained with ' + lesionPct + '% of the cells still dead');
      } else {
        say('run finished, ' + Shared.fmt.int(brain.stepsTrained) + ' examples seen');
      }
      // The weights changed, so the old curve is wrong. Recompute now
      // rather than on the first drag, which would stall mid-gesture.
      lesionCurve = null;
      computeLesionCurve();
    }
  });

  function setTrainLabel(running) {
    $('pTrain').innerHTML = (running ? 'Pause' : 'Train') + ' <kbd>space</kbd>';
  }

  function say(msg) {
    $('status').textContent = msg;
  }

  function toggleTrain() {
    const running = trainer.toggle(CONFIG.trainingExamples);
    setTrainLabel(running);
    say(running ? 'training' : 'paused');
  }

  function stepOnce() {
    trainer.pause();
    setTrainLabel(false);
    const ex = trainer.once();
    refresh();
    // refresh() ran the network on other colours, so put the example
    // it just learned back on screen before the final draw.
    NeuronView.invalidate();
    lastInput = ex.input;
    restoreDisplay();
    draw();
    say('one example, one Hebbian update');
  }

  function resetWeights() {
    trainer.pause();
    setTrainLabel(false);
    brain.reset();
    applyLesion();
    lastTarget = null;
    NeuronView.invalidate();
    resetTriple();
    lesionCurve = null;
    drawLesionChart();
    refresh();
    renderGrid();
    say('every synapse blank again');
  }

  /* ---- lesion ---------------------------------------------
     brain.lesionTo() is the repeatable mask added in phase 0's
     follow-up, not the built-in lesion(), which shuffles from the
     brain's own stateful generator and so kills a different set on
     every call. Same slider position, same cells, every time.   */

  function applyLesion() {
    brain.lesionTo(lesionPct / 100, Shared.LESION_SEED);
  }

  let lesionTimer = null;

  function onLesionInput(pct) {
    lesionPct = pct;
    $('pLesLabel').textContent = pct;
    if (lesionTimer) clearTimeout(lesionTimer);
    lesionTimer = setTimeout(() => {
      lesionTimer = null;
      applyLesion();
      NeuronView.invalidate();
      const e = refresh();
      renderGrid();
      if (!lesionCurve && brain.stepsTrained > 0) computeLesionCurve();
      drawLesionChart();
      if (lesionCurve) {
        setScore('sBefore', lesionCurve[0].score);
        setScore('sAfter', pct === 0 ? null : e.score);
      }
      say(pct === 0 ? 'all neurons restored, score ' + e.score
                    : pct + '% killed, score ' + e.score);
    }, 60);
  }

  function setScore(id, v) {
    const el = $(id);
    if (v == null) {
      el.textContent = '—';
      el.classList.add('pending');
    } else {
      el.textContent = String(v);
      el.classList.remove('pending');
    }
  }

  function resetTriple() {
    setScore('sBefore', null);
    setScore('sAfter', null);
    setScore('sRetrain', null);
  }

  /* ---- the lesion curve -----------------------------------
     Score against percentage killed, computed by actually killing
     them and actually re-measuring, twenty times. Costs about 110ms,
     so it runs once when a training run finishes rather than on
     every drag. Invalidated by anything that changes the weights. */

  let lesionCurve = null;

  function computeLesionCurve() {
    const keep = lesionPct;
    const pts = [];
    for (let pct = 0; pct <= 95; pct += 5) {
      brain.lesionTo(pct / 100, Shared.LESION_SEED);
      pts.push({ pct, score: brain.evaluate(relation, 60).score });
    }
    brain.lesionTo(keep / 100, Shared.LESION_SEED);
    restoreDisplay();
    lesionCurve = pts;
    drawLesionChart();
    return pts;
  }

  function drawLesionChart() {
    const svg = $('lesionChart');
    const W = 300, H = 72, L = 24, R = 4, T = 6, B = 14;
    const px = (pct) => L + (pct / 95) * (W - L - R);
    const py = (s) => T + (1 - Math.max(0, Math.min(100, s)) / 100) * (H - T - B);
    const parts = [];

    parts.push('<line x1="' + L + '" y1="' + py(0) + '" x2="' + (W - R) +
               '" y2="' + py(0) + '" stroke="#33383B" stroke-width="1"/>');
    parts.push('<text x="0" y="10" fill="#676D70" font-size="9" ' +
               'font-family="ui-monospace, Menlo, monospace">100</text>');
    parts.push('<text x="6" y="' + (py(0) + 3) + '" fill="#676D70" font-size="9" ' +
               'font-family="ui-monospace, Menlo, monospace">0</text>');
    parts.push('<text x="' + L + '" y="' + H + '" fill="#676D70" font-size="9" ' +
               'font-family="ui-monospace, Menlo, monospace">0%</text>');
    parts.push('<text x="' + (W - R) + '" y="' + H + '" fill="#676D70" font-size="9" ' +
               'text-anchor="end" font-family="ui-monospace, Menlo, monospace">95%</text>');

    if (lesionCurve) {
      let d = '';
      lesionCurve.forEach((p, i) => {
        const x0 = px(p.pct), x1 = px(Math.min(95, p.pct + 5)), y = py(p.score);
        d += (i === 0 ? 'M' : 'L') + x0.toFixed(1) + ' ' + y.toFixed(1) +
             ' L' + x1.toFixed(1) + ' ' + y.toFixed(1);
      });
      parts.push('<path d="' + d + '" fill="none" stroke="#9BA1A3" stroke-width="1.5"/>');

      const here = lesionCurve[Math.round(lesionPct / 5)];
      if (here) {
        parts.push('<line x1="' + px(here.pct) + '" y1="' + T + '" x2="' + px(here.pct) +
                   '" y2="' + py(0) + '" stroke="#E8EAE6" stroke-width="1" opacity="0.5"/>');
        parts.push('<circle cx="' + px(here.pct) + '" cy="' + py(here.score) +
                   '" r="3.5" fill="#E8EAE6"/>');
      }
    } else {
      parts.push('<text x="' + (W / 2) + '" y="' + (H / 2) + '" fill="#676D70" font-size="10" ' +
                 'text-anchor="middle" font-family="ui-monospace, Menlo, monospace">' +
                 'train, then drag</text>');
    }

    svg.innerHTML = parts.join('');
  }

  /* ---- retrain the survivors -------------------------------
     Does the damage heal? Keep the mask on and train a fresh run.
     Dead cells never fire, so they never learn: only the survivors
     reorganise. All three numbers stay on screen together. */

  let pendingRetrain = false;

  function retrainLesioned() {
    if (lesionPct === 0) {
      say('kill some neurons first, then retrain the survivors');
      return;
    }
    if (!lesionCurve) computeLesionCurve();
    setScore('sBefore', lesionCurve[0].score);
    setScore('sAfter', brain.evaluate(relation, 120).score);
    setScore('sRetrain', null);
    restoreDisplay();
    pendingRetrain = true;
    trainer.pause();
    trainer.start(CONFIG.trainingExamples);
    setTrainLabel(true);
    say('retraining ' + brain.aliveCount() + ' survivors, ' + lesionPct + '% still dead');
  }

  /* ---- relation switching ---------------------------------- */

  function buildRelationSelect() {
    $('pRelation').innerHTML = Colors.relationNames
      .map((n, i) => '<option value="' + n + '">' + (i + 1) + '  ' +
                     Colors.relations[n].label + '</option>')
      .join('');
    $('pRelation').value = relation;
  }

  function switchRelation(name) {
    if (!Colors.relations[name] || name === relation) return;
    relation = name;
    $('pRelation').value = name;
    trainer.pause();
    brain.reset();
    applyLesion();
    lastTarget = null;
    NeuronView.invalidate();
    resetTriple();
    lesionCurve = null;
    drawLesionChart();
    paintConfig();
    paintStatic();
    refresh();
    renderGrid();
    say('switched to ' + Colors.relations[name].label + ', retraining from scratch');
    trainer.start(CONFIG.trainingExamples);
    setTrainLabel(true);
  }

  /* ---- the help overlay ------------------------------------ */

  const KEYMAP = [
    ['space', 'train, or pause a run in progress'],
    ['s', 'show it one example and stop'],
    ['r', 'reset every learned weight to blank'],
    ['l', 'focus the lesion slider, then arrow keys'],
    ['t', 'the guided tutorial'],
    ['a', 'A/B two brains side by side'],
    ['1 … 6', 'switch which relation it learns'],
    ['?', 'this list'],
    ['esc', 'close any overlay']
  ];

  $('keyList').innerHTML = KEYMAP
    .map(([k, v]) => '<kbd>' + k + '</kbd><span>' + v + '</span>')
    .join('');

  function overlayOpen() {
    return !$('help').hidden;
  }

  function closeOverlays() {
    $('help').hidden = true;
  }

  /* ---- controls -------------------------------------------- */

  $('pTrain').addEventListener('click', toggleTrain);
  $('pStep').addEventListener('click', stepOnce);
  $('pReset').addEventListener('click', resetWeights);
  $('pRetrain').addEventListener('click', retrainLesioned);
  $('pRelation').addEventListener('change', (ev) => switchRelation(ev.target.value));
  $('pLesion').addEventListener('input', (ev) => onLesionInput(Number(ev.target.value)));
  $('pHelp').addEventListener('click', () => { $('help').hidden = !$('help').hidden; });
  $('help').addEventListener('click', closeOverlays);

  $('net').addEventListener('click', (ev) => {
    const rect = $('net').getBoundingClientRect();
    const j = Viz.hiddenAt(ev.clientX - rect.left, ev.clientY - rect.top, brain);
    if (j >= 0) {
      selected = j;
      NeuronView.invalidate();
      draw();
      say('spotlight on neuron #' + j);
    }
  });

  /* ---- keyboard -------------------------------------------
     He is driving this from the far side of a stage, so every
     binding works from anywhere on the page. */

  window.addEventListener('keydown', (ev) => {
    const tag = ev.target && ev.target.tagName;
    if (tag === 'SELECT') return;

    if (ev.key === 'Escape') {
      closeOverlays();
      return;
    }
    if (ev.key === '?' || (ev.key === '/' && ev.shiftKey)) {
      ev.preventDefault();
      $('help').hidden = !$('help').hidden;
      return;
    }
    if (overlayOpen()) return;

    // Arrow keys belong to the slider once it has focus.
    if (tag === 'INPUT' && (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight')) return;

    switch (ev.key) {
      case ' ':
        ev.preventDefault();
        toggleTrain();
        break;
      case 's': case 'S':
        stepOnce();
        break;
      case 'r': case 'R':
        resetWeights();
        break;
      case 'l': case 'L':
        ev.preventDefault();
        $('pLesion').focus();
        say('lesion slider focused, use the arrow keys');
        break;
      case 'a': case 'A':
        say('A/B mode arrives in phase 6');
        break;
      case 't': case 'T':
        say('the tutorial arrives in phase 5');
        break;
      default:
        if (ev.key >= '1' && ev.key <= '6') {
          const name = Colors.relationNames[Number(ev.key) - 1];
          if (name) switchRelation(name);
        }
    }
  });

  /* ---- the prediction grid --------------------------------
     Three rows of 64: the colour shown, what the network answers,
     and the correct answer. The middle row starts as noise and
     settles onto the bottom row.

     The number beside it is the mean hue error over all 64. It is
     the closest thing this architecture allows to a training curve,
     and it is worth saying out loud that it is not a loss curve:
     nothing in the code computes a loss, and nothing compares the
     answer to the target. This is measured from the outside.     */

  const GRID_EVERY = 200;
  let sinceGrid = 0;
  let truthRows = null;
  const cells = { in: [], got: [], want: [] };

  function buildGrid() {
    const map = { in: 'stripIn', got: 'stripGot', want: 'stripWant' };
    for (const key of Object.keys(map)) {
      const box = $(map[key]);
      box.innerHTML = '';
      cells[key] = [];
      for (let i = 0; i < Probes.list.length; i++) {
        cells[key].push(box.appendChild(document.createElement('i')));
      }
    }
  }

  /* The shown row and the correct row only change when the relation
     changes, so they are painted once rather than every 200 examples.
     Ambiguous relations pick one of their two answers per call, so
     the correct row is frozen here and reused, otherwise it would
     flicker for reasons unrelated to learning. */
  function paintStatic() {
    truthRows = Probes.truth(relation);
    for (let i = 0; i < Probes.list.length; i++) {
      const c = Probes.list[i], w = truthRows[i];
      cells.in[i].style.background = Colors.css(Colors.hsv2rgb(c.h, c.s, c.v));
      cells.want[i].style.background = Colors.css(Colors.hsv2rgb(w.h, w.s, w.v));
    }
  }

  function now() {
    return (typeof performance !== 'undefined' && performance.now) ? performance.now() : 0;
  }

  function renderGrid() {
    const t0 = now();
    const r = Probes.answers(brain, relation, truthRows);
    for (let i = 0; i < r.got.length; i++) {
      const g = r.got[i];
      cells.got[i].style.background = Colors.css(Colors.hsv2rgb(g.h, g.s, g.v));
    }
    const ms = now() - t0;
    restoreDisplay();
    $('gridErr').innerHTML =
      'mean hue error <b>' + Shared.fmt.deg(r.hueError) + '</b>' +
      '<span style="color:var(--text-lo)"> &nbsp;64 held out, ' +
      Probes.rejected + ' refused by the trainer &nbsp;' + ms.toFixed(1) + 'ms</span>';
    return r;
  }

  /* ---- start ----------------------------------------------- */

  buildRelationSelect();
  paintConfig();
  sizeVotes();
  resetTriple();
  buildGrid();
  paintStatic();
  drawLesionChart();
  refresh();
  renderGrid();
  say('ready. press space to train, ? for keys');

  /* presenter.html#train starts a run on load. Used by the headless
     screenshot checks in _dev, and handy if the laptop is already on
     the projector before the room fills up. */
  if (typeof location !== 'undefined' && location.hash === '#train') {
    speedIdx = Shared.SPEEDS.indexOf('fast');
    toggleTrain();
  }

})();
