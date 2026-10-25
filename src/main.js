const { app, BrowserWindow, dialog, session } = require('electron');
const { autoUpdater } = require('electron-updater');
const path = require('path');
const { pathToFileURL } = require('url');

const INDEX_FILE = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).href;
const isAppPage = (url) => typeof url === 'string' && url.split('#')[0] === INDEX_URL;

// Keep video smooth when the window is in the background (e.g. while Discord is focused).
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');
// Stop Chromium from moving the video onto a hardware overlay plane whenever nothing covers it.
// On many GPUs (notably NVIDIA hybrid laptops) that switch flashes a green frame when the
// control bar hides.
app.commandLine.appendSwitch('disable-direct-composition-video-overlays');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 720,
    minWidth: 480,
    minHeight: 270,
    backgroundColor: '#000000',
    title: 'CapView',
    icon: path.join(__dirname, 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webviewTag: false,
      backgroundThrottling: false,
    },
  });

  win.loadFile(INDEX_FILE);

  // The app only ever shows its own page: block navigation and popups.
  win.webContents.on('will-navigate', (event) => event.preventDefault());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));

  // F11 toggles fullscreen, F12 opens devtools.
  win.webContents.on('before-input-event', (event, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') {
      win.setFullScreen(!win.isFullScreen());
      event.preventDefault();
    } else if (input.key === 'F12') {
      win.webContents.toggleDevTools();
      event.preventDefault();
    }
  });
}

function setWindowTitle(title) {
  for (const win of BrowserWindow.getAllWindows()) win.setTitle(title);
}

// Packaged builds check GitHub Releases on startup. The dialog is the only
// prompt: Install downloads and restarts, Not now keeps the current version.
function setupAutoUpdater() {
  if (!app.isPackaged) return;

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.logger = console;

  let installRequested = false;

  autoUpdater.on('error', (error) => {
    console.error('Update error:', error);
    if (!installRequested) return;
    installRequested = false;
    setWindowTitle('CapView');
    dialog.showMessageBox({
      type: 'error',
      buttons: ['OK'],
      title: 'Update failed',
      message: 'CapView could not install the update.',
      detail: (error && error.message) || 'Check your connection and try again on the next launch.',
    });
  });

  autoUpdater.on('update-available', async (info) => {
    const version = info && info.version ? info.version : 'a newer version';
    const parent = BrowserWindow.getAllWindows().find((win) => !win.isDestroyed());
    const choice = {
      type: 'info',
      buttons: ['Install', 'Not now'],
      defaultId: 0,
      cancelId: 1,
      noLink: true,
      title: 'Update available',
      message: `CapView ${version} is available.`,
      detail: `You are using ${app.getVersion()}. Install it now? CapView will download the update and restart when it is ready.`,
    };
    const { response } = parent
      ? await dialog.showMessageBox(parent, choice)
      : await dialog.showMessageBox(choice);
    if (response !== 0) return;
    installRequested = true;
    setWindowTitle('CapView — downloading update');
    autoUpdater.downloadUpdate().catch((error) => console.error('Update download failed:', error));
  });

  autoUpdater.on('download-progress', (progress) => {
    const percent = Math.round(progress.percent || 0);
    setWindowTitle(`CapView — downloading update ${percent}%`);
  });

  autoUpdater.on('update-downloaded', () => {
    autoUpdater.quitAndInstall(true, true);
  });

  autoUpdater.checkForUpdates().catch((error) => console.error('Update check failed:', error));
}

app.whenReady().then(() => {
  // Only grant camera/mic access, and only to the app's own page; deny everything else.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(permission === 'media' && isAppPage(details.requestingUrl || wc.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) => {
    return permission === 'media' && isAppPage(details.requestingUrl || (wc && wc.getURL()));
  });

  createWindow();
  setupAutoUpdater();
});

app.on('window-all-closed', () => app.quit());
