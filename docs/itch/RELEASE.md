# Crunchr 1.0.0 on itch.io

This is the working file for the Crunchr store page. It has the page copy, the
screenshots, the settings, and the steps to upload the build.

Crunchr is a free download. People unzip it, double-click `crunchr.html`, and
use it in their browser. There is no account and no server.

> Choose **Downloadable** for Kind of Game. Do not choose **HTML Game**.

---

## 1. Ship the file

Crunchr is a tool, not a game. The download is a ZIP with one HTML file, a short
guide and the licence. People unzip it, double-click `crunchr.html`, and it opens
in their browser. It works offline.

Set **Kind of Game** to `Downloadable`. If you pick *HTML Game*, itch wraps
Crunchr in its own page layout. That wrapper can block the download button, and
it controls how the page scrolls. The file is the point, so make the file the
download.

| What you upload | Size | What people get |
| --- | --- | --- |
| `Crunchr-1.0.0.zip` | about 133 kB | The whole download |
| `crunchr.html` | about 438 kB | The app itself |
| `START HERE.txt` | about 3 kB | A short guide |
| `LICENSE.txt` | about 1 kB | The MIT licence |

`npm run itch:dist` checks the ZIP before it leaves the repo. It looks for the
three files, compares the app with the build, and confirms the app makes no
network calls. If a check fails, it deletes the ZIP.

---

## 2. Page settings

| Field | Value |
| --- | --- |
| **Title** | Crunchr |
| **Project URL** | `crunchr`, at <https://tarlow.itch.io/crunchr> |
| **Short description** | Eleven game sounds you can shape in your browser. Listen to ten versions, then download the WAV files. No sample packs, no account, nothing uploaded. |
| **Classification** | Tool |
| **Kind of Game** | **Downloadable** (see section 1) |
| **Genre** | Leave it blank. itch's genres are for games. |
| **Release status** | Released |
| **Version** | `1.0.0`, from `package.json`. The footer shows `v1.0.0`. |
| **Platforms** | Windows, macOS, Linux. One file covers all three. |
| **Price** | Free (see section 7) |
| **Cover image** | `docs/media/itch/cover-630x500.png` (630 by 500, required) |
| **Banner** | `docs/media/itch/banner-960x400.png` (960 by 400, optional) |
| **Mobile Friendly** | On. The layout works on a phone. |
| **Support contact** | `tarlow@mossaistudio.com`, shown on the page |
| **Tags** | See section 3 |

### Tags

Pick up to 10. These are search labels, not sentences:

```
audio, sound-effects, gamedev, tool, sound-design, offline, browser, no-install, sfx, foley
```

`html5` and `webgl` make itch treat the page like a playable game. Skip them.

---

## 3. The page copy

This goes in the description box. itch takes headings, paragraphs, lists, bold,
italic, links and images. The block below is ready to paste.

