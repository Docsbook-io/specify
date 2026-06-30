#!/usr/bin/env node
/**
 * @docsbook/specify — CLI entry point
 *
 * The CLI is the DETERMINISTIC half of spec-driven development. The four
 * generative entry points — code→spec, spec→code, spec-driven reflexion, and
 * conformance judgment — are AI tasks; they live in the `specify` skill, which
 * an agent (Claude Code, Cursor, Codex) runs. The CLI does what does NOT need a
 * model: validate spec structure, build the trigger↔code-graph coverage map,
 * and print the dossier/guide the skill reasons over.
 *
 * Subcommands:
 *   specify new "<idea>"             scaffold a brand-new spec from an idea (greenfield)
 *   specify spec validate <dir>      validate spec structure (deterministic)
 *   specify verify <spec> [--graph]  coverage map: spec triggers ↔ graphify nodes
 *   specify reverse <code-dir>       print the code→spec dossier for the AI skill
 *   specify build <spec-dir>         print the spec→code dossier for the AI skill
 *   specify reflect                  print the spec-driven reflexion guide
 *   specify install [dir]            install skills + commands into an AI tool
 *
 * All commands output JSON to stdout.
 */

import { validateSpec } from './spec/validate.js';
import { verifySpec } from './spec/verify.js';
import { installSkills } from './installer.js';
import { reverseDossier, buildDossier, reflectGuide, newSpec } from './dossier.js';

const [, , ...argv] = process.argv;
const cmd = argv[0];
const sub = argv[1];
const rest = argv.slice(2);

function out(obj: unknown): void {
  process.stdout.write(JSON.stringify(obj, null, 2) + '\n');
}

/** Pull a `--flag value` pair out of the full argv. */
function flag(name: string): string | undefined {
  const i = argv.indexOf(`--${name}`);
  return i !== -1 ? argv[i + 1] : undefined;
}

async function main(): Promise<void> {
  switch (cmd) {
    case 'new': {
      if (!sub) { out({ status: 'error', message: 'Usage: specify new "<one-line product idea>" [--dir <path>]' }); process.exit(1); }
      const result = newSpec(sub, { dir: flag('dir') });
      out(result);
      if (result.status === 'error') process.exit(1);
      break;
    }

    case 'reverse': {
      if (!sub) { out({ status: 'error', message: 'Usage: specify reverse <code-dir> [--graph <graph.json>]' }); process.exit(1); }
      out(reverseDossier(sub, { graphPath: flag('graph') }));
      break;
    }

    case 'build': {
      if (!sub) { out({ status: 'error', message: 'Usage: specify build <spec-dir>' }); process.exit(1); }
      out(buildDossier(sub));
      break;
    }

    case 'verify': {
      if (!sub) { out({ status: 'error', message: 'Usage: specify verify <spec-dir> [--graph <graph.json>] [--threshold <n>]' }); process.exit(1); }
      const thr = flag('threshold');
      const result = verifySpec(sub, { graphPath: flag('graph'), threshold: thr ? Number(thr) : undefined });
      out(result);
      if (result.status === 'error') process.exit(1);
      break;
    }

    case 'reflect':
      out(reflectGuide());
      break;

    case 'spec': {
      if (sub === 'validate') {
        const dir = rest[0];
        if (!dir) { out({ status: 'error', message: 'Usage: specify spec validate <dir>' }); process.exit(1); }
        const result = await validateSpec(dir);
        out(result);
        if (result.status !== 'ok') process.exit(1);
      } else {
        out({ status: 'error', message: `Unknown spec subcommand: ${sub ?? '(none)'}. Available: validate` });
        process.exit(1);
      }
      break;
    }

    case 'install': {
      const targetDir = sub ?? process.cwd();
      installSkills(targetDir);
      break;
    }

    default: {
      out({
        status: 'help',
        usage: 'specify <command> [args]',
        commands: {
          'new "<idea>" [--dir <p>]': 'Scaffold a brand-new spec from an idea — no code yet (greenfield)',
          'spec validate <dir>': 'Validate a spec directory structure (deterministic)',
          'verify <spec> [--graph <p>]': 'Coverage map: spec triggers ↔ graphify code-graph nodes',
          'reverse <code-dir>': 'Print the code→spec dossier the AI skill reasons over',
          'build <spec-dir>': 'Print the spec→code dossier the AI skill reasons over',
          'reflect': 'Print the spec-driven reflexion guide',
          'install [dir]': 'Install specify skills + commands into Claude/Cursor/Codex',
        },
        note: 'reverse / build / verify-judgment / reflect are AI tasks — run the `specify` skill in your agent. The CLI prepares the deterministic dossier; the skill does the reasoning.',
        version: '0.3.0',
      });
    }
  }
}

main().catch((err: unknown) => {
  process.stderr.write(`specify: ${String(err)}\n`);
  process.exit(1);
});
