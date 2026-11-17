import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { findResidues } from '../check-residues.mjs';

test('residue gate checks real env, source paths and regenerated artifacts, excluding dependencies', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'spotcheck-residue-fixture-'));
  const marker = String.fromCharCode(75, 105, 114, 97);
  try {
    for (const directory of ['backend/src/domain', 'backend/dist', 'frontend/.next/server', 'node_modules/vendor']) fs.mkdirSync(path.join(root, directory), { recursive: true });
    fs.writeFileSync(path.join(root, 'backend/.env'), `${marker.toUpperCase()}_ENABLED=false`);
    fs.writeFileSync(path.join(root, 'backend/dist/old.js'), `const integration = '${marker}';`);
    fs.writeFileSync(path.join(root, 'frontend/.next/server/old.js'), `const integration = '${marker}';`);
    fs.writeFileSync(path.join(root, 'node_modules/vendor/index.js'), marker);
    fs.writeFileSync(path.join(root, `backend/src/domain/${marker}.ts`), 'export {};');
    const errors = findResidues(root);
    assert.equal(errors.length, 4);
    assert.ok(errors.some((error) => error.startsWith('backend/.env:1')));
    assert.ok(errors.some((error) => error.startsWith('frontend/.next/server/old.js:1')));
    assert.ok(!errors.some((error) => error.includes('node_modules')));
    for (const relative of ['backend/.env', 'backend/dist/old.js', 'frontend/.next/server/old.js', `backend/src/domain/${marker}.ts`]) fs.unlinkSync(path.join(root, relative));
    assert.deepEqual(findResidues(root), []);
  } finally { fs.rmSync(root, { recursive: true, force: true }); }
});
