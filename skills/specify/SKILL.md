---
name: specify
description: Spec-driven development — reverse-engineer behavioral specs from code, scaffold code from specs, verify code↔spec conformance, and reflect on a spec before coding. A spec is "a codebase without the code": README + trigger-keyed files describing WHAT a system does, never HOW. Use when writing/validating behavioral specs, generating a spec from existing code, building code from a spec, or checking that code still matches its spec.
metadata:
  type: workflow
  version: 0.4.0
  keywords:
    - spec
    - specification
    - spec-driven
    - greenfield
    - idea-to-spec
    - reverse-engineer
    - code-generation
    - conformance
    - verify
    - behavioral
    - graphify
    - markdown-lsp
---

# specify — spec-driven development

A **spec** is a codebase without the code. It is a folder of markdown describing
what a system *does* — its behaviors, invariants, edge cases — with **no file
paths, function names, types, or imports**. From a complete spec you could
rebuild the project and get the same functionality. The spec is what stops the
next change from silently breaking behavior.

## Spec format

```
<module>/
  README.md        # frontmatter `triggers:` + behavior overview, links to aspects
  <aspect>.md      # one file per behavioral aspect (optional, nestable)
```

Every file's frontmatter carries a `triggers:` array — the phrases a developer
or AI would use to ask about that behavior. Triggers are the lookup key (for
markdown-lsp search and for `verify` coverage mapping). A file's body is either
a direct behavior description, or links to nested files — each link is a
`key trigger → file` pair, the same shape as a knowledge base.

**Rules:** no code in the spec — no paths, signatures, types, imports. Each
heading is a behavioral claim. See `examples/translation-behavior/`.

## The CLI does the deterministic half; you do the reasoning

`@docsbook/specify` ships a CLI for the parts that need no model — validating
spec structure and building the trigger↔code coverage map. The generative entry
points are AI tasks **you** perform, using the CLI's JSON dossier as input.

### 0. Idea → spec (new) — greenfield, no code yet

When the user has only an idea and hasn't written code, it is **cheaper to write
the spec first**, then generate code from it (`build`). Start here:

```bash
specify new "AI-powered habit tracker with streaks and reminders"
# or pin the folder: specify new "<idea>" --dir ./specs/habits
```

The CLI scaffolds a valid, code-free spec skeleton (README with placeholder
triggers + Overview / Behaviors / Invariants / Edge cases sections). Then, as the
agent: **expand the idea into behavioral claims** — one heading per thing the
product does, split distinct concerns into aspect files, fill every `triggers:`
array, state invariants and edge cases. Keep it code-free: no stack, no
frameworks, no signatures — choosing the stack is the `build` step's job. Finish
with `specify spec validate` (must pass), then `specify build` to scaffold code.

### 1. Code → spec (reverse)

```bash
# (a) build a knowledge graph of the code — use the graphify skill
graphify ./src                       # → graphify-out/graph.json
# (b) get the clustered dossier (symbols grouped by graphify community)
specify reverse ./src --graph ./graphify-out/graph.json
```

Then, as the agent: **write the spec into a `specs/` directory at the root of
the project being analyzed** — `specs/<subsystem>/` (the dossier's `spec_dir`
field gives the exact path; never write specs into the specify package itself or
into `examples/`). For each cluster, write one behavioral spec file describing
what those symbols do — strip every code reference, add a `triggers:` array, link
the files under a root README. Finish with `specify spec validate ./specs/<subsystem>`
(must pass).

### 2. Spec → code (build)

```bash
specify build ./specs/my-feature     # → aspects + triggers + a code plan skeleton
```

Then, as the agent: implement every behavioral claim and honor every invariant.
Map each trigger to an implementation site, write the code, do **not** invent
behavior the spec omits. Confirm with `specify verify` (step 4).

### 3. Verify code ↔ spec conformance

```bash
specify verify ./specs/my-feature --graph ./graphify-out/graph.json
```

The CLI returns a **coverage map**: every spec trigger lexically matched against
graphify code-graph nodes (threshold 0.5, like docs-drift). `covered` triggers
have a plausible implementation site; **`uncovered` triggers are the drift
signal** — a behavior the spec promises with no matching code, or spec text too
vague to match a symbol. Then, as the agent: open the matched code for each
trigger and judge whether the behavior is *actually* implemented correctly — the
deterministic pass finds *where* to look; you decide *whether it's right*.

> The spec stays code-free. All code references live in the verify output, never
> in the spec — that's why graphify (not the spec) carries the code↔behavior link.

### 4. Reflect before coding

```bash
specify reflect                      # standing guide for writing code from a spec
```

Run before a non-trivial change: find the triggers your change touches — those
behaviors are the contract you must not break — and update the spec in the same
change if observable behavior shifts.

## Searching a large spec cheaply (markdown-lsp)

A spec is markdown, so [markdown-lsp](https://www.npmjs.com/package/markdown-lsp)
searches it without burning tokens on a full read:

```bash
# full-text / fuzzy trigger search over the spec — no API key needed
npx markdown-lsp search-text ./specs/my-feature "quota exceeded"
npx markdown-lsp search-symbols ./specs/my-feature "cache"
npx markdown-lsp links-from ./specs/my-feature README.md   # walk the spec graph

# optional: semantic search over the spec (needs OPENROUTER_API_KEY)
npx markdown-lsp index ./specs/my-feature --granularity heading
npx markdown-lsp semantic-search ./specs/my-feature "what happens on rate limit"
```

Prefer markdown-lsp search over reading whole spec files into context.

## Commands reference

| Command | Kind | What it does |
|---|---|---|
| `specify new "<idea>" [--dir <p>]` | scaffold | Create a brand-new spec from an idea — no code yet (greenfield) |
| `specify spec validate <dir>` | deterministic | Validate spec structure (triggers, links, no-code) |
| `specify verify <spec> [--graph <p>]` | deterministic | Coverage map: triggers ↔ graphify nodes |
| `specify reverse <code-dir> [--graph <p>]` | dossier→AI | Clustered code symbols to turn into spec files |
| `specify build <spec-dir>` | dossier→AI | Triggers + code plan to scaffold from |
| `specify reflect` | guide | Spec-driven coding guide |
| `specify install [dir]` | setup | Install this skill into Claude/Cursor/Codex |
