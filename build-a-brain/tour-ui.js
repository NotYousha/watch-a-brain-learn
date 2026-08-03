/* ============================================================
   tour-ui.js — HOW THE TUTORIAL WORKS. Mechanics only.

   No copy lives here. The twelve stops are in tour.js, which can be
   rewritten without touching this file.

   What this owns:
     the spotlight cut-out, as one SVG mask
     the card, and which side of the target it sits on
     navigation, the keyboard, and click to advance
     snapshotting the brain on entry and restoring it on exit
     narration, which is off until switched on and never autoplays
   ============================================================ */

const TourUI = {

  ctx: null,
  at: -1,
  live: false,
  saved: null,
  narrate: false,
  audio: null,

  /* ---- rectangles ------------------------------------------
     Anything drawn inside a canvas has no element to point at, so
     its position is worked out here.

     The neuron view numbers below mirror the layout constants in
     neuronview.js draw(). That is a real coupling and it is
     deliberate: the alternative was adding a geometry export to
     neuronview.js, which phase 9 has to ship as a self-contained
     pull request upstream. If the neuron view layout changes, these
     move with it.                                                */

  rect: {
    el(sel) {
      if (/^#[\w-]+$/.test(sel) && document.getElementById) {
        const byId = document.getElementById(sel.slice(1));
        if (byId && byId.getBoundingClientRect) return byId.getBoundingClientRect();
      }
      const e = document.querySelector ? document.querySelector(sel) : null;
      return e && e.getBoundingClientRect ? e.getBoundingClientRect() : null;
    },

    net() { return TourUI.rect.el('#net'); },
    cell() { return TourUI.rect.el('#cell'); },

    /* viz.js puts the input column at x = w * 0.10, running from
       y = h * 0.10 to h * 0.90. */
    inputColumn() {
      const r = TourUI.rect.net();
      if (!r) return null;
      const pad = 18;
      return {
        left: r.left + r.width * 0.10 - pad,
        top: r.top + r.height * 0.10 - pad,
        width: pad * 2,
        height: r.height * 0.80 + pad * 2
      };
    },

    /* neuronview.js: cy = h*0.52, somaX = w*0.34,
       somaR = max(16, min(h*0.19, 46)), trunkX = w*0.70, termX = w*0.86,
       dendrite reach = somaX - w*0.045. */
    _cellGeom() {
      const r = TourUI.rect.cell();
      if (!r) return null;
      const w = r.width, h = r.height;
      const somaX = w * 0.34;
      return {
        r, w, h,
        cy: h * 0.52,
        somaX,
        somaR: Math.max(16, Math.min(h * 0.19, 46)),
        trunkX: w * 0.70,
        termX: w * 0.86,
        reach: somaX - w * 0.045
      };
    },

    dendrites() {
      const g = TourUI.rect._cellGeom();
      if (!g) return null;
      return {
        left: g.r.left + g.w * 0.025,
        top: g.r.top + g.cy - g.h * 0.34,
        width: g.somaX - g.w * 0.025 + 6,
        height: g.h * 0.68
      };
    },

    /* One branch near the top of the fan, plus room for its label. */
    oneDendrite() {
      const g = TourUI.rect._cellGeom();
      if (!g) return null;
      return {
        left: g.r.left + g.w * 0.03,
        top: g.r.top + g.cy - g.reach * 0.46,
        width: Math.max(90, g.w * 0.16),
        height: Math.max(56, g.h * 0.20)
      };
    },

    soma() {
      const g = TourUI.rect._cellGeom();
      if (!g) return null;
      const pad = g.somaR + 18;
      return {
        left: g.r.left + g.somaX - pad,
        top: g.r.top + g.cy - pad,
        width: pad * 2,
        height: pad * 2
      };
    },

    terminals() {
      const g = TourUI.rect._cellGeom();
      if (!g) return null;
      return {
        left: g.r.left + g.trunkX - 12,
        top: g.r.top + g.h * 0.08,
        width: (g.termX - g.trunkX) + g.w * 0.12,
        height: g.h * 0.84
      };
    }
  },

  /* ---- setup ----------------------------------------------- */

  init(ctx) {
    TourUI.ctx = ctx;
    const nb = document.getElementById('tourNarrate');
    if (nb) {
      nb.addEventListener('click', () => TourUI.toggleNarration());
      nb.setAttribute('aria-pressed', 'false');
    }
    const next = document.getElementById('tourNext');
    const back = document.getElementById('tourBack');
    const quit = document.getElementById('tourQuit');
    if (next) next.addEventListener('click', (e) => { e.stopPropagation(); TourUI.go(TourUI.at + 1); });
    if (back) back.addEventListener('click', (e) => { e.stopPropagation(); TourUI.go(TourUI.at - 1); });
    if (quit) quit.addEventListener('click', (e) => { e.stopPropagation(); TourUI.exit(); });

    const overlay = document.getElementById('spot');
    // Clicking the dimmed area advances. Clicking the card does not.
    if (overlay) overlay.addEventListener('click', () => TourUI.go(TourUI.at + 1));
  },

  /* ---- entering and leaving --------------------------------
     Entering snapshots everything the tour is going to disturb, and
     leaving puts it back. Walking out halfway must never leave a
     half trained brain and a lesion nobody asked for.            */

  enter() {
    if (TourUI.live) return;
    const ctx = TourUI.ctx;
    TourUI.saved = {
      brain: ctx.snapshot(),
      relation: ctx.relationName(),
      lesion: ctx.lesionPercent(),
      selected: ctx.selectedNeuron(),
      wasTraining: ctx.isTraining(),
      big: ctx.bigMode ? ctx.bigMode() : false
    };
    ctx.pauseTraining();
    /* Two stops point at swatches inside the prediction grid, and a
       hidden element has no rectangle to spotlight. Restored on exit. */
    if (ctx.setBig) ctx.setBig(false);
    TourUI.live = true;
    TourUI.show(true);
    TourUI.go(0);
  },

  exit() {
    if (!TourUI.live) return;
    const ctx = TourUI.ctx, s = TourUI.saved;
    TourUI.stopSpeaking();
    TourUI.live = false;
    TourUI.show(false);
    if (s) {
      ctx.restoreState(s);
      TourUI.saved = null;
    }
    ctx.say('tutorial closed, everything put back');
  },

  /* `hidden` is a property of HTMLElement and does NOT exist on
     SVGElement, so `svg.hidden = false` quietly sets a meaningless
     expando and leaves the attribute in place. That is why the
     spotlight rendered nothing on the first attempt. Go through the
     attribute, which works for both. */
  show(on) {
    TourUI.setHidden(document.getElementById('spot'), !on);
    TourUI.setHidden(document.getElementById('tourCard'), !on);
  },

  setHidden(el, on) {
    if (!el) return;
    el.hidden = on;
    if (el.setAttribute && el.removeAttribute) {
      if (on) el.setAttribute('hidden', '');
      else el.removeAttribute('hidden');
    }
  },

  /* ---- navigation ------------------------------------------ */

  async go(i) {
    if (!TourUI.live) return;
    if (i < 0) return;
    if (i >= Tour.stops.length) { TourUI.exit(); return; }

    TourUI.at = i;
    const stop = Tour.stops[i];
    const ctx = TourUI.ctx;

    if (stop.pause) ctx.pauseTraining();

    // Some stops need a network that has actually learned something.
    // Train quietly rather than pointing at an empty panel.
    if (stop.action) {
      ctx.busy(true);
      try {
        await stop.action(ctx);
      } catch (err) {
        ctx.say('tutorial step ' + stop.id + ' failed: ' + err.message);
      }
      ctx.busy(false);
      if (TourUI.at !== i || !TourUI.live) return;   // moved on while we waited
    }

    TourUI.paint(stop, i);
  },

  paint(stop, i) {
    const ctx = TourUI.ctx;
    const total = Tour.stops.length;

    const title = TourUI.fill(stop.title);
    const body = TourUI.fill(stop.body);

    const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    set('tourTitle', title);
    set('tourBody', body);
    set('tourProgress', (i + 1) + ' / ' + total);

    const codeEl = document.getElementById('tourCode');
    if (codeEl) {
      codeEl.textContent = stop.code || '';
      codeEl.hidden = !stop.code;
    }

    const back = document.getElementById('tourBack');
    if (back) back.disabled = i === 0;

    const rect = TourUI.targetRect(stop);
    TourUI.cutOut(rect);
    TourUI.placeCard(rect);
    TourUI.speak(i, body);
  },

  /* Placeholders like {firing} are resolved against the live network
     at the moment the stop is shown, so the copy cannot drift away
     from what the network is doing. */
  fill(text) {
    if (!text) return '';
    return String(text).replace(/\{(\w+)\}/g, (whole, key) => {
      const f = Tour.FILLERS[key];
      if (!f) return whole;
      try {
        return String(f(TourUI.ctx));
      } catch (err) {
        return '?';
      }
    });
  },

  targetRect(stop) {
    let r = null;
    try {
      r = typeof stop.target === 'function' ? stop.target() : TourUI.rect.el(stop.target);
    } catch (err) {
      r = null;
    }
    if (!r || !r.width || !r.height) {
      // Never throw and never spotlight nothing: fall back to the page.
      r = TourUI.rect.el('#shell') || { left: 0, top: 0, width: 100, height: 100 };
    }
    return r;
  },

  /* ---- the spotlight --------------------------------------
     One SVG mask, one hole. Not a box-shadow: a huge spread shadow
     breaks down at the viewport edges and clips unpredictably when
     the target is near a corner, which several of these targets are. */

  cutOut(r) {
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1920;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 1080;
    const pad = 8;

    const x = Math.max(0, r.left - pad);
    const y = Math.max(0, r.top - pad);
    const w = Math.max(1, Math.min(vw - x, r.width + pad * 2));
    const h = Math.max(1, Math.min(vh - y, r.height + pad * 2));

    const put = (id, bx, by, bw, bh) => {
      const el = document.getElementById(id);
      if (!el || !el.setAttribute) return;
      el.setAttribute('x', Math.round(bx));
      el.setAttribute('y', Math.round(by));
      el.setAttribute('width', Math.max(0, Math.round(bw)));
      el.setAttribute('height', Math.max(0, Math.round(bh)));
    };

    put('spotTop', 0, 0, vw, y);
    put('spotBottom', 0, y + h, vw, vh - (y + h));
    put('spotLeft', 0, y, x, h);
    put('spotRight', x + w, y, vw - (x + w), h);
    put('spotRing', x, y, w, h);
  },

  /* ---- the card -------------------------------------------
     Sits beside the target on whichever side has room, and is
     clamped so it can never run off screen. */

  placeCard(r) {
    const card = document.getElementById('tourCard');
    if (!card || !card.getBoundingClientRect) return;
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 1920;
    const vh = (typeof window !== 'undefined' && window.innerHeight) || 1080;

    const cr = card.getBoundingClientRect();
    const cw = cr.width || 420;
    const ch = cr.height || 260;
    const gap = 18;

    let left, top;
    const roomRight = vw - (r.left + r.width) - gap;
    const roomLeft = r.left - gap;
    const roomBelow = vh - (r.top + r.height) - gap;

    if (roomRight >= cw) {
      left = r.left + r.width + gap;
      top = r.top + r.height / 2 - ch / 2;
    } else if (roomLeft >= cw) {
      left = r.left - cw - gap;
      top = r.top + r.height / 2 - ch / 2;
    } else if (roomBelow >= ch) {
      left = r.left + r.width / 2 - cw / 2;
      top = r.top + r.height + gap;
    } else {
      left = r.left + r.width / 2 - cw / 2;
      top = r.top - ch - gap;
    }

    // A target that fills the screen leaves nowhere beside it, so
    // centre the card instead of jamming it against an edge.
    if (r.width > vw * 0.9 && r.height > vh * 0.9) {
      left = vw / 2 - cw / 2;
      top = vh / 2 - ch / 2;
    }

    card.style.left = Math.round(Math.max(12, Math.min(vw - cw - 12, left))) + 'px';
    card.style.top = Math.round(Math.max(12, Math.min(vh - ch - 12, top))) + 'px';
  },

  /* ---- narration -------------------------------------------
     Off on load, always. A conference room is loud and unexpected
     audio is a disaster. The card body is on screen either way, so
     the captions are never conditional on the audio.

     Two paths. If audio/tour-01.mp3 and friends exist they are
     played, which is the good one. If they do not, the browser's own
     speech synthesiser reads the same text, which is robotic but
     needs no files. Nothing is ever fetched from the network.
     See _dev/render-narration.md for regenerating the files.      */

  toggleNarration() {
    TourUI.narrate = !TourUI.narrate;
    const nb = document.getElementById('tourNarrate');
    if (nb && nb.setAttribute) nb.setAttribute('aria-pressed', String(TourUI.narrate));
    if (!TourUI.narrate) {
      TourUI.stopSpeaking();
    } else if (TourUI.at >= 0) {
      TourUI.speak(TourUI.at, TourUI.fill(Tour.stops[TourUI.at].body));
    }
  },

  stopSpeaking() {
    if (TourUI.audio) {
      try { TourUI.audio.pause(); } catch (e) { /* nothing to do */ }
      TourUI.audio = null;
    }
    if (typeof speechSynthesis !== 'undefined' && speechSynthesis.cancel) {
      speechSynthesis.cancel();
    }
  },

  speak(i, text) {
    TourUI.stopSpeaking();
    if (!TourUI.narrate) return;

    const file = 'audio/tour-' + String(i + 1).padStart(2, '0') + '.mp3';
    if (typeof Audio !== 'undefined') {
      const a = new Audio(file);
      TourUI.audio = a;
      a.addEventListener('error', () => {
        if (TourUI.audio === a) TourUI.audio = null;
        TourUI.synth(text);
      });
      const p = a.play();
      if (p && p.catch) p.catch(() => { TourUI.audio = null; TourUI.synth(text); });
      return;
    }
    TourUI.synth(text);
  },

  synth(text) {
    if (typeof speechSynthesis === 'undefined' || typeof SpeechSynthesisUtterance === 'undefined') return;
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    speechSynthesis.speak(u);
  },

  /* ---- keyboard -------------------------------------------
     Called by presenter.js only while the tour is up. Escape always
     works: never trap someone in here. */

  key(ev) {
    if (!TourUI.live) return false;
    switch (ev.key) {
      case 'ArrowRight': case 'PageDown':
        TourUI.go(TourUI.at + 1); return true;
      case 'ArrowLeft': case 'PageUp':
        TourUI.go(TourUI.at - 1); return true;
      case 'Escape':
        TourUI.exit(); return true;
      case ' ':
        TourUI.go(TourUI.at + 1); return true;
      default:
        return false;
    }
  },

  /* Reposition on resize, since every target is measured live. */
  reflow() {
    if (!TourUI.live || TourUI.at < 0) return;
    const r = TourUI.targetRect(Tour.stops[TourUI.at]);
    TourUI.cutOut(r);
    TourUI.placeCard(r);
  }
};
