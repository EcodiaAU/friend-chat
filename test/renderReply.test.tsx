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

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail === 0 ? 0 : 1);
