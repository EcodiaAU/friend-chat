// The queued-bubble freeze fix, proven at its root. The freeze was: a turn whose
// transport goes silent (a saturated per-person engine session) never settles, so
// `busy` stays pinned and every queued message hangs on "answered next" forever. The
// watchdog makes an un-settling turn impossible: it aborts a silent turn, which rejects
// the await, runs the finally, and drains the queue. These are pure (setTimeout +
// AbortController), so the fix is tested with no DOM. Run: node test/run.mjs
import { startTurnWatchdog, awaitOrAbort } from '../src/turnWatchdog';

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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function run() {
  // 1. A silent turn is torn down: onStall fires and the controller aborts. THIS is
  //    the freeze fix: without it the awaiting turn would hang and pin `busy` forever.
  {
    const ctrl = new AbortController();
    let stalled = false;
    startTurnWatchdog(ctrl, 20, () => {
      stalled = true;
    });
    await sleep(45);
    check('silent turn: onStall fired', stalled);
    check('silent turn: controller aborted', ctrl.signal.aborted);
  }

  // 2. A turn that keeps showing life (bump) never trips, however long it runs. A
  //    Friend genuinely building something streams the whole way and must not be killed.
  {
    const ctrl = new AbortController();
    let stalled = false;
    const dog = startTurnWatchdog(ctrl, 30, () => {
      stalled = true;
    });
    for (let i = 0; i < 5; i++) {
      await sleep(15);
      dog.bump();
    }
    check('live turn: never stalled while bumping', !stalled && !ctrl.signal.aborted);
    dog.clear();
  }

  // 3. clear() blocks any later fire: a settled turn is never aborted after the fact.
  {
    const ctrl = new AbortController();
    let stalled = false;
    const dog = startTurnWatchdog(ctrl, 20, () => {
      stalled = true;
    });
    dog.clear();
    await sleep(40);
    check('cleared turn: no stall after clear', !stalled && !ctrl.signal.aborted);
  }

  // 4. stallMs <= 0 disables the guard entirely (an app can opt out).
  {
    const ctrl = new AbortController();
    let stalled = false;
    startTurnWatchdog(ctrl, 0, () => {
      stalled = true;
    });
    await sleep(30);
    check('disabled guard: never fires', !stalled && !ctrl.signal.aborted);
  }

  // 5. awaitOrAbort rejects the instant the signal aborts, even if the promise never
  //    resolves. This is what lets a stalled or stopped turn settle at the UI layer.
  {
    const ctrl = new AbortController();
    const never = new Promise<string>(() => {}); // never settles
    const p = awaitOrAbort(never, ctrl.signal);
    setTimeout(() => ctrl.abort(), 15);
    let rejected = false,
      name = '';
    try {
      await p;
    } catch (e) {
      rejected = true;
      name = (e as Error)?.name ?? '';
    }
    check('awaitOrAbort: rejects on abort of a never-settling promise', rejected);
    check('awaitOrAbort: rejection is an AbortError', name === 'AbortError', name);
  }

  // 6. awaitOrAbort resolves normally when the promise wins the race.
  {
    const ctrl = new AbortController();
    const ok = awaitOrAbort(Promise.resolve('done'), ctrl.signal);
    let val = '';
    try {
      val = await ok;
    } catch {
      /* not expected */
    }
    check('awaitOrAbort: resolves with the value when not aborted', val === 'done', val);
  }

  // 7. awaitOrAbort surfaces the promise's own rejection (a real transport error is not
  //    masked as an abort).
  {
    const ctrl = new AbortController();
    let msg = '';
    try {
      await awaitOrAbort(Promise.reject(new Error('boom')), ctrl.signal);
    } catch (e) {
      msg = (e as Error).message;
    }
    check('awaitOrAbort: passes through the underlying rejection', msg === 'boom', msg);
  }

  // 8. An already-aborted signal rejects immediately, without waiting on the promise.
  {
    const ctrl = new AbortController();
    ctrl.abort();
    let rejected = false;
    try {
      await awaitOrAbort(new Promise<string>(() => {}), ctrl.signal);
    } catch {
      rejected = true;
    }
    check('awaitOrAbort: pre-aborted signal rejects at once', rejected);
  }

  console.log(`\nturnWatchdog: ${pass} passed, ${fail} failed`);
  if (fail > 0) process.exit(1);
}

await run();
