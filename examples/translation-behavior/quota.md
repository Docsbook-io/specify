---
triggers:
  - "daily quota"
  - "quota exceeded"
  - "translation limit"
  - "rate limit"
  - "402 response"
  - "translation unavailable"
---

# Quota and Limits

## Daily quota

The translation provider enforces a per-API-key daily character limit. Once exhausted, translation requests to the external provider will be refused for the remainder of the day.

## Behavior on quota exhaustion

When the daily quota is reached, the system stops attempting external translation requests. The caller receives an indication that translation is currently unavailable. The original-language content is served as a fallback. No error is surfaced to the end user — only the original content is shown.

## Quota reset

The quota resets on a daily cycle as defined by the provider. No action is required from the system; on the next successful request after reset, normal behavior resumes.

## Transparency

Quota exhaustion is observable in server-side logs. It is not exposed in the user-facing UI.

## Cached content on quota exhaustion

Content that was already translated and cached before quota exhaustion continues to be served from cache. Quota limits only affect new (cache-miss) translation requests.
