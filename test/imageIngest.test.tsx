// Getting an image into the chat, proven at its rules. The bug these guard against:
// the Friend invites someone to "attach or paste" an image, they paste, and nothing
// happens, because paste did not exist in this package at all. These are the rules
// that decide whether a paste becomes an upload, whether a normal text paste survives
// it, and what a person is told when an upload fails. Pure, so no DOM.
// Run: node test/run.mjs
import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import {
  appendUrl,
  carriesText,
  failureMessage,
  imagesFrom,
  ingestImages,
  shouldSwallowPaste,
  type DataTransferLike,
} from '../src/imageIngest';

let pass = 0,
  fail = 0;
function check(name: string, cond: boolean, detail = '') {
  if (cond) {
    pass++;
    console.log('  ok  ' + name);
  } else {
    fail++;
    console.log('FAIL  ' + name + '  ' + detail);
  }
}

/** A File stand-in: the module only ever reads type/name/size off one. */
function f(name: string, type: string, size = 1024): File {
  return { name, type, size } as unknown as File;
}
/** A clipboardData/dataTransfer stand-in. */
function dt(opts: {
  items?: { kind?: string; type?: string; file?: File | null }[];
  files?: File[];
  types?: string[];
  data?: Record<string, string>;
}): DataTransferLike {
  return {
    items: opts.items?.map((i) => ({ kind: i.kind ?? 'file', type: i.type, getAsFile: () => i.file ?? null })),
    files: opts.files,
    types: opts.types,
    getData: opts.data ? (t: string) => opts.data?.[t] ?? '' : undefined,
  };
}

