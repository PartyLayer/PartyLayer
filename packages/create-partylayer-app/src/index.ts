#!/usr/bin/env node
/**
 * create-partylayer-app — scaffold a PartyLayer dApp.
 *
 *   npm create partylayer-app@latest
 *   pnpm create partylayer-app
 *   yarn create partylayer-app
 *
 * Flags (skip the matching prompt; pass all for a non-interactive run):
 *   <dir>              target directory (positional)
 *   --template, -t     template id (e.g. react-vite)
 *   --pm               npm | pnpm | yarn
 *   --no-install       skip dependency install
 *   --no-git           skip git init
 *   --help, -h         show this help
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as p from '@clack/prompts';
import mri from 'mri';
import pc from 'picocolors';
import { runPrompts, type PackageManager } from './prompts.js';
import { scaffold } from './scaffold.js';
import { isTemplateId, TEMPLATES } from './templates.js';

const HELP = `${pc.bold('create-partylayer-app')} — scaffold a PartyLayer dApp

${pc.bold('Usage')}
  npm create partylayer-app@latest [dir] [options]

${pc.bold('Options')}
  -t, --template <id>   ${TEMPLATES.map((t) => t.id).join(', ')}
      --pm <manager>    npm | pnpm | yarn
      --no-install      skip dependency install
      --no-git          skip git init
  -h, --help            show this help
`;

async function main(): Promise<void> {
  const argv = mri(process.argv.slice(2), {
    boolean: ['install', 'git', 'help'],
    default: { install: true, git: true, help: false },
    alias: { t: 'template', h: 'help' },
  });

  if (argv.help) {
    console.log(HELP);
    return;
  }

  p.intro(pc.bgYellow(pc.black(' create-partylayer-app ')));

  const flagTemplate = typeof argv.template === 'string' ? argv.template : undefined;
  if (flagTemplate && !isTemplateId(flagTemplate)) {
    p.cancel(`Unknown template "${flagTemplate}". Available: ${TEMPLATES.map((t) => t.id).join(', ')}`);
    process.exit(1);
  }
  const flagPm = typeof argv.pm === 'string' ? (argv.pm as PackageManager) : undefined;
  if (flagPm && !['npm', 'pnpm', 'yarn'].includes(flagPm)) {
    p.cancel(`Unknown package manager "${flagPm}". Use npm, pnpm, or yarn.`);
    process.exit(1);
  }

  const opts = await runPrompts({
    projectDir: typeof argv._[0] === 'string' ? argv._[0] : undefined,
    template: flagTemplate,
    pm: flagPm,
    install: argv.install,
    git: argv.git,
  });

  const targetDir = resolve(process.cwd(), opts.projectDir);
  if (existsSync(targetDir) && readdirSync(targetDir).length > 0) {
    p.cancel(`Target directory "${opts.projectDir}" already exists and is not empty.`);
    process.exit(1);
  }

  const templatesRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'templates');
  const templateDir = join(templatesRoot, opts.template);

  const s = p.spinner();
  s.start(`Scaffolding ${pc.cyan(opts.projectName)} (${opts.template})`);
  await scaffold(templateDir, targetDir, { PROJECT_NAME: opts.projectName });
  s.stop(`Created ${pc.cyan(opts.projectDir)}`);

  if (opts.git) {
    const git = spawnSync('git', ['init', '-q'], { cwd: targetDir, stdio: 'ignore' });
    if (git.status === 0) {
      spawnSync('git', ['add', '-A'], { cwd: targetDir, stdio: 'ignore' });
      spawnSync('git', ['commit', '-q', '-m', 'Initial commit from create-partylayer-app'], {
        cwd: targetDir,
        stdio: 'ignore',
      });
    }
  }

  if (opts.install) {
    const inst = p.spinner();
    inst.start(`Installing dependencies with ${opts.pm}`);
    const res = spawnSync(opts.pm, ['install'], { cwd: targetDir, stdio: 'ignore' });
    if (res.status === 0) {
      inst.stop('Dependencies installed');
    } else {
      inst.stop(pc.yellow(`Install skipped/failed — run "${opts.pm} install" yourself.`));
    }
  }

  const steps = [
    `cd ${opts.projectDir}`,
    ...(opts.install ? [] : [`${opts.pm} install`]),
    `${opts.pm} run dev`,
  ];
  p.note(steps.join('\n'), 'Next steps');
  p.outro(`${pc.green('Done.')} Open the app and click Connect Wallet.`);
}

main().catch((err) => {
  p.cancel(String(err instanceof Error ? err.message : err));
  process.exit(1);
});
