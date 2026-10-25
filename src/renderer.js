const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const videoSelect = document.getElementById('videoSelect');
const audioSelect = document.getElementById('audioSelect');
const resSelect = document.getElementById('resSelect');
const volume = document.getElementById('volume');
const reloadBtn = document.getElementById('reload');
const modeEl = document.getElementById('mode');
const bar = document.getElementById('bar');
const humToggle = document.getElementById('humFilter');

const STORE_KEY = 'capview-settings';
const NONE = 'none';

let videoStream = null;
let audioStream = null;
let audioCtx = null;
let gainNode = null;

function loadSettings() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || {};
  } catch {
    return {};
  }
}

function saveSettings() {
  localStorage.setItem(STORE_KEY, JSON.stringify({
    video: videoSelect.value,
    audio: audioSelect.value,
    res: resSelect.value,
    volume: volume.value,
    humFilter: humToggle.checked,
  }));
}

function setStatus(text) {
  statusEl.textContent = text || '';
  statusEl.classList.toggle('hidden', !text);
}

function stopStream(stream) {
  if (stream) stream.getTracks().forEach((t) => t.stop());
}

function fillSelect(select, devices, { allowNone }) {
  const previous = select.value;
  select.innerHTML = '';
  if (allowNone) select.add(new Option('None', NONE));
  devices.forEach((d, i) => {
    select.add(new Option(d.label || `Device ${i + 1}`, d.deviceId));
  });
  if ([...select.options].some((o) => o.value === previous)) select.value = previous;
}

async function listDevices() {
  // Device labels are only exposed after media permission has been granted once.
  try {
    const tmp = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    stopStream(tmp);
  } catch {
    // No camera or mic at all; enumerate anyway.
  }
  const devices = await navigator.mediaDevices.enumerateDevices();
  fillSelect(videoSelect, devices.filter((d) => d.kind === 'videoinput'), { allowNone: false });
  fillSelect(audioSelect, devices.filter((d) => d.kind === 'audioinput'), { allowNone: true });
}

// USB capture cards expose video and audio with the same "(vid:pid)" suffix in their labels.
function pairAudioWithVideo() {
  const label = videoSelect.selectedOptions[0]?.text || '';
  const usbId = label.match(/\(([0-9a-f]{4}:[0-9a-f]{4})\)/i)?.[1];
  if (!usbId) return;
  const match = [...audioSelect.options].find((o) => o.text.toLowerCase().includes(usbId.toLowerCase()));
  if (match) audioSelect.value = match.value;
}

function videoConstraints() {
  // resizeMode 'none' makes Chromium pick a mode the card really supports instead of
  // silently rescaling a lower-res mode up to the requested size.
  const c = { deviceId: { exact: videoSelect.value }, resizeMode: 'none' };
  if (resSelect.value !== 'auto') {
    const [, w, h, fps] = resSelect.value.match(/(\d+)x(\d+)@(\d+)/);
    c.width = { ideal: Number(w) };
    c.height = { ideal: Number(h) };
    c.frameRate = { ideal: Number(fps) };
  }
  return c;
}

async function startVideo() {
  stopStream(videoStream);
  videoStream = null;
  video.srcObject = null;
  if (!videoSelect.value) {
    setStatus('No video devices found. Plug in the capture card and hit Restart.');
    return;
  }
  setStatus('Starting video...');
  try {
    videoStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints(), audio: false });
    video.srcObject = videoStream;
    const s = videoStream.getVideoTracks()[0].getSettings();
    document.title = `CapView - ${s.width}x${s.height} @ ${Math.round(s.frameRate)}fps`;
    modeEl.textContent = `${s.width}x${s.height} @ ${Math.round(s.frameRate)}fps`;
    setStatus('');
  } catch (err) {
    setStatus(`Video failed: ${err.name} - ${err.message}`);
  }
}

