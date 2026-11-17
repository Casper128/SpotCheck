import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const retiredName = String.fromCharCode(107, 105, 114, 97);
const ignored = new Set(['.git', 'node_modules', '.playwright-cli', 'output', 'coverage']);
const textFile = /\.(?:[cm]?[jt]sx?|json|map|css|html|md|ya?ml|txt|sh|prisma)$/i;

export function findResidues(root) {
  const errors = [];
  function visit(directory) {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      if (ignored.has(entry.name) || entry.isSymbolicLink()) continue;
      const filename = path.join(directory, entry.name);
      const relative = path.relative(root, filename).split(path.sep).join('/');
      if (relative.toLowerCase().includes(retiredName)) errors.push(`${relative}:1 Nombre retirado en ruta activa.`);
      if (entry.isDirectory()) { visit(filename); continue; }
      if (!entry.isFile() || !(textFile.test(entry.name) || entry.name.startsWith('.env') || entry.name.endsWith('Dockerfile'))) continue;
      const lines = fs.readFileSync(filename, 'utf8').split('\n');
      for (let index = 0; index < lines.length; index++) {
        if (lines[index].toLowerCase().includes(retiredName)) errors.push(`${relative}:${index + 1} Referencia de integración retirada.`);
      }
    }
  }
  visit(root);
  return errors;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = findResidues(process.cwd());
  if (errors.length) { process.stderr.write(errors.slice(0, 20).join('\n') + '\n'); process.exitCode = 1; }
  else process.stdout.write('Residue gate passed.\n');
}