```html
<h2>Small sounds for games, made in your browser</h2>

<p>
  Crunchr is a small sound tool I made for game projects. It makes clicks,
  footsteps, dice, cloth, coins, squishes and crunches. You shape them in the
  page, then download the WAV files.
</p>

<p>
  A prototype can work perfectly and still feel unfinished when every button
  makes the same dull click, so Crunchr gives you a quick way to replace those
  sounds without opening a recording program.
</p>

<p>
  When a prototype needs a footstep before the art is done, you can pick a sound,
  move a couple of sliders, and have a file in a minute.
</p>

<p>
  No sample packs, no account, and nothing gets uploaded.
</p>

<h3>Pick a sound, then make it yours</h3>

<p>
  There are eleven sounds in four groups: clicks, footsteps, items and crunches.
  Pick one and it plays. Six sliders change the length, pitch, punch, body,
  roughness and fade. The seventh, Variation, decides how different the ten
  downloadable takes should be.
</p>

<p>
  Tap the sound you already picked and you get a new take with fresh random
  detail, while your sliders stay where they are. <strong>Nudge 10%</strong>
  moves every control a little. <strong>Surprise me</strong> jumps to a random
  sound. Reset puts the sliders back where they started.
</p>

<h3>One WAV, or ten</h3>

<p>
  <strong>Download WAV</strong> saves the sound you're hearing as one file. It's
  a standard 44.1 kHz, 16-bit stereo WAV, which is what most game engines and
  editors expect.
</p>

<p>
  You can keep a single WAV for a button or a coin, or take the ten-version ZIP
  when you need a row of footsteps that don't repeat. The changes are small,
  which is what you want for sounds that repeat a lot.
</p>

<p>
  The row of numbers under Save plays all ten in order, and clicking one hears it
  on its own before you decide which file to keep. The gap you set is only for
  listening and never gets written into the files.
</p>

<p>
  So the ZIP still has ten separate files, and your game decides when each one
  plays.
</p>

<h3>The picture is the sound</h3>

<p>
  The wave beside the controls is the sound you're working on. It moves while the
  sound plays. Point at it and you get the time and loudness at that spot.
</p>

<p>
  Crunchr builds the sound in the page when you press Play, so the take you heard
  is the one that goes into the WAV. Preview, the single WAV and the ten-version
  ZIP all come from that same take.
</p>

<h3>Made for the middle of a project</h3>

<p>
  You know the bit where the prototype works but every button still sounds like a
  default beep? That's where Crunchr fits. It's also fine for a small final
  effect when you don't need a whole library.
</p>

<p>
  But it isn't a recording program. It won't record, edit or clean up audio you
  already have, and it doesn't save a project file. The WAVs are what you keep.
</p>

<p>
  What's the sound you keep putting off? Make that one first.
</p>

<h3>Works offline</h3>

<p>
  The app is one file that opens in your browser. Put it somewhere you'll find it
  again, double-click it, and it works with the wifi off.
</p>

<p>
  When you close the tab and come back later, the sound you were working on and
  the slider positions are still there, waiting for you. Clear the site data and
  they're gone.
</p>

<p>
  The sounds you make are yours, including in games you sell.
</p>

<h3>What you need</h3>

<p>
  A current version of Chrome, Edge, Firefox or Safari on Windows, macOS or
  Linux. Browsers won't play sound until you click or press a key, so press
  something first, and after that the Play button, the spacebar and the wave all
  behave the way you expect. It's free, with the code under the MIT licence.
</p>
```

---

## 4. Screenshots

Upload them in this order. itch uses the first one as the big image at the top.
These are real captures of the build, not mock-ups. `npm run release:media`
makes them.

| # | File | Size | Caption |
| --- | --- | --- | --- |
| 1 | [`docs/screenshots/01-instrument.png`](../screenshots/01-instrument.png) | 1600 by 1000 | The whole tool: eleven sounds in four groups, seven controls, and a picture of the wave. |
| 2 | [`docs/screenshots/02-shape-and-listen.png`](../screenshots/02-shape-and-listen.png) | 1600 by 1000 | Shape a footstep and hear it right away. The sliders change the same sound that gets downloaded. |
| 3 | [`docs/screenshots/03-ten-versions.png`](../screenshots/03-ten-versions.png) | 1600 by 1000 | Ten versions, one selected. Play the set, hear one on its own, or save a single WAV. |
| 4 | [`docs/screenshots/04-help.png`](../screenshots/04-help.png) | 1600 by 1000 | The built-in guide, with the keyboard shortcuts. |
| 5 | [`docs/screenshots/05-mobile.png`](../screenshots/05-mobile.png) | 390 by 844 | The phone layout: one column, big controls, same sounds. |

The first four are 1600 by 1000 pixels. itch scales them for the page. The phone
shot is portrait on purpose.

### Cover and banner

`npm run release:media` also draws the cover and banner:

* `cover-630x500.png` is required and appears in browse listings.
* `banner-960x400.png` is optional and sits at the top of the page.

Both use the real app capture, the app's teal and gold colours, and the version
from `package.json`. Running the command again overwrites the images, so change
the layout in `scripts/release-media.mjs` instead of editing a PNG by hand.

---

## 5. Launch post

Post this with the first screenshot or the cover at the top.

```html
<h2>Crunchr 1.0.0 is out</h2>

<p>
  I made a small sound tool called Crunchr, and it runs in one browser tab.
</p>

<p>
  You pick a click, a footstep, a die, a coin or a squish. Then you shape it,
  listen to ten versions, and download the WAVs. It's for the parts of a game
  that need a sound but don't need a whole sound library.
</p>

<h3>What's in 1.0.0</h3>

<ul>
  <li>Eleven sounds: clicks, footsteps, items and crunches.</li>
  <li>Seven controls: length, pitch, punch, body, roughness, fade and Variation.</li>
  <li>A live wave that shows the sound while it plays, plus the time and loudness
      under your pointer.</li>
  <li>One WAV file, or a ZIP of ten numbered versions.</li>
  <li>A preview row that plays all ten, with its own spacing and a button to save
      the version you picked.</li>
  <li>Each sound remembers its slider positions, and tapping it again makes a new
      take without losing them.</li>
  <li>A built-in guide, the Spacebar shortcut, and a phone layout with buttons
      you can actually hit.</li>
  <li>It doesn't connect to the internet or collect anything about you. The sound
      you were working on stays in your browser.</li>
  <li>One file that works offline.</li>
</ul>

<p>
  Every sound is built from scratch in the browser, so there are no sample files
  to hunt down, no licences to track, and nothing extra to ship with your game.
</p>

<p>
  There's no account and nothing gets uploaded. The sounds are yours, including
  in games you sell.
</p>

<p>
  It's free and MIT licensed, and if a sound you need isn't here, tell me what's
  missing.
</p>

<p>
  What are you building next? Go make the sound it's missing.
</p>

<p>~ Tarlow</p>
```

