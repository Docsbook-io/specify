---
triggers:
  - "translation cache"
  - "cache hit"
  - "cache miss"
  - "cached translation"
  - "reuse translation"
---

# Caching Behavior

## Cache key

A translation is uniquely identified by the combination of: source content identity + target language code. If the source content has not changed and the target language is the same, the cached translation is returned without making an external translation request.

## Cache lifetime

Once a translation is cached, it is valid indefinitely — there is no TTL. A cache entry is invalidated only when the source content changes.

## Cache miss behavior

On a cache miss, the system requests a translation from the external provider, stores the result, and returns it. The response to the caller includes the translated content.

## Scope

The cache is shared across all requests for the same workspace. Two users requesting the same page in the same language will both benefit from the same cache entry after the first request.

## Integrity

A cache entry is never returned if its source content digest does not match the current content. Stale entries are silently replaced on the next cache miss.
