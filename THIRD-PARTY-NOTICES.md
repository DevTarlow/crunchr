# Third-party notices

Crunchr's production bundle includes code from the following open-source
packages. They are used with their respective licenses.

## MIT-licensed runtime dependencies

### React and React DOM

Copyright (c) Meta Platforms, Inc. and affiliates.

Source: <https://github.com/facebook/react> — MIT License.

### JSZip (dual MIT / GPL-3.0; this project uses the MIT option)

Copyright (c) 2009-2016 Stuart Knightley, David Duponchel, Franz Buchinger and
António Afonso.

Source: <https://github.com/Stuk/jszip> — MIT or GPL-3.0-or-later. Crunchr uses
the MIT license.

### Tailwind CSS

Copyright (c) Tailwind Labs, Inc.

Source: <https://github.com/tailwindlabs/tailwindcss> — MIT License.

## MIT-licensed build and test tooling

- **Vite** — Copyright (c) VoidZero Inc. and Vite contributors,
  <https://github.com/vitejs/vite>, MIT.
- **@vitejs/plugin-react** — MIT, <https://github.com/vitejs/vite-plugin-react>.
- **vite-plugin-singlefile** — MIT,
  <https://github.com/richardtallent/vite-plugin-singlefile>.
- **Vitest** — Copyright (c) Anthony Fu, Matias Capeletto and Vitest
  contributors, <https://github.com/vitest-dev/vitest>, MIT.
- **@tailwindcss/vite** — Copyright (c) Tailwind Labs, Inc., MIT.

## Other development tooling

- **Playwright Core** — Copyright (c) Microsoft Corporation,
  <https://github.com/microsoft/playwright>, Apache-2.0. Used only by the
  headless Chrome smoke test; it is not included in the app bundle.
- **TypeScript** — Copyright (c) Microsoft Corporation,
  <https://github.com/microsoft/TypeScript>, Apache-2.0. Development dependency.

## MIT License text

The following license text applies to the MIT-licensed components listed above.

```text
MIT License

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

The individual copyright notices above are retained for redistribution. If you
distribute the standalone single-file build, ship this notice alongside it or
make it available in your project's credits.

## Audio

All audio in Crunchr is generated procedurally at runtime. This project does not
redistribute any audio samples. The pink-noise approximation is based on the
publicly documented Paul Kellet filter; remaining filters, oscillators, models
and envelopes are original to this repository. The RBJ Audio EQ Cookbook
formulas are used as a well-known DSP reference.
