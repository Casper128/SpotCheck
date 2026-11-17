import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createProxyServer } from '../proxy/server.mjs';

const dev = process.argv.includes('--dev');
process.env.NODE_ENV ||= dev ? 'development' : 'production';
const requireBackend = createRequire(new URL('../backend/package.json', import.meta.url));
requireBackend('dotenv').config({ path: fileURLToPath(new URL('../backend/.env', import.meta.url)), quiet: true });
const { readConfig } = requireBackend('./dist/infrastructure/config/environment.js');
const { createApp } = requireBackend('./dist/presentation/createApp.js');
const requireFrontend = createRequire(new URL('../frontend/package.json', import.meta.url));
const next = requireFrontend('next');
const config = readConfig();
const port = Number(process.env.PORT || 3000);
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT no válido.');
const appOrigin = new URL(config.frontendOrigin);
const proxyOrigin = new URL(config.proxyOrigin || `http://preview.localhost:${port}`);
if (proxyOrigin.origin !== (config.proxyOrigin || proxyOrigin.origin) || !['http:', 'https:'].includes(proxyOrigin.protocol)) throw new Error('PROXY_ORIGIN debe ser un origen HTTP(S) exacto.');
if (appOrigin.host === proxyOrigin.host) throw new Error('El proxy requiere un host separado de la aplicación.');
if (config.publicApiOrigin !== config.frontendOrigin) throw new Error('En el despliegue unificado PUBLIC_API_ORIGIN y FRONTEND_ORIGIN deben coincidir.');
if (process.env.NODE_ENV === 'production' && !config.proxyOrigin) throw new Error('Configura PROXY_ORIGIN con un subdominio del mismo despliegue.');

// Run migrations against the runtime database, never against a temporary build database.
await new Promise((resolve, reject) => {
  const child = spawn(process.platform === 'win32' ? 'npm.cmd' : 'npm', ['run', 'db:migrate'], { stdio: 'inherit', env: process.env });
  child.once('error', reject);
  child.once('exit', code => code === 0 ? resolve() : reject(new Error('No se pudieron aplicar las migraciones PostgreSQL.')));
});
const api = await createApp({ config, logger: true });
const frontend = next({ dev, dir: fileURLToPath(new URL('../frontend', import.meta.url)) });
await frontend.prepare();
await api.ready();
const handleFrontend = frontend.getRequestHandler();
const proxy = await createProxyServer({ appOrigin: appOrigin.origin, proxyOrigin: proxyOrigin.origin });
const server = createServer({ requestTimeout: 20_000, headersTimeout: 10_000 }, (request, response) => {
  // Do not trust forwarded host headers: untrusted sites must never share the app origin.
  const host = (request.headers.host || '').toLowerCase();
  if (host === proxyOrigin.host.toLowerCase()) { proxy.emit('request', request, response); return; }
  if (host !== appOrigin.host.toLowerCase()) { response.writeHead(421); response.end('Host no configurado'); return; }
  const pathname = (request.url || '/').split('?')[0];
  if (pathname === '/health' || pathname === '/api' || pathname.startsWith('/api/') || pathname === '/swagger' || pathname.startsWith('/swagger/')) {
    api.server.emit('request', request, response);
    return;
  }
  void handleFrontend(request, response).catch(error => {
    console.error('Error al servir la interfaz:', error instanceof Error ? error.name : 'Error');
    if (!response.headersSent) response.writeHead(500);
    response.end();
  });
});
let stopping = false;
function shutdown() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 15_000).unref();
  server.close(() => {
    void Promise.all([api.close(), frontend.close()]).then(() => { clearTimeout(timeout); process.exit(0); }, () => process.exit(1));
  });
  server.closeIdleConnections();
}
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, shutdown);
server.listen(port, '0.0.0.0', () => console.log(`SpotCheck ready on port ${port}; application and isolated proxy share one deployment.`));
