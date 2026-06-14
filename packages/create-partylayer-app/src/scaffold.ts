/**
 * Copy a template directory into the target, applying:
 *  - file renames: `_package.json` → `package.json`, and any other `_x` → `.x`
 *    (so a published `.gitignore` isn't rewritten to `.npmignore` by npm, and
 *    `templates/<id>/_package.json` is NOT picked up by the monorepo's
 *    `packages/*` workspace glob);
 *  - placeholder substitution: `{{VAR}}` → vars[VAR].
 */
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const RENAME: Record<string, string> = {
  '_package.json': 'package.json',
};

function targetName(name: string): string {
  if (RENAME[name]) return RENAME[name];
  if (name.startsWith('_')) return '.' + name.slice(1);
  return name;
}

function substitute(content: string, vars: Record<string, string>): string {
  return content.replace(/\{\{(\w+)\}\}/g, (_match, key: string) =>
    Object.prototype.hasOwnProperty.call(vars, key) ? vars[key] : `{{${key}}}`,
  );
}

export async function scaffold(
  templateDir: string,
  targetDir: string,
  vars: Record<string, string>,
): Promise<void> {
  await copyDir(templateDir, targetDir, vars);
}

async function copyDir(
  src: string,
  dest: string,
  vars: Record<string, string>,
): Promise<void> {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const from = join(src, entry.name);
    const to = join(dest, targetName(entry.name));
    if (entry.isDirectory()) {
      await copyDir(from, to, vars);
    } else {
      const content = await readFile(from, 'utf8');
      await writeFile(to, substitute(content, vars));
    }
  }
}
