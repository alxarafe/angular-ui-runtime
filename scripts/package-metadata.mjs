import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const json = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
export const THEME_IDS = Object.freeze(['default', 'alternative', 'cyberpunk', 'vintage', 'high-contrast']);
export const runtimePackage = json('projects/ui-runtime/package.json');
export function themePackage(id) {
  if (!THEME_IDS.includes(id)) throw new Error(`Unknown local theme package: ${id}`);
  return json(`packages/themes/${id}/package.json`);
}
export function archiveName(pkg) { return `${pkg.name.replace(/^@/, '').replace('/', '-')}-${pkg.version}.tgz`; }
export function archivePath(pkg, directory = '/artifacts') { return join(directory, archiveName(pkg)); }
