# Regenerating the tutorial narration

The tutorial reads its own copy aloud when the Narrate button is switched on.
Narration is off on load and never autoplays. A conference room is loud and
unexpected audio is a disaster.

There are two paths and the code tries them in this order.

## Path one: pre-rendered files, which is the one to use

`tour-ui.js` looks for `audio/tour-01.mp3` through `audio/tour-12.mp3`, numbered
to match the stop order in `tour.js`. If a file is there it plays through a plain
`<audio>` element. Nothing is fetched over the network and no speech API is called
at runtime.

To regenerate them:

1. Print the current copy. From `build-a-brain`:

   ```
   node -e '
     const fs = require("fs");
     eval(fs.readFileSync("tour.js", "utf8"));
     Tour.stops.forEach((s, i) => {
       const n = String(i + 1).padStart(2, "0");
       fs.writeFileSync("_dev/narration-" + n + ".txt", s.body + "\n");
       console.log(n, s.id);
     });
   '
   ```

   That writes one text file per stop into `_dev/`.

2. Note the placeholders. Several stops contain `{firing}`, `{inMin}`, `{rank}`
   and so on, which are filled from the live network when the stop is shown. A
   recording cannot do that. Either read the placeholder as the typical value, or
   reword that sentence in the recording to avoid a specific number. The typical
   values on the shipped config are:

   | placeholder | typical |
   |---|---|
   | `{firing}` | 12 or 13 of 256 |
   | `{inMin}` / `{inMax}` | 1 and 7 |
   | `{rank}` / `{poolSize}` / `{winners}` | varies every frame, avoid in audio |
   | `{sep}` | about 135 degrees on triadic |
   | `{conf}` | about 51 per cent on triadic |

   The on-screen caption always shows the live number, so a recording that says
   "about a dozen" while the card says "12" is fine. A recording that states a
   number the card contradicts is not.

3. Record or synthesise the audio. Any tool is fine as long as the output is mp3
   and lands at `audio/tour-NN.mp3`. Keep each stop under about 35 seconds.

4. Check the total. These are the only binary assets in the repository. Keep the
   set under about 3MB so a clone stays quick. Mono, 64kbps is plenty for speech.

5. Delete the `_dev/narration-*.txt` scratch files afterwards. They are working
   files, not part of the project.

## Path two: the browser's own voice, which is the fallback

If a file is missing or fails to load, `tour-ui.js` falls back to
`speechSynthesis` with the same text. It is robotic and the voice depends on the
machine, but it needs no files and no network. This is what runs today, because
no audio files are committed yet.

## What is deliberately not done

No text is sent to any speech service at runtime. The fallback uses the voice
already installed in the browser. If a future version wants better audio, it gets
committed as files by the process above, offline, in advance.

## Captions

The card body is on screen at every stop whether narration is on or off, so the
captions are not conditional on the audio and there is no separate caption track
to keep in sync. Rewording `tour.js` changes both at once.
