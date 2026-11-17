import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import fs from 'node:fs';
import test from 'node:test';
import { inspectSource, checkProject } from '../check-architecture.mjs';
const root = path.join(os.tmpdir(), 'spotcheck-architecture-fixtures');
const inspect = (filename, source) => inspectSource(path.join(root, filename), source, root);

test('allows inward dependencies, shared DTO and public env', () => {
  assert.deepEqual(inspect('frontend/src/infrastructure/http/Api.ts', 'import type { Canvas } from "@spotcheck/shared"; import type { ReviewApi } from "@/domain/ReviewApi"; const api = process.env.NEXT_PUBLIC_API_URL;'), []);
  assert.deepEqual(inspect('backend/src/presentation/Controller.ts', 'import { Repository } from "../infrastructure/Repository";'), []);
});
test('rejects inverse layers through aliases, relatives, export, require and dynamic import', () => {
  for (const source of ['import { R } from "@/infrastructure/Repo";', 'export { R } from "../infrastructure/Repo";', 'const repo = require("../infrastructure/Repo");', 'const repo = import("../infrastructure/Repo");']) assert.ok(inspect('backend/src/application/UseCase.ts', source).some((error) => error.includes('Dependencia inversa')));
  assert.ok(inspect('backend/src/domain/Entity.ts', 'const repo = import(name);').length);
});
test('rejects data/UI leaks, private env, cross-app imports and unsafe typing', () => {
  for (const source of ['import { Prisma } from "@prisma/client";', 'const secret = process.env.PRIVATE_API_KEY;', 'const secret = process.env["DATABASE_URL"];', 'const { SECRET } = process.env;', 'import type { X } from "../../../backend/src/domain/X";', 'let value: any;', '// @ts-ignore\nlet value = 1;']) assert.ok(inspect('frontend/src/domain/View.ts', source).length, source);
  assert.ok(inspect('backend/src/presentation/Http.ts', 'import Link from "next/link";').length);
  assert.ok(inspect('shared/src/dto.ts', 'import type { X } from "../../backend/src/domain/X";').length);
});

test('project gate enforces symmetric directories and package isolation', () => {
  const fixture = fs.mkdtempSync(path.join(os.tmpdir(), 'spotcheck-structure-'));
  try {
    for (const app of ['backend', 'frontend']) for (const layer of ['domain', 'application', 'infrastructure', 'presentation']) fs.mkdirSync(path.join(fixture, app, 'src', layer), { recursive: true });
    assert.deepEqual(checkProject(fixture), []);
    fs.rmdirSync(path.join(fixture, 'frontend', 'src', 'domain'));
    assert.ok(checkProject(fixture).some((error) => error.includes('exactamente')));
    fs.mkdirSync(path.join(fixture, 'frontend', 'src', 'domain'));
    fs.writeFileSync(path.join(fixture, 'frontend', 'package.json'), JSON.stringify({ dependencies: { '@prisma/client': '6' } }));
    assert.ok(checkProject(fixture).some((error) => error.includes('Dependencia prohibida')));
  } finally { fs.rmSync(fixture, { recursive: true, force: true }); }
});
