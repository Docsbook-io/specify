---
triggers:
  - "content chunking"
  - "chunk translation"
  - "large page translation"
  - "translate long document"
  - "split for translation"
---

# Content Chunking

## Purpose

Translation providers impose limits on the size of a single request. To handle pages that exceed those limits, the system splits content into smaller chunks before translating, then reassembles the results.

## Chunk boundaries

Chunks are split at natural boundaries — paragraph breaks or block-level element boundaries — to avoid splitting sentences mid-way. The meaning and structure of each chunk is self-contained enough for accurate translation.

## Reassembly

After all chunks are translated, they are reassembled in original order. The caller receives a single translated document, not individual chunks.

## Behavior on partial failure

If a chunk fails to translate (e.g. network error, provider error), the entire translation request is considered failed for that document. The system falls back to the original-language content rather than returning a partially translated page.

## Content types

Chunking applies to both markdown-structured content and HTML content. The chunking strategy is adapted to the content type to preserve structural integrity (e.g. not splitting inside a list item).

## Code blocks

Code blocks are excluded from translation. They pass through each chunk unchanged, as though invisible to the translation provider.
