---
triggers:
  - "translate page"
  - "translation request"
  - "on language change"
  - "translation cache"
  - "daily quota"
  - "quota exceeded"
  - "translation error"
  - "language detection"
  - "batch translate"
  - "translate markdown"
  - "translate html"
---

# Translation Behavior

Describes the observable behavior of the page translation subsystem — what it does when, under what conditions, and what a caller should expect in return. Contains no code references.

## Aspects

- [Caching behavior](caching.md) — how translated content is stored and reused
- [Quota and limits](quota.md) — what happens when daily translation limits are reached
- [Content chunking](chunking.md) — how large documents are split for translation

## Overview

When a user requests a page in a language other than the workspace default, the system attempts to produce a translated version of that page's content. The result is either served from a cache (instant) or generated on demand (async, may take several seconds for long pages).

Translation applies to both the main page body and sidebar navigation items. The two are translated independently and may be served from different cache entries.

If translation fails or is unavailable, the system falls back to the original language content without error to the end user. Errors are logged internally.

## Invariants

- A successfully translated page is semantically equivalent to the original — structure (headings, links, lists) is preserved; only natural-language text changes.
- Translation is workspace-scoped: enabling translation for workspace A does not affect workspace B.
- The source language is always the workspace's configured default language.
- Translation is not applied to code blocks — they pass through unchanged.
