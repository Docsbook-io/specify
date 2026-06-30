/**
 * Lightweight frontmatter parser for specify specs.
 *
 * Parses the leading --- block from markdown files.
 * Returns a plain object or null if no frontmatter is found.
 *
 * Supports:
 *   - scalar: key: value
 *   - inline list: key: [a, b, c]
 *   - block list:
 *       key:
 *         - item1
 *         - item2
 *
 * We intentionally do NOT depend on markdown-lsp for frontmatter —
 * markdown-lsp does not parse frontmatter out of the box (plan fact).
 * gray-matter is the external dep for production use; this module adds
 * a zero-dep fallback that handles the spec's subset.
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FrontmatterValue = string | string[] | Record<string, any>;
export type Frontmatter = Record<string, FrontmatterValue>;

/** Extract raw YAML string between opening and closing ---. */
function extractRaw(text: string): string | null {
  if (!text.startsWith('---')) return null;
  const end = text.indexOf('\n---', 3);
  if (end === -1) return null;
  return text.slice(3, end).replace(/^\r?\n/, '');
}

function unquote(v: string): string {
  v = v.trim();
  if (
    (v.startsWith('"') && v.endsWith('"')) ||
    (v.startsWith("'") && v.endsWith("'"))
  ) {
    return v.slice(1, -1);
  }
  return v;
}

function parseInlineList(raw: string): string[] {
  const inner = raw.trim().slice(1, -1).trim();
  if (!inner) return [];
  return inner.split(',').map(s => unquote(s.trim())).filter(Boolean);
}

function parseYaml(yaml: string): Frontmatter {
  const out: Frontmatter = {};
  const lines = yaml.split(/\r?\n/);
  let i = 0;

  while (i < lines.length) {
    const line = lines[i] ?? '';
    if (!line.trim() || line.trim().startsWith('#')) { i++; continue; }

    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
    if (!m) { i++; continue; }

    const key = m[1] as string;
    const rest = (m[2] ?? '').trim();

    if (rest === '') {
      // Block value: collect indented children
      const children: string[] = [];
      i++;
      while (i < lines.length) {
        const sub = lines[i] ?? '';
        if (!sub.trim()) { i++; continue; }
        if (!/^\s/.test(sub)) break;
        const listM = sub.match(/^\s+-\s+(.*)$/);
        if (listM) children.push(unquote((listM[1] ?? '').trim()));
        i++;
      }
      out[key] = children;
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

/**
 * Parse frontmatter from a markdown file's text.
 * Returns the parsed object or null if no frontmatter block is present.
 */
export function parseFrontmatter(text: string): Frontmatter | null {
  // Try gray-matter if available (runtime dep)
  try {
    // Dynamic import to avoid hard dep at parse time in environments without it
    // We use require() style via a synchronous approach for CJS compat:
    // gray-matter is listed as a real dep in package.json so it will be available.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const matter = (require('gray-matter') as { default: (s: string) => { data: Frontmatter } }).default
      ?? (require('gray-matter') as (s: string) => { data: Frontmatter });
    const { data } = matter(text);
    return data as Frontmatter;
  } catch {
    // Fallback to built-in parser
  }

  const raw = extractRaw(text);
  if (!raw) return null;
  return parseYaml(raw);
}
