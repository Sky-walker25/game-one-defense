import { mkdir, cp, rm, stat, readFile, writeFile } from 'node:fs/promises';
const root = new URL('../', import.meta.url);
const dist = new URL('dist/', root);
await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });
for (const path of ['index.html', 'styles.css', 'mobile.css', 'favicon.svg', '.nojekyll', 'src', 'assets', 'qa']) {
  await cp(new URL(path, root), new URL(path, dist), { recursive: true });
}
// The production bundle also runs from a local file, without an HTTP server.
// Modules remain separate in src/ for development and direct simulation tests.
const modules = ['data', 'engine', 'storage', 'audio', 'camera', 'render', 'app'];
const parts = await Promise.all(modules.map(async name => {
  const source = await readFile(new URL(`src/${name}.js`, root), 'utf8');
  return `// src/${name}.js\n` + source.replace(/^import .*;\r?\n/gm, '').replace(/^export /gm, '');
}));
await writeFile(new URL('src/bundle.js', dist), '"use strict";\n(() => {\n' + parts.join('\n\n') + '\n})();\n');
const html = await readFile(new URL('index.html', dist), 'utf8');
await writeFile(new URL('index.html', dist), html.replace('<script type="module" src="./src/app.js"></script>', '<script defer src="./src/bundle.js"></script>'));
for (const path of ['index.html', 'src/app.js', 'src/engine.js', 'styles.css']) {
  if (!(await stat(new URL(path, dist))).size) throw new Error(`Fichier vide : ${path}`);
}
console.log('BASTION : version statique prête dans dist/.');
