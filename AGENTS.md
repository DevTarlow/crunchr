# AGENTS.md — working in Crunchr

Operating contract for AI agents in this repository. Read this before editing
anything. For product architecture and usage, read [`README.md`](README.md).

## 1. The git contract

> **Commit after a task is done. Push only when explicitly asked.**

| Action | Who | When |
| --- | --- | --- |
| `git commit` | **The agent, unprompted** | As soon as a task is complete and verified. Do not leave finished work sitting in the working tree and do not ask whether to commit. |
| `git push` | **Only when the human explicitly says so** | On an unambiguous instruction such as *"push"*, *"push it"*, *"push that"* or *"push to GitHub"*. A previous push does not authorise the next one. |

- **Never push on your own initiative.** A green test run, a clean diff or a
  finished task are not permission. `commit ≠ push`.
- **A commit is the definition of "task done."** The loop is:
  implement → verify → commit → report the hash → **stop and wait**.
- **Explicit push only.** If the intent is ambiguous ("ship it", "get it up
  there"), ask before pushing. "Commit" means commit, not push.
- **Report every commit** with the short SHA and subject in the final message,
  and state that it has not been pushed.
- **Never rewrite published history** without explicit permission: no
  force-push, no rebasing or amending commits already on `origin/main`, and no
  `reset --hard` against published commits.
- **Never commit secrets or generated credentials.**

The remote is `origin` → <https://github.com/DevTarlow/crunchr.git>; the working
branch is `main`.

## 2. Task loop

1. **Orient.** Read this file and the relevant part of `README.md`. Check
   `git status --short --branch` and `git log --oneline -5` before editing.
2. **Change the smallest correct thing.** Keep unrelated cleanup out of the
   task.
3. **Verify.** Run the minimum gate for the kind of change (see §3).
4. **Commit** with a Conventional Commit message (see §4).
5. **Report** the short hash and subject; explicitly note "not pushed".
6. **Wait.** Do not run `git push` until the human asks.

If a request is a question or analysis with no file changes, no commit is
needed. If a task cannot be verified, report the failure rather than committing
a red tree.

## 3. Verification

The project is fast to check, so there is no excuse for committing a broken
tree.

| Command | What it covers | Typical use |
| --- | --- | --- |
| `npm run dev` | Vite dev server on port **5173** | Inner loop |
| `npm run typecheck` | `tsc --noEmit`, strict | Every code change |
| `npm test` | Vitest; pure audio/WAV/export tests | Every code change |
| `npm run test:browser` | Headless Chrome smoke against the existing `dist-single/` build | UI, audio, export or CSP changes |
| `npm run verify:browser` | `build:single` → browser smoke | Re-run just the browser gate |
| `npm run verify` | typecheck → tests → `dist/` → `dist-single/` → browser smoke | Before commit for risky work, and **always before a push** |
| `npm run build` | Standard static build in `dist/` | Build-sensitive changes |
| `npm run build:single` | Self-contained `dist-single/index.html` | Before itch packaging |

**Before every commit:** `npm run typecheck && npm test`. Add
`npm run verify:browser` when touching UI, audio, exports, CSP or the
single-file build.

**Before every push:** `npm run verify` (including the browser smoke).

### Browser smoke

`scripts/browser-smoke.mjs` uses `playwright-core` to drive the system Chrome
against the actual `dist-single/index.html` artifact from `file://`. It asserts:

- the single-file UI renders and no network requests leave the page;
- the first gesture arms audio; the trigger button, Spacebar and scope click
  each play the Dice preset and drive the live scope;
- WAV export is valid RIFF/PCM, 44.1 kHz, 16-bit, stereo and non-silent;
- the batch download contains exactly the ten correctly named valid WAVs;
- the 1440 px and 390 px layouts have no horizontal overflow;
- there are no console errors or page errors.

Chrome is located through `CHROME_PATH`, then the normal system install paths,
then a Playwright-managed Chromium path. A missing browser is a hard failure, not
a skipped test. The smoke test cannot judge subjective sound design; audition
material changes to the synthesis models yourself and say so when reporting.

Before pushing, always run the full `npm run verify`; do not claim a browser
check that was not executed. If the browser harness itself changes, update it and
this file in the same commit.

### Project-specific test expectations

- Add or update tests when synthesis, parameter mapping, humanization, WAV
  encoding or ZIP packaging changes.
- Preserve deterministic rendering: the same model, parameters and seed must
  produce the same samples.
- Extreme slider values and durations must remain finite, bounded and
  click-free.
- Never weaken TypeScript strictness to make a change compile.
- Keep the tree free of `TODO`, `FIXME` and placeholder implementations.

## 4. Commit rules

- **One coherent task = one commit.** Split independent work; do not bundle
  unrelated fixes.
- **Stage explicitly.** Check `git status` and add only files belonging to the
  task; avoid blind `git add -A`.
- **Conventional Commits**, imperative mood, one line under ~72 characters:
  `feat:`, `fix:`, `docs:`, `refactor:`, `test:`, `chore:`, `perf:`.
  Examples: `fix: keep WAV sample count aligned with render length`,
  `docs: codify the development workflow`.
- Add a short body when the *why* is not obvious from the subject. Mention the
  verification that was run when it matters.
- **No AI attribution**, "Generated with…" trailers or co-author lines.
- Update `README.md`, `AGENTS.md` or `THIRD-PARTY-NOTICES.md` in the same commit
  whenever behaviour, scripts, dependencies or this workflow changes.
- Build output (`dist/`, `dist-single/`), `node_modules/`, caches and
  `qa-artifacts/` are ignored and must never be committed.

## 5. Push rules

When the human explicitly asks to push:

1. Run `npm run verify`.
2. Confirm the working tree is clean (`git status --short --branch`).
3. Confirm the current branch is `main` and the commit history is sane.
4. Push the current branch to `origin` (the local credential helper is
   configured for GitHub via `gh`).
5. Report the branch, commit hash and remote; verify the remote ref matches the
   local commit.

Do not create pull requests, tags, releases or itch uploads unless explicitly
asked. A GitHub push is not an itch.io deployment.

## 6. Repository invariants

- **No audio sample assets.** All sound is procedural. Do not add `.wav`,
  `.mp3`, `.ogg` or other sample files to the app, and do not introduce runtime
  CDNs or remote assets.
- **Deterministic DSP is the source of truth.** The renderer in
  `src/audio/synthesis.ts` feeds audition, WAV export and ZIP batches. Keep them
  in sync; do not replace it with a live-only graph.
- **Preserve the export contract:** 44.1 kHz, 16-bit PCM, stereo, `audioBufferToWav`
  remains a standalone encoder, batches contain 10 WAVs, and downloads stay
  client-side.
- **Preserve autoplay compliance:** do not create or resume the `AudioContext`
  before a user gesture.
- **No external backend, analytics or telemetry.** The production CSP blocks
  network egress; keep it that way.
- **Keep the single-file build working.** `dist-single/index.html` must remain
  self-contained and openable from disk.
- **Keep the UI accessible and responsive.** Preserve labels, focus behavior,
  the Spacebar trigger and reduced-motion handling.
- **Source layout:** audio/DSP belongs under `src/audio/`, UI under
  `src/components/`; keep pure DSP functions testable and UI components thin.

## 7. Environment notes for this workspace

- The checkout can be reported as owned by a different uid than the git process,
  and the global gitconfig is read-only. Use a per-command safe directory:
  ```bash
  git -c safe.directory="$PWD" status
  git -c safe.directory="$PWD" log --oneline -5
  ```
  Running commands from the repository root keeps `$PWD` correct. Do not try to
  write `/home/<user>/.gitconfig`; it is read-only.
- GitHub authentication is available through `gh`. This repository's local Git
  config has `credential.helper=!gh auth git-credential`, so a normal
  `git -c safe.directory="$PWD" push` works once an explicit push is requested.
  Never write tokens into the repository or a remote URL.
- The browser smoke needs Google Chrome or a Chromium binary. Set
  `CHROME_PATH=/path/to/chrome` when it is not in a standard location. The
  `playwright-core` package deliberately does not download a browser.
- npm's default cache directory is read-only in this environment. If dependency
  installation is needed, use a writable cache:
  ```bash
  npm install --cache /tmp/crunchr-npm-cache
  ```
- The dev server is pinned to port 5173. Do not start a competing server unless
  the existing one is unusable.

## 8. Definition of done

A task is done only when:

- the requested change is implemented;
- `npm run typecheck && npm test` pass, plus `npm run verify` when appropriate;
- the browser smoke has run (`npm run verify:browser`) whenever UI, audio,
  exports, CSP or the single-file build changed;
- docs are updated if behaviour or workflow changed;
- only task-related files are staged;
- a Conventional Commit exists;
- the commit hash is reported and the change has **not** been pushed.

If this workflow changes — new scripts, different gates, a changed commit or
push policy — update this file in the same commit.
