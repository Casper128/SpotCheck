import { spawn } from 'node:child_process';
const children = ['@spotcheck/backend', '@spotcheck/frontend'].map((workspace) => spawn('npm', ['run', 'start', '--workspace', workspace], { stdio: 'inherit', env: process.env }));
let stopping = false;
function stop(signal = 'SIGTERM') {
  if (stopping) return;
  stopping = true;
  for (const child of children) child.kill(signal);
}
process.on('SIGINT', () => stop('SIGINT'));
process.on('SIGTERM', () => stop());
for (const child of children) child.on('exit', (code) => { if (!stopping) { process.exitCode = code || 1; stop(); } });
