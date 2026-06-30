/**
 * dossier.ts — deterministic material the `specify` skill reasons over.
 *
 * The generative steps (write the spec prose, scaffold the code, judge
 * conformance) need a model. The CLI does not call one. Instead each command
 * here gathers the *deterministic inputs* an agent needs and hands them over as
 * structured JSON, so the skill spends its tokens reasoning, not re-discovering
 * structure the CLI can compute for free.
 *
 *   reverse — read a graphify graph of the CODE → group symbols by community →
 *             hand the agent clusters to turn into behavioral spec files.
 *   build   — read a SPEC → list triggers + aspect files → hand the agent a code
 *             plan skeleton to scaffold from.
 *   reflect — print the standing guide for writing code from a spec.
 */

import fs from 'fs';
import path from 'path';
import { collectTriggers } from './spec/triggers.js';
import { loadGraph, type GraphNode } from './graph/graphify.js';
import { scanCodeAsNodes } from './graph/codescan.js';

// ── reverse: code → spec dossier ─────────────────────────────────────────────

export interface ReverseCluster {
  community: number;
  files: string[];
  symbols: { label: string; source_file?: string; source_location?: string }[];
}

export interface ReverseDossier {
  status: 'ok' | 'error';
  command: 'reverse';
  /** 'graphify' when a graph was used (richer clusters), 'codescan' for the zero-setup fallback. */
  mode: 'graphify' | 'codescan';
  graph: string | null;
  code_dir: string;
  /** Where the AI MUST write the spec: a specs/ dir at the project root. Always set. */
  spec_dir: string;
  total_symbols: number;
  clusters: ReverseCluster[];
  instructions: string[];
  hint?: string;
  message?: string;
}

/** The spec destination for a code dir: always `<project-root>/specs`. */
function specsDirFor(codeDir: string): string {
  // If codeDir looks like a source subdir (src, lib, app…), specs/ lives beside it at the root.
  const base = path.basename(codeDir);
  const root = ['src', 'lib', 'app', 'source'].includes(base) ? path.dirname(codeDir) : codeDir;
  return path.join(root, 'specs');
}

