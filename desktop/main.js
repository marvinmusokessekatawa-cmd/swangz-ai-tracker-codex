/* Swangz AI Tracker — the desktop window.
   ------------------------------------------------------------------
   This is a window onto the live site, not a copy of it. That is a decision,
   not a shortcut:

     · sign-in is Google OAuth against the deployed origin. A bundled copy
       would run on file:// and the redirect would have nowhere to land.
     · the data lives in Supabase, so an offline bundle would be a shell with
       nothing in it anyway.
     · deploying the site updates the app. Nobody has to reinstall anything to
       get a fix, which for an internal tool is the whole ball game.

   The service worker still runs inside this window, so the shell opens
   instantly and opens at all on a bad connection.
   ------------------------------------------------------------------ */
const { app, BrowserWindow, shell, Menu, dialog } = require('electron');
const path = require('path');
const fs = require('fs');

const SITE = process.env.SWANGZ_URL || 'https://swangz-ai-tracker.netlify.app/';
const HOST = new URL(SITE).host;

/* Google refuses OAuth from anything it recognises as an embedded browser, and
   Electron's default user agent announces itself as one — the sign-in page
   answers "this browser or app may not be secure" and there is no way past it.
   This is Chromium, so presenting Chromium's own user agent is accurate; what
   is removed is the Electron/app suffix that triggers the block. */
function cleanUserAgent(ua) {
  return ua
    .replace(/\sElectron\/[\d.]+/g, '')
    .replace(new RegExp('\\s' + app.getName().replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\/[\\d.]+', 'g'), '');
}

/* Remember where the window was, so it opens where they left it. */
const stateFile = () => path.join(app.getPath('userData'), 'window-state.json');
function readState() {
  try { return JSON.parse(fs.readFileSync(stateFile(), 'utf8')); } catch (_) { return {}; }
}
function writeState(win) {
  try {
    if (!win || win.isDestroyed()) return;
    const b = win.getNormalBounds ? win.getNormalBounds() : win.getBounds();
    fs.writeFileSync(stateFile(), JSON.stringify({ ...b, maximized: win.isMaximized() }));
  } catch (_) { /* a window position is never worth an error dialog */ }
}

let win = null;

function createWindow() {
  const s = readState();
  win = new BrowserWindow({
    width: s.width || 1280,
    height: s.height || 860,
    x: s.x, y: s.y,
    minWidth: 380,
    minHeight: 560,
    backgroundColor: '#02040a',          // the midnight ground, so there is no white flash
    show: false,
    autoHideMenuBar: true,
    title: 'Swangz AI Tracker',
    icon: path.join(__dirname, 'build', 'icon.png'),
    webPreferences: {
      /* Nothing on the page is trusted with Node. It is a website. */
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      spellcheck: true,
    },
  });
  if (s.maximized) win.maximize();

  const ses = win.webContents.session;
  ses.setUserAgent(cleanUserAgent(ses.getUserAgent()));

  win.once('ready-to-show', () => win.show());
  ['resize', 'move', 'maximize', 'unmaximize'].forEach(e => win.on(e, () => writeState(win)));
  win.on('close', () => writeState(win));
  win.on('closed', () => { win = null; });

  /* Anything that is not the tracker opens in the real browser: the tool
     websites people link, the Drive folder, the media on a project. A window
     with no address bar is no place to wander off into. */
  const external = url => {
    try { if (new URL(url).host !== HOST) { shell.openExternal(url); return true; } } catch (_) {}
    return false;
  };
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (external(url)) return { action: 'deny' };
    return { action: 'allow' };
  });
  win.webContents.on('will-navigate', (event, url) => {
    /* Google's sign-in pages are the exception — they must stay in this
       window or the session never comes back to us. */
    let host = '';
    try { host = new URL(url).host; } catch (_) { return; }
    const isAuth = /(^|\.)google\.com$/.test(host) ||
                   /(^|\.)googleusercontent\.com$/.test(host) ||
                   /(^|\.)supabase\.co$/.test(host);
    if (host !== HOST && !isAuth) { event.preventDefault(); shell.openExternal(url); }
  });

  win.webContents.on('did-fail-load', (e, code, desc, url, isMainFrame) => {
    if (!isMainFrame || code === -3) return;              // -3 is an aborted nav
    dialog.showMessageBox(win, {
      type: 'warning',
      title: 'Cannot reach the tracker',
      message: 'The Swangz AI Tracker could not be loaded.',
      detail: 'Check the connection and press Retry.\n\n' + desc + ' (' + code + ')',
      buttons: ['Retry', 'Close'],
      defaultId: 0,
    }).then(({ response }) => {
      if (response === 0) win.loadURL(SITE); else win.close();
    });
  });

  win.loadURL(SITE);
}

/* A menu with the handful of things a window needs, and nothing else. */
function buildMenu() {
  const isMac = process.platform === 'darwin';
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(isMac ? [{ role: 'appMenu' }] : []),
    {
      label: 'File',
      submenu: [
        { label: 'Reload', accelerator: 'CmdOrCtrl+R', click: () => win && win.reload() },
        { type: 'separator' },
        isMac ? { role: 'close' } : { role: 'quit' },
      ],
    },
    { role: 'editMenu' },
    {
      label: 'View',
      submenu: [
        { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' },
        { type: 'separator' }, { role: 'togglefullscreen' },
      ],
    },
    {
      label: 'Help',
      submenu: [
        { label: 'Open in browser', click: () => shell.openExternal(SITE) },
        { label: 'About', click: () => dialog.showMessageBox(win, {
            type: 'info', title: 'Swangz AI Tracker',
            message: 'Swangz AI Tracker ' + app.getVersion(),
            detail: 'A window onto ' + SITE + '\nDesigned & developed by Arnold Kigozi and Marvin Musoke.',
          }) },
      ],
    },
  ]));
}

/* One window, one app. A second launch focuses the one already open. */
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
  });
  app.whenReady().then(() => {
    buildMenu();
    createWindow();
    app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
  });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
}
