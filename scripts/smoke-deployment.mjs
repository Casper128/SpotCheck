import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const compose = JSON.parse(execFileSync('docker', ['compose', 'config', '--format', 'json'], { encoding: 'utf8' }));
assert.deepEqual(Object.keys(compose.services).sort(), ['app', 'postgres']);
assert.equal(compose.services.app.build.dockerfile, 'Dockerfile');
const app = compose.services.app.environment;
assert.equal(app.PUBLIC_API_ORIGIN, app.FRONTEND_ORIGIN);
assert.notEqual(new URL(app.FRONTEND_ORIGIN).host, new URL(app.PROXY_ORIGIN).host);
assert.ok(app.DATABASE_URL.startsWith('postgresql://'));
assert.equal(compose.services.app.build.args.NEXT_PUBLIC_API_URL, app.FRONTEND_ORIGIN);
assert.equal(compose.services.app.build.args.NEXT_PUBLIC_PROXY_ORIGIN, app.PROXY_ORIGIN);
if (!process.argv.includes('--config-only')) {
  for (const url of [app.FRONTEND_ORIGIN, `${app.FRONTEND_ORIGIN}/health`, `${app.FRONTEND_ORIGIN}/swagger/json`, `${app.PROXY_ORIGIN}/health`]) {
    assert.equal((await fetch(url, { signal: AbortSignal.timeout(15_000) })).status, 200, url);
  }
}
console.log('Unified deployment smoke passed.');
