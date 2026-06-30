/**
 * specify verify <spec-dir> [--graph <graph.json>] [--code <dir>]
 *
 * Deterministic conformance pass: builds a coverage map between every behavioral
 * trigger declared in the spec and the code symbols of the project.
 *
 * Two modes, picked automatically:
 *   - `graphify` — a graphify graph.json is present (richest: deduped, parser-
 *     extracted, community-aware symbols). graphify is an ACCELERATOR.
 *   - `codescan` — no graph; we scan the code directory directly for declared
 *     symbol names (zero-setup fallback). Slightly coarser, no deps, no build.
 *
 * Either way the matching is identical lexical overlap. This pass does NOT decide
 * whether behavior is *correctly* implemented — that judgment is the AI skill's,
 * reading the matched code. It answers the cheap half: which behaviors have a
 * plausible implementation site, and which appear to have none (the drift signal).
 *
 * Output is a JSON dossier the skill consumes — the spec stays code-free; all
 * code references live here, in the verify output, not in the spec.
 */

import fs from 'fs';
import path from 'path';
import { collectTriggers } from './triggers.js';
import { loadGraph, mapTriggersToGraph, type TriggerCoverage } from '../graph/graphify.js';
import { scanCodeAsNodes } from '../graph/codescan.js';

export interface VerifyResult {
  status: 'ok' | 'drift' | 'error';
  spec_dir: string;
  /** Which surface was matched against: graphify graph, or a direct code scan. */
  mode: 'graphify' | 'codescan';
  graph: string | null;
  /** Code dir scanned in codescan mode (null in graphify mode). */
  code_dir: string | null;
  threshold: number;
  total_triggers: number;
  covered: number;
  uncovered: number;
  coverage: TriggerCoverage[];
  hint?: string;
  message?: string;
}

export interface VerifyOptions {
  graphPath?: string;
  codeDir?: string;
  threshold?: number;
  topK?: number;
}

export function verifySpec(specDir: string, opts: VerifyOptions = {}): VerifyResult {
  const absDir = path.resolve(specDir);
  const threshold = opts.threshold ?? 0.5;
  const base = (extra: Partial<VerifyResult>): VerifyResult => ({
    status: 'error', spec_dir: absDir, mode: 'graphify', graph: null, code_dir: null,
    threshold, total_triggers: 0, covered: 0, uncovered: 0, coverage: [], ...extra,
  });

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return base({ message: 'Spec directory does not exist' });
  }

  const triggers = collectTriggers(absDir);

  // Prefer graphify when a graph is available — it's the richer surface.
  const graphPath = opts.graphPath ?? findDefaultGraph(absDir);
  let nodes;
  let mode: 'graphify' | 'codescan';
  let codeDir: string | null = null;
  let hint: string | undefined;

  if (graphPath) {
    try {
      nodes = loadGraph(graphPath);
      mode = 'graphify';
    } catch (err) {
      return base({ graph: graphPath, message: String(err instanceof Error ? err.message : err) });
    }
  } else {
    // Zero-setup fallback: scan the code directly. graphify stays optional.
    codeDir = opts.codeDir ?? findCodeDir(absDir);
    if (!codeDir) {
      return base({
        message: 'No graphify graph.json and no code dir found. Pass --code <dir>, or run graphify for a richer match.',
      });
    }
    nodes = scanCodeAsNodes(codeDir);
    mode = 'codescan';
    hint = 'codescan mode (no graphify). For deduped, parser-accurate symbols run `graphify <code>` and re-verify — usually higher coverage.';
  }

  const coverage = mapTriggersToGraph(triggers, nodes, threshold, opts.topK ?? 5);
  const covered = coverage.filter(c => c.covered).length;
  const uncovered = coverage.length - covered;

  return {
    status: uncovered > 0 ? 'drift' : 'ok',
    spec_dir: absDir,
    mode,
    graph: graphPath,
    code_dir: codeDir,
    threshold,
    total_triggers: coverage.length,
    covered,
    uncovered,
    coverage,
    ...(hint ? { hint } : {}),
  };
}

/** Look for a graphify graph dump in conventional locations relative to cwd / spec dir. */
function findDefaultGraph(specDir: string): string | null {
  const candidates = [
    path.join(process.cwd(), 'graphify-out', 'graph.json'),
    path.join(specDir, '..', 'graphify-out', 'graph.json'),
    path.join(specDir, 'graphify-out', 'graph.json'),
  ];
  for (const c of candidates) if (fs.existsSync(c)) return path.resolve(c);
  return null;
}

/** Find a code dir to scan when no graph exists. Spec lives in <root>/specs, so code is <root> (or <root>/src). */
function findCodeDir(specDir: string): string | null {
  const root = path.dirname(specDir); // .../specs/<name> → .../specs ; or .../specs → .../<root>
  const projectRoot = path.basename(root) === 'specs' ? path.dirname(root) : root;
  const candidates = [
    path.join(projectRoot, 'src'),
    path.join(projectRoot, 'lib'),
    projectRoot,
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isDirectory()) return path.resolve(c);
  }
  return null;
}
