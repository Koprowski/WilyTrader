import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const rendererSrc = path.join(root, 'src', 'renderer');
const rendererDist = path.join(root, 'dist', 'renderer');

fs.mkdirSync(rendererDist, { recursive: true });
for (const name of ['index.html', 'styles.css']) {
  fs.copyFileSync(path.join(rendererSrc, name), path.join(rendererDist, name));
}

const mainSrc = path.join(root, 'src', 'main');
const mainDist = path.join(root, 'dist', 'main');
fs.mkdirSync(mainDist, { recursive: true });
for (const name of ['gemini-cli-shim.mjs']) {
  fs.copyFileSync(path.join(mainSrc, name), path.join(mainDist, name));
}
