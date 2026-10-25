# CapView

A minimal capture card viewer. Pick a video device and an audio device, and it shows the feed in a plain window with the audio played through your default output. Built to be shared as a window in Discord.

## Install

```bash
npm install
npm run dist
```

Then run `dist/CapView Setup 1.0.0.exe`. It installs per-user and adds CapView to the Start menu and desktop.

For development, `npm start` runs it without installing.

> If the build fails with an NSIS `could not open file` error, the project path is too long (Windows MAX_PATH). Move the repo to a shorter path.

## Usage

- Pick the capture card under **Video**, its audio under **Audio** (or `None`). On first launch the audio device with the same USB ID as the video device is picked automatically.
- The control bar and cursor hide after a few seconds of no mouse movement.
- Double-click the video or press **F11** for fullscreen. **F12** opens devtools.
- Your selections are remembered between launches.

## Sharing in Discord

Go Live / Screen Share → **Applications** → pick the **CapView** window. Discord captures the window's audio as well, so viewers hear the game sound.

## Troubleshooting

- **Black screen / "Could not start video source":** another app (OBS, the capture card's own software) is holding the device. Close it, then hit **Restart**.
- **Wrong resolution or low FPS:** cheap USB cards often top out at 1080p30/50, or need 720p for 60fps. Try a different preset; the mode the card really delivers is shown in green in the control bar. On a USB 2 port, 1080p is sent as heavily compressed MJPEG and looks soft; use a USB 3 port if the card supports it.
- **Low buzzing or humming:** usually a ground loop between the console and the PC (different power outlets) or noisy USB power. The **Hum filter** toggle (on by default) cuts everything below 90 Hz and notches 50/100/150 Hz. To remove it at the source, plug the console and PC into the same power strip, or try with the laptop charger unplugged.
- **Audio crackles or is delayed:** set the capture card's audio device to 48 kHz in Windows Sound settings → Recording → device Properties → Advanced.
