import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const layers = ['domain', 'application', 'infrastructure', 'presentation'];
const allowed = { domain: ['domain'], application: ['domain', 'application'], infrastructure: ['domain', 'application', 'infrastructure'], presentation: layers };
const forbiddenData = /(^|\/)(@prisma|prisma|pg|postgres|mysql2?|mongodb|mongoose|sqlite3?|better-sqlite3|sequelize|typeorm|drizzle-orm|knex)(\/|$)/;
const forbiddenUI = /^(next(?:\/|$)|react(?:-dom)?(?:\/|$)|lucide-react(?:\/|$)|zustand(?:\/|$))/;
const extensions = /\.(?:[cm]?[jt]sx?)$/;
const normalize = (value) => value.split(path.sep).join('/');

export function inspectSource(filename, text, root) {
  const errors = [];
  const relative = normalize(path.relative(root, filename)).replace(/^frontend\/shared\//, 'shared/');
  const app = relative.split('/')[0];
  const production = !relative.includes('/tests/');
  const sourceLayer = relative.match(/^(backend|frontend)\/src\/([^/]+)\//)?.[2];
  const source = ts.createSourceFile(filename, text, ts.ScriptTarget.Latest, true, filename.endsWith('x') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const add = (node, message) => errors.push(`${relative}:${source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1} ${message}`);
  if (/@ts-(?:ignore|nocheck)\b/.test(text)) errors.push(`${relative}:1 No se permite @ts-ignore/@ts-nocheck.`);
  const validateImport = (node, specifier) => {
    if (app === 'frontend' && (forbiddenData.test(specifier) || (production && specifier.startsWith('node:')) || /^(fs|path|crypto|http|https|net|tls|child_process)$/.test(specifier))) add(node, `Import privado/BD prohibido en frontend: ${specifier}`);
    if (app === 'backend' && forbiddenUI.test(specifier)) add(node, `Dependencia UI/Next prohibida en backend: ${specifier}`);
    if (app === 'shared' && (forbiddenData.test(specifier) || forbiddenUI.test(specifier) || (production && specifier.startsWith('node:')))) add(node, `Shared debe ser neutral: ${specifier}`);
    if (/^@spotcheck\/(backend|frontend)(?:\/|$)/.test(specifier)) add(node, `No importar otra aplicación: ${specifier}`);
    let destination;
    if (specifier.startsWith('@/')) destination = path.resolve(root, app, 'src', specifier.slice(2));
    else if (specifier.startsWith('.')) destination = path.resolve(path.dirname(filename), specifier);
    if (!destination) return;
    const target = normalize(path.relative(root, destination)).replace(/^frontend\/shared\//, 'shared/');
    if (!target.startsWith(`${app}/`) && !target.startsWith('shared/')) { add(node, `Import escapa de su aplicación: ${specifier}`); return; }
    if (app === 'shared' && !target.startsWith('shared/')) add(node, 'Shared no puede importar aplicaciones.');
    const destinationLayer = target.match(/^(backend|frontend)\/src\/([^/]+)(?:\/|$)/)?.[2];
    if (sourceLayer && destinationLayer && !allowed[sourceLayer]?.includes(destinationLayer)) add(node, `Dependencia inversa: ${sourceLayer} -> ${destinationLayer}`);
    if (sourceLayer && target.startsWith(`${app}/app/`)) add(node, 'Una capa interna no puede importar el adaptador app.');
  };
  const visit = (node) => {
    if (node.kind === ts.SyntaxKind.AnyKeyword) add(node, 'No se permite el tipo any.');
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) validateImport(node, node.moduleSpecifier.text);
    if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      const argument = node.arguments[0];
      if (argument && (ts.isStringLiteral(argument) || ts.isNoSubstitutionTemplateLiteral(argument))) validateImport(node, argument.text);
      else add(node, 'Import dinámico no verificable.');
    }
    if (app === 'frontend' && ts.isPropertyAccessExpression(node) && node.expression.getText(source) === 'process.env') {
      if (!node.name.text.startsWith('NEXT_PUBLIC_')) add(node, `Variable privada en frontend: ${node.name.text}`);
    }
    if (app === 'frontend' && ts.isElementAccessExpression(node) && node.expression.getText(source) === 'process.env') {
      const argument = node.argumentExpression;
      if (!argument || !ts.isStringLiteral(argument) || !argument.text.startsWith('NEXT_PUBLIC_')) add(node, 'Acceso a variable privada/no verificable en frontend.');
    }
    if (app === 'frontend' && ts.isVariableDeclaration(node) && node.initializer?.getText(source) === 'process.env') add(node, 'No desestructurar/copiar process.env en frontend.');
    ts.forEachChild(node, visit);
  };
  visit(source);
  return errors;
}

function listFiles(directory) {
  if (!fs.existsSync(directory)) return [];
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    if (['node_modules', '.next', 'dist', 'coverage'].includes(entry.name)) return [];
    const filename = path.join(directory, entry.name);
    return entry.isDirectory() ? listFiles(filename) : extensions.test(entry.name) && !entry.name.endsWith('.d.ts') ? [filename] : [];
  });
}

export function checkProject(root) {
  const errors = [];
  const applications = ['frontend', ...(fs.existsSync(path.join(root, 'backend')) ? ['backend'] : [])];
  for (const app of applications) {
    const directory = path.join(root, app, 'src');
    const actual = fs.existsSync(directory) ? fs.readdirSync(directory).filter((name) => !name.startsWith('.')).sort() : [];
    if (actual.join(',') !== [...layers].sort().join(',')) errors.push(`${app}/src:1 Debe contener exactamente domain/application/infrastructure/presentation.`);
    const configPath = path.join(root, app, 'tsconfig.json');
    if (fs.existsSync(configPath)) {
      const config = ts.readConfigFile(configPath, ts.sys.readFile);
      const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, path.dirname(configPath));
      if (parsed.options.strict !== true) errors.push(`${app}/tsconfig.json:1 strict debe ser true.`);
    }
  }
  for (const app of [...applications, 'shared']) {
    const appDirectory = app === 'shared' && fs.existsSync(path.join(root, 'frontend/shared')) ? 'frontend/shared' : app;
    const packagePath = path.join(root, appDirectory, 'package.json');
    if (fs.existsSync(packagePath)) {
      const manifest = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      for (const dependency of Object.keys({ ...manifest.dependencies, ...manifest.devDependencies })) {
        if ((app === 'frontend' && forbiddenData.test(dependency)) || (app === 'backend' && forbiddenUI.test(dependency)) || (app === 'shared' && (forbiddenData.test(dependency) || forbiddenUI.test(dependency)))) errors.push(`${app}/package.json:1 Dependencia prohibida: ${dependency}`);
      }
    }
    for (const directory of ['src', ...(app === 'frontend' ? ['app'] : []), 'tests']) for (const filename of listFiles(path.join(root, appDirectory, directory))) errors.push(...inspectSource(filename, fs.readFileSync(filename, 'utf8'), root));
  }
  return errors;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const errors = checkProject(process.cwd());
  if (errors.length) { process.stderr.write(errors.slice(0, 20).join('\n') + '\n'); process.exitCode = 1; }
  else process.stdout.write('Architecture gates passed.\n');
}
