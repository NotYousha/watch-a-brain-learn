/* ============================================================
   tour.js — WHAT THE TUTORIAL SAYS. Content only.

   This file is safe to rewrite the night before the talk. It holds
   no logic. The mechanics live in tour-ui.js and nothing here needs
   to change if you reword a stop, reorder stops, add one, or cut one.

   Each stop is:

     id      short name, used in logs
     target  a CSS selector, or a function returning a rectangle in
             viewport coordinates. Rectangle helpers for things drawn
             inside a canvas live in TourUI.rect.
     title   one line, 18px on screen
     body    plain second person. No term used before it is defined.
     code    optional, a file and line shown in a monospace strip
     action  optional, run on entry. May return a promise. Receives
             the context object built by presenter.js.
     pause   true if training should be stopped while this stop is up

   Numbers that could drift are read out of the running network at
   display time through {placeholders}, not typed in. See FILLERS at
   the bottom for what each one resolves to. That way the copy cannot
   end up claiming something the network is not doing.
   ============================================================ */

const Tour = {

  stops: [

    {
      id: 'whole',
      target: '#shell',
      title: 'What you are looking at',
      body: 'Two hundred and fifty six artificial neurons that have ' +
            'learned to turn a colour into {task}. Nothing here was ' +
            'programmed to do that. There is no rule for it anywhere in ' +
            'the code. It worked the rule out from examples.',
      pause: true
    },

    {
      id: 'arrives',
      target: '#probe0',
      title: 'A colour arrives',
      body: 'One colour goes in. It is never stored in one place, and ' +
            'no single neuron ever holds it. Watch what happens to it next.',
      pause: true
    },

    {
      id: 'smeared',
      target: () => TourUI.rect.inputColumn(),
      title: 'The colour gets smeared',
      body: 'Twenty eight cells receive it. Sixteen sit around the ' +
            'colour wheel, six watch how vivid it is, six watch how ' +
            'bright. An orange lights its own cell brightly and its ' +
            'neighbours dimly. The colour is not a value here. It is the ' +
            'shape of that bump. Your own visual system does this, and it ' +
            'is called population coding.',
      pause: true
    },

    {
      id: 'neuron',
      target: () => TourUI.rect.dendrites(),
      title: 'What a neuron is',
      body: 'These branches are one cell listening. It hears a few wires, ' +
            'weights what it hears, adds it all up, and fires only if the ' +
            'total clears a bar. Ten weak yeses lose to two strong ones. ' +
            'That is the whole of it. There is nothing else in there.',
      action: (ctx) => ctx.spotlightBusiestNeuron(),
      pause: true
    },

    {
      id: 'synapse',
      target: () => TourUI.rect.oneDendrite(),
      title: 'What a synapse is',
      body: 'Each of those wires has one number on it: how much this ' +
            'input counts. Like a fader on a mixing desk. Training slides ' +
            'the faders and does nothing else. It adds no neurons, no ' +
            'layers, and no speed. A fully trained network runs at exactly ' +
            'the same speed as an untrained one.',
      pause: true
    },

    {
      id: 'threshold',
      target: () => TourUI.rect.soma(),
      title: 'The bar it has to clear',
      body: 'The green arc is how hard this cell is being driven right ' +
            'now. The full circle is the bar. This cell is currently ' +
            'ranked {rank} of {poolSize} in its group, and only the top ' +
            '{winners} are allowed to fire, so it stays silent. Losing is ' +
            'what neurons mostly do.',
      pause: true
    },

    {
      id: 'competition',
      target: '#net',
      title: 'Only {firing} of 256 fire',
      body: 'Each group runs its own contest and everything else is ' +
            'forced to zero. Not because it was wrong. Because it was not ' +
            'the loudest. This is called k winners take all. Switch it off ' +
            'so that all 256 fire at once and it still learns, but worse: ' +
            'the score drops about seven points and the answers blur. You ' +
            'can run that comparison live in A/B mode.',
      pause: true
    },

    {
      id: 'sparse',
      target: '#chipWiring',
      title: 'Each cell hears only {inMin} to {inMax} of the 28',
      body: 'Those inputs are picked at random and fixed at birth. The ' +
            'wiring never learns. That randomness is what makes every cell ' +
            'an accidental specialist in a different combination of things. ' +
            'Wire them all to everything instead and it still scores about ' +
            'the same, but the answers get measurably less precise, because ' +
            'the cells stop being different from each other. A/B mode will ' +
            'show you that one too.',
      pause: true
    },

    {
      id: 'hebb',
      target: () => TourUI.rect.terminals(),
      title: 'The one line that learns',
      body: 'The question and the answer are shown at the same moment, ' +
            'and nothing compares them. No error is computed. Where a cell ' +
            'fired and an answer cell lit up at the same time, the wire ' +
            'between them grows a little. Neurons that fire together, wire ' +
            'together. Donald Hebb wrote that down in 1949.',
      code: 'brain.js:314   this.Who[base + o] += lr * a * t[o]',
      action: (ctx) => ctx.stepOnce(),
      pause: true
    },

    {
      id: 'homeostasis',
      target: '#metrics',
      title: 'Why it does not collapse',
      body: 'A cell that fires more gets stronger wires, which makes it ' +
            'fire more, and something has to stop that running away. ' +
            'Three things do. The contest you just saw, which is worth ' +
            'about five points. A cap on how much total wire strength any ' +
            'one cell may hold, which {atCap} of the 256 cells are pressed ' +
            'against at this moment. And the whole layer being divided by ' +
            'its own total activity, so it fires with the same energy no ' +
            'matter how many cells won. Measured: removing the cap costs ' +
            'about one point, removing the contest costs five. Biology has ' +
            'all three.',
      code: 'brain.js:320   if (norm > 1) ... /= norm',
      pause: true
    },

    {
      id: 'unsure',
      target: '#confCard',
      title: 'When it does not know',
      body: 'This is now set to a task with two correct answers. Both are ' +
            'equally right and nothing in the network can choose, so it ' +
            'answers with both at once and produces a colour that is ' +
            'neither. Look at the bars: two humps, {sep} degrees apart. ' +
            'Watch the confidence, not the score. {conf} per cent is the ' +
            'network telling you it is torn. The same averaging failure ' +
            'turns up in models a million times this size.',
      action: (ctx) => ctx.showAmbiguous(),
      pause: true
    },

    {
      id: 'break',
      target: '#controls',
      title: 'Break it',
      body: 'Now watch the score while cells are killed. Forty per cent ' +
            'gone and it barely moves. Ninety five per cent gone, thirteen ' +
            'cells left out of 256, and it still scores about half. ' +
            'Nothing in this code implements fault tolerance. There is no ' +
            'redundancy feature. It falls out of having spread the answer ' +
            'across many cells in the first place. Software does not ' +
            'normally behave like this.',
      action: (ctx) => ctx.breakIt(),
      pause: true
    }

  ],

  /* ---- the placeholders --------------------------------------
     Each returns a string, read from the live network at the moment
     the stop is shown. Add one here and you can use {name} in any
     title or body above. */

  /* Short lowercase phrases that read correctly mid-sentence. The
     relation blurbs in colors.js are standalone sentences with their
     own capital and a "Red -> cyan" example, which produce nonsense
     when dropped into the middle of stop 1. */

  TASK_PHRASES: {
    complement: 'the colour directly opposite it on the wheel',
    analogous: 'its neighbour thirty degrees around the wheel',
    triadic: 'a colour a third of the way around the wheel, in either direction',
    'split-complement': 'a colour just to one side or the other of its opposite',
    warmer: 'a warmer, richer version of itself',
    luminance: 'the grey that matches how bright it looks'
  },

  FILLERS: {
    task:     (ctx) => Tour.TASK_PHRASES[ctx.relationName()] || ctx.taskPhrase(),
    firing:   (ctx) => String(ctx.firingCount()),
    inMin:    (ctx) => String(ctx.wiring().min),
    inMax:    (ctx) => String(ctx.wiring().max),
    rank:     (ctx) => String(ctx.drives().rank),
    poolSize: (ctx) => String(ctx.drives().of),
    winners:  (ctx) => String(ctx.drives().winners),
    sep:      (ctx) => ctx.voteSeparation(),
    conf:     (ctx) => ctx.confidencePercent(),
    atCap:    (ctx) => String(ctx.cellsAtCap())
  }
};
