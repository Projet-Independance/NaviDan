const { spawn } = require('child_process');
const electron = require('electron');

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const code = `
const { app, BrowserWindow } = require('electron');
app.whenReady().then(() => {
  const win = new BrowserWindow({ show: false });
  const proto = Object.getPrototypeOf(win.webContents);
  console.log('PROPS:', Object.getOwnPropertyNames(proto).filter(k => /audio|media/i.test(k)));
  app.quit();
});
`;

const p = spawn(electron, ['-e', code], { env, stdio: 'inherit' });

