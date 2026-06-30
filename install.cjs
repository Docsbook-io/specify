#!/usr/bin/env node
/**
 * install.js — standalone installer (mirrors docs-skills/install.js).
 * Run via: npx @docsbook/specify
 * or: node install.js [target-dir]
 */
'use strict';

const fs = require('fs');
const path = require('path');

const SKILLS_SRC = path.join(__dirname, 'skills');

function discoverSkills(baseDir) {
  const found = [];
  const seen = new Set();
  function walk(dir) {
    let entries;
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (entries.some(e => e.isFile() && e.name === 'SKILL.md')) {
      const name = path.basename(dir);
      if (seen.has(name)) { console.warn(`[specify] skill collision "${name}" — skipping`); return; }
      seen.add(name);
      found.push({ name, srcPath: dir });
      return;
    }
    for (const entry of entries) { if (entry.isDirectory()) walk(path.join(dir, entry.name)); }
  }
  walk(baseDir);
  return found;
}

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const file of fs.readdirSync(src)) {
    const s = path.join(src, file);
    const d = path.join(dest, file);
    if (fs.statSync(s).isDirectory()) copyDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function detect(targetDir) {
  if (fs.existsSync(path.join(targetDir, '.claude'))) return 'claude';
  if (fs.existsSync(path.join(targetDir, '.cursor'))) return 'cursor';
  if (fs.existsSync(path.join(targetDir, '.github', 'copilot-instructions.md'))) return 'copilot';
  if (fs.existsSync(path.join(targetDir, 'AGENTS.md'))) return 'codex';
  return 'claude';
}

const skills = discoverSkills(SKILLS_SRC);
const targetDir = path.resolve(process.argv[2] || process.cwd());
const tool = detect(targetDir);

console.log(`[specify] Detected: ${tool} | Target: ${targetDir} | Skills: ${skills.map(s => s.name).join(', ')}`);

if (tool === 'claude') {
  const dest = path.join(targetDir, '.claude', 'skills');
  for (const { name, srcPath } of skills) copyDir(srcPath, path.join(dest, name));
  console.log(`[specify] Installed ${skills.length} skill(s) into ${dest}`);
  // Slash commands → .claude/commands/
  const cmdSrc = path.join(__dirname, 'commands');
  if (fs.existsSync(cmdSrc)) {
    const cmdDest = path.join(targetDir, '.claude', 'commands');
    fs.mkdirSync(cmdDest, { recursive: true });
    for (const f of fs.readdirSync(cmdSrc)) {
      if (f.endsWith('.md')) fs.copyFileSync(path.join(cmdSrc, f), path.join(cmdDest, f));
    }
    console.log(`[specify] Installed command(s) into ${cmdDest} — use /specify`);
  }
} else if (tool === 'cursor') {
  const rulesDir = path.join(targetDir, '.cursor', 'rules');
  fs.mkdirSync(rulesDir, { recursive: true });
  const lines = ['---', 'description: specify skills', '---', ''];
  for (const { srcPath } of skills) {
    const f = path.join(srcPath, 'SKILL.md');
    if (fs.existsSync(f)) { lines.push(fs.readFileSync(f, 'utf8')); lines.push(''); }
  }
  fs.writeFileSync(path.join(rulesDir, 'specify.mdc'), lines.join('\n'));
  console.log(`[specify] Installed into ${rulesDir}/specify.mdc`);
} else {
  const filePath = tool === 'copilot'
    ? path.join(targetDir, '.github', 'copilot-instructions.md')
    : path.join(targetDir, 'AGENTS.md');
  const existing = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf8') : '';
  if (!existing.includes('## specify')) {
    const lines = ['## specify', ''];
    for (const { srcPath } of skills) {
      const f = path.join(srcPath, 'SKILL.md');
      if (fs.existsSync(f)) { lines.push(fs.readFileSync(f, 'utf8')); lines.push(''); }
    }
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, existing + '\n\n' + lines.join('\n'));
    console.log(`[specify] Appended to ${filePath}`);
  } else {
    console.log(`[specify] Already installed in ${filePath}`);
  }
}
