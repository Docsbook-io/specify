---
description: Spec-driven workflow. A spec is a codebase without the code. Usage: /specify [reverse|build|verify|reflect|validate] [path]
---

# /specify

Spec-driven development with `@docsbook/specify`. A **spec** is a folder of
markdown describing what a system *does* — behaviors, invariants, edge cases —
with no file paths, function names, types, or imports. From it you could rebuild
the project. The spec is what stops a change from silently breaking behavior.

The CLI does the deterministic half (validate structure, build the trigger↔code
coverage map). The four generative entry points are AI tasks **you** perform,
reasoning over the CLI's JSON dossier.

## Entry points

```
/specify new "<idea>"           idea → spec   — greenfield: no code yet; scaffold a
                                spec, then expand the idea into behaviors
/specify reverse <code-dir>     code → spec   — graphify the code, then turn each
                                cluster into a behavioral spec file
/specify build <spec-dir>       spec → code   — implement every trigger, honoring
                                every invariant; invent nothing the spec omits
/specify verify <spec> <graph>  conformance   — coverage map of triggers ↔ code
                                nodes; uncovered triggers = drift signal
/specify reflect                guide         — read before a non-trivial change
/specify validate <spec-dir>    structure     — deterministic lint of the spec
```

## How to run each

0. **new** (greenfield) — `specify new "<idea>"` scaffolds a code-free spec
   skeleton. Expand each section into behavioral claims, split concerns into
   aspect files, fill every `triggers:` array. Then `validate`, then `build`.
1. **reverse** — `graphify ./src` (graphify skill) → `specify reverse ./src
   --graph ./graphify-out/graph.json`. For each cluster in the dossier, write one
   code-free spec file with a `triggers:` array. Finish with `specify spec validate`.
2. **build** — `specify build ./specs/x` gives triggers + a code plan. Implement
   each behavioral claim; do not add behavior the spec omits.
3. **verify** — `specify verify ./specs/x --graph ./graphify-out/graph.json`.
   Open the matched code per trigger and judge whether the behavior is correct.
4. **reflect** — `specify reflect`. Find the triggers your change touches; update
   the spec in the same change if observable behavior shifts.

## Searching a large spec cheaply

A spec is markdown — search it with `markdown-lsp` instead of reading whole files:

```bash
npx markdown-lsp search-text ./specs/x "quota exceeded"
npx markdown-lsp search-symbols ./specs/x "cache"
```

See `examples/translation-behavior/` for a real spec.
