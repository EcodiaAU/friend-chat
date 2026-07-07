import * as React from 'react';

/** Inline **bold** rendering. */
function inline(s: string): React.ReactNode {
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((p, i) =>
    /^\*\*[^*]+\*\*$/.test(p) ? <strong key={i}>{p.slice(2, -2)}</strong> : <span key={i}>{p}</span>,
  );
}

/** Minimal, dependency-free rendering of a Friend reply: paragraphs, bullets, bold. */
export function renderReply(text: string): React.ReactNode {
  const blocks = text.split(/\n{2,}/);
  return blocks.map((block, bi) => {
    const lines = block.split(/\n/);
    const isList = lines.length > 0 && lines.every((l) => /^\s*[-*•]\s+/.test(l));
    if (isList) {
      return (
        <ul key={bi} className="fc-ul">
          {lines.map((l, li) => (
            <li key={li}>{inline(l.replace(/^\s*[-*•]\s+/, ''))}</li>
          ))}
        </ul>
      );
    }
    return (
      <p key={bi} className="fc-p">
        {lines.map((l, li) => (
          <span key={li}>
            {inline(l)}
            {li < lines.length - 1 ? <br /> : null}
          </span>
        ))}
      </p>
    );
  });
}
