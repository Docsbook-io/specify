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

## Quick Start — install once, then just ask

```bash
npx @docsbook/specify install     # adds the skill + /specify to Claude Code, Cursor, or Codex
```

That's it. Now talk to your AI tool in plain language. Once a `specs/` directory
exists, **specify works under the hood on its own** — you never run a command or
say "update the spec".

### The everyday loop — you just ask for the feature

```
You:  "Add team invites with role-based access."

AI:   (silently, before touching code)
      1. reads the spec for the area you're changing
      2. ⚠️ "The auth spec says viewers can't see billing — should an invited
          admin? The spec is silent on invite expiry. Confirm before I build."
      3. implements it, honoring every invariant the spec locked in
      4. updates specs/ in the same change so the spec never lags the code
```

You asked for a feature. The AI consulted the spec, **reflected and asked the
right questions first**, built it without breaking a stated behavior, and kept
the spec in sync — all without you mentioning specs once.

### First time? Bootstrap the spec, then forget about it

| You have… | Just say to your AI tool |
|---|---|
| **A project, no specs yet** | *“Generate specs for this project.”* → it graphs your code, clusters it into behaviors, writes one code-free spec per subsystem into `specs/`. From then on, the loop above runs automatically. |
| **Only an idea, no code yet** | *“I want to build a URL shortener with click analytics.”* → it writes the spec **first**, asks what's ambiguous, then *“build it”* generates code from the agreed spec. |

> **Why spec-first is cheaper:** the spec is *a codebase without the code* — write
> it once, and every future change is checked against it instead of discovered in
> production. The AI reflecting against a spec before coding catches the broken
> contract while it's still a question, not a bug.

A spec lands as plain markdown you can read and edit:

```
specs/analytics/
  README.md            # what the subsystem does + links to aspects
  failed-searches.md   # one file per behavioral aspect
  page-journeys.md
```

The CLI that powers all of this is documented [below](#cli-reference) — but for
day-to-day use, you never need it.

---

## Works with zero setup — graphify & embeddings are optional boosters

Everything above runs out of the box. Two integrations are **opt-in upgrades** —
you choose if and when the extra accuracy is worth a one-time setup step.

| Capability | ✅ Zero setup (default) | ⚡ With the booster |
|---|---|---|
| **Match spec ↔ code** (`reverse`, `verify`) | **codescan** — scans your source for declared symbols directly. No install, no build, works offline. | **[graphify](https://www.npmjs.com/package/graphify)** — a parser-built code graph: deduped symbols, call-graph clustering. Tighter clusters, usually higher coverage. Run `graphify ./src` once. |
| **Search a large spec** | **markdown-lsp full-text / fuzzy** — instant, no API key: `markdown-lsp search-text ./specs "quota"`. | **[markdown-lsp](https://www.npmjs.com/package/markdown-lsp) semantic-search** — embedding-backed meaning search (finds "rate limit" from "too many requests"). One `index` step + an API key. |

How the choice surfaces in practice:

```bash
# default — no graphify needed, runs anywhere
specify verify ./specs/billing
# → { "mode": "codescan", "covered": 7, "total_triggers": 7, ... }

# booster — if a graphify graph exists, specify uses it automatically
graphify ./src && specify verify ./specs/billing
# → { "mode": "graphify", ... }   ← tighter symbols, the hint tells you when it helps
```

You never get blocked waiting on setup: specify picks the **best surface that's
available** and tells you (`mode` + `hint`) when a booster would improve the
result. Add graphify or embeddings only when you want the extra precision.

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

<a id="cli-reference"></a>

## CLI reference

> For day-to-day use you don't need this — the installed skill drives the CLI for
> you (see [Quick Start](#quick-start--install-once-then-just-ask)). This section
> is for understanding the machinery, scripting, or CI.

The CLI does the **deterministic half** (validate structure, build the
trigger↔code coverage map). The generative steps are **AI tasks** your agent
performs, reasoning over the CLI's JSON dossier.

### 0. Idea → spec (`new`) — greenfield

Only have an idea? It's **cheaper to write the spec first**, then generate the
code from it. No code required.

```bash
npx @docsbook/specify new "AI-powered habit tracker with streaks and reminders"
```

Scaffolds a valid, code-free spec skeleton. The agent then expands the idea into
behavioral claims — splitting concerns into aspect files, filling `triggers:`,
stating invariants and edge cases — without naming any stack or framework
(that's the `build` step's job). Then `validate`, then `build`.

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
| `specify new "<idea>" [--dir <p>]` | scaffold | Create a brand-new spec from an idea — no code yet (greenfield) |
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