function findGraph(codeDir: string, explicit?: string): string | null {
  if (explicit) return fs.existsSync(explicit) ? path.resolve(explicit) : null;
  const candidates = [
    path.join(process.cwd(), 'graphify-out', 'graph.json'),
    path.join(codeDir, 'graphify-out', 'graph.json'),
    path.join(codeDir, '..', 'graphify-out', 'graph.json'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return path.resolve(c);
  return null;
}

const REVERSE_INSTRUCTIONS = [
  'Write the spec into a `specs/` directory at the ROOT of the project being analyzed (e.g. specs/<subsystem>/) — never anywhere else. This is always the destination.',
  'READ THE FILE BODIES — do not spec from symbol names alone. The dossier lists symbols (names, files); the BEHAVIOR lives inside the code. Open each cluster\'s files and read the logic: branches, conditions, constants, guards, limits, defaults, error paths.',
  'The completeness bar is REBUILDABILITY: someone must be able to reconstruct this system from the spec ALONE and get the same functionality. If a behavior is not in the spec, it does not exist for the rebuilder. Capture business rules, not just structure.',
  'Especially capture rules that hide INSIDE function bodies: plan/tier/subscription gating (who can do what on free vs paid), permission & access checks, quotas & rate limits, pricing, feature flags, default values, validation rules, and what happens on each error/edge case. These are the first things a name-only pass misses — and the most important to get right.',
  'For each cluster, write one behavioral spec file describing WHAT those symbols do — never HOW.',
  'Strip all code: no file paths, function names, class names, types, or imports in the spec.',
  'Give each spec file a frontmatter `triggers:` array — the phrases a developer/AI would use to ask about this behavior.',
  'Group related clusters under a root README.md that links to the aspect files and states invariants.',
  'Run `specify spec validate ./specs/<subsystem>` on the result — it must pass with no errors.',
];

export function reverseDossier(codeDir: string, opts: { graphPath?: string } = {}): ReverseDossier {
  const absCode = path.resolve(codeDir);
  const specDir = specsDirFor(absCode);
  const graphPath = findGraph(absCode, opts.graphPath);

  let nodes: GraphNode[];
  let mode: 'graphify' | 'codescan';
  let hint: string | undefined;

  if (graphPath) {
    try {
      nodes = loadGraph(graphPath);
      mode = 'graphify';
    } catch (err) {
      return {
        status: 'error', command: 'reverse', mode: 'graphify', graph: graphPath, code_dir: absCode, spec_dir: specDir,
        total_symbols: 0, clusters: [], instructions: REVERSE_INSTRUCTIONS,
        message: String(err instanceof Error ? err.message : err),
      };
    }
  } else {
    // Zero-setup fallback: scan the code directly. graphify stays optional.
    if (!fs.existsSync(absCode) || !fs.statSync(absCode).isDirectory()) {
      return {
        status: 'error', command: 'reverse', mode: 'codescan', graph: null, code_dir: absCode, spec_dir: specDir,
        total_symbols: 0, clusters: [], instructions: REVERSE_INSTRUCTIONS,
        message: `Code directory does not exist: ${absCode}`,
      };
    }
    nodes = scanCodeAsNodes(absCode);
    mode = 'codescan';
    hint = 'codescan mode (no graphify): clusters are grouped by directory, not by call-graph community. For semantically tighter clusters run `graphify <code>` and re-run reverse.';
  }

  // Cluster: by graphify community when present, else by source directory.
  const byKey = new Map<string, GraphNode[]>();
  for (const n of nodes) {
    const key = mode === 'graphify'
      ? String((n as GraphNode & { community?: number }).community ?? -1)
      : path.dirname(n.source_file ?? '.');
    (byKey.get(key) ?? byKey.set(key, []).get(key)!).push(n);
  }

  const clusters: ReverseCluster[] = [...byKey.entries()]
    .map(([key, ns], i) => ({
      community: mode === 'graphify' ? Number(key) : i,
      files: [...new Set(ns.map(n => n.source_file).filter((f): f is string => !!f))],
      symbols: ns.map(n => ({ label: n.label, source_file: n.source_file, source_location: n.source_location })),
    }))
    .sort((a, b) => b.symbols.length - a.symbols.length);

  return {
    status: 'ok', command: 'reverse', mode, graph: graphPath, code_dir: absCode, spec_dir: specDir,
    total_symbols: nodes.length, clusters, instructions: REVERSE_INSTRUCTIONS,
    ...(hint ? { hint } : {}),
  };
}

// ── build: spec → code dossier ───────────────────────────────────────────────

export interface BuildDossier {
  status: 'ok' | 'error';
  command: 'build';
  spec_dir: string;
  aspects: { file: string; triggers: string[] }[];
  total_triggers: number;
  instructions: string[];
  message?: string;
}

const BUILD_INSTRUCTIONS = [
  'Treat the spec as the source of truth — implement every behavioral claim and honor every invariant.',
  'Each trigger is a behavior the code must exhibit; map triggers to implementation sites, then write the code.',
  'Do not invent behavior the spec does not describe; if the spec is ambiguous, ask before guessing.',
  'After scaffolding, run `specify verify <spec-dir> --graph <graph.json>` to confirm every trigger has a code match.',
];

export function buildDossier(specDir: string): BuildDossier {
  const absDir = path.resolve(specDir);
  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return {
      status: 'error', command: 'build', spec_dir: absDir,
      aspects: [], total_triggers: 0, instructions: BUILD_INSTRUCTIONS,
      message: 'Spec directory does not exist',
    };
  }
  const triggers = collectTriggers(absDir);
  const byFile = new Map<string, string[]>();
  for (const t of triggers) {
    const arr = byFile.get(t.file) ?? byFile.set(t.file, []).get(t.file)!;
    arr.push(t.phrase);
  }
  return {
    status: 'ok', command: 'build', spec_dir: absDir,
    aspects: [...byFile.entries()].map(([file, trs]) => ({ file, triggers: trs })),
    total_triggers: triggers.length,
    instructions: BUILD_INSTRUCTIONS,
  };
}

// ── reflect: spec-driven coding guide ────────────────────────────────────────

export interface ReflectGuide {
  status: 'ok';
  command: 'reflect';
  guide: string[];
}

export function reflectGuide(): ReflectGuide {
  return {
    status: 'ok',
    command: 'reflect',
    guide: [
      'A spec is a codebase without the code: read it before writing or changing code, so a change preserves every stated behavior.',
      'Before editing: find the triggers your change touches. Those behaviors are the contract you must not break.',
      'When adding behavior, add a trigger + spec text FIRST, then code to it — the spec is what stops the next person breaking it.',
      'When a change alters observable behavior, update the spec in the same change; a spec that lags the code is worse than none.',
      'Keep code out of the spec. If you reach for a file path or function name, you are describing HOW, not WHAT — restate it as behavior.',
      'Verify both directions: every trigger should map to code (`specify verify`), and every behavior in code should trace to a trigger.',
    ],
  };
}

// ── new: idea → spec scaffold ────────────────────────────────────────────────

export interface NewSpecResult {
  status: 'ok' | 'error';
  command: 'new';
  spec_dir: string;
  created: string[];
  idea: string;
  instructions: string[];
  message?: string;
}

const NEW_INSTRUCTIONS = [
  'There is NO code yet — this is greenfield. The spec is written FIRST; code is generated from it later (`specify build`).',
  'Expand the idea into behaviors: for each thing the product DOES, write a heading that is a behavioral claim — what happens, when, under what conditions, what the caller gets back.',
  'Split distinct concerns into aspect files (one file per subsystem/feature). Link them from README.md; each link is a `trigger → file` pair.',
  'Fill every file\'s frontmatter `triggers:` array with the phrases a developer or AI would use to ask about that behavior — these are the lookup keys.',
  'State invariants explicitly (what must always hold) and edge cases / error conditions (what happens when things go wrong).',
  'Keep it code-free: no file paths, function names, types, frameworks, or libraries — describe WHAT, never HOW. Choosing the stack is the build step\'s job, not the spec\'s.',
  'When done, run `specify spec validate <dir>` (must pass), then `specify build <dir>` to scaffold the code.',
];

/** Slugify an idea into a directory-name-safe spec folder name. */
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'spec';
}

