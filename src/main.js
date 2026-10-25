const { app, BrowserWindow, session } = require('electron');
const path = require('path');

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
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      backgroundThrottling: false,
    },
  });

  win.loadFile(path.join(__dirname, 'index.html'));

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
  // Only grant camera/mic access; deny everything else.
  session.defaultSession.setPermissionRequestHandler((_wc, permission, callback) => {
    callback(permission === 'media');
  });
  session.defaultSession.setPermissionCheckHandler((_wc, permission) => permission === 'media');

  createWindow();
});

app.on('window-all-closed', () => app.quit());
