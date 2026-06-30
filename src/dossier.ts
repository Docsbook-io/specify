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

// ── reverse: code → spec dossier ─────────────────────────────────────────────

export interface ReverseCluster {
  community: number;
  files: string[];
  symbols: { label: string; source_file?: string; source_location?: string }[];
}

export interface ReverseDossier {
  status: 'ok' | 'error';
  command: 'reverse';
  graph: string | null;
  code_dir: string;
  total_symbols: number;
  clusters: ReverseCluster[];
  instructions: string[];
  message?: string;
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
  'For each cluster, write one behavioral spec file describing WHAT those symbols do — never HOW.',
  'Strip all code: no file paths, function names, class names, types, or imports in the spec.',
  'Give each spec file a frontmatter `triggers:` array — the phrases a developer/AI would use to ask about this behavior.',
  'Group related clusters under a root README.md that links to the aspect files and states invariants.',
  'Run `specify spec validate <dir>` on the result — it must pass with no errors.',
];

export function reverseDossier(codeDir: string, opts: { graphPath?: string } = {}): ReverseDossier {
  const absCode = path.resolve(codeDir);
  const graphPath = findGraph(absCode, opts.graphPath);
  if (!graphPath) {
    return {
      status: 'error', command: 'reverse', graph: null, code_dir: absCode,
      total_symbols: 0, clusters: [], instructions: REVERSE_INSTRUCTIONS,
      message: 'No graph.json found. Run graphify on the code first (graphify skill), or pass --graph <path>.',
    };
  }

  let nodes: GraphNode[];
  try {
    nodes = loadGraph(graphPath);
  } catch (err) {
    return {
      status: 'error', command: 'reverse', graph: graphPath, code_dir: absCode,
      total_symbols: 0, clusters: [], instructions: REVERSE_INSTRUCTIONS,
      message: String(err instanceof Error ? err.message : err),
    };
  }

  // Group nodes by graphify community (its semantic clustering of the codebase).
  const byCommunity = new Map<number, GraphNode[]>();
  for (const n of nodes) {
    const c = (n as GraphNode & { community?: number }).community ?? -1;
    (byCommunity.get(c) ?? byCommunity.set(c, []).get(c)!).push(n);
  }

  const clusters: ReverseCluster[] = [...byCommunity.entries()]
    .map(([community, ns]) => ({
      community,
      files: [...new Set(ns.map(n => n.source_file).filter((f): f is string => !!f))],
      symbols: ns.map(n => ({ label: n.label, source_file: n.source_file, source_location: n.source_location })),
    }))
    .sort((a, b) => b.symbols.length - a.symbols.length);

  return {
    status: 'ok', command: 'reverse', graph: graphPath, code_dir: absCode,
    total_symbols: nodes.length, clusters, instructions: REVERSE_INSTRUCTIONS,
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
