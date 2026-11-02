#!/usr/bin/env node
const { spawn } = require('child_process');
const path = require('path');

process.title = 'NaviDan';

// Cross-platform binary resolution (Windows, Linux, macOS)
let electronPath;
try {
  electronPath = require('electron');
} catch {
  const binaryName = process.platform === 'win32' ? 'electron.exe' : 'electron';
  electronPath = path.join(__dirname, 'node_modules', 'electron', 'dist', binaryName);
}

const env = { ...process.env };
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronPath, ['.'], {
  cwd: __dirname,
  env,
  stdio: 'inherit',
  windowsHide: false
});

child.on('close', (code) => {
  process.exit(code || 0);
});
