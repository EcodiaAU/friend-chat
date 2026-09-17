/**
 * Getting an image OUT of a person's head and INTO the chat.
 *
 * The Friend routinely invites someone to "attach or paste" an image. Until
 * 2026-09-17 paste did not exist in this package at all, and the attach button
 * rendered only where a host had wired `onAttachImage`, so on most surfaces the
 * invitation could not be honoured and the person's images simply never arrived.
 * A real client hit exactly that, tried both, got nothing, and told the founder
 * over WhatsApp. This module is the ingest side of the fix.
 *
 * Everything here is pure and DOM-free on purpose: the package's test harness
 * (test/run.mjs) runs on plain node with no jsdom, so the rules that actually
 * decide behaviour (which items count as images, when a paste may be swallowed,
 * what happens when an upload fails) are asserted directly rather than through a
 * rendered component. The component keeps only the wiring.
 */

/** The shape of `clipboardData` / `dataTransfer` this module reads. Both browser
 *  objects satisfy it; a test supplies a plain object. */
export interface DataTransferLike {
  /** `DataTransferItemList` in a browser. `getAsFile()` is the only way to reach a
   *  pasted screenshot: it never appears in `.files` in some engines. */
  items?: ArrayLike<{ kind?: string; type?: string; getAsFile?: () => File | null }> | null;
  /** `FileList` in a browser. The only place a DRAGGED file appears in some engines. */
  files?: ArrayLike<File> | null;
  /** The MIME types the payload carries. Used to tell an image-only paste from a
   *  rich paste that also carries text. */
  types?: readonly string[] | null;
  /** Present on a real clipboard event. Used to detect "text came too". */
  getData?: (type: string) => string;
}

/** A file-ish the module can size up without a DOM File constructor. */
type FileLike = { type?: string; name?: string; size?: number };

function isImage(f: FileLike | null | undefined): boolean {
  return !!f && typeof f.type === 'string' && f.type.startsWith('image/');
}

/** A stable identity for de-duplication. A pasted image appears in BOTH `items` and
 *  `files` in Chromium, so reading both without this uploads the same bytes twice. */
function fingerprint(f: FileLike): string {
  return `${f.name ?? ''} ${f.type ?? ''} ${f.size ?? -1}`;
}

/**
 * Every image in the payload, de-duplicated, in the order the payload presents them.
 * Reads `items` first (the only source for a pasted screenshot) then `files` (the
 * only source for some dragged files), which is why the de-duplication matters.
 */
export function imagesFrom(dt: DataTransferLike | null | undefined): File[] {
  if (!dt) return [];
  const out: File[] = [];
  const seen = new Set<string>();
  const take = (f: File | null | undefined) => {
    if (!isImage(f as FileLike | null)) return;
    const key = fingerprint(f as unknown as FileLike);
    // Two genuinely distinct pastes never collide on name + type + size, and the
    // duplicate this guards against is byte-identical anyway.
    if (seen.has(key)) return;
    seen.add(key);
    out.push(f as File);
  };
  const items = dt.items;
  if (items) {
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      if (!it) continue;
      if (it.kind && it.kind !== 'file') continue;
      if (typeof it.getAsFile !== 'function') continue;
      take(it.getAsFile());
    }
  }
  const files = dt.files;
  if (files) {
    for (let i = 0; i < files.length; i++) take(files[i]);
  }
  return out;
}

/**
 * Whether the payload also carries text the person expects to land in the composer.
 *
 * THIS IS THE RULE THAT KEEPS A NORMAL PASTE NORMAL. Copying a block out of a web
 * page puts text/plain AND text/html on the clipboard, and some sources add an
 * image alongside. Swallowing that paste to grab the image would throw away the
 * text the person was actually pasting, which is a worse bug than the one this
 * module exists to fix.
 */
export function carriesText(dt: DataTransferLike | null | undefined): boolean {
  if (!dt) return false;
  const types = dt.types;
  const named = types ? Array.from(types) : [];
  const hasTextType = named.some((t) => t === 'text/plain' || t === 'text/html' || t === 'text/uri-list');
  if (!hasTextType) return false;
  // A type can be advertised and empty (Chromium lists text/html for a plain
  // screenshot paste). Ask for the bytes when we can; an unanswerable getData
  // falls back to trusting the advertised type, which errs toward NOT swallowing.
  if (typeof dt.getData === 'function') {
    for (const t of ['text/plain', 'text/uri-list', 'text/html']) {
      if (!named.includes(t)) continue;
      let v = '';
      try {
        v = dt.getData(t) || '';
      } catch {
        return true;
      }
      if (v.trim()) return true;
    }
    return false;
  }
  return true;
}

/**
 * Whether the host may cancel the browser's own handling of this paste. True only
 * for an image-only payload: there is nothing else in it to lose, and cancelling
 * stops the browser dropping a filename or a data: url into the textarea.
 */
export function shouldSwallowPaste(dt: DataTransferLike | null | undefined): boolean {
  return imagesFrom(dt).length > 0 && !carriesText(dt);
}

/** Append an uploaded url to whatever is already typed, space-separated, with no
 *  double space and no leading space on an empty composer. */
export function appendUrl(prev: string, url: string): string {
  const head = (prev ?? '').trimEnd();
  return head ? `${head} ${url}` : url;
}

export interface IngestResult {
  /** How many images uploaded and produced a url. */
  ok: number;
  /** How many were handed to the host and came back with nothing (or threw). */
  failed: number;
}

export interface IngestDeps {
  /** The host's upload. Returns a durable url, or null when the upload failed. */
  upload: (file: File) => Promise<string | null>;
  /** Called with +1 when a batch starts and -1 when it settles. A COUNTER, not a
   *  flag: a second paste landing mid-upload must not unstick the first batch's
   *  pending state when it finishes. */
  onPending: (delta: number) => void;
  /** Called once per successful upload with the url to drop into the composer. */
  onUrl: (url: string) => void;
  /** Called once per batch that had any failure, with a person-readable line. Silence
   *  on failure is how this bug reached the founder; a failed upload must SAY so. */
  onError: (message: string) => void;
  /** Called when a batch begins, to clear any error line from a previous attempt. */
  onStart?: () => void;
}

/** The person-readable failure line. One image or several, it names what to do next. */
export function failureMessage(failed: number, total: number): string {
  if (failed <= 0) return '';
  if (total === 1) return 'That image did not upload. Try again, or use the attach button.';
  if (failed === total) return `None of those ${total} images uploaded. Try again, or use the attach button.`;
  return `${failed} of those ${total} images did not upload. Try again, or use the attach button.`;
}

/**
 * Upload each image through the host and drop every returned url into the composer.
 * Sequential on purpose: a person pasting four photos on a phone connection gets a
 * predictable order in the composer, and the host's asset route is not a bulk API.
 * Never throws: a host upload that rejects is counted as a failure and reported.
 */
export async function ingestImages(files: readonly File[], deps: IngestDeps): Promise<IngestResult> {
  if (!files.length) return { ok: 0, failed: 0 };
  deps.onStart?.();
  deps.onPending(1);
  let ok = 0;
  let failed = 0;
  try {
    for (const file of files) {
      let url: string | null = null;
      try {
        url = await deps.upload(file);
      } catch {
        url = null;
      }
      if (url) {
        ok++;
        deps.onUrl(url);
      } else {
        failed++;
      }
    }
  } finally {
    deps.onPending(-1);
  }
  if (failed > 0) deps.onError(failureMessage(failed, files.length));
  return { ok, failed };
}
