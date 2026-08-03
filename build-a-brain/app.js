/* ============================================================
   app.js — the buttons, the training loop, the readouts.

   You probably do not need to change this file either.
   ============================================================ */

(function () {

  const rel = Colors.relations[CONFIG.relation];
  if (!rel) {
    document.body.innerHTML =
      '<p style="padding:40px;font-family:monospace">' +
      'config.js has relation: "' + CONFIG.relation + '", which does not exist.<br>' +
      'Pick one of: ' + Colors.relationNames.join(', ') + '</p>';
    return;
  }

  if (CONFIG.theme === 'light') document.body.classList.add('light');

  document.getElementById('brainName').textContent = CONFIG.brainName;
  document.getElementById('ownerLine').textContent = 'built by ' + CONFIG.ownerName;
  document.getElementById('taskLine').textContent = rel.label + ' — ' + rel.blurb;

  const brain = new Brain(CONFIG);
  const netCanvas = document.getElementById('net');
  const cellCanvas = document.getElementById('cell');
  const mapCanvas = document.getElementById('map');
  const sparkCanvas = document.getElementById('spark');

  Viz.init(netCanvas, CONFIG);
  NeuronView.init(cellCanvas, CONFIG);
  window.addEventListener('resize', () => {
    Viz.resize(); NeuronView.resize(); redraw();
  });

  let history = [];
  let training = false;
  let remaining = 0;
  let frame = 0;
  let lesionPct = 0;
  let lastTarget = null;

  /* Which neuron is in the spotlight below. Start on the one with
     the most dendrites — it is the most interesting to look at. */
  let selected = 0;
  for (let j = 1; j < brain.nHid; j++) {
    if (brain.inDeg[j] > brain.inDeg[selected]) selected = j;
  }

  const $ = (id) => document.getElementById(id);

  function redraw() {
    Viz.draw(brain, { selected });
    NeuronView.draw(brain, selected, { target: lastTarget });
  }

  /* ---- how fast to train ----------------------------------
     Slow is one example per frame, so you can actually watch a
     single Hebbian update happen. */

  const SPEEDS = ['slow', 'normal', 'fast'];
  let speedIdx = Math.max(0, SPEEDS.indexOf(CONFIG.trainSpeed || 'slow'));

  function perFrame() {
    if (SPEEDS[speedIdx] === 'slow') return 1;
    if (SPEEDS[speedIdx] === 'fast') return Math.max(1, Math.round(CONFIG.trainingExamples / 120));
    return Math.max(1, Math.round(CONFIG.trainingExamples / 900));
  }

  /* ---- readouts ------------------------------------------- */

  function refreshStats() {
    const e = brain.evaluate(CONFIG.relation, 80);
    $('bigScore').innerHTML = e.score + '<small> / 100</small>';
    $('stHue').textContent = e.hueError === null ? 'n/a' : e.hueError.toFixed(1) + '°';
    $('stConf').textContent = (e.confidence * 100).toFixed(0) + '%';
    $('stSteps').textContent = brain.stepsTrained.toLocaleString();
    $('stAlive').textContent = brain.aliveCount() + ' / ' + brain.nHid;
    return e;
  }

  function refreshPanels() {
    Viz.drawMap(mapCanvas, brain, CONFIG.relation);
    Viz.drawHistory(sparkCanvas, history);
  }

  function ask(color) {
    const got = brain.predict(color);
    const want = rel.apply(color);
    $('swIn').style.background = Colors.css(Colors.hsv2rgb(color.h, color.s, color.v));
    $('swGot').style.background = Colors.css(Colors.hsv2rgb(got.h, got.s, got.v));
    $('swWant').style.background = Colors.css(Colors.hsv2rgb(want.h, want.s, want.v));
    lastTarget = null;
    redraw();
  }

  /* ---- the training loop ----------------------------------
     We train a few examples per animation frame rather than all
     at once, so that you can actually watch the synapses grow. */

  function loop() {
    if (!training) return;

    const n = perFrame();
    for (let i = 0; i < n && remaining > 0; i++) {
      const ex = Colors.makeExample(CONFIG.relation);
      brain.learn(ex);
      lastTarget = Code.encode(ex.target);
      remaining--;
    }

    redraw();

    if (frame % 20 === 0) {
      const e = refreshStats();
      history.push(e.score);
      if (history.length > 220) history.shift();
      refreshPanels();
    }
    frame++;

    if (remaining <= 0) {
      training = false;
      $('btnTrain').textContent = 'Train again';
      $('btnTrain').disabled = false;
      $('progress').textContent =
        'Trained on ' + brain.stepsTrained.toLocaleString() + ' example colours.';
      refreshStats();
      refreshPanels();
      return;
    }

    $('progress').textContent =
      'Training… ' + (CONFIG.trainingExamples - remaining).toLocaleString() +
      ' / ' + CONFIG.trainingExamples.toLocaleString();

    requestAnimationFrame(loop);
  }

  /* ---- controls ------------------------------------------- */

  $('btnTrain').addEventListener('click', () => {
    if (training) return;
    training = true;
    remaining = CONFIG.trainingExamples;
    frame = 0;
    $('btnTrain').disabled = true;
    $('btnTrain').textContent = 'Training…';
    requestAnimationFrame(loop);
  });

  $('btnReset').addEventListener('click', () => {
    training = false;
    brain.reset();
    applyLesion();
    history = [];
    $('btnTrain').disabled = false;
    $('btnTrain').textContent = 'Train';
    $('progress').textContent = 'Forgotten. Every synapse is blank again.';
    lastTarget = null;
    NeuronView.invalidate();
    refreshStats();
    refreshPanels();
    redraw();
  });

  /* One example, one Hebbian update, redrawn. This is the button
     that makes learning visible. */
  $('btnStep').addEventListener('click', () => {
    const ex = Colors.makeExample(CONFIG.relation);
    brain.learn(ex);
    lastTarget = Code.encode(ex.target);
    refreshStats();
    refreshPanels();
    // refreshStats/refreshPanels run the brain on other colours, so
    // put the example we just learned back on screen before drawing.
    NeuronView.invalidate();
    brain.think(Code.encode(ex.input));
    $('progress').textContent =
      'Stepped. ' + brain.stepsTrained.toLocaleString() + ' example colours seen.';
    redraw();
  });

  $('speed').addEventListener('input', (ev) => {
    speedIdx = Number(ev.target.value);
    $('spdLabel').textContent = SPEEDS[speedIdx];
  });

  /* Click a neuron in the crowd to put it in the spotlight. */
  netCanvas.addEventListener('click', (ev) => {
    const rect = netCanvas.getBoundingClientRect();
    const j = Viz.hiddenAt(ev.clientX - rect.left, ev.clientY - rect.top, brain);
    if (j >= 0) { selected = j; NeuronView.invalidate(); redraw(); }
  });

  $('btnAsk').addEventListener('click', () => {
    const hex = $('pick').value;
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;
    ask(Colors.rgb2hsv(r, g, b));
  });

  $('btnRandom').addEventListener('click', () => {
    const c = Colors.randomColor();
    const rgb = Colors.hsv2rgb(c.h, c.s, c.v);
    const q = (n) => Math.round(n * 255).toString(16).padStart(2, '0');
    $('pick').value = '#' + q(rgb.r) + q(rgb.g) + q(rgb.b);
    ask(c);
  });

  function applyLesion() {
    brain.heal();
    if (lesionPct > 0) brain.lesion(lesionPct / 100);
  }

  $('lesion').addEventListener('input', (ev) => {
    lesionPct = Number(ev.target.value);
    $('lesLabel').textContent = lesionPct;
    applyLesion();
    NeuronView.invalidate();
    refreshStats();
    refreshPanels();
    redraw();
  });

  $('btnHeal').addEventListener('click', () => {
    lesionPct = 0;
    $('lesion').value = 0;
    $('lesLabel').textContent = '0';
    brain.heal();
    NeuronView.invalidate();
    refreshStats();
    refreshPanels();
    redraw();
  });

  /* ---- start ---------------------------------------------- */
  $('spdLabel').textContent = SPEEDS[speedIdx];
  $('speed').value = String(speedIdx);
  refreshStats();
  refreshPanels();
  ask(Colors.randomColor());
})();
