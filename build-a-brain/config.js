/* ============================================================
   config.js  <<<  THIS IS YOUR FILE. THIS IS THE ONE YOU CHANGE.

   Every setting below is a decision about what kind of brain you
   are building. Claude will talk you through each one. Change a
   number, save, refresh the browser, train again, see what happens.
   ============================================================ */

const CONFIG = {

  /* ---- 1. WHOSE BRAIN IS THIS? --------------------------- */
  ownerName: 'Yousha',
  brainName: 'Neural Network',

  /* ---- 2. WHAT IS IT LEARNING? ---------------------------
     Your brief tells you which one is yours. One of:
       'complement' 'analogous' 'triadic'
       'split-complement' 'warmer' 'luminance'          */
  relation: 'complement',

  /* ---- 3. HOW BIG IS IT? ---------------------------------
     How many neurons in the thinking layer.
     Fewer = faster, coarser, more obviously "a machine".
     More  = smoother, but harder to see what each neuron does.
     Try: 32, 64, 128, 256                                    */
  hiddenNeurons: 256,

  /* ---- 4. HOW DENSELY IS IT WIRED? -----------------------
     The chance that any given input neuron connects to any
     given hidden neuron. 1.0 would be all-to-all, like a
     computer. Real brains are far sparser than that.
     Try: 0.15, 0.3, 0.6                                      */
  connectivity: 0.15,

  /* ---- 5. HOW MANY NEURONS FIRE AT ONCE? -----------------
     Only the loudest few neurons are allowed to fire; the rest
     are silenced by their neighbours. This is competition, and
     it is why one neuron cannot take over the whole brain.
     0.1 means the top 10% fire.
     Try: 0.05, 0.1, 0.25                                     */
  fireFraction: 0.05,

  /* ---- 5b. COLOUR vs BRIGHTNESS ---------------------------
     Your brain has two pathways, like your real visual system.
     This is the share of neurons on the COLOUR pathway; the rest
     watch brightness. 0.6 means 60% colour, 40% brightness.
     If your puzzle is about brightness, try lowering this.
     Try: 0.4, 0.6, 0.8                                       */
  chromaFraction: 0.4,

  /* ---- 6. HOW FAST DOES IT LEARN? ------------------------
     How much a synapse strengthens each time two neurons fire
     together. Too low and it never learns. Too high and it
     panics and overwrites everything it knew.
     Try: 0.01, 0.05, 0.2                                     */
  learningRate: 0.2,

  /* ---- 7. DOES IT FORGET? --------------------------------
     How fast unused synapses fade away. 0 means it never
     forgets anything. Real synapses do fade — "use it or
     lose it".
     Try: 0, 0.001, 0.01                                      */
  forgetting: 0,

  /* ---- 8. STARTING WIRING --------------------------------
     Any whole number. Change it and your brain is born with a
     completely different random wiring — a different individual.
     Yours should be different from everyone else's.           */
  seed: 7,

  /* ---- 9. LOOK ------------------------------------------
     'dark' or 'light'                                         */
  theme: 'dark',

  /* ---- 10. HOW LONG DOES TRAINING RUN? -------------------
     Number of example colours shown per training run.          */
  trainingExamples: 4000,

  /* ---- 11. HOW FAST DOES THE SCREEN GO? ------------------
     'slow'   one example per frame — you can watch a single
              synapse being strengthened. About a minute.
     'normal' the original pace. About fifteen seconds.
     'fast'   a couple of seconds.
     You can also change this live with the Speed slider, and
     the Step x1 button shows exactly one example.             */
  trainSpeed: 'slow'
};
