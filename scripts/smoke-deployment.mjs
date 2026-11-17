import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const compose = JSON.parse(execFileSync('docker', ['compose', 'config', '--format', 'json'], { encoding: 'utf8' }));
assert.deepEqual(Object.keys(compose.services).sort(), ['frontend']);
assert.equal(compose.services.frontend.build.dockerfile, 'frontend/Dockerfile');
assert.equal(compose.services.frontend.volumes, undefined);
assert.ok(!Object.keys(compose.services.frontend.environment ?? {}).some(key => /DATABASE|PRIVATE|SECRET|PASSWORD|TOKEN/.test(key)));
const ui = process.env.SPOTCHECK_APP_ORIGIN || `http://localhost:${process.env.SPOTCHECK_PORT || 3001}`;
const proxy = compose.services.frontend.build.args.NEXT_PUBLIC_PROXY_ORIGIN;
assert.equal(compose.services.frontend.build.args.NEXT_PUBLIC_PROXY_ORIGIN, proxy);
assert.notEqual(ui, proxy);
if (!process.argv.includes('--config-only')) {
  const get = url => fetch(url, { signal: AbortSignal.timeout(15_000) });
  for (const url of [ui]) assert.equal((await get(url)).status, 200, url);
}
console.log('Frontend deployment smoke passed; API and proxy are managed separately.');
