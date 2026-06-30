/**
 * graphify.ts — read a graphify `graph.json` knowledge-graph dump and expose a
 * lexical map from spec triggers to code-graph nodes.
 *
 * Why lexical, not embeddings: matching spec triggers against code-symbol names
 * is a *connection* problem (does a behavior have a corresponding implementation
 * site?), not a *semantic-similarity* problem. graphify already extracts symbol
 * names via tree-sitter; we tokenize trigger phrases and node labels and score
 * by token overlap. This keeps `specify` zero-API-key for the deterministic
 * coverage pass — the AI verify skill reasons over the result, it does not need
 * to re-run embeddings to know which symbols a trigger plausibly touches.
 *
 * The spec itself stays code-free: triggers are behavior phrases. The mapping
 * lives here, outside the spec, exactly as the design requires.
 */

import fs from 'fs';
import path from 'path';
import type { SpecTrigger } from '../spec/triggers.js';

export interface GraphNode {
  id: string;
  label: string;
  norm_label?: string;
  file_type?: string;
  source_file?: string;
  source_location?: string;
}

export interface GraphifyGraph {
  nodes: GraphNode[];
}

export interface NodeMatch {
  id: string;
  label: string;
  source_file?: string;
  source_location?: string;
  score: number;
}

export interface TriggerCoverage {
  trigger: string;
  spec_file: string;
  matches: NodeMatch[];
  covered: boolean;
}

const STOPWORDS = new Set([
  'a', 'an', 'the', 'on', 'in', 'of', 'to', 'for', 'and', 'or', 'is', 'are',
  'be', 'with', 'by', 'at', 'as', 'from', 'into', 'when', 'if', 'this', 'that',
]);

/** Split a phrase / symbol name into normalized word tokens (camelCase + snake + kebab aware). */
export function tokenize(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2') // camelCase → camel Case
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(t => t.length > 1 && !STOPWORDS.has(t));
}

/** Load a graphify graph.json. Returns only code nodes (file_type === 'code'). */
export function loadGraph(graphPath: string): GraphNode[] {
  const abs = path.resolve(graphPath);
  if (!fs.existsSync(abs)) {
    throw new Error(`graph.json not found at ${abs} — run graphify on the code first`);
  }
  const raw = JSON.parse(fs.readFileSync(abs, 'utf8')) as GraphifyGraph;
  if (!Array.isArray(raw.nodes)) {
    throw new Error(`${abs} has no nodes[] — not a graphify graph dump`);
  }
  return raw.nodes.filter(n => (n.file_type ?? 'code') === 'code');
}

/**
 * Score a trigger against a node: Jaccard-style overlap of token sets, biased
 * toward the node label (symbol name) but also crediting the source file path.
 */
function scoreMatch(triggerTokens: Set<string>, node: GraphNode): number {
  if (triggerTokens.size === 0) return 0;
  const labelTokens = new Set(tokenize(node.label));
  const pathTokens = new Set(tokenize(node.source_file ?? ''));

  let labelHits = 0;
  for (const t of triggerTokens) if (labelTokens.has(t)) labelHits++;
  let pathHits = 0;
  for (const t of triggerTokens) if (pathTokens.has(t)) pathHits++;

  // Label matches are worth more than path matches.
  const score = (labelHits * 1.0 + pathHits * 0.5) / triggerTokens.size;
  return Math.min(score, 1);
}

/**
 * Map every spec trigger to its best-matching code-graph nodes.
 *
 * @param threshold minimum score for a node to count as a match (default 0.5,
 *                  matching the docs-drift convention).
 * @param topK      keep at most this many matches per trigger.
 */
export function mapTriggersToGraph(
  triggers: SpecTrigger[],
  nodes: GraphNode[],
  threshold = 0.5,
  topK = 5,
): TriggerCoverage[] {
  return triggers.map(({ phrase, file }) => {
    const tokens = new Set(tokenize(phrase));
    const scored: NodeMatch[] = [];
    for (const node of nodes) {
      const score = scoreMatch(tokens, node);
      if (score >= threshold) {
        scored.push({
          id: node.id,
          label: node.label,
          source_file: node.source_file,
          source_location: node.source_location,
          score: Number(score.toFixed(3)),
        });
      }
    }
    scored.sort((a, b) => b.score - a.score);
    const matches = scored.slice(0, topK);
    return { trigger: phrase, spec_file: file, matches, covered: matches.length > 0 };
  });
}
