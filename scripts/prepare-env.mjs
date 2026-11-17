import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
for (const app of ['backend', 'frontend']) {
  const filename = `${app}/.env`;
  if (!fs.existsSync(filename)) fs.copyFileSync(`${app}/.env.example`, filename);
}
const filename = 'backend/.env';
let source = fs.readFileSync(filename, 'utf8');
if (!/^SESSION_SECRET=.+$/m.test(source)) {
  const entry = `SESSION_SECRET=${randomBytes(32).toString('hex')}`;
  source = /^SESSION_SECRET=.*$/m.test(source) ? source.replace(/^SESSION_SECRET=.*$/m, entry) : `${source.trimEnd()}\n${entry}\n`;
  fs.writeFileSync(filename, source, { mode: 0o600 });
}
fs.chmodSync(filename, 0o600);
console.log('Environment prepared; private session key stays in backend/.env.');
