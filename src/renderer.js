const video = document.getElementById('video');
const statusEl = document.getElementById('status');
const videoSelect = document.getElementById('videoSelect');
const audioSelect = document.getElementById('audioSelect');
const resSelect = document.getElementById('resSelect');
const volume = document.getElementById('volume');
const reloadBtn = document.getElementById('reload');

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
  const c = { deviceId: { exact: videoSelect.value } };
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
    setStatus('');
  } catch (err) {
    setStatus(`Video failed: ${err.name} - ${err.message}`);
  }
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
    audioCtx.createMediaStreamSource(audioStream).connect(gainNode).connect(audioCtx.destination);
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
reloadBtn.addEventListener('click', async () => { await listDevices(); restart(); });

// Re-scan when a device is plugged in or removed.
navigator.mediaDevices.addEventListener('devicechange', listDevices);

// Hide the control bar and cursor after a few seconds without mouse movement.
let idleTimer = null;
function wake() {
  document.body.classList.remove('idle');
  clearTimeout(idleTimer);
  idleTimer = setTimeout(() => document.body.classList.add('idle'), 2500);
}
document.addEventListener('mousemove', wake);
document.addEventListener('mousedown', wake);

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
  wake();
  restart();
})();