async function run() {
  // 1. THE CORE CASE: a screenshot on the clipboard. Chromium exposes it through
  //    `items` only, which is why reading `.files` alone finds nothing.
  {
    const png = f('image.png', 'image/png');
    const found = imagesFrom(dt({ items: [{ type: 'image/png', file: png }], types: ['Files', 'image/png'] }));
    check('a pasted screenshot is found through items', found.length === 1 && found[0] === png);
  }

  // 2. The same image in BOTH items and files uploads ONCE. Chromium presents a
  //    pasted image in both, so reading both without de-duplication doubles it.
  {
    const png = f('image.png', 'image/png', 4096);
    const twin = f('image.png', 'image/png', 4096);
    const found = imagesFrom(dt({ items: [{ type: 'image/png', file: png }], files: [twin] }));
    check('the same image in items AND files is ingested once', found.length === 1, `got ${found.length}`);
  }

  // 3. Several pasted images all come through, in order.
  {
    const a = f('a.png', 'image/png', 1);
    const b = f('b.jpg', 'image/jpeg', 2);
    const c = f('c.gif', 'image/gif', 3);
    const found = imagesFrom(dt({ items: [{ file: a }, { file: b }, { file: c }] }));
    check('multiple pasted images all ingest, in order', found.length === 3 && found[0] === a && found[2] === c);
  }

  // 4. Non-images are ignored. A pasted PDF is not an image upload.
  {
    const found = imagesFrom(dt({ files: [f('notes.pdf', 'application/pdf'), f('x.png', 'image/png')] }));
    check('a non-image file is ignored', found.length === 1 && found[0].name === 'x.png');
  }

  // 5. A plain text paste finds nothing at all. This is the "never swallow a normal
  //    paste" floor: no images means the handler returns and the browser does its job.
  {
    const clip = dt({ items: [{ kind: 'string', type: 'text/plain' }], types: ['text/plain'], data: { 'text/plain': 'hello' } });
    check('a plain text paste yields no images', imagesFrom(clip).length === 0);
    check('a plain text paste is never swallowed', !shouldSwallowPaste(clip));
  }

  // 6. THE MIXED PASTE. Copying a block out of a web page carries text AND an image.
  //    The text must paste natively, so the event is NOT cancelled, and the image is
  //    still ingested. Cancelling here would destroy what they were actually pasting.
  {
    const clip = dt({
      items: [{ kind: 'string', type: 'text/html' }, { type: 'image/png', file: f('i.png', 'image/png') }],
      types: ['text/plain', 'text/html', 'Files'],
      data: { 'text/plain': 'the words they copied', 'text/html': '<p>the words they copied</p>' },
    });
    check('a mixed text+image paste carries text', carriesText(clip));
    check('a mixed text+image paste is NOT swallowed', !shouldSwallowPaste(clip));
    check('a mixed text+image paste still yields the image', imagesFrom(clip).length === 1);
  }

  // 7. An image-only paste IS swallowed, so the browser does not also drop a filename
  //    or a data: url into the textarea beside the uploaded link.
  {
    const clip = dt({
      items: [{ type: 'image/png', file: f('shot.png', 'image/png') }],
      types: ['Files', 'image/png'],
    });
    check('an image-only paste is swallowed', shouldSwallowPaste(clip));
  }

  // 8. An ADVERTISED-BUT-EMPTY text type does not count as text. Chromium lists
  //    text/html on a bare screenshot paste; trusting the type alone would leave a
  //    stray filename in the composer on every paste.
  {
    const clip = dt({
      items: [{ type: 'image/png', file: f('shot.png', 'image/png') }],
      types: ['Files', 'text/html'],
      data: { 'text/html': '' },
    });
    check('an empty advertised text type is not text', !carriesText(clip));
    check('a screenshot paste with an empty text/html is still swallowed', shouldSwallowPaste(clip));
  }

  // 9. The url lands in the composer beside whatever is already typed, with exactly
  //    one space and no leading space on an empty composer.
  {
    check('append onto text', appendUrl('use this', 'https://x/y.png') === 'use this https://x/y.png');
    check('append onto trailing space', appendUrl('use this  ', 'https://x/y.png') === 'use this https://x/y.png');
    check('append onto empty', appendUrl('', 'https://x/y.png') === 'https://x/y.png');
  }

  // 10. A successful batch: every url reaches the composer, and the pending counter
  //     comes back to zero.
  {
    let pending = 0;
    let peak = 0;
    const urls: string[] = [];
    const res = await ingestImages([f('a.png', 'image/png', 1), f('b.png', 'image/png', 2)], {
      upload: async (file) => `https://cdn/${file.name}`,
      onPending: (d) => {
        pending += d;
        peak = Math.max(peak, pending);
      },
      onUrl: (u) => urls.push(u),
      onError: () => check('no error on a clean batch', false),
    });
    check('every image uploads', res.ok === 2 && res.failed === 0);
    check('every url reaches the composer', urls.join(',') === 'https://cdn/a.png,https://cdn/b.png');
    check('the pending counter rises and settles back to zero', peak === 1 && pending === 0);
  }

  // 11. A FAILED UPLOAD SAYS SO. This is the whole of objective (d): the host returns
  //     null, and the person is told, rather than watching nothing happen.
  {
    let told = '';
    const res = await ingestImages([f('a.png', 'image/png')], {
      upload: async () => null,
      onPending: () => {},
      onUrl: () => check('no url on a failed upload', false),
      onError: (m) => {
        told = m;
      },
    });
    check('a failed upload is counted', res.ok === 0 && res.failed === 1);
    check('a failed upload tells the person', told.length > 0 && /did not upload/i.test(told), told);
  }

  // 12. A host upload that THROWS is a failure, not a crash that takes the chat down.
  {
    let told = '';
    let pending = 0;
    const res = await ingestImages([f('a.png', 'image/png')], {
      upload: async () => {
        throw new Error('network');
      },
      onPending: (d) => {
        pending += d;
      },
      onUrl: () => {},
      onError: (m) => {
        told = m;
      },
    });
    check('a throwing upload is a counted failure, not a crash', res.failed === 1 && told.length > 0);
    check('the pending counter settles even when the upload throws', pending === 0);
  }

  // 13. A partial batch reports honestly: the good ones land, the bad ones are named.
  {
    let told = '';
    const urls: string[] = [];
    const res = await ingestImages(
      [f('a.png', 'image/png', 1), f('b.png', 'image/png', 2), f('c.png', 'image/png', 3)],
      {
        upload: async (file) => (file.name === 'b.png' ? null : `https://cdn/${file.name}`),
        onPending: () => {},
        onUrl: (u) => urls.push(u),
        onError: (m) => {
          told = m;
        },
      },
    );
    check('a partial batch keeps the successes', res.ok === 2 && urls.length === 2);
    check('a partial batch names how many failed', /1 of those 3/.test(told), told);
  }

  // 14. The error line is cleared at the START of the next attempt, so a stale failure
  //     never sits over a working upload.
  {
    let started = 0;
    await ingestImages([f('a.png', 'image/png')], {
      upload: async () => 'https://cdn/a.png',
      onPending: () => {},
      onUrl: () => {},
      onError: () => {},
      onStart: () => {
        started++;
      },
    });
    check('a new batch clears the previous error', started === 1);
  }

  // 15. Nothing to ingest does nothing: no pending flicker, no error, no batch.
  {
    let touched = 0;
    const res = await ingestImages([], {
      upload: async () => 'x',
      onPending: () => {
        touched++;
      },
      onUrl: () => {
        touched++;
      },
      onError: () => {
        touched++;
      },
      onStart: () => {
        touched++;
      },
    });
    check('an empty batch is a no-op', res.ok === 0 && res.failed === 0 && touched === 0);
  }

  // 16. The failure line is person-readable in each shape (no ids, no jargon).
  {
    check('one image failure reads plainly', failureMessage(1, 1) === 'That image did not upload. Try again, or use the attach button.');
    check('a total failure names the count', /None of those 3 images/.test(failureMessage(3, 3)));
    check('no failures means no line', failureMessage(0, 2) === '');
  }

  // 17. A null/undefined payload is handled rather than thrown on (a drag with no
  //     dataTransfer, an engine that hands back nothing).
  {
    check('a null payload yields no images', imagesFrom(null).length === 0 && imagesFrom(undefined).length === 0);
    check('a null payload is never swallowed', !shouldSwallowPaste(null));
  }

  // 18. EXACTLY ONE PASTE INGEST PATH IN THE COMPONENT.
  //
  // This is a source fence rather than a behaviour test, and it is here because the
  // assertions above CANNOT catch what it catches. Measured on the deployed app
  // 2026-09-17: the composer had a React onPaste on the panel AND a window paste
  // listener, both correct, both ingesting, so ONE pasted screenshot made TWO
  // uploads and put TWO urls in the composer. Every pure assertion above passed
  // throughout, because the duplication was two handlers each de-duplicating
  // correctly once. Only a count of the handlers sees it.
  //
  // The window listener is the one that survives, because it is a superset: a React
  // handler on the panel never fires when focus is still on <body>, which is
  // exactly the person who has just opened the drawer and hit paste.
  {
    // The bundled test runs out of test/.tmp, so import.meta.url is the wrong
    // anchor. Walk up from cwd until src/FriendChat.tsx is found, and FAIL rather
    // than silently pass if it never is.
    let srcPath = '';
    for (let dir = process.cwd(), i = 0; i < 5; i++) {
      const candidate = join(dir, 'src/FriendChat.tsx');
      if (existsSync(candidate)) { srcPath = candidate; break; }
      const up = dirname(dir);
      if (up === dir) break;
      dir = up;
    }
    check('the component source is findable (else this fence proves nothing)', srcPath !== '');
    const src = srcPath ? await readFile(srcPath, 'utf8') : '';
    const reactHandlers = src.match(/onPaste=\{/g) ?? [];
    const windowListeners = src.match(/addEventListener\(\s*'paste'/g) ?? [];
    check('the component has NO React onPaste (it would double every paste)', reactHandlers.length === 0, `found ${reactHandlers.length}`);
    check('the component has exactly ONE window paste listener', windowListeners.length === 1, `found ${windowListeners.length}`);
    // CONTROL: the patterns catch what they claim to, so a rename cannot make this
    // fence pass by matching nothing.
    check(
      'CONTROL: the onPaste pattern matches a real handler',
      (`<div onPaste={(e) => {}}>`.match(/onPaste=\{/g) ?? []).length === 1,
    );
    check(
      'CONTROL: the listener pattern matches a real registration',
      (`window.addEventListener('paste', h, true)`.match(/addEventListener\(\s*'paste'/g) ?? []).length === 1,
    );
  }

  console.log(`\nimageIngest: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

await run();
