delete process.env.ELECTRON_RUN_AS_NODE;
const { spawn } = require('child_process');
const electronPath = require('electron');
const path = require('path');

const desktopDir = path.resolve(__dirname, '..');

const child = spawn(electronPath, ['.'], {
  stdio: 'inherit',
  env: process.env,
  cwd: desktopDir,
});

child.on('close', (code) => {
  process.exit(code || 0);
});
