import * as React from 'react';

/**
 * Minimal, dependency-free rendering of a Friend reply so the chat reads clearly for
 * anyone: paragraphs, ordered + unordered lists, small headings, and inline
 * **bold** / *italic* / `code` / [links](url) / ![images](url).
 *
 * The load-bearing rule: in prose, a RAW URL never appears as text. A bare link
 * becomes a clickable label; a bare image URL becomes a thumbnail preview. So even
 * when the Friend pastes a raw URL, the person sees a tidy link or a picture, never a
 * wall of https://... . (Origin 2026-07-17: the image-library answer dumped a raw
 * Supabase URL and the filename with no preview and no clickable library link.)
 *
 * The one deliberate carve-out is inside a ``` fence, where every character is left
 * exactly as it arrived. A URL in a curl line is part of the command being handed
 * over, and tidying it into a label would break the thing the person is about to
 * paste. Fence content never meets the inline pass at all.
 */

const URL_CORE = 'https?:\\/\\/[^\\s<>()\\[\\]]+[^\\s<>()\\[\\].,;:!?\'"]';
const IMG_EXT = /\.(png|jpe?g|gif|webp|svg|avif|bmp|ico)(\?[^\s]*)?$/i;

/** A URL that points at an image: by extension, or a known asset-store path. */
function isImageUrl(u: string): boolean {
  return IMG_EXT.test(u) || /\/storage\/v1\/object\/(public|sign)\//.test(u) || /\/_next\/image\?/.test(u);
}

/** A human label for a bare URL: the file name if it has one, else the host. */
function labelForUrl(u: string): string {
  try {
    const url = new URL(u);
    const last = url.pathname.split('/').filter(Boolean).pop();
    if (last && /\.[a-z0-9]{2,5}$/i.test(last)) return decodeURIComponent(last);
    return url.hostname.replace(/^www\./, '') + (url.pathname !== '/' ? url.pathname : '');
  } catch {
    return 'link';
  }
}

function imageNode(url: string, alt: string, key: React.Key): React.ReactNode {
  return (
    <a key={key} className="fc-imglink" href={url} target="_blank" rel="noopener noreferrer" title={alt || 'Open image'}>
      <img className="fc-img" src={url} alt={alt || 'image'} loading="lazy" />
      {alt ? <span className="fc-imgcap">{alt}</span> : null}
    </a>
  );
}

function linkNode(url: string, text: string, key: React.Key): React.ReactNode {
  return (
    <a key={key} className="fc-link" href={url} target="_blank" rel="noopener noreferrer">
      {text}
    </a>
  );
}

// One pass over a line, in priority order: image, link, code, bold, italic, bare URL.
const INLINE_RE = new RegExp(
  [
    '!\\[([^\\]]*)\\]\\((' + URL_CORE + ')\\)', // 1 alt, 2 url   -> ![alt](url)
    '\\[([^\\]]+)\\]\\((' + URL_CORE + ')\\)', // 3 text, 4 url  -> [text](url)
    '`([^`]+)`', // 5 code
    '\\*\\*([^*]+)\\*\\*', // 6 bold
    '\\*([^*]+)\\*', // 7 italic
    '(' + URL_CORE + ')', // 8 bare url
  ].join('|'),
  'g',
);

