# itch.io release kit

Everything needed to publish **Crunchr 1.0.0** on itch.io. The page copy below
is ready to paste, the artwork is in [`docs/media/itch/`](../media/itch/), the
screenshots are in [`docs/screenshots/`](../screenshots/), and the page fields
live in [`metadata.json`](metadata.json).

> **Read §1 first.** Crunchr is a **downloadable file**, not an *HTML Game*.
> The artifact is one self-contained HTML file in a ZIP, and that decides how
> the page is configured.

---

## 1. Downloadable, never "HTML Game"

| Artifact | Built by | Goes to itch as | Who can use it |
| --- | --- | --- | --- |
| `Crunchr-1.0.0.zip` (~133 kB) | `npm run itch:dist` | Downloadable file | Anyone |
| …containing `crunchr.html` (438 kB) | the same build | the app itself | Anyone |
| …plus `START HERE.txt` and `LICENSE.txt` | the same build | the guide and licence | Anyone |

Crunchr ships as one HTML file the reader unzips and double-clicks: the whole
instrument, offline, in any current browser. There is nothing to install, no
account, and no server of ours in the middle.

**Keep "Kind of Game" set to `Downloadable`.** An *HTML Game* page puts the
instrument inside itch's own frame, where the host controls page scrolling and
where a cross-origin frame is allowed to block file downloads. Crunchr's whole
promise is that the button makes a file you keep, so the file is the artifact.
Shipping it directly also means the offline copy and the store copy are the same
bytes.

`npm run itch:dist` verifies the archive by reading it back: the three file
names, the app byte for byte against `dist-single/index.html`, and the
self-contained no-egress build. A failing check deletes the ZIP so a broken one
cannot look publishable.

---

## 2. Page fields

| Field | Value |
| --- | --- |
| **Title** | Crunchr |
| **Project URL** | `crunchr` → <https://tarlow.itch.io/crunchr> |
| **Short description / tagline** | Eleven procedural game sounds in one browser tab. Shape them, hear ten versions, and download clean WAVs. No samples, no account, no uploads. |
| **Classification** | Tool |
| **Kind of Game** | **Downloadable** (see §1) |
| **Genre** | leave unset — itch's genre list is a game taxonomy |
| **Release status** | Released |
| **Version** | `1.0.0`, from `package.json`; the footer shows `v1.0.0` |
| **Platforms** | Windows, macOS, Linux (one file; the browser is what matters) |
| **Pricing** | Free (see §7) |
| **Cover image** | `docs/media/itch/cover-630x500.png` (630×500, required) |
| **Banner** | `docs/media/itch/banner-960x400.png` (960×400, optional page header) |
| **Mobile Friendly** | **On** — the layout stacks into one column at 390 px and 320 px |
| **Support contact** | `tarlow@mossaistudio.com`, visible on the page and not only in the app |
| **Tags** | see §3 |

### Tags

Pick up to 10. Recommended, in priority order:

```
audio, sound-effects, gamedev, tool, procedural, offline, browser, no-install, sfx, foley
```

Adjacent tags that also fit: `game-development`, `indie`, `assets`, `utility`.
Avoid `html5` and `webgl`; itch reads those as a playable build, which this page
is not.

---

## 3. Description (paste into the itch description editor)

itch accepts a limited HTML subset: headings, paragraphs, lists, bold, italic,
links and images. This is written for that subset.

```html
<h2>Small sounds, made in your browser</h2>

<p>
  Crunchr is a tiny sound maker for games. It makes clicks, footsteps, dice,
  cloth, coins, squishes and crunches, then gives you the WAV files to drop into
  your project. Everything is synthesized from scratch in the page. There are no
  sample packs, no accounts and no uploads.
</p>

<h3>Pick a sound, then make it yours</h3>

<p>
  There are eleven sounds in four groups: clicks, footsteps, items and crunches.
  Pick one and hear it immediately. Six sliders shape it: length, pitch, punch,
  body, roughness and fade. A variation slider decides how much the ten
  downloadable versions should differ.
</p>

<p>
  Tap the sound you already selected and Crunchr rolls a new version with fresh
  random detail while your sliders stay where they are. <strong>Nudge 10%</strong>
  moves every control a little; <strong>Surprise me</strong> jumps to a random
  sound and a new seed. Reset puts the preset back the way it started.
</p>

<h3>One WAV, or ten versions</h3>

<p>
  <strong>Download WAV</strong> saves the sound on your sliders as one 44.1 kHz,
  16-bit stereo WAV. <strong>Download 10 versions</strong> saves a ZIP with ten
  numbered WAVs, each with small changes, so a row of footsteps does not sound
  like the same footstep ten times.
</p>

<p>
  The preview strip plays all ten in a row. Click a number to hear one version on
  its own, then <strong>Save vNN</strong> to download just that file. The space
  between sounds is only a preview setting; the ZIP always has ten separate
  sounds, so your game decides when to trigger each one.
</p>

<h3>The sound you see is the sound you download</h3>

<p>
  A live picture of the wave sits beside the controls. It starts as the whole
  one-shot, switches to the real audio while the sound plays, and shows the time
  and loudness when you point at it. Preview, single export and batch export all
  come from the same seeded renderer, so what you auditioned is what lands in
  the file.
</p>

<h3>Made for the messy middle of a game</h3>

<p>
  Crunchr is for the moment a prototype needs a button click, a boot on gravel,
  a die hitting a table or a coin hitting the floor. It is a focused one-shot
  instrument, not a full sound library, mixer or DAW. If you need a placeholder
  that already sounds intentional, or a small final effect, it is built for that.
</p>

<h3>Offline, and yours</h3>

<p>
  The app is one HTML file you keep. It opens with the wifi switched off and has
  no analytics, no telemetry and no network requests. The last sound and slider
  settings are kept in this browser only; clearing the site data removes them.
  The sounds you make are yours to use in games, including commercial ones.
</p>

<h3>What you need</h3>

<p>
  Current Chrome, Edge, Firefox or Safari, on Windows, macOS or Linux, with Web
  Audio. The first click or key press unlocks sound, as browser autoplay rules
  require. It is free and MIT licensed.
</p>
```

