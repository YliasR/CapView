const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const { pathToFileURL } = require('url');

const INDEX_FILE = path.join(__dirname, 'index.html');
const INDEX_URL = pathToFileURL(INDEX_FILE).href;
const isAppPage = (url) => typeof url === 'string' && url.split('#')[0] === INDEX_URL;

// Keep video smooth when the window is in the background (e.g. while Discord is focused).
app.commandLine.appendSwitch('disable-renderer-backgrounding');
app.commandLine.appendSwitch('disable-background-timer-throttling');

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

app.whenReady().then(() => {
  // Only grant camera/mic access, and only to the app's own page; deny everything else.
  session.defaultSession.setPermissionRequestHandler((wc, permission, callback, details) => {
    callback(permission === 'media' && isAppPage(details.requestingUrl || wc.getURL()));
  });
  session.defaultSession.setPermissionCheckHandler((wc, permission, _origin, details) => {
    return permission === 'media' && isAppPage(details.requestingUrl || (wc && wc.getURL()));
  });

  createWindow();
});

app.on('window-all-closed', () => app.quit());
