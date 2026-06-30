/**
 * specify verify <spec-dir> [--graph <graph.json>]
 *
 * Deterministic conformance pass: builds a coverage map between every behavioral
 * trigger declared in the spec and the code-symbol nodes of a graphify graph.
 *
 * It does NOT decide whether the behavior is *correctly* implemented — that is a
 * judgment call the AI verify skill makes by reading the matched code. This pass
 * answers the cheap, deterministic half: "which behaviors have a plausible
 * implementation site, and which appear to have none?" Uncovered triggers are
 * the high-signal candidates for drift (spec describes behavior with no code) or
 * for spec-text that is too vague to match any symbol.
 *
 * Output is a JSON dossier the skill consumes — the spec stays code-free; all
 * code references live here, in the verify output, not in the spec.
 */

import fs from 'fs';
import path from 'path';
import { collectTriggers } from './triggers.js';
import { loadGraph, mapTriggersToGraph, type TriggerCoverage } from '../graph/graphify.js';

export interface VerifyResult {
  status: 'ok' | 'drift' | 'error';
  spec_dir: string;
  graph: string | null;
  threshold: number;
  total_triggers: number;
  covered: number;
  uncovered: number;
  coverage: TriggerCoverage[];
  message?: string;
}

export interface VerifyOptions {
  graphPath?: string;
  threshold?: number;
  topK?: number;
}

export function verifySpec(specDir: string, opts: VerifyOptions = {}): VerifyResult {
  const absDir = path.resolve(specDir);
  const threshold = opts.threshold ?? 0.5;

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return {
      status: 'error', spec_dir: absDir, graph: null, threshold,
      total_triggers: 0, covered: 0, uncovered: 0, coverage: [],
      message: 'Spec directory does not exist',
    };
  }

  // Default graph location: graphify-out/graph.json next to where the user runs.
  const graphPath = opts.graphPath ?? findDefaultGraph(absDir);
  if (!graphPath) {
    return {
      status: 'error', spec_dir: absDir, graph: null, threshold,
      total_triggers: 0, covered: 0, uncovered: 0, coverage: [],
      message: 'No graph.json found. Run graphify on the code first, or pass --graph <path>.',
    };
  }

  let nodes;
  try {
    nodes = loadGraph(graphPath);
  } catch (err) {
    return {
      status: 'error', spec_dir: absDir, graph: graphPath, threshold,
      total_triggers: 0, covered: 0, uncovered: 0, coverage: [],
      message: String(err instanceof Error ? err.message : err),
    };
  }

  const triggers = collectTriggers(absDir);
  const coverage = mapTriggersToGraph(triggers, nodes, threshold, opts.topK ?? 5);
  const covered = coverage.filter(c => c.covered).length;
  const uncovered = coverage.length - covered;

  return {
    status: uncovered > 0 ? 'drift' : 'ok',
    spec_dir: absDir,
    graph: graphPath,
    threshold,
    total_triggers: coverage.length,
    covered,
    uncovered,
    coverage,
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
