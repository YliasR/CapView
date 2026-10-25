# CapView

A minimal capture card viewer for Windows. Pick a video device and an audio device, and it shows the feed in a plain window with the audio played through your default output. Built to be shared as a window in Discord.

The current release is **1.2.0**. License: [MIT](LICENSE).

## Install

Download `CapView-Setup-1.2.0.exe` from the [releases page](https://github.com/YliasR/CapView/releases) and run it. The installer is 64-bit Windows only.

The setup wizard:

- Shows the MIT license. The wizard follows the Windows display language; the license text is English.
- Choose **Only for me** (the default, no administrator prompt) or **Anyone who uses this computer (all users)**, which asks for an administrator. Those labels are translated with the Windows language.
- Lets you pick the install folder. **Only for me** defaults to `%LocalAppData%\Programs\CapView`.
- Adds Start menu and desktop shortcuts.
- Registers an uninstaller under Windows Settings → Apps, named **CapView**.
- The finish page starts CapView unless you clear **Run CapView**.

Windows SmartScreen may warn on first launch because the installer is not code-signed. Choose **More info**, then **Run anyway**.

`v1.0.0` does not check for updates. Install 1.0.1 or later once to get that.

## Updates

CapView 1.0.1 and later check GitHub Releases on startup.

- A newer release opens a dialog with **Install** and **Not now**.
- **Install** downloads the update. The window title shows the percent, then CapView restarts and installs it.
- **Not now** keeps the running version.
- If the check cannot reach the release (offline, or the repository is still private), nothing is shown. An error dialog only appears when a download you already asked for fails.

`npm start` does not check. The app has no update token, so the repository has to be public for the check to work.

## Usage

- Pick the capture card under **Video**, its audio under **Audio** (or `None`). On first launch, if no audio device was saved, the audio device with the same USB ID as the video device is picked automatically.
- **Resolution** starts at 1080p60. Presets are 1080p60, 1080p30, 720p60, 720p30, and Auto. The green readout in the control bar is the mode the card is actually delivering.
- **Volume** and **Hum filter** (on by default) apply to the capture-card audio.
- **Picture** adjusts brightness, contrast, sharpness, saturation, hue, gamma, and temperature. 0 leaves the image unchanged. Click a number to reset that slider.
- **Restart** releases the devices and opens them again.
- The control bar and cursor hide after 1 second without mouse movement. They also hide as soon as the pointer leaves the window, or the window loses focus. Moving the mouse brings them back.
- Double-click the video or press **F11** for fullscreen. **F12** opens devtools.
- Video, audio, resolution, volume, the hum filter, and picture settings are remembered between launches.

## Sharing in Discord

Go Live / Screen Share → **Applications** → pick the **CapView** window. Discord captures the window's audio as well, so viewers hear the game sound.

## Build

Development, without installing:

```bash
npm install
npm start
```

The Windows installer is built with:

```bash
npm run dist
```

That writes `dist/CapView-Setup-1.2.0.exe` and does not publish it. On Windows, if NSIS fails with `could not open file`, the project path is longer than `MAX_PATH`. Move the repo to a shorter path.

Pushes and pull requests to `master` (the default branch) build that installer on GitHub Actions and upload it as a workflow artifact. The workflow also runs for `main` if that branch exists. Tagging `vX.Y.Z` publishes the installer, `latest.yml`, the blockmap, and `SHA256SUMS.txt` as a GitHub release. The in-app updater reads that release.

## Troubleshooting

- **Black screen / `Video failed: NotReadableError - Could not start video source`:** another app (OBS, the capture card's own software) is holding the device. Close it, then hit **Restart**.
- **Wrong resolution or low FPS:** cheap USB cards often top out at 1080p30/50, or need 720p for 60fps. Try a different preset. The mode the card really delivers is shown in green in the control bar. On a USB 2 port, 1080p is sent as heavily compressed MJPEG and looks soft; use a USB 3 port if the card supports it.
- **Low buzzing or humming:** cheap USB capture cards (MS2130 "USB3 Video" and similar) put a buzz into their own audio while video streams. It sits at the video frame rate (30 or 60 Hz) and every harmonic of it up to about 2 kHz, so it is not mains hum and changing outlets does not help. The **Hum filter** toggle (on by default) locks onto the frame rate the card is delivering and subtracts that comb, adapting to the buzz's level and phase. It also cuts everything below 40 Hz. A musical note that sits exactly on a multiple of the frame rate is reduced as well. If a buzz is still there with the filter on, check whether it comes from the PC's own output: set **Audio** to `None`. If it stays, the hum is between the PC and your speakers or headphones (a ground loop on the output), and no filter in the app can reach it.
- **Audio crackles or is delayed:** set the capture card's audio device to 48 kHz in Windows Sound settings → Recording → device Properties → Advanced.
