import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createStartupLog, repositoryRoot, safeError } from './startup-log.mjs';

const log = createStartupLog();
let phase = 'bootstrap';
let failing = false;
let activeMigration = null;
let api;
let frontend;
let server;
const started = Date.now();
const dev = process.argv.includes('--dev');
process.env.NODE_ENV ||= dev ? 'development' : 'production';
log.write('info', 'startup.begin', { node: process.version, cwd: process.cwd(), root: repositoryRoot, logFile: log.filename, portProvided: Boolean(process.env.PORT) });

function failure(error) {
  if (failing) return;
  failing = true;
  log.write('error', 'startup.failed', { phase, elapsedMs: Date.now() - started, ...safeError(error) });
  activeMigration?.kill('SIGTERM');
  // Exit promptly so the supervisor can restart the process. No secrets in default error stacks.
  process.exit(1);
}
process.on('uncaughtException', failure);
process.on('unhandledRejection', failure);
let shutdownHandler = signal => {
  log.write('warn', 'startup.interrupted', { phase, signal });
  activeMigration?.kill('SIGTERM');
  process.exit(0);
};
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => shutdownHandler(signal));
async function stage(name, run) {
  phase = name;
  const time = Date.now();
  log.write('info', 'stage.begin', { phase });
  const timer = setInterval(() => log.write('warn', 'stage.waiting', { phase: name, elapsedMs: Date.now() - time }), 15_000).unref();
  try {
    const result = await run();
    log.write('info', 'stage.ready', { phase: name, durationMs: Date.now() - time });
    return result;
  } finally { clearInterval(timer); }
}
function configurationError(code) { return Object.assign(new Error(), { code }); }

async function main() {
  // A managed host may invoke the entrypoint from another directory.
  process.chdir(repositoryRoot);
  const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
  const modules = await stage('modules', async () => {
    requireBackend('dotenv').config({ path: fileURLToPath(new URL('../backend/.env', import.meta.url)), quiet: true });
    const { readConfig } = requireBackend('./dist/infrastructure/config/environment.js');
    const { createApp } = requireBackend('./dist/presentation/createApp.js');
    const requireFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
    const next = requireFrontend('next');
    const { createProxyServer } = await import('../proxy/server.mjs');
    return { readConfig, createApp, next, createProxyServer };
  });
  const { config, port, appOrigin } = await stage('configuration', async () => {
    const config = modules.readConfig();
    const port = Number(process.env.PORT || 3000);
    if (!Number.isInteger(port) || port < 1 || port > 65535) throw configurationError('CONFIG_PORT');
    const appOrigin = new URL(config.frontendOrigin);
    const proxyOrigin = new URL(config.proxyOrigin || `${appOrigin.origin}/proxy`);
    if (proxyOrigin.origin !== appOrigin.origin || proxyOrigin.pathname.replace(/\/$/, '') !== '/proxy') throw configurationError('CONFIG_PROXY_ORIGIN');
    if (config.publicApiOrigin !== config.frontendOrigin) throw configurationError('CONFIG_API_ORIGIN');
    config.proxyOrigin = `${appOrigin.origin}/proxy`;
    log.write('info', 'configuration.summary', { port, portSource: process.env.PORT ? 'environment' : 'default', databaseConfigured: Boolean(process.env.DATABASE_URL), googleConfigured: Boolean(config.googleClientId && config.sessionSecret) });
    return { config, port, appOrigin };
  });
  await stage('postgres.migrations', () => new Promise((resolve, reject) => {
    const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:migrate'], { cwd: repositoryRoot, stdio: ['ignore', 'pipe', 'pipe'], env: process.env });
    activeMigration = child;
    let output = '';
    let timedOut = false;
    const capture = chunk => { output = (output + chunk.toString()).slice(-16_384); };
    child.stdout.on('data', capture);
    child.stderr.on('data', capture);
    const timeout = setTimeout(() => { timedOut = true; child.kill('SIGTERM'); }, 120_000).unref();
    child.once('error', error => { clearTimeout(timeout); activeMigration = null; reject(error); });
    child.once('close', (code, signal) => {
      clearTimeout(timeout);
      activeMigration = null;
      if (code === 0 && !timedOut) { resolve(); return; }
      const prismaCode = output.match(/\bP\d{4}\b/)?.[0];
      log.write('error', 'postgres.migrations.failed', { exitCode: code, signal });
      reject(Object.assign(new Error(), { code: timedOut ? 'MIGRATION_TIMEOUT' : prismaCode || 'MIGRATION_FAILED' }));
    });
  }));
  api = await stage('backend', () => modules.createApp({ config, logger: true }));
  await stage('next.prepare', async () => {
    frontend = modules.next({ dev, dir: fileURLToPath(new URL('../frontend', import.meta.url)) });
    await frontend.prepare();
  });
  await stage('backend.ready', () => api.ready());
  const handleFrontend = frontend.getRequestHandler();
  const proxy = await stage('proxy', () => modules.createProxyServer({ appOrigin: appOrigin.origin, proxyOrigin: config.proxyOrigin }));
  let hostWarning = false;
  server = createServer({ requestTimeout: 20_000, headersTimeout: 10_000 }, (request, response) => {
    const host = (request.headers.host || '').toLowerCase();
    if (host !== appOrigin.host.toLowerCase()) {
      if (!hostWarning) {
        hostWarning = true;
        log.write('warn', 'request.host-mismatch', { expectedHost: appOrigin.host, observedHost: /^[a-z0-9.:[\]-]{1,255}$/.test(host) ? host : 'invalid' });
      }
      response.writeHead(421); response.end('Host no configurado'); return;
    }
    const pathname = (request.url || '/').split('?')[0];
    // The diagnostic file is private even if a future static handler is added.
    if (pathname === '/.runtime' || pathname.startsWith('/.runtime/')) { response.writeHead(404); response.end(); return; }
    if (pathname === '/proxy' || pathname.startsWith('/proxy/')) { proxy.emit('request', request, response); return; }
    if (pathname === '/health' || pathname === '/api' || pathname.startsWith('/api/') || pathname === '/swagger' || pathname.startsWith('/swagger/')) {
      api.server.emit('request', request, response); return;
    }
    void handleFrontend(request, response).catch(error => {
      log.write('error', 'request.frontend-failed', safeError(error));
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  await stage('http.listen', () => new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '0.0.0.0', () => { server.removeListener('error', reject); resolve(); });
  }));
  phase = 'running';
  server.on('error', failure);
  log.write('info', 'startup.ready', { port, bind: '0.0.0.0', elapsedMs: Date.now() - started });
  let stopping = false;
  function shutdown(signal) {
    if (stopping) return;
    stopping = true;
    log.write('info', 'shutdown.begin', { signal });
    const timeout = setTimeout(() => process.exit(1), 15_000).unref();
    server.close(() => {
      void Promise.all([api.close(), frontend.close()]).then(() => { clearTimeout(timeout); process.exit(0); }, failure);
    });
    server.closeIdleConnections();
  }
  shutdownHandler = shutdown;
}
void main().catch(failure);