function inline(s: string, keyPrefix: string): React.ReactNode[] {
  const out: React.ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  INLINE_RE.lastIndex = 0;
  let n = 0;
  while ((m = INLINE_RE.exec(s)) !== null) {
    if (m.index > last) out.push(<React.Fragment key={`${keyPrefix}t${n}`}>{s.slice(last, m.index)}</React.Fragment>);
    const k = `${keyPrefix}n${n}`;
    if (m[1] !== undefined && m[2]) out.push(imageNode(m[2], m[1], k));
    else if (m[3] !== undefined && m[4]) {
      // a [label](url) whose label is itself a raw url -> show the tidy label instead
      out.push(linkNode(m[4], /^https?:\/\//.test(m[3]) ? labelForUrl(m[4]) : m[3], k));
    } else if (m[5] !== undefined) out.push(<code key={k} className="fc-code">{m[5]}</code>);
    else if (m[6] !== undefined) out.push(<strong key={k}>{m[6]}</strong>);
    else if (m[7] !== undefined) out.push(<em key={k}>{m[7]}</em>);
    else if (m[8]) out.push(isImageUrl(m[8]) ? imageNode(m[8], '', k) : linkNode(m[8], labelForUrl(m[8]), k));
    last = m.index + m[0].length;
    n += 1;
  }
  if (last < s.length) out.push(<React.Fragment key={`${keyPrefix}t${n}`}>{s.slice(last)}</React.Fragment>);
  return out;
}

const UL_RE = /^\s*[-*•]\s+/;
const OL_RE = /^\s*\d+[.)]\s+/;
const H_RE = /^\s*(#{1,3})\s+(.*)$/;
// A checklist item: "- [ ] thing" / "- [x] thing". Read-only in a reply, so the
// glyph is a picture of state, not a control the person can toggle to a lie.
const TASK_RE = /^\s*[-*•]\s+\[([ xX])\]\s*/;

// ── Tables ──────────────────────────────────────────────────────────────────
// A pipe table is a header row, a dash separator, then body rows. Recognised only
// with that separator present, so a paragraph that merely happens to contain a
// vertical bar is still a paragraph.
const TABLE_SEP_RE = /^\s*\|?[\s:|-]*-[\s:|-]*\|?\s*$/;
const PIPE_ROW_RE = /\|/;

function cells(line: string): string[] {
  let s = line.trim();
  if (s.startsWith('|')) s = s.slice(1);
  if (s.endsWith('|')) s = s.slice(0, -1);
  return s.split('|').map((c) => c.trim());
}

/** Column alignment from the separator row: :--- left, ---: right, :---: centre. */
function alignments(sep: string): (('left' | 'right' | 'center') | undefined)[] {
  return cells(sep).map((c) => {
    const l = c.startsWith(':');
    const r = c.endsWith(':');
    if (l && r) return 'center';
    if (r) return 'right';
    if (l) return 'left';
    return undefined;
  });
}

function isTable(lines: string[]): boolean {
  return (
    lines.length >= 2 &&
    PIPE_ROW_RE.test(lines[0]) &&
    TABLE_SEP_RE.test(lines[1]) &&
    lines[1].includes('-') &&
    lines.slice(2).every((l) => PIPE_ROW_RE.test(l))
  );
}

// ── Fenced code ─────────────────────────────────────────────────────────────
// A ``` fence is lifted out BEFORE anything else looks at the text, for two
// reasons. Blank lines inside a fence would otherwise split it across paragraph
// blocks, and every character between the fences has to survive verbatim: a
// snippet full of * and _ is code, not emphasis, so it never meets the inline
// pass at all.

const FENCE_OPEN_RE = /^\s*(?:```|~~~)\s*([A-Za-z0-9_+.#-]*)\s*$/;
const FENCE_CLOSE_RE = /^\s*(?:```|~~~)\s*$/;

type Seg = { kind: 'code'; lang: string; code: string } | { kind: 'prose'; text: string };

function segment(text: string): Seg[] {
  const lines = text.split('\n');
  const out: Seg[] = [];
  let prose: string[] = [];
  const flush = () => {
    if (prose.some((l) => l.trim() !== '')) out.push({ kind: 'prose', text: prose.join('\n') });
    prose = [];
  };
  for (let i = 0; i < lines.length; i += 1) {
    const open = lines[i].match(FENCE_OPEN_RE);
    if (!open) {
      prose.push(lines[i]);
      continue;
    }
    flush();
    const body: string[] = [];
    i += 1;
    // An UNCLOSED fence still renders: a reply cut off mid-snippet (a stopped turn,
    // a stream still arriving) shows the code it has rather than the fence markers.
    while (i < lines.length && !FENCE_CLOSE_RE.test(lines[i])) {
      body.push(lines[i]);
      i += 1;
    }
    out.push({ kind: 'code', lang: open[1] || '', code: body.join('\n') });
  }
  flush();
  return out;
}

async function copyText(s: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(s);
      return true;
    }
  } catch {
    /* fall through to the legacy path: a denied permission is not a dead button */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = s;
    ta.setAttribute('readonly', '');
    ta.style.cssText = 'position:fixed;top:-9999px;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/**
 * A code snippet in a reply: monospaced, its own scroll, and one press to take it.
 * A Friend that answers with code is answering with something the person means to
 * USE, so the copy is part of the answer rather than a nicety.
 */
function CodeBlock({ code, lang }: { code: string; lang: string }) {
  const [copied, setCopied] = React.useState(false);
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  return (
    <div className="fc-codewrap">
      <div className="fc-codebar">
        <span className="fc-codelang">{lang || 'code'}</span>
        <button
          type="button"
          className="fc-copy"
          aria-label={copied ? 'Copied' : 'Copy code'}
          onClick={() => {
            void copyText(code).then((ok) => {
              if (!ok) return;
              setCopied(true);
              if (timer.current) clearTimeout(timer.current);
              timer.current = setTimeout(() => setCopied(false), 1600);
            });
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="fc-pre">
        <code>{code}</code>
      </pre>
    </div>
  );
}

/** Minimal, dependency-free rendering of a Friend reply. */
export function renderReply(text: string): React.ReactNode {
  return segment(text ?? '').map((seg, si) =>
    seg.kind === 'code' ? (
      <CodeBlock key={`c${si}`} code={seg.code} lang={seg.lang} />
    ) : (
      <React.Fragment key={`s${si}`}>{renderProse(seg.text, si)}</React.Fragment>
    ),
  );
}

function renderProse(text: string, si: number): React.ReactNode {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi0) => {
    // Keys stay unique across segments: a reply is prose, fence, prose.
    const bi = `${si}-${bi0}`;
    const lines = block.split(/\n/).filter((l, i, a) => l.trim() !== '' || (i > 0 && i < a.length - 1));
    if (!lines.length) return null;

    const h = lines.length === 1 ? lines[0].match(H_RE) : null;
    if (h) {
      const level = h[1].length; // 1..3
      const cls = `fc-h fc-h${level}`;
      return level === 1 ? (
        <h4 key={bi} className={cls}>{inline(h[2], `${bi}-`)}</h4>
      ) : level === 2 ? (
        <h5 key={bi} className={cls}>{inline(h[2], `${bi}-`)}</h5>
      ) : (
        <h6 key={bi} className={cls}>{inline(h[2], `${bi}-`)}</h6>
      );
    }

    if (isTable(lines)) {
      const head = cells(lines[0]);
      const align = alignments(lines[1]);
      const body = lines.slice(2).map(cells);
      return (
        <div key={bi} className="fc-tablewrap">
          <table className="fc-table">
            <thead>
              <tr>
                {head.map((c, ci) => (
                  <th key={ci} style={align[ci] ? { textAlign: align[ci] } : undefined}>
                    {inline(c, `${bi}-h${ci}-`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {body.map((row, ri) => (
                <tr key={ri}>
                  {/* Padded to the header width so a short row does not collapse the
                      grid and a long one does not spill past its heading. */}
                  {head.map((_, ci) => (
                    <td key={ci} style={align[ci] ? { textAlign: align[ci] } : undefined}>
                      {inline(row[ci] ?? '', `${bi}-${ri}-${ci}-`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    // A checklist before a plain bullet list, since every task line is also a bullet.
    if (lines.every((l) => TASK_RE.test(l))) {
      return (
        <ul key={bi} className="fc-ul fc-tasks">
          {lines.map((l, li) => {
            const done = /[xX]/.test(l.match(TASK_RE)![1]);
            return (
              <li key={li} className={done ? 'fc-task fc-task-done' : 'fc-task'}>
                <span className="fc-check" role="img" aria-label={done ? 'done' : 'not done'}>
                  {done ? '✓' : ''}
                </span>
                <span>{inline(l.replace(TASK_RE, ''), `${bi}-${li}-`)}</span>
              </li>
            );
          })}
        </ul>
      );
    }

    if (lines.every((l) => UL_RE.test(l))) {
      return (
        <ul key={bi} className="fc-ul">
          {lines.map((l, li) => <li key={li}>{inline(l.replace(UL_RE, ''), `${bi}-${li}-`)}</li>)}
        </ul>
      );
    }
    if (lines.every((l) => OL_RE.test(l))) {
      return (
        <ol key={bi} className="fc-ol">
          {lines.map((l, li) => <li key={li}>{inline(l.replace(OL_RE, ''), `${bi}-${li}-`)}</li>)}
        </ol>
      );
    }

    return (
      <p key={bi} className="fc-p">
        {lines.map((l, li) => (
          <span key={li}>
            {inline(l, `${bi}-${li}-`)}
            {li < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  });
}
