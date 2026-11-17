import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
const { publicConfigSchema } = createRequire(import.meta.url)('@spotcheck/shared');
const compose = JSON.parse(execFileSync('docker', ['compose', 'config', '--format', 'json'], { encoding: 'utf8' }));
assert.deepEqual(Object.keys(compose.services).sort(), ['backend', 'frontend', 'proxy']);
assert.equal(compose.services.frontend.build.dockerfile, 'frontend/Dockerfile');
assert.equal(compose.services.backend.build.dockerfile, 'backend/Dockerfile');
assert.equal(compose.volumes['pastel-data'].name, 'usewpastel_pastel-data');
assert.equal(compose.services.backend.environment.DATABASE_URL, 'file:/app/data/dev.db');
assert.equal(compose.services.backend.environment.UPLOAD_DIRECTORY, '/app/data/uploads');
assert.ok(compose.services.backend.volumes.some(volume => volume.source === 'pastel-data' && volume.target === '/app/data'));
assert.equal(compose.services.frontend.volumes, undefined);
assert.ok(!Object.keys(compose.services.frontend.environment ?? {}).some(key => /DATABASE|PRIVATE|SECRET|PASSWORD|TOKEN/.test(key)));
const api = compose.services.backend.environment.PUBLIC_API_ORIGIN;
const ui = compose.services.backend.environment.FRONTEND_ORIGIN;
const proxy = compose.services.proxy.environment.PROXY_ORIGIN;
assert.equal(compose.services.frontend.build.args.NEXT_PUBLIC_API_URL, api);
assert.equal(compose.services.frontend.build.args.NEXT_PUBLIC_PROXY_ORIGIN, proxy);
assert.notEqual(ui, proxy);
if (!process.argv.includes('--config-only')) {
  const get = (url, init) => fetch(url, { ...init, signal: AbortSignal.timeout(15_000) });
  for (const url of [ui, `${ui}/account-status`, `${api}/health`, `${proxy}/health`]) assert.equal((await get(url)).status, 200, url);
  const response = await get(`${api}/api/canvases`, { headers: { origin: ui } });
  assert.equal(response.status, 401);
  assert.equal(response.headers.get('access-control-allow-origin'), ui);
  assert.equal(response.headers.get('access-control-allow-credentials'), 'true');
  for (const pathname of ['/api/projects/unknown/workspace', '/api/canvases/unknown', '/api/uploads/00000000-0000-0000-0000-000000000000.png']) assert.equal((await get(`${api}${pathname}`)).status, 401);
  const config = publicConfigSchema.parse(await (await get(`${api}/api/config`)).json());
  assert.equal(config.proxyOrigin, proxy);
  if (!config.googleConfigured) assert.equal((await get(`${api}/api/auth/challenge`)).status, 503);
  assert.equal((await get(`${api}/api/auth/google`, { method: 'POST', headers: { origin: 'https://foreign.example', 'content-type': 'application/json' }, body: '{}' })).status, 403);
  assert.equal((await get(`${proxy}/?url=http%3A%2F%2F127.0.0.1`)).status, 502);
  const baselinePath = process.env.SPOTCHECK_BASELINE;
  if (baselinePath) {
    const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'));
    const script = "const {PrismaClient}=require('@prisma/client');const db=new PrismaClient();(async()=>{const tables={Canvas:await db.canvas.findMany({select:{id:true,shareId:true}}),Pin:await db.pin.findMany({select:{id:true}}),Comment:await db.comment.findMany({select:{id:true}})};console.log(JSON.stringify({tables}));await db.$disconnect()})().catch(()=>process.exit(1))";
    const current = JSON.parse(execFileSync('docker', ['compose', 'exec', '-T', 'backend', 'node', '-e', script], { encoding: 'utf8' }));
    for (const table of ['Canvas', 'Pin', 'Comment']) {
      assert.ok(current.tables[table].length >= baseline.tables[table].length, `${table} count preserved`);
      const ids = new Set(current.tables[table].map(row => row.id));
      for (const row of baseline.tables[table]) assert.ok(ids.has(row.id), `${table} record preserved`);
    }
    console.log(`Prior IDs preserved: ${baseline.tables.Canvas.length} projects, ${baseline.tables.Pin.length} pins, ${baseline.tables.Comment.length} comments.`);
  }
  execFileSync('docker', ['compose', 'exec', '-T', 'frontend', 'node', '-e', "const fs=require('node:fs');let orm=false;try{require.resolve('@prisma/client',{paths:['/app/frontend']});orm=true;}catch{}if(fs.existsSync('/app/backend')||orm||Object.keys(process.env).some(k=>/DATABASE_URL|PRIVATE_API_KEY|WEBHOOK_SECRET|SESSION_SECRET/.test(k)))process.exit(1)"], { stdio: 'pipe' });
}
console.log('Deployment/auth isolation smoke passed.');
