/**
 * triggers.ts — collect every behavioral trigger declared across a spec directory.
 *
 * A spec's triggers live in the frontmatter `triggers:` array of each markdown
 * file (root README.md and every aspect file). This module flattens them into a
 * single list, remembering which file each trigger came from, so downstream
 * tooling (verify mapping) can report coverage per source page.
 */

import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from './frontmatter.js';

export interface SpecTrigger {
  /** The trigger phrase, verbatim from frontmatter. */
  phrase: string;
  /** Spec file (relative to spec dir) the trigger was declared in. */
  file: string;
}

/** Walk a directory recursively and collect all .md files. */
function walkMd(dir: string): string[] {
  const files: string[] = [];
  function walk(d: string) {
    for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
      const full = path.join(d, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.md')) files.push(full);
    }
  }
  walk(dir);
  return files;
}

/** Collect all triggers declared across a spec directory. */
export function collectTriggers(specDir: string): SpecTrigger[] {
  const absDir = path.resolve(specDir);
  const triggers: SpecTrigger[] = [];
  for (const file of walkMd(absDir)) {
    const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
    const raw = fm?.['triggers'];
    if (!Array.isArray(raw)) continue;
    const rel = path.relative(absDir, file);
    for (const t of raw) {
      if (typeof t === 'string' && t.trim()) {
        triggers.push({ phrase: t.trim(), file: rel });
      }
    }
  }
  return triggers;
}
