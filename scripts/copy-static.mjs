import { cpSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = dirname(fileURLToPath(import.meta.url));
const rootDir = join(scriptDir, '..');
const srcDir = join(rootDir, 'src');
const distDir = join(rootDir, 'dist');

mkdirSync(distDir, { recursive: true });

for (const fileName of ['manifest.json', 'popup.html', 'popup.css']) {
  cpSync(join(srcDir, fileName), join(distDir, fileName));
}
