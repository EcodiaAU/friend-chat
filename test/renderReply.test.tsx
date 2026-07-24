// Renders renderReply output to static HTML and asserts the load-bearing rules:
// no raw URL text, images become thumbnails, links become tidy labels, lists render.
// Run: npx tsx test/renderReply.test.tsx
import * as React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { renderReply } from '../src/renderReply';

let pass = 0, fail = 0;
const html = (t: string) => renderToStaticMarkup(React.createElement(React.Fragment, null, renderReply(t)));
function check(name: string, cond: boolean, detail = '') {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('FAIL  ' + name + '  ' + detail); }
}

const SUPA = 'https://cuiobblgoybgmaxnsazo.supabase.co/storage/v1/object/public/ecosphere-assets/21a350a2/033a4072.png';

// 1. The exact reported message: bare Supabase image URL on its own line.
const reported = `You've got one image in your library right now:\n\n1 (1).png\n${SUPA}\n\nThat's the only one uploaded so far.`;
const h1 = html(reported);
check('reported msg: image URL becomes an <img> preview', h1.includes('<img') && h1.includes(SUPA), h1.slice(0, 200));
check('reported msg: no raw URL text leaks outside an attribute', !/>[^<]*https?:\/\//.test(h1), h1);

// 2. Markdown image -> thumbnail with caption.
const h2 = html(`![logo.png](${SUPA})`);
check('markdown image -> fc-img', h2.includes('class="fc-img"') && h2.includes('logo.png'));

// 3. Markdown link -> clickable label, not the URL text.
const h3 = html('Add them through the [Image Library](https://studio.ecodia.au/library?site=abc).');
check('markdown link -> fc-link with label', h3.includes('class="fc-link"') && h3.includes('>Image Library<'));
check('markdown link: raw url not shown as text', !/>[^<]*https:\/\/studio/.test(h3), h3);

// 4. Bare non-image URL -> tidy labelled link (host/path, not raw).
const h4 = html('See https://studio.ecodia.au/library?site=abc for more.');
check('bare non-image URL -> fc-link', h4.includes('class="fc-link"'));
check('bare non-image URL: no raw https text node', !/>[^<]*https:\/\//.test(h4), h4);

// 5. Ordered list renders as <ol>.
const h5 = html('1. First\n2. Second\n3. Third');
check('ordered list -> <ol>', h5.includes('<ol') && (h5.match(/<li>/g) || []).length === 3);

// 6. Unordered list still works.
const h6 = html('- one\n- two');
check('unordered list -> <ul>', h6.includes('<ul') && (h6.match(/<li>/g) || []).length === 2);

// 7. Heading.
const h7 = html('## Your images');
check('## heading -> h5.fc-h', h7.includes('fc-h') && h7.includes('Your images'));

// 8. Bold + inline code still work.
const h8 = html('This is **bold** and `code`.');
check('bold + code inline', h8.includes('<strong>bold</strong>') && h8.includes('<code'));

// 9. A link opens safely in a new tab.
check('links are target=_blank rel=noopener', h3.includes('target="_blank"') && h3.includes('rel="noopener noreferrer"'));

// 10. Plain text with no markup is untouched.
const h10 = html('Just a normal sentence.');
check('plain text passthrough', h10.includes('Just a normal sentence.') && !h10.includes('fc-link'));

// ── Fenced code blocks ─────────────────────────────────────────────────────
// 11. A fence renders as <pre class="fc-pre"><code> with a copy button.
const h11 = html('Try this:\n\n```js\nconst a = 1;\n```\n\nThat is it.');
check('fence -> pre.fc-pre + code', h11.includes('class="fc-pre"') && h11.includes('<code>const a = 1;</code>'));
check('fence -> copy button', h11.includes('class="fc-copy"') && h11.includes('>Copy<'));
check('fence -> language label', h11.includes('class="fc-codelang"') && h11.includes('>js<'));
check('prose around a fence still renders', h11.includes('Try this:') && h11.includes('That is it.'));

// 12. THE load-bearing one: * and _ inside a fence are code, never emphasis.
const starry = 'a * b ** c _d_ __e__ *not italic*';
const h12 = html('```\n' + starry + '\n```');
check('fence: * and _ survive verbatim', h12.includes('a * b ** c _d_ __e__ *not italic*'), h12);
check('fence: no <em>/<strong> from fenced content', !h12.includes('<em>') && !h12.includes('<strong>'), h12);

// 13. A blank line inside a fence does not split it into two blocks.
const h13 = html('```py\ndef a():\n\n    return 1\n```');
check('fence: blank line stays inside one block', (h13.match(/fc-pre/g) || []).length === 1 && h13.includes('return 1'), h13);

// 14. A URL inside a fence stays literal text: it is code, not a link to tidy up.
const h14 = html('```\ncurl https://api.ecodia.au/thing\n```');
check('fence: URL stays literal, not linkified', h14.includes('curl https://api.ecodia.au/thing') && !h14.includes('fc-link'), h14);

// 15. Backticks with no language still render, labelled generically.
const h15 = html('```\nplain\n```');
check('fence with no language -> "code" label', h15.includes('>code<') && h15.includes('plain'));

// 16. An unclosed fence (a stopped or still-streaming turn) still shows its code.
const h16 = html('Here:\n\n```sh\nnpm run build');
check('unclosed fence still renders its code', h16.includes('fc-pre') && h16.includes('npm run build'), h16);

// 17. Inline `code` is untouched by the fence work.
check('inline code still renders (regression)', h8.includes('<code class="fc-code">code</code>'), h8);

// 18. Two fences in one reply stay separate.
const h18 = html('```\none\n```\n\nmid\n\n```\ntwo\n```');
check('two fences -> two blocks', (h18.match(/fc-pre/g) || []).length === 2 && h18.includes('mid'), h18);

// ── Tables ─────────────────────────────────────────────────────────────────
// 19. A pipe table renders as a real table with a header row.
const h19 = html('| Day | Spot |\n| --- | --- |\n| Sat | Beach |\n| Sun | Markets |');
check('pipe table -> <table>', h19.includes('class="fc-table"') && h19.includes('<thead') && h19.includes('<th'));
check('table: header cells', h19.includes('>Day<') && h19.includes('>Spot<'));
check('table: body rows', (h19.match(/<tr>/g) || []).length === 3 && h19.includes('>Markets<'), h19);

// 20. Alignment markers in the separator drive text-align.
const h20 = html('| a | b | c |\n| :-- | --: | :-: |\n| 1 | 2 | 3 |');
check('table: alignment from separator', h20.includes('text-align:left') && h20.includes('text-align:right') && h20.includes('text-align:center'), h20);

// 21. Inline markup works inside a cell, and a link in a cell is still tidied.
const h21 = html('| What | Where |\n| --- | --- |\n| **Bold** | [Studio](https://studio.ecodia.au/x) |');
check('table: inline markup in cells', h21.includes('<strong>Bold</strong>') && h21.includes('class="fc-link"'));
check('table: no raw URL text in a cell', !/>[^<]*https:\/\//.test(h21), h21);

// 22. A short row is padded, not collapsed.
const h22 = html('| a | b | c |\n| --- | --- | --- |\n| 1 |');
check('table: short row padded to header width', (h22.match(/<td/g) || []).length === 3, h22);

// 23. A paragraph that merely contains a pipe is NOT a table.
const h23 = html('Use a | b to pipe it.\nThat is all.');
check('pipe in prose is not a table', !h23.includes('fc-table') && h23.includes('fc-p'), h23);

// ── Task lists ─────────────────────────────────────────────────────────────
// 24. "- [ ]" / "- [x]" render as checkbox glyphs.
const h24 = html('- [x] Booked the van\n- [ ] Packed the tent');
check('task list -> fc-tasks', h24.includes('class="fc-ul fc-tasks"'));
check('task list: done + not-done states', h24.includes('fc-task fc-task-done') && h24.includes('aria-label="done"') && h24.includes('aria-label="not done"'), h24);
check('task list: the bracket markers are gone from the text', !h24.includes('[x]') && !h24.includes('[ ]'), h24);
check('task list: item text survives', h24.includes('Booked the van') && h24.includes('Packed the tent'));

// 25. An uppercase [X] counts as done.
const h25 = html('- [X] Shouted');
check('task list: [X] uppercase is done', h25.includes('fc-task-done'), h25);

// 26. A plain bullet list is still a plain bullet list, not a checklist.
check('plain bullets are not a task list (regression)', !h6.includes('fc-tasks'), h6);

// 27. A mixed list (one task, one plain bullet) falls back to a plain list.
const h27 = html('- [x] done thing\n- plain thing');
check('mixed list falls back to plain <ul>', !h27.includes('fc-tasks') && h27.includes('class="fc-ul"'), h27);

// 28. Inline markup inside a task item works.
const h28 = html('- [ ] Ask about **the van**');
check('task list: inline markup in an item', h28.includes('<strong>the van</strong>'), h28);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
