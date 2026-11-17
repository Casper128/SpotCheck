import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
const compose = JSON.parse(execFileSync('docker', ['compose', 'config', '--format', 'json'], { encoding: 'utf8' }));
assert.deepEqual(Object.keys(compose.services).sort(), ['frontend', 'proxy']);
assert.equal(compose.services.frontend.build.dockerfile, 'frontend/Dockerfile');
assert.equal(compose.services.frontend.volumes, undefined);
assert.ok(!Object.keys(compose.services.frontend.environment ?? {}).some(key => /DATABASE|PRIVATE|SECRET|PASSWORD|TOKEN/.test(key)));
const ui = compose.services.proxy.environment.APP_ORIGIN;
const proxy = compose.services.proxy.environment.PROXY_ORIGIN;
assert.equal(compose.services.frontend.build.args.NEXT_PUBLIC_PROXY_ORIGIN, proxy);
assert.notEqual(ui, proxy);
if (!process.argv.includes('--config-only')) {
  const get = url => fetch(url, { signal: AbortSignal.timeout(15_000) });
  for (const url of [ui, `${proxy}/health`]) assert.equal((await get(url)).status, 200, url);
  assert.equal((await get(`${proxy}/?url=http%3A%2F%2F127.0.0.1`)).status, 502);
}
console.log('Frontend/proxy deployment smoke passed; external API is managed separately.');
