# @docsbook/specify

[![npm version](https://img.shields.io/npm/v/@docsbook/specify.svg?style=flat-square)](https://www.npmjs.com/package/@docsbook/specify)
[![npm downloads](https://img.shields.io/npm/dm/@docsbook/specify.svg?style=flat-square)](https://www.npmjs.com/package/@docsbook/specify)
[![license](https://img.shields.io/npm/l/@docsbook/specify.svg?style=flat-square)](https://github.com/Docsbook-io/specify/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/@docsbook/specify.svg?style=flat-square)](https://www.npmjs.com/package/@docsbook/specify)

**A spec is a codebase without the code.** `specify` is a spec-driven CLI + AI
skill: reverse-engineer behavioral specs from code, scaffold code from specs,
and verify code still matches its spec — so an update never silently breaks
behavior. From a complete spec you could rebuild the project and get the same
functionality.

```bash
# install the skill + /specify command into your AI tool (Claude / Cursor / Codex)
npx @docsbook/specify install

# or use the CLI directly
npx @docsbook/specify spec validate ./specs/my-module
```

---

## What is a spec?

A spec is a folder of markdown describing what a system **does** — its
behaviors, invariants, edge cases — with **no file paths, function names, types,
or imports**. It is the contract that stops the next change from breaking
behavior.

```
my-module/
  README.md        # frontmatter `triggers:` + behavior overview, links to aspects
  caching.md       # one file per behavioral aspect (nestable)
  quota.md
```

Every file carries a frontmatter `triggers:` array — the phrases a developer or
AI would use to ask about that behavior. Triggers are the lookup key (for
search and for `verify` coverage). A file's body is either a direct behavior
description, or links to nested files — each link is a `key trigger → file`
pair, the same shape as a knowledge base.

```yaml
---
triggers:
  - "translation cache"
  - "cache hit"
  - "cache miss"
---
# Caching Behavior
A translation is uniquely identified by source content + target language. …
```

**Rule: no code in the spec.** No paths, signatures, types, imports — each
heading is a behavioral claim. See [`examples/translation-behavior/`](examples/translation-behavior/)
for a real, validated spec.

---

## The four entry points

The CLI does the **deterministic half** (validate structure, build the
trigger↔code coverage map). The four generative steps are **AI tasks** your
agent performs, reasoning over the CLI's JSON dossier. Install the skill and run
them as `/specify …`, or drive the CLI directly.

### 1. Code → spec (`reverse`)

```bash
graphify ./src                                         # → graphify-out/graph.json (graphify skill)
npx @docsbook/specify reverse ./src --graph ./graphify-out/graph.json
```

The CLI clusters code symbols by [graphify](https://www.npmjs.com/package/graphify)
community and hands the agent the clusters; the agent writes one **code-free**
spec file per cluster.

### 2. Spec → code (`build`)

```bash
npx @docsbook/specify build ./specs/my-feature
```

Returns triggers + a code-plan skeleton. The agent implements every behavioral
claim, honoring every invariant — and invents nothing the spec omits.

### 3. Verify code ↔ spec (`verify`)

```bash
npx @docsbook/specify verify ./specs/my-feature --graph ./graphify-out/graph.json
```

Returns a **coverage map**: every trigger lexically matched against graphify
code-graph nodes. `uncovered` triggers are the **drift signal** — a behavior the
spec promises with no matching code (or spec text too vague to match). The spec
stays code-free; all code references live in this output, never in the spec.

### 4. Reflect before coding (`reflect`)

```bash
npx @docsbook/specify reflect
```

Prints the standing guide for changing code under a spec: find the triggers your
change touches, treat them as the contract, update the spec in the same change
if observable behavior shifts.

---

## Integrations

| Tool | What it buys you |
|---|---|
| [**graphify**](https://www.npmjs.com/package/graphify) | A knowledge graph of the code. `reverse` clusters it into spec files; `verify` matches triggers to its symbol nodes — so the spec carries zero code references and conformance stays cheap. |
| [**markdown-lsp**](https://www.npmjs.com/package/markdown-lsp) | Search a large spec without reading whole files into context: `markdown-lsp search-text ./specs "quota"`, `search-symbols`, `links-from`. Optional `index` + `semantic-search` for embedding-backed lookup. |

```bash
# search a spec cheaply instead of reading every file
npx markdown-lsp search-text ./specs/my-feature "quota exceeded"
npx markdown-lsp links-from ./specs/my-feature README.md
```

---

## Commands

| Command | Kind | Description |
|---|---|---|
| `specify install [dir]` | setup | Install the skill + `/specify` command into Claude / Cursor / Codex |
| `specify spec validate <dir>` | deterministic | Lint spec structure — triggers present, links resolve, no code leaks |
| `specify verify <spec> [--graph <p>] [--threshold <n>]` | deterministic | Coverage map: triggers ↔ graphify code-graph nodes |
| `specify reverse <code-dir> [--graph <p>]` | dossier → AI | Clustered code symbols to turn into spec files |
| `specify build <spec-dir>` | dossier → AI | Triggers + code plan to scaffold from |
| `specify reflect` | guide | Spec-driven coding guide |

All commands print JSON to stdout.

---

## Install

```bash
npx @docsbook/specify install          # detects Claude / Cursor / Copilot / Codex
```

- **Claude Code** → `.claude/skills/specify/` + `.claude/commands/specify.md` (use `/specify`)
- **Cursor** → `.cursor/rules/specify.mdc`
- **Copilot / Codex** → appended to `copilot-instructions.md` / `AGENTS.md`

## License

MIT © Dan Bondarev