---

## 4. Screenshots

Upload in this order. itch shows the first one as the page hero. Every file is a
real capture of the single-file build, not a mock-up, and every one is produced
by `npm run release:media`.

| # | File | Size | Caption |
| --- | --- | --- | --- |
| 1 | [`docs/screenshots/01-instrument.png`](../screenshots/01-instrument.png) | 1600×1000 | The whole instrument: eleven sounds in four groups, seven controls, and a live picture of the wave. |
| 2 | [`docs/screenshots/02-shape-and-listen.png`](../screenshots/02-shape-and-listen.png) | 1600×1000 | Shape a footstep, then hear it. Length, pitch, punch, body, roughness and fade all update the same renderer that writes the WAV. |
| 3 | [`docs/screenshots/03-ten-versions.png`](../screenshots/03-ten-versions.png) | 1600×1000 | Save one WAV or ten versions. Preview the batch, hear a single version, and save it on its own. |
| 4 | [`docs/screenshots/04-help.png`](../screenshots/04-help.png) | 1600×1000 | The built-in manual explains the instrument and the keyboard shortcuts without leaving the page. |
| 5 | [`docs/screenshots/05-mobile.png`](../screenshots/05-mobile.png) | 390×844 | The one-column phone layout: the full sound bank and instrument, with touch-sized controls. |

itch accepts these at 16:10 and scales them; there is no need to re-cut them to
16:9. The first four are 16:10; the phone shot is portrait on purpose.

### Cover and banner

```bash
npm run release:media   # rebuilds the single file, then redraws every image
```

* `cover-630x500.png` is required and is what appears in browse listings.
* `banner-960x400.png` is optional and goes at the top of the page.

Both are drawn by `scripts/release-media.mjs` in the same Chrome the browser
checks use: the words and version come from `package.json`, the panel art is the
real 1600×1000 hero capture, and the colours are the app's own teal and gold
tokens. Running it again overwrites the PNGs, so change the composition in the
script rather than hand-editing the files.

---

## 5. Release notes (paste into the itch devlog post)

Open the post with `docs/screenshots/01-instrument.png` or the cover. A launch
post reads better with the product at the top of it.

```html
<h2>Crunchr 1.0.0 is out</h2>

<p>
  Crunchr is a tiny sound maker for games: eleven procedural sounds in one browser
  tab, with the WAV files at the end. No samples, no account, no uploads.
</p>

<p>
  Pick a click, a footstep, a die, a coin or a squish. Shape it, listen to it, then
  download one clean WAV or ten slightly different versions. The whole thing is a
  single HTML file that works offline.
</p>

<h3>What's in 1.0.0</h3>

<ul>
  <li>Eleven sounds in four groups: clicks, footsteps, items and crunches.</li>
  <li>Seven controls: length, pitch, punch, body, roughness, fade and batch
      variation.</li>
  <li>A live scope that shows the whole one-shot, the real waveform while it
      plays, and the time and loudness under your pointer.</li>
  <li>One 44.1 kHz, 16-bit stereo WAV, or a ZIP of ten numbered versions.</li>
  <li>Batch preview with adjustable spacing, per-version audition and Save vNN.</li>
  <li>Per-sound slider memory and a re-roll that makes a new version without
      losing your settings.</li>
  <li>A built-in manual, Spacebar performance key and a mobile layout with
      touch-sized controls.</li>
  <li>A deterministic renderer: preview, WAV and ZIP all come from the same
      seeded code.</li>
  <li>No samples, no network requests, no analytics. The last session stays in
      your browser.</li>
</ul>

<p>
  It is free and MIT licensed, and the sounds you make are yours. If it earns a
  place in your project, tell me what is missing.
</p>
```

