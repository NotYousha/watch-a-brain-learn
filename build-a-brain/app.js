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
  const mapCanvas = document.getElementById('map');
  const sparkCanvas = document.getElementById('spark');

  Viz.init(netCanvas, CONFIG);
  window.addEventListener('resize', () => { Viz.resize(); Viz.draw(brain, {}); });

  let history = [];
  let training = false;
  let remaining = 0;
  let frame = 0;
  let lesionPct = 0;

  const $ = (id) => document.getElementById(id);

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
    Viz.draw(brain, {});
  }

  /* ---- the training loop ----------------------------------
     We train a few examples per animation frame rather than all
     at once, so that you can actually watch the synapses grow. */

  function loop() {
    if (!training) return;

    const perFrame = Math.max(1, Math.round(CONFIG.trainingExamples / 900));
    for (let i = 0; i < perFrame && remaining > 0; i++) {
      brain.learn(Colors.makeExample(CONFIG.relation));
      remaining--;
    }

    Viz.draw(brain, {});

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
    refreshStats();
    refreshPanels();
    Viz.draw(brain, {});
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
    refreshStats();
    refreshPanels();
    Viz.draw(brain, {});
  });

  $('btnHeal').addEventListener('click', () => {
    lesionPct = 0;
    $('lesion').value = 0;
    $('lesLabel').textContent = '0';
    brain.heal();
    refreshStats();
    refreshPanels();
    Viz.draw(brain, {});
  });

  /* ---- start ---------------------------------------------- */
  refreshStats();
  refreshPanels();
  ask(Colors.randomColor());
})();
