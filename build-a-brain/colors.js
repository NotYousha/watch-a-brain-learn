/* ============================================================
   colors.js — colour maths and the "relations" your brain learns.

   A RELATION is just a rule that turns one colour into another.
   Your brain never sees the rule. It only sees thousands of
   (input colour -> answer colour) pairs and has to work it out.
   ============================================================ */

const Colors = {

  /* ---- conversions ---------------------------------------- */

  // h in [0,360), s and v in [0,1]  ->  {r,g,b} each in [0,1]
  hsv2rgb(h, s, v) {
    h = ((h % 360) + 360) % 360;
    const c = v * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = v - c;
    let r = 0, g = 0, b = 0;
    if (h < 60)       { r = c; g = x; b = 0; }
    else if (h < 120) { r = x; g = c; b = 0; }
    else if (h < 180) { r = 0; g = c; b = x; }
    else if (h < 240) { r = 0; g = x; b = c; }
    else if (h < 300) { r = x; g = 0; b = c; }
    else              { r = c; g = 0; b = x; }
    return { r: r + m, g: g + m, b: b + m };
  },

  rgb2hsv(r, g, b) {
    const max = Math.max(r, g, b), min = Math.min(r, g, b);
    const d = max - min;
    let h = 0;
    if (d > 1e-9) {
      if (max === r)      h = 60 * (((g - b) / d) % 6);
      else if (max === g) h = 60 * ((b - r) / d + 2);
      else                h = 60 * ((r - g) / d + 4);
    }
    if (h < 0) h += 360;
    return { h, s: max < 1e-9 ? 0 : d / max, v: max };
  },

  css(c) {
    const q = (n) => Math.max(0, Math.min(255, Math.round(n * 255)));
    return `rgb(${q(c.r)},${q(c.g)},${q(c.b)})`;
  },

  // Shortest distance between two hues, in degrees (0..180).
  hueDist(a, b) {
    let d = Math.abs(((a % 360) + 360) % 360 - ((b % 360) + 360) % 360);
    return d > 180 ? 360 - d : d;
  },

  // Straight-line distance in RGB space, 0 (identical) .. 1 (black vs white).
  rgbDist(a, b) {
    const dr = a.r - b.r, dg = a.g - b.g, db = a.b - b.b;
    return Math.sqrt((dr * dr + dg * dg + db * db) / 3);
  },

  /* ---- the six relations ---------------------------------- */
  /*
     Each relation takes an {h,s,v} colour and returns the
     answer as {h,s,v}.

     Some relations are AMBIGUOUS — there is more than one
     correct answer, and the rule picks one at random each time
     it is asked. Watch what that does to your brain.
  */

  relations: {

    // Straight across the colour wheel. One clean answer.
    complement: {
      label: 'Complement',
      blurb: 'The colour directly opposite on the wheel. Red -> cyan.',
      ambiguous: false,
      apply: (c) => ({ h: c.h + 180, s: c.s, v: c.v })
    },

    // A small step around the wheel. Very easy — almost too easy.
    analogous: {
      label: 'Analogous',
      blurb: 'The neighbour 30 degrees around the wheel. Red -> orange.',
      ambiguous: false,
      apply: (c) => ({ h: c.h + 30, s: c.s, v: c.v })
    },

    // TWO correct answers, 120 degrees either way.
    triadic: {
      label: 'Triadic',
      blurb: 'A third of the way around — either direction. Two right answers.',
      ambiguous: true,
      apply: (c) => ({ h: c.h + (Math.random() < 0.5 ? 120 : 240), s: c.s, v: c.v })
    },

    // TWO correct answers, just either side of the complement.
    'split-complement': {
      label: 'Split Complement',
      blurb: 'Just to either side of the opposite colour. Two right answers, close together.',
      ambiguous: true,
      apply: (c) => ({ h: c.h + (Math.random() < 0.5 ? 150 : 210), s: c.s, v: c.v })
    },

    // Not a rotation at all — a pull toward orange, and richer.
    warmer: {
      label: 'Warmer',
      blurb: 'Drag the colour toward firelight orange and make it richer.',
      ambiguous: false,
      apply: (c) => {
        // Move 45% of the way toward 30 degrees (orange), the short way round.
        let d = ((30 - c.h + 540) % 360) - 180;
        return {
          h: c.h + d * 0.45,
          s: Math.min(1, c.s * 0.7 + 0.3),
          v: Math.min(1, c.v * 0.95 + 0.05)
        };
      }
    },

    // Hue is thrown away. Your brain must learn that green counts most.
    luminance: {
      label: 'Luminance',
      blurb: 'The grey that matches how BRIGHT the colour looks. Green counts ~6x more than blue.',
      ambiguous: false,
      apply: (c) => {
        const rgb = Colors.hsv2rgb(c.h, c.s, c.v);
        const y = 0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b;
        return { h: c.h, s: 0, v: y };   // grey: saturation zero
      }
    }
  },

  /* ---- making training examples --------------------------- */

  randomColor() {
    return {
      h: Math.random() * 360,
      s: 0.45 + Math.random() * 0.55,   // avoid near-greys, hue is unreliable there
      v: 0.45 + Math.random() * 0.55
    };
  },

  // One training example: a colour and its correct answer.
  makeExample(relationName) {
    const rel = Colors.relations[relationName];
    if (!rel) throw new Error(`Unknown relation: ${relationName}`);
    const input = Colors.randomColor();
    return { input, target: rel.apply(input) };
  }
};

/* Also expose the relation names in a fixed order, for menus. */
Colors.relationNames = Object.keys(Colors.relations);
