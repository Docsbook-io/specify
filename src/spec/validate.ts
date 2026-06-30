/**
 * specify spec validate <dir>
 *
 * Checks that a spec directory is well-formed:
 *   1. README.md exists at the root with a `triggers:` frontmatter field (non-empty array).
 *   2. All markdown links inside spec files resolve to files within the spec dir.
 *   3. No implementation details detected (heuristic: file paths, function signatures, class names).
 *
 * Outputs: { status: "ok" | "error", issues: Issue[] }
 */

import fs from 'fs';
import path from 'path';
import { parseFrontmatter } from './frontmatter.js';

export interface ValidationIssue {
  file: string;
  rule: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ValidationResult {
  status: 'ok' | 'error';
  spec_dir: string;
  files_checked: number;
  issues: ValidationIssue[];
}

/** Resolve a link target relative to the file it appears in, within the spec dir. */
function resolveLink(linkHref: string, fromFile: string, specDir: string): string | null {
  if (linkHref.startsWith('http://') || linkHref.startsWith('https://') || linkHref.startsWith('#')) {
    return null; // external or anchor — skip
  }
  const abs = path.resolve(path.dirname(fromFile), linkHref.split('#')[0] ?? '');
  // Only care about links within the spec dir
  if (!abs.startsWith(path.resolve(specDir))) return null;
  return abs;
}

/** Extract markdown link hrefs from text: [text](href) */
function extractLinks(text: string): string[] {
  const re = /\[([^\]]*)\]\(([^)]+)\)/g;
  const hrefs: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m[2]) hrefs.push(m[2]);
  }
  return hrefs;
}

/**
 * Heuristic: detect implementation details in spec text.
 * Flags: file extension paths, function signatures (parentheses after identifier),
 * import statements, TypeScript types.
 */
function detectImplDetails(text: string, filePath: string): string[] {
  const findings: string[] = [];

  const lines = text.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const lineNo = i + 1;

    // Skip frontmatter block
    if (i === 0 && line.trim() === '---') break; // frontmatter handled by parser

    // import/require statements
    if (/^\s*(import|require)\s/.test(line)) {
      findings.push(`line ${lineNo}: import/require statement detected — specs must not reference code`);
    }

    // File paths with extensions (e.g. ./src/foo.ts, ../utils/bar.js)
    if (/\b[\w./]+\.(ts|tsx|js|jsx|py|go|rs|java|cpp|c)\b/.test(line)) {
      findings.push(`line ${lineNo}: file path with extension detected ("${line.trim().slice(0, 60)}")`);
    }

    // Function signatures: identifier followed by ( and args
    if (/\b[a-z][a-zA-Z0-9_]*\s*\([^)]*\)\s*(?::|=>|{)/.test(line)) {
      findings.push(`line ${lineNo}: function/method signature pattern detected — describe behavior, not implementation`);
    }

    // TypeScript types
    if (/:\s*(string|number|boolean|void|Promise<|Record<|Array<|undefined|null)\b/.test(line)) {
      findings.push(`line ${lineNo}: type annotation detected — specs must not expose implementation types`);
    }
  }

  void filePath; // suppress unused param warning — available for richer future messages
  return findings;
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

export async function validateSpec(specDir: string): Promise<ValidationResult> {
  const absDir = path.resolve(specDir);
  const issues: ValidationIssue[] = [];

  if (!fs.existsSync(absDir) || !fs.statSync(absDir).isDirectory()) {
    return {
      status: 'error',
      spec_dir: absDir,
      files_checked: 0,
      issues: [{ file: absDir, rule: 'spec-dir-exists', message: 'Spec directory does not exist', severity: 'error' }],
    };
  }

  // Rule 1: README.md must exist
  const readmePath = path.join(absDir, 'README.md');
  if (!fs.existsSync(readmePath)) {
    issues.push({ file: readmePath, rule: 'readme-exists', message: 'README.md missing from spec root', severity: 'error' });
  } else {
    // Rule 2: triggers field
    const readmeText = fs.readFileSync(readmePath, 'utf8');
    const fm = parseFrontmatter(readmeText);
    if (!fm || !Array.isArray(fm['triggers']) || (fm['triggers'] as unknown[]).length === 0) {
      issues.push({
        file: readmePath,
        rule: 'triggers-present',
        message: 'README.md frontmatter must contain a non-empty `triggers:` array',
        severity: 'error',
      });
    }
  }

  // Collect all .md files
  const mdFiles = walkMd(absDir);

  // Rule 3 & 4: for each file — check links resolve and no impl details
  for (const file of mdFiles) {
    const text = fs.readFileSync(file, 'utf8');
    const rel = path.relative(absDir, file);

    // Check links
    const links = extractLinks(text);
    for (const href of links) {
      const target = resolveLink(href, file, absDir);
      if (target !== null && !fs.existsSync(target)) {
        issues.push({
          file: rel,
          rule: 'link-resolves',
          message: `Broken link: "${href}" does not resolve`,
          severity: 'error',
        });
      }
    }

    // Check for impl details (skip README frontmatter section)
    const bodyStart = text.startsWith('---') ? (text.indexOf('\n---', 3) + 4) : 0;
    const body = text.slice(bodyStart);
    const implIssues = detectImplDetails(body, file);
    for (const msg of implIssues) {
      issues.push({ file: rel, rule: 'no-impl-details', message: msg, severity: 'warning' });
    }
  }

  const hasErrors = issues.some(i => i.severity === 'error');
  return {
    status: hasErrors ? 'error' : 'ok',
    spec_dir: absDir,
    files_checked: mdFiles.length,
    issues,
  };
}
