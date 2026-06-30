/**
 * installer.ts — detect AI tool and install specify skills.
 *
 * Mirrors the docs-skills install.js pattern.
 * Supports: Claude Code (.claude/), Cursor (.cursor/), GitHub Copilot, Codex (AGENTS.md).
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Skills live adjacent to dist/ — resolve relative to the package root
const PACKAGE_ROOT = path.resolve(__dirname, '..');
const SKILLS_SRC = path.join(PACKAGE_ROOT, 'skills');

interface Skill {
  name: string;
  srcPath: string;
}

function discoverSkills(baseDir: string): Skill[] {
  const found: Skill[] = [];
  const seen = new Set<string>();

  function walk(dir: string) {
    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    if (entries.some(e => e.isFile() && e.name === 'SKILL.md')) {
      const name = path.basename(dir);
      if (seen.has(name)) {
        console.warn(`[specify] WARNING: skill name collision "${name}" at ${dir} — skipping`);
        return;
      }
      seen.add(name);
      found.push({ name, srcPath: dir });
      return;
    }
    for (const entry of entries) {
      if (entry.isDirectory()) walk(path.join(dir, entry.name));
    }
  }

  walk(baseDir);
  return found;
}

function copyDir(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const s = path.join(src, file);
    const d = path.join(dest, file);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function detect(targetDir: string): string {
  if (fs.existsSync(path.join(targetDir, '.claude'))) return 'claude';
  if (fs.existsSync(path.join(targetDir, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(targetDir, '.github', 'copilot-instructions.md'))) return 'copilot';
  if (fs.existsSync(path.join(targetDir, 'AGENTS.md'))) return 'codex';
  return 'claude'; // default
}

function installClaudeCode(targetDir: string, skills: Skill[]): void {
  const dest = path.join(targetDir, '.claude', 'skills');
  for (const { name, srcPath } of skills) {
    copyDir(srcPath, path.join(dest, name));
  }
  console.log(`[specify] Installed ${skills.length} skill(s) into ${dest}`);

  // Slash commands → .claude/commands/
  const cmdSrc = path.join(PACKAGE_ROOT, 'commands');
  if (fs.existsSync(cmdSrc)) {
    const cmdDest = path.join(targetDir, '.claude', 'commands');
    fs.mkdirSync(cmdDest, { recursive: true });
    for (const f of fs.readdirSync(cmdSrc)) {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(cmdSrc, f), path.join(cmdDest, f));
    }
    console.log(`[specify] Installed command(s) into ${cmdDest}`);
  }
  console.log('[specify] Use /specify in Claude Code to start');
}

function installCursor(targetDir: string, skills: Skill[]): void {
  const rulesDir = path.join(targetDir, '.cursor', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  const lines = ['---', 'description: specify skills', '---', ''];
  for (const { srcPath } of skills) {
    const skillFile = path.join(srcPath, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      lines.push(fs.readFileSync(skillFile, 'utf8'));
      lines.push('');
    }
  }
  fs.writeFileSync(path.join(rulesDir, 'specify.mdc'), lines.join('\n'));
  console.log(`[specify] Installed into ${rulesDir}/specify.mdc`);
}

function appendSection(filePath: string, section: string): void {
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (existing.includes('## specify')) {
    console.log(`[specify] Section already exists in ${filePath}, skipping`);
    return;
  }
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, existing + '\n\n' + section);
  console.log(`[specify] Appended specify section to ${filePath}`);
}

function buildSection(header: string, skills: Skill[]): string {
  const lines = [header, ''];
  for (const { srcPath } of skills) {
    const skillFile = path.join(srcPath, 'SKILL.md');
    if (fs.existsSync(skillFile)) {
      lines.push(fs.readFileSync(skillFile, 'utf8'));
      lines.push('');
    }
  }
  return lines.join('\n');
}

export function installSkills(targetDir: string): void {
  const absTarget = path.resolve(targetDir);
  const skills = discoverSkills(SKILLS_SRC);
  const tool = detect(absTarget);

  console.log(`[specify] Detected AI tool: ${tool}`);
  console.log(`[specify] Target: ${absTarget}`);
  console.log(`[specify] Found ${skills.length} skill(s): ${skills.map(s => s.name).join(', ')}`);

  switch (tool) {
    case 'claude':
      installClaudeCode(absTarget, skills);
      break;
    case 'cursor':
      installCursor(absTarget, skills);
      break;
    case 'copilot':
      appendSection(
        path.join(absTarget, '.github', 'copilot-instructions.md'),
        buildSection('## specify', skills)
      );
      break;
    case 'codex':
      appendSection(
        path.join(absTarget, 'AGENTS.md'),
        buildSection('## specify', skills)
      );
      break;
  }
}
