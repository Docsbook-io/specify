#!/usr/bin/env node
/**
 * build-index.js — parse all skills/<name>/SKILL.md frontmatter and emit index.json.
 * Mirrors the docs-skills build-index.js pattern.
 *
 * Output: index.json at package root.
 * No external deps.
 */

'use strict';

const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const SKILLS_DIR = path.join(REPO_ROOT, 'skills');
const OUTPUT = path.join(REPO_ROOT, 'index.json');

const REPO_OWNER = 'Docsbook-io';
const REPO_NAME = 'specify';
const BRANCH = 'main';

const RAW_BASE = `https://raw.githubusercontent.com/${REPO_OWNER}/${REPO_NAME}/${BRANCH}`;
const GH_BASE = `https://github.com/${REPO_OWNER}/${REPO_NAME}/blob/${BRANCH}`;

function extractFrontmatter(text) {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  return text.slice(3, end).replace(/^\r?\n/, '');
}

function unquote(v) {
  v = v.trim();
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineList(v) {
  const inner = v.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(s => unquote(s.trim())).filter(Boolean);
}

function parseFrontmatter(yaml) {
  const out = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }
    const key = m[1];
    const rest = m[2].trim();

    if (rest === '') {
      const childList = [];
      i++;
      while (i < lines.length) {
        const sub = lines[i];
        if (!sub.trim()) { i++; continue; }
        if (!/^\s/.test(sub)) break;
        const listM = sub.match(/^\s+-\s+(.*)$/);
        if (listM) childList.push(unquote(listM[1].trim()));
        i++;
      }
      out[key] = childList;
      continue;
    }

    if (rest.startsWith('[') && rest.endsWith(']')) {
      out[key] = parseInlineList(rest);
    } else {
      out[key] = unquote(rest);
    }
    i++;
  }
  return out;
}

function collectSkillFiles(dir, prefix) {
  const results = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillFile = path.join(dir, entry.name, 'SKILL.md');
    const nestedPath = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (fs.existsSync(skillFile)) {
      results.push({ skillPath: nestedPath, file: skillFile });
    } else {
      results.push(...collectSkillFiles(path.join(dir, entry.name), nestedPath));
    }
  }
  return results.sort((a, b) => a.skillPath.localeCompare(b.skillPath));
}

function buildIndex() {
  if (!fs.existsSync(SKILLS_DIR)) {
    console.error(`skills/ not found at ${SKILLS_DIR}`);
    process.exit(1);
  }

  const skillFiles = collectSkillFiles(SKILLS_DIR, '');
  const skills = [];

  for (const { skillPath, file } of skillFiles) {
    const name = path.basename(skillPath);
    const text = fs.readFileSync(file, 'utf8');
    const fm = extractFrontmatter(text);
    if (!fm) { console.warn(`skip ${skillPath}: no frontmatter`); continue; }
    const parsed = parseFrontmatter(fm);

    const md = (parsed.metadata && typeof parsed.metadata === 'object') ? parsed.metadata : {};
    const entry = {
      name: parsed.name || name,
      description: parsed.description || '',
    };

    if (md.version) entry.version = md.version;
    if (md.keywords && md.keywords.length) entry.keywords = md.keywords;
    entry.raw_url = `${RAW_BASE}/skills/${skillPath}/SKILL.md`;
    entry.github_url = `${GH_BASE}/skills/${skillPath}/SKILL.md`;
    skills.push(entry);
  }

  return { schema_version: 1, generated_at: new Date().toISOString(), skills };
}

const index = buildIndex();
fs.writeFileSync(OUTPUT, JSON.stringify(index, null, 2) + '\n', 'utf8');
console.log(`wrote index.json — ${index.skills.length} skill(s)`);
