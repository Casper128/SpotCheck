import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
for (const app of ['frontend', 'backend']) {
  const filename = `${app}/.env`;
  if (!fs.existsSync(filename)) fs.copyFileSync(`${app}/.env.example`, filename);
}
const filename = 'backend/.env';
let contents = fs.readFileSync(filename, 'utf8');
if (!/^SESSION_SECRET=.+$/m.test(contents)) {
  contents = contents.replace(/^SESSION_SECRET=.*$/m, `SESSION_SECRET=${randomBytes(32).toString('hex')}`);
  fs.writeFileSync(filename, contents, { mode: 0o600 });
}
fs.chmodSync(filename, 0o600);
console.log('Environment templates prepared. Configure PostgreSQL and matching public origins before starting.');
