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
            'the loudest. This is called k winners take all, and without ' +
            'it one loud cell would end up answering every colour the same ' +
            'way.',
      pause: true
    },

    {
      id: 'sparse',
      target: '#chipWiring',
      title: 'Each cell hears only {inMin} to {inMax} of the 28',
      body: 'If every cell heard every input, all 256 would respond ' +
            'identically and you would have paid for 256 neurons and built ' +
            'one, copied. The wiring is sparse and random, and it is fixed ' +
            'at birth. It never learns. That randomness is what makes each ' +
            'cell an accidental specialist in something different.',
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
            'fire more. Left alone, one cell ends up answering every ' +
            'colour identically and the score sits at nothing. Two brakes ' +
            'stop that. The contest you just saw, and a cap on how much ' +
            'total wire strength any one cell is allowed. Biology calls ' +
            'the second one homeostasis.',
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

  FILLERS: {
    task:     (ctx) => ctx.taskPhrase(),
    firing:   (ctx) => String(ctx.firingCount()),
    inMin:    (ctx) => String(ctx.wiring().min),
    inMax:    (ctx) => String(ctx.wiring().max),
    rank:     (ctx) => String(ctx.drives().rank),
    poolSize: (ctx) => String(ctx.drives().of),
    winners:  (ctx) => String(ctx.drives().winners),
    sep:      (ctx) => ctx.voteSeparation(),
    conf:     (ctx) => ctx.confidencePercent()
  }
};