/**
 * Scaffold a brand-new spec directory from a one-line product idea — for the
 * greenfield case where no code exists yet. Writes a minimal, valid spec
 * skeleton (a README with placeholder triggers) and returns the instructions
 * the AI skill follows to expand the idea into a full behavioral spec.
 *
 * The skeleton is deliberately minimal and code-free; the model does the
 * expansion. We only guarantee the result is a structurally valid spec the
 * agent can grow into.
 */
export function newSpec(idea: string, opts: { dir?: string } = {}): NewSpecResult {
  const trimmed = idea.trim();
  if (!trimmed) {
    return {
      status: 'error', command: 'new', spec_dir: '', created: [], idea,
      instructions: NEW_INSTRUCTIONS, message: 'Usage: specify new "<one-line product idea>" [--dir <path>]',
    };
  }

  const specDir = path.resolve(opts.dir ?? path.join('specs', slugify(trimmed)));
  if (fs.existsSync(specDir) && fs.readdirSync(specDir).length > 0) {
    return {
      status: 'error', command: 'new', spec_dir: specDir, created: [], idea,
      instructions: NEW_INSTRUCTIONS,
      message: `Spec directory ${specDir} already exists and is not empty — choose another with --dir.`,
    };
  }

  fs.mkdirSync(specDir, { recursive: true });
  const title = trimmed.replace(/\.$/, '');
  const readme = `---
triggers:
  - "${slugify(trimmed).replace(/-/g, ' ')}"
---

# ${title.charAt(0).toUpperCase() + title.slice(1)}

> Greenfield spec scaffold. Expand each section below into behavioral claims,
> then split distinct concerns into aspect files and link them here. Remove this
> note when done. The spec must stay code-free.

## Overview

<!-- What does this product do, in one paragraph? What is its job? -->

## Behaviors

<!-- One heading per thing the product does. Each heading is a behavioral claim:
     what happens, when, under what conditions, what the caller gets back. -->

## Invariants

<!-- What must ALWAYS hold true, regardless of input or state? -->

## Edge cases & errors

<!-- What happens when input is missing/invalid, a dependency fails, a limit is hit? -->
`;
  const readmePath = path.join(specDir, 'README.md');
  fs.writeFileSync(readmePath, readme);

  return {
    status: 'ok', command: 'new', spec_dir: specDir,
    created: [path.relative(process.cwd(), readmePath)], idea: trimmed,
    instructions: NEW_INSTRUCTIONS,
  };
}
