/**
 * codescan.ts — zero-setup fallback for when no graphify graph.json exists.
 *
 * graphify is an ACCELERATOR, not a requirement. When a graph is present we match
 * spec triggers against its extracted symbol nodes (richer, deduped, community-
 * aware). When it is absent, we still want `verify` and `reverse` to work — so we
 * scan the code directory directly and synthesize the same `GraphNode[]` shape
 * from declared symbol names (function / class / const / type / def …) found by a
 * light regex sweep. The downstream lexical matcher then behaves identically.
 *
 * This is deliberately simple: no parser, no AST, no deps. It will miss some
 * symbols a real parser would catch — which is exactly why graphify, when
 * available, is the better surface. The point is graceful degradation: something
 * useful with zero setup, something better with graphify.
 */

import fs from 'fs';
import path from 'path';
import type { GraphNode } from './graphify.js';

const CODE_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.go', '.rs', '.java', '.rb', '.php', '.cs', '.kt', '.swift', '.c', '.cpp', '.h',
]);

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'out', '.next', 'coverage',
  'vendor', '__pycache__', '.venv', 'venv', 'target', 'specs',
]);

/** Patterns that declare a named symbol, across common languages. Group 1 = name. */
const DECL_PATTERNS: RegExp[] = [
  /\b(?:export\s+)?(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?(?:abstract\s+)?class\s+([A-Za-z_$][\w$]*)/g,
  /\b(?:export\s+)?(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*[=:]/g,
  /\b(?:export\s+)?(?:type|interface|enum)\s+([A-Za-z_$][\w$]*)/g,
  /\bdef\s+([A-Za-z_][\w]*)/g,        // python / ruby
  /\bfunc\s+([A-Za-z_][\w]*)/g,       // go
  /\bfn\s+([A-Za-z_][\w]*)/g,         // rust
];

function walkCode(dir: string, acc: string[]): void {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (e.name.startsWith('.') && e.name !== '.') continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (!SKIP_DIRS.has(e.name)) walkCode(full, acc);
    } else if (e.isFile() && CODE_EXT.has(path.extname(e.name))) {
      acc.push(full);
    }
  }
}

/**
 * Scan a code directory and synthesize GraphNode[] from declared symbol names —
 * the no-graphify fallback. Each declaration becomes one node whose `label` is
 * the symbol name and whose `source_file` is the relative path, so the existing
 * lexical matcher works unchanged.
 */
export function scanCodeAsNodes(codeDir: string): GraphNode[] {
  const absDir = path.resolve(codeDir);
  const files: string[] = [];
  walkCode(absDir, files);

  const nodes: GraphNode[] = [];
  for (const file of files) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    const rel = path.relative(absDir, file);
    const seen = new Set<string>();
    for (const re of DECL_PATTERNS) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) {
        const name = m[1];
        if (!name || seen.has(name)) continue;
        seen.add(name);
        nodes.push({
          id: `${rel}:${name}`,
          label: name,
          file_type: 'code',
          source_file: rel,
        });
      }
    }
    // Also add the file itself as a node — file names often echo behavior.
    nodes.push({ id: rel, label: path.basename(file), file_type: 'code', source_file: rel });
  }
  return nodes;
}
