# KanjiCanvas (patched)

This folder contains a patched copy of [asdfjkl/kanjicanvas](https://github.com/asdfjkl/kanjicanvas) adapted for this app.

## Changes made

1. Stroke color/theme

- Set a unified pink stroke color `#ff79c6`.
- `strokeColors` now defaults to an array of `#ff79c6` for all strokes.
- `draw()` default stroke color changed from `#333` to `#ff79c6`.
- The initial dot drawn on mousedown uses `fillStyle = #ff79c6`.

2. Pointer/touch coordinate accuracy (Hi‑DPI aware)

- In `findxy()` for both `down` and `move`:
  - Prefer `event.offsetX/offsetY` when available (mouse).
  - Fall back to `(clientX/Y - rect.left/top)` for touch/others.
  - Scale coordinates by `canvas.width/rect.width` and `canvas.height/rect.height` to map CSS pixels to canvas pixels (fixes consistent left/up offsets on touch and mouse, including high‑DPI displays).

3. Stroke numbers

- Unchanged in the library; can be controlled via `canvas.dataset.strokeNumbers`.
- Our React wrapper sets this to `false` for a clean UI.

## Integration notes

- The React wrapper is `src/components/KanjiRecognizer.tsx`:
  - Dynamically imports `kanji-canvas.js` and `ref-patterns.js`.
  - Resizes the canvas to device pixel ratio and handles redraws.
  - Debounces recognition (200 ms) after the last stroke and shows a candidate popup.
  - Inserts selected kanji into the app input and clears the canvas.

## Upstream updates

If you update from upstream, re-apply the changes above (color + coordinate scaling). Alternatively, color theming can be performed in the wrapper by overriding `KanjiCanvas.draw` and `strokeColors`, but pointer scaling must remain in the library to ensure correctness across input types.

> Note: `ref-patterns.js` is intentionally large; avoid editing it.