---

## 6. What it does not do

Crunchr makes one sound at a time. It doesn't record, edit or clean up audio you
already have, and it doesn't save a project file. The WAVs are what you keep.

It isn't a full sound library, a mixer or a recording program. It doesn't sync
sounds between devices.

---

## 7. Price and licence

Free. The code is MIT licensed, and the sounds you make are yours, including in
games you sell.

itch can take donations on a free page. Leave the minimum at zero. The page copy
promises a free file, and a price would turn a simple download into a checkout.

Support address on the page: `tarlow@mossaistudio.com`.

The ZIP includes `LICENSE.txt`. `package.json` declares MIT, and
`npm run release:check` fails if those drift.

---

## 8. Build and upload

```bash
npm run verify          # code check, unit tests, builds, browser checks
npm run release:media   # redraw the screenshots, cover and banner
npm run release:check   # check the settings, images, licence and one-file build
npm run itch:dist       # build and check dist-itch/Crunchr-1.0.0.zip
```

`release:media` and `itch:dist` rebuild the app first, so the pictures and the
ZIP can't come from an old build. `release:check` only reads.

### Upload in the browser

1. Create the page with project URL `crunchr`.
2. Set **Classification** to `Tool` and **Kind of Game** to **Downloadable**.
3. Upload `dist-itch/Crunchr-1.0.0.zip` as the Windows, macOS and Linux download.
   One file covers all three.
4. Upload `cover-630x500.png`. The banner is optional.
5. Add the five screenshots in the order and with the captions in section 4.
6. Paste the description from section 3 and the tags from section 2.
7. Set the price to **Free**, add `tarlow@mossaistudio.com` as the support
   contact, and turn **Mobile Friendly** on.
8. Tick **Released**, save, and run the checks in section 10.

There is no command-line uploader in this repo. Upload in the browser. The ZIP
is small, so re-uploading a new build by hand is fine for 1.0.

---

## 9. Versioning

When you cut the next release:

1. Bump `version` in `package.json`.
2. Change the footer in `src/App.tsx` to match.
3. Update `version` in `docs/itch/metadata.json` and the title of this file.
4. Run `npm run release:media` so the cover shows the new number.
5. Run the section 8 commands and upload the new ZIP.

`release:check` catches a mismatch between `package.json`, the page settings and
the footer. The ZIP name comes from `package.json`, so it changes automatically.

---

## 10. Before you publish

Automated checks, run 20 October 2026 against this tree:

- [x] `npm run verify` passed. It ran the code check, 32 unit tests, both builds
      and 28 browser checks. Those cover WAV and ZIP downloads, each sound's
      saved sliders, the guide, the setting that turns off animation, button
      sizes, and layouts at 1440, 390 and 320 pixels.
- [x] `npm run release:media` passed. Nine real captures, no console errors and
      no network requests.
- [x] `npm run release:check` passed. The settings match `package.json`, every
      image has the right size, the licence is there, and the one-file build
      makes no network calls.
- [x] `npm run itch:dist` passed. `dist-itch/Crunchr-1.0.0.zip`, three files,
      about 133 kB, and the app matches the build.
- [x] Page copy, tags, screenshots, cover, banner, support address and version
      are written down in this kit.
- [x] The price is free and the app is MIT licensed.
- [x] Kind of Game is documented as **Downloadable**, not HTML Game.

Still needs a person:

- [ ] Listen to all eleven sounds on headphones and on a phone speaker. The
      tests check levels and file validity, not whether the sounds are good.
- [ ] Upload the ZIP, download it from the public page, unzip it and open
      `crunchr.html`. Save one WAV and the ten-version ZIP, reload the page, and
      check that the sound you were working on comes back.
- [ ] Confirm that the project URL `tarlow/crunchr` is the intended target, then
      set the page to Released and publish.
- [ ] Check the page on a phone and in one browser that isn't Chrome. The test
      suite only runs Chrome.