// Cheap capture cards often pick up mains hum (50 Hz in Europe) and sub-bass rumble from
// ground loops or noisy USB power. A steep (4th-order Butterworth) high-pass removes the
// rumble, and notches on the mains harmonics remove the buzz above it.
const MAINS_HZ = 50;
function humFilters(ctx) {
  const highpass = [0.541, 1.307].map((Q) =>
    new BiquadFilterNode(ctx, { type: 'highpass', frequency: 90, Q }));
  const notches = [1, 2, 3].map((n) =>
    new BiquadFilterNode(ctx, { type: 'notch', frequency: MAINS_HZ * n, Q: 3 }));
  return [...highpass, ...notches];
}

async function startAudio() {
  stopStream(audioStream);
  audioStream = null;
  if (audioCtx) {
    await audioCtx.close();
    audioCtx = null;
  }
  if (!audioSelect.value || audioSelect.value === NONE) return;

  try {
    // Disable all voice processing so game audio passes through untouched.
    audioStream = await navigator.mediaDevices.getUserMedia({
      video: false,
      audio: {
        deviceId: { exact: audioSelect.value },
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
        channelCount: { ideal: 2 },
        sampleRate: { ideal: 48000 },
        latency: { ideal: 0 },
      },
    });
    audioCtx = new AudioContext({ latencyHint: 'interactive', sampleRate: 48000 });
    gainNode = audioCtx.createGain();
    gainNode.gain.value = Number(volume.value);
    let node = audioCtx.createMediaStreamSource(audioStream);
    if (humToggle.checked) {
      for (const filter of humFilters(audioCtx)) node = node.connect(filter);
    }
    node.connect(gainNode).connect(audioCtx.destination);
  } catch (err) {
    setStatus(`Audio failed: ${err.name} - ${err.message}`);
  }
}

async function restart() {
  await Promise.all([startVideo(), startAudio()]);
}

videoSelect.addEventListener('change', () => { saveSettings(); startVideo(); });
resSelect.addEventListener('change', () => { saveSettings(); startVideo(); });
audioSelect.addEventListener('change', () => { saveSettings(); startAudio(); });
volume.addEventListener('input', () => {
  if (gainNode) gainNode.gain.value = Number(volume.value);
  saveSettings();
});
humToggle.addEventListener('change', () => { saveSettings(); startAudio(); });
reloadBtn.addEventListener('click', async () => { await listDevices(); restart(); });

// Re-scan when a device is plugged in or removed.
navigator.mediaDevices.addEventListener('devicechange', listDevices);

// Hide the control bar and cursor shortly after the mouse stops, unless it's over the bar.
const IDLE_MS = 1000;
let idleTimer = null;
function goIdle() {
  clearTimeout(idleTimer);
  document.body.classList.add('idle');
}
function overBar(e) {
  const r = bar.getBoundingClientRect();
  return e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom;
}
// Uses the bar's rect rather than :hover, since the hidden bar ignores the pointer.
function wake(e) {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  if (!e || !overBar(e)) idleTimer = setTimeout(goIdle, IDLE_MS);
}
document.addEventListener('mousemove', wake);
document.addEventListener('mousedown', wake);
// Hide immediately when the cursor leaves the window (e.g. moving over to Discord).
document.documentElement.addEventListener('mouseleave', goIdle);
window.addEventListener('blur', () => { if (!document.hasFocus()) goIdle(); });

// Double-click the video to toggle fullscreen.
video.addEventListener('dblclick', () => {
  if (document.fullscreenElement) document.exitFullscreen();
  else document.documentElement.requestFullscreen();
});

(async function init() {
  await listDevices();
  const saved = loadSettings();
  const has = (select, value) => [...select.options].some((o) => o.value === value);
  if (saved.video && has(videoSelect, saved.video)) videoSelect.value = saved.video;
  if (saved.audio && has(audioSelect, saved.audio)) audioSelect.value = saved.audio;
  else pairAudioWithVideo();
  if (saved.res && has(resSelect, saved.res)) resSelect.value = saved.res;
  if (saved.volume) volume.value = saved.volume;
  if (typeof saved.humFilter === 'boolean') humToggle.checked = saved.humFilter;
  wake();
  restart();
})();
