# CapView

Electron app that shows one capture-card video device and plays its audio. Meant to be shared as a window in Discord. The control bar hides when the mouse is idle.

Chromium flags in `main.js` keep the video composited (no hardware overlay). Picture adjustments are CSS/SVG filters on the `<video>`, so they show up in a window capture. Leave filters off when every picture slider is at 0.

## Files

- `package.json` — Electron app. `npm start` to run, `npm run dist` for the Windows installer.
- `src/main.js` — window, media-permission lockdown, F11 fullscreen, F12 devtools.
- `src/index.html` — video element, device bar, Picture panel, SVG filters (gamma, temperature, sharpness).
- `src/renderer.js` — device list, capture restart, hum filter, volume, picture settings. Saved in `localStorage` under `capview-settings`.
- `src/style.css` — fullscreen black video and the bottom bar.
- `build/icon.png` — window and installer icon.
- `README.md` — install and troubleshooting for humans.
- `node_modules/`, `dist/` — generated, gitignored.

## While editing

- UI copy stays plain. No extra chrome.
- `nodeIntegration` stays off. The page is sandboxed.
- A neutral picture (all sliders at 0) must not set a filter on the video.
