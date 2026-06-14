/**
 * Interactive prompt flow (project name → template → package manager → options).
 * Every field is prompted ONLY if it wasn't supplied via a CLI flag, so passing
 * all flags makes the CLI fully non-interactive (safe in CI / non-TTY).
 */
import * as p from '@clack/prompts';
import { TEMPLATES } from './templates.js';

export type PackageManager = 'npm' | 'pnpm' | 'yarn';

export interface ScaffoldOptions {
  /** Target directory (relative to cwd), e.g. "my-app". */
  projectDir: string;
  /** Project name baked into package.json + app config (derived from dir). */
  projectName: string;
  template: string;
  pm: PackageManager;
  install: boolean;
  git: boolean;
}

export interface InitialOptions {
  projectDir?: string;
  template?: string;
  pm?: PackageManager;
  install: boolean;
  git: boolean;
}

const PM_VALUES: PackageManager[] = ['npm', 'pnpm', 'yarn'];

/** A valid, install-safe directory/package name. */
function sanitizeName(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^[-_.]+|[-_.]+$/g, '')
    || 'partylayer-app';
}

function bail(): never {
  p.cancel('Scaffolding cancelled.');
  process.exit(0);
}

export async function runPrompts(initial: InitialOptions): Promise<ScaffoldOptions> {
  let projectDir = initial.projectDir;
  if (!projectDir) {
    const res = await p.text({
      message: 'Project directory?',
      placeholder: 'my-partylayer-app',
      defaultValue: 'my-partylayer-app',
    });
    if (p.isCancel(res)) bail();
    projectDir = (res as string) || 'my-partylayer-app';
  }

  let template = initial.template;
  if (!template) {
    const res = await p.select({
      message: 'Which template?',
      options: TEMPLATES.map((t) => ({ value: t.id, label: t.label, hint: t.hint })),
      initialValue: TEMPLATES[0].id,
    });
    if (p.isCancel(res)) bail();
    template = res as string;
  }

  let pm = initial.pm;
  if (!pm) {
    const res = await p.select({
      message: 'Package manager?',
      options: PM_VALUES.map((v) => ({ value: v, label: v })),
      initialValue: 'npm' as PackageManager,
    });
    if (p.isCancel(res)) bail();
    pm = res as PackageManager;
  }

  return {
    projectDir,
    projectName: sanitizeName(projectDir.split('/').pop() || projectDir),
    template,
    pm,
    install: initial.install,
    git: initial.git,
  };
}
