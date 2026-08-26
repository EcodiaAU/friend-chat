// The turn lifecycle guard. One job: a turn can never hang forever.
//
// The Friend engine serialises turns per person (one live session each). When it
// saturates under concurrent load, a streaming turn can stall with no further token,
// no resolve, and no reject: the socket is simply quiet. Without a guard the awaiting
// `send()` never reaches its `finally`, `busy` stays pinned true, and every message
// the person queues after it freezes on "queued: answered next" forever. That is the
// queued-bubble freeze. The fix lives on the client because the client must never
// trust the engine to always settle.
//
// Two pure primitives, both runnable on bare node (setTimeout + AbortController only),
// so the freeze fix is unit-tested without a DOM.

/** Handle over a running turn's stall timer. */
export interface TurnWatchdog {
  /** Call on ANY sign of life, not only a streamed word. Re-arms the stall timer. */
  bump(): void;
  /** The turn settled; stop the timer. Idempotent, and blocks any pending fire. */
  clear(): void;
}

/**
 * Arm a stall watchdog for one turn. If the turn shows no sign of life for `stallMs`
 * (no `bump()` and no `clear()`), `onStall` fires and the controller is aborted, which
 * rejects the awaiting transport, runs the turn's `finally`, releases `busy`, and
 * drains the held queue. `stallMs <= 0` disables the guard (returns inert no-ops).
 *
 * WHAT COUNTS AS LIFE. This used to say a healthy long turn streams tokens the whole
 * way, so only a dead turn goes quiet. That is false, and it cost the Friend web chat
 * real answers before it was caught (2026-08-26): a model emits a tool frame when a
 * call starts and another when it lands, so a search, a page read, or a delegated
 * helper produces NO text for its entire duration. One measured Friend turn ran 87.3
 * seconds without a single frame and was still working. So `bump()` must be called on
 * every frame a transport sees, text or not, and `stallMs` must exceed the longest
 * thing the Friend legitimately does in silence. Doctrine:
 * backend/patterns/silence-is-not-death-streaming-turn-watchdogs-2026-08-26.md
 */
export function startTurnWatchdog(
  ctrl: AbortController,
  stallMs: number,
  onStall: () => void,
): TurnWatchdog {
  if (!(stallMs > 0)) return { bump() {}, clear() {} };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let done = false;
  const arm = () => {
    if (done) return;
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      if (done) return;
      done = true;
      timer = null;
      onStall();
      ctrl.abort();
    }, stallMs);
  };
  arm();
  return {
    bump() {
      arm();
    },
    clear() {
      done = true;
      if (timer) clearTimeout(timer);
      timer = null;
    },
  };
}

/**
 * Await `p`, but reject the moment `signal` aborts, whichever happens first. The
 * transport keeps running in the background (a bare `ask` promise cannot be cancelled),
 * but the UI stops waiting on it: the turn settles, `busy` clears, and the queue moves.
 * This is what turns a hung or stopped turn into a settled one at the UI layer even
 * when the underlying request is uncancellable.
 */
export function awaitOrAbort<T>(p: Promise<T>, signal: AbortSignal): Promise<T> {
  if (signal.aborted) return Promise.reject(new DOMException('Aborted', 'AbortError'));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    p.then(
      (v) => {
        signal.removeEventListener('abort', onAbort);
        resolve(v);
      },
      (e) => {
        signal.removeEventListener('abort', onAbort);
        reject(e);
      },
    );
  });
}
