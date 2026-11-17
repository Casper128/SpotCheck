import { spawn } from 'node:child_process';

const build = spawn('npm', ['run', 'build', '--workspace', '@spotcheck/shared'], { stdio: 'inherit' });
build.on('exit', (code) => {
  if (code !== 0) { process.exitCode = code || 1; return; }
  const children = ['@spotcheck/shared', '@spotcheck/frontend'].map((workspace) =>
    spawn('npm', ['run', 'dev', '--workspace', workspace], { stdio: 'inherit', env: process.env }));
  let stopping = false;
  const stop = (signal = 'SIGTERM') => {
    if (stopping) return;
    stopping = true;
    for (const child of children) child.kill(signal);
  };
  process.on('SIGINT', () => stop('SIGINT'));
  process.on('SIGTERM', () => stop());
  for (const child of children) child.on('exit', (childCode) => { if (!stopping) { process.exitCode = childCode || 1; stop(); } });
});