---

## 6. What 1.0 deliberately is not

Keeping the page honest is part of the release:

* It is not a general-purpose synthesizer, sequencer or DAW.
* It does not import, edit or normalize existing audio files.
* It does not save a project file; the WAVs are the output.
* It does not upload, sync or share sounds between devices.
* It does not claim to replace a recorded foley library. It is for fast,
  characterful one-shots and placeholders that already sound like something.

---

## 7. Pricing and licence

**Free.** Crunchr is MIT licensed, and the same build is intended to be
available from the repository as well as itch. Charging here would only make the
itch copy the lesser one.

itch can take donations on a free page if you want the option. Leave the
minimum at zero: the page copy promises a free file, and a price takes the page
out of "Downloadable" and into a payment flow it does not need.

Support address on the page: `tarlow@mossaistudio.com`.

The ZIP ships `LICENSE.txt`. `package.json` declares `MIT`, and
`npm run release:check` fails if that drifts.

---

## 8. Build the upload

```bash
npm run verify          # typecheck, 32 unit tests, both builds, 28 browser checks
npm run release:media   # redraw screenshots, cover and banner from the built app
npm run release:check   # validate fields, image sizes, licence and self-contained HTML
npm run itch:dist       # package and byte-verify dist-itch/Crunchr-1.0.0.zip
```

`release:media` and `itch:dist` rebuild `dist-single/index.html` first, so no
old app can sneak into the artwork or the archive. `release:check` never writes.

### Upload in the browser

1. Create the page with project URL `crunchr`.
2. Set **Classification** to `Tool` and **Kind of Game** to **Downloadable**.
3. Upload `dist-itch/Crunchr-1.0.0.zip` as the Windows, macOS and Linux download.
   One file covers all three.
4. Upload `cover-630x500.png`; optionally upload `banner-960x400.png`.
5. Add the five screenshots in the order and with the captions in §4.
6. Paste the description from §3 and the tags from §2.
7. Set the price to **Free**, add `tarlow@mossaistudio.com` as the support
   contact, and set **Mobile Friendly** on.
8. Tick **Released**, save, and do the post-upload check in §10.

There is no butler script in this repository; the browser upload is the
supported path. The ZIP is small enough that re-uploading a new build is not
worth automating for 1.0.

---

## 9. Versioning

When the next release is cut:

1. Bump `version` in `package.json`.
2. Update the footer in `src/App.tsx` (`v1.0.0`) — `release:check` verifies both
   places agree.
3. Update `version` in `docs/itch/metadata.json` and the title of this document.
4. Run `npm run release:media` so the cover plate carries the new number.
5. Run the §8 chain again and upload a new ZIP.

The archive name comes from `package.json`, so a version bump renames the ZIP
automatically.

---

## 10. Before you hit publish

Automated gates, run 20 October 2026 against this tree:

- [x] `npm run verify` green — typecheck, 32 unit tests, `dist/`, `dist-single/`
      and 28 real-Chrome checks, including WAV/ZIP validity, per-sound memory,
      the manual, reduced motion, touch targets and 1440/390/320 px overflow.
- [x] `npm run release:media` green — nine real captures, no console errors and
      no network requests.
- [x] `npm run release:check` green — page fields match `package.json`, every
      screenshot and plate has the expected dimensions, the licence is present,
      and the single-file build is self-contained with `connect-src 'none'`.
- [x] `npm run itch:dist` green — `dist-itch/Crunchr-1.0.0.zip`, three files,
      ~133 kB, `crunchr.html` byte-identical to `dist-single/index.html`.
- [x] Description, tags, screenshots, cover, banner, support address and
      version are written down in this kit.
- [x] Price is free and the app is MIT licensed.
- [x] `Kind of Game` is documented as **Downloadable**, not HTML Game.

Still needs a person:

- [ ] Listen to every one of the eleven presets on headphones and on a phone
      speaker. The automated suite checks levels, finiteness, determinism and
      WAV validity, not whether the sounds are good.
- [ ] Upload the ZIP, then download it from the public page, unzip it and
      double-click `crunchr.html`. Export one WAV and the 10-version ZIP, reload
      the page and confirm the session comes back.
- [ ] Confirm the project URL `tarlow/crunchr` is the intended target, then set
      the page to Released and publish.
- [ ] Re-check the page at 390 px and on one non-Chrome browser. The browser
      suite runs Chrome only; the app uses standard Web Audio, Canvas and native
      range inputs, but it has not been smoke-tested in Firefox or Safari here.
