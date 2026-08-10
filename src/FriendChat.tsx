import * as React from 'react';
import { AnimatePresence, animate, motion, useDragControls, useMotionValue, useReducedMotion } from 'framer-motion';
import { FriendMark } from './FriendMark';
import { renderReply } from './renderReply';
import { startTurnWatchdog, awaitOrAbort } from './turnWatchdog';

export interface FriendAskResult {
  /** Authoritative (server-resolved) Friend connection for this turn. */
  friend_connected: boolean;
  /** The person's Friend name, if resolved. */
  friendName?: string;
  /** The reply text (markdown-ish: paragraphs, bullets, **bold**). */
  reply?: string;
  /**
   * Opaque per-app payload for this reply, rendered by `renderExtra` under the
   * friend bubble. The component never inspects it. Glovebox uses it to carry
   * web/call/map/save action pills; apps that pass no `renderExtra` ignore it.
   */
  extra?: unknown;
}

export interface FriendChatProps {
  /** Room name, e.g. "Locals". Drives the subtitle "here with you in Locals". */
  app: string;
  /** Whether the person has connected their Friend. false shows the connect-to-buy nudge. */
  connected: boolean;
  /**
   * Per-app transport. The component never knows which edge fn / backend it hits.
   * Optional ONLY when `askStream` or `renderBody` supplies the conversation instead.
   */
  ask?: (message: string) => Promise<FriendAskResult>;
  /**
   * Streaming transport, used in place of `ask` when supplied. Call `onDelta` with the
   * reply text SO FAR (cumulative, not a diff) as it arrives, and resolve with the
   * final result. The drawer renders the bubble from the first delta, so a long turn
   * (a Friend that is actually building something, not just answering) shows its work
   * rather than holding a silent spinner for a minute. Apps that pass `ask` are
   * unchanged: same drawer, same UI, one brain.
   */
  askStream?: (message: string, onDelta: (textSoFar: string) => void, signal?: AbortSignal) => Promise<FriendAskResult>;
  /**
   * Take the person straight into this app's Friend SSO. Wire this to the native
   * in-app system SSO sheet (@ecodia/friend-auth connectFriend on Capacitor, web
   * OAuth redirect on the web) so the connect CTA opens the sign-in surface
   * directly, never a detour through a login page.
   */
  onConnect: () => void;
  /** Initial resolved Friend name (updated from ask responses). Default "Friend". */
  friendName?: string;
  examples?: string[];
  placeholder?: string;
  emptyLine?: string;
  connectTitle?: string;
  connectBody?: string;
  /** Per-app accent: sets --fc-accent (user bubble + send + CTA). */
  accent?: string;
  onAccent?: string;
  /**
   * Optional render-prop for the opaque `extra` a reply carries, drawn under the
   * friend bubble (e.g. Glovebox's action pills). Only invoked when `extra` is
   * non-null, so apps that omit it keep the plain-text reply unchanged.
   */
  renderExtra?: (extra: unknown) => React.ReactNode;
  /**
   * Optional replacement for the whole connected conversation surface (the stream +
   * composer). The drawer chrome stays identical (edge tab, drag, scrim, header, and
   * the not-connected nudge), so an app with its OWN chat body still reads and behaves
   * as the one federated Friend drawer. Studio uses this to host its agentic chat
   * (streaming, tools, artifacts) inside the shared drawer instead of the plain
   * ask/reply panel. Rendered in a flex-filling, min-height-0 box; own your scrolling.
   * Apps that omit it keep the built-in stream + composer unchanged.
   */
  renderBody?: () => React.ReactNode;
  /**
   * Optional controls rendered in the header, left of the close button (in place of
   * the default "Friend" link out to friend.ecodia.au). Style them against
   * --fc-on-accent so they read on the accent tile.
   */
  headerActions?: React.ReactNode;
  /**
   * Start a fresh conversation WITHOUT the person having to close and reopen the app.
   * When provided (and no `headerActions` override), a "New chat" button shows in the
   * header: pressing it aborts any in-flight turn, clears the visible transcript, and
   * then calls this so the host can fork a clean engine session. The host keeps its
   * own context (in Studio: the connected site and its data are untouched - only the
   * chat history is shed), so this is a graceful reset, not a restart. Origin: Ryan @
   * SeedTree asked for exactly this, 2026-08-10. Omit it and the header is unchanged.
   */
  onNewChat?: () => void | Promise<void>;
  /**
   * Fires whenever the drawer opens or closes. An app whose body is expensive to
   * boot uses this to mount it on FIRST open rather than on every page load, and to
   * keep it mounted afterwards so the conversation survives a collapse.
   */
  onOpenChange?: (open: boolean) => void;
  /**
   * Open the drawer from OUTSIDE it and hand the Friend a starter message. Studio's
   * site editor uses this: pressing "Ask <Friend>" on an element on the canvas pulls
   * the drawer out with the question already in it. Bump `nonce` to fire again (the
   * same text twice in a row is a legitimate second ask). autosend sends immediately;
   * otherwise the text is placed in the composer for the person to finish.
   */
  seed?: { text: string; autosend?: boolean; nonce: number } | null;
  /** Extra --fc-* palette overrides on the root. */
  style?: React.CSSProperties;
  /**
   * Vertical offset (px) of the collapsed edge tab from the bottom, so it clears
   * this app's bottom tab bar. Default 116.
   */
  tabBottom?: number;
  /**
   * Whether the open drawer takes the whole surface (modal) or docks beside a page
   * the person keeps working in (non-modal). Default true, which is today's
   * behaviour for every app that does not opt out.
   *
   * modal (default): a dimmed, blurred, click-to-close scrim covers the viewport
   * behind the sheet. Correct on a phone, where the sheet is min(390px, 90vw) and
   * so covers nearly the whole screen: there is nothing meaningful to work
   * alongside, and a tap on the strip beside it is the expected way to dismiss.
   *
   * modal={false}: no scrim at all. The page behind stays scrollable, clickable
   * and readable, and the drawer is a dockable side panel. Correct on a wide
   * viewport, where 390px leaves genuine working room. Pass this in a desktop-class
   * app (Studio). Closing is still one press on the edge tab or the header X, and
   * the drawer's transcript no longer chains its scroll into the host page.
   *
   * Origin: Angelica @ Resonaverde, 2026-07-20. Studio was dead underneath the open
   * drawer because the scrim swallowed every wheel and click event. That is right
   * for a dialog and wrong for a side panel.
   */
  modal?: boolean;
  /**
   * Attach an image from the person's own device. When provided, the composer shows
   * an attach button; on pick, the file is handed here to be uploaded (by the host,
   * to the site's own storage), and the returned url is dropped into the composer so
   * the Friend receives a real, durable link it can use in a repo/element/section
   * edit. Return null to signal the upload failed. Omit the prop on a surface with no
   * asset store, and the button is hidden.
   */
  onAttachImage?: (file: File) => Promise<string | null>;
  /**
   * How long (ms) a turn may show no sign of life (no streamed token, no resolve, no
   * reject) before it is treated as a stalled engine and torn down: the turn settles,
   * the person sees a quiet "went quiet, try again", and anything they queued behind it
   * is answered rather than frozen. The Friend engine serialises turns per person, so a
   * saturated engine can leave a socket silent forever; without this the whole chat
   * freezes. A healthy long turn streams continuously and never trips it. Default 60000.
   * Pass 0 to disable the guard.
   */
  turnStallMs?: number;
}

type Msg = {
  role: 'you' | 'friend';
  text: string;
  extra?: unknown;
  /**
   * A person turn sent while the Friend was still replying: it is in the transcript
   * already, held in the queue, and answered the moment the current turn settles.
   * Rendered with a quiet "queued" hint so the hold is visible rather than silent.
   */
  queued?: boolean;
};

/**
 * The unified Ecodia Friend side-drawer. Not a floating blob: the Friend lives at
 * the right edge as a slim black tab (cream bar + white dot) and is physically
 * pulled out into a right-anchored sheet. One identical interaction across every
 * app; each app passes only its own context via `ask`, `friendName`, room copy and
 * `accent`. Connected gives the chat, not-connected gives the connect-to-buy nudge
 * whose CTA goes straight to the native Friend SSO. Mount once at app scope; the
 * app owns route-based hiding (do not render it on marketing/auth surfaces).
 */
export function FriendChat({
  app,
  connected,
  ask,
  askStream,
  onConnect,
  friendName: initialName = 'Friend',
  examples = [],
  placeholder,
  emptyLine,
  connectTitle,
  connectBody,
  accent,
  onAccent,
  renderExtra,
  renderBody,
  headerActions,
  onNewChat,
  onOpenChange,
  seed,
  style,
  tabBottom = 116,
  modal = true,
  onAttachImage,
  turnStallMs = 60000,
}: FriendChatProps) {
  const reduce = useReducedMotion();
  const dragControls = useDragControls();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  // Device-image attach: a hidden file input the attach button opens, and a pending
  // flag while the host uploads. The returned url is dropped into the composer.
  const [attaching, setAttaching] = React.useState(false);
  const fileRef = React.useRef<HTMLInputElement | null>(null);
  // Lets the person STOP a turn mid-flight: while busy the send button becomes a
  // stop button, and clicking it aborts the in-flight askStream (its fetch reader
  // rejects, caught below). One controller per turn.
  const abortRef = React.useRef<AbortController | null>(null);
  const [stopping, setStopping] = React.useState(false);
  function stop() {
    setStopping(true);
    abortRef.current?.abort();
  }
  // Guards a double-press of "New chat" while the host forks the engine session.
  const [resetting, setResetting] = React.useState(false);
  // Messages sent while a turn was still streaming, fired in order as each turn
  // settles. A ref, not state: the drain runs inside the finishing turn's own
  // `finally`, where a `busy` read off state would still be the stale `true` from
  // that turn and would re-queue the item it is trying to fire.
  const queueRef = React.useRef<{ text: string }[]>([]);
  const busyRef = React.useRef(false);
  const [name, setName] = React.useState(initialName);
  const [degraded, setDegraded] = React.useState(false);
  const streamRef = React.useRef<HTMLDivElement>(null);

  // Fresh conversation without a full restart. Abort any in-flight turn, drop the
  // queue, clear the visible transcript, then let the host fork a clean engine
  // session (keeping ITS context - e.g. Studio's connected site). Best-effort: even
  // if the host fork fails, the person still gets a cleared view to start over in.
  async function handleNewChat() {
    if (resetting) return;
    setResetting(true);
    try {
      abortRef.current?.abort();
      queueRef.current = [];
      busyRef.current = false;
      setBusy(false);
      setStopping(false);
      setInput('');
      setMessages([]);
      await onNewChat?.();
    } catch {
      /* a failed fork still leaves a cleared view the person can start over in */
    } finally {
      setResetting(false);
    }
  }

  React.useEffect(() => setName(initialName), [initialName]);
  React.useEffect(() => {
    streamRef.current?.scrollTo({ top: streamRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, busy]);

  // ── Edge-drawer geometry + drag ─────────────────────────────────────────────
  // drawerX is the live translateX of the sheet: 0 = fully open, sheetW = collapsed
  // to just the peeking edge tab.
  const drawerX = useMotionValue(360);
  const [sheetW, setSheetW] = React.useState(360);
  React.useEffect(() => {
    const measure = () => setSheetW(Math.min(390, Math.round(window.innerWidth * 0.9)));
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, []);
  React.useEffect(() => {
    if (!open) drawerX.set(sheetW);
  }, [sheetW, open, drawerX]);

  const openSpring = reduce
    ? { duration: 0.2 }
    : ({ type: 'spring', stiffness: 360, damping: 24, mass: 0.9 } as const);
  const shutSpring = reduce
    ? { duration: 0.18 }
    : ({ type: 'spring', stiffness: 440, damping: 34, mass: 0.9 } as const);
  function openDrawer() {
    setOpen(true);
    onOpenChange?.(true);
    animate(drawerX, 0, openSpring);
  }
  function closeDrawer() {
    setOpen(false);
    onOpenChange?.(false);
    animate(drawerX, sheetW, shutSpring);
  }
  function toggleDrawer() {
    drawerX.get() > sheetW / 2 ? openDrawer() : closeDrawer();
  }

  const showConnect = !connected || degraded;

  const rootStyle: React.CSSProperties = {
    ...(accent ? ({ ['--fc-accent']: accent } as React.CSSProperties) : null),
    ...(onAccent ? ({ ['--fc-on-accent']: onAccent } as React.CSSProperties) : null),
    ...style,
  };

  const scrimMotion = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.18 },
  };
  const markTone = { barColor: 'var(--fc-on-accent)', dotColor: 'var(--fc-on-accent)' };

  // Strip the "queued" hint off any bubble still wearing it. Used when the queue is
  // dropped (a disconnected transport) so no bubble is left on screen forever promising
  // "answered next" for a message that will never be sent.
  function unfreezeQueued() {
    setMessages((m) => (m.some((x) => x.queued) ? m.map((x) => (x.queued ? { ...x, queued: false } : x)) : m));
  }

  async function send(text: string, fromQueue = false) {
    const msg = text.trim();
    if (!msg || (!ask && !askStream)) return;
    if (busyRef.current && !fromQueue) {
      // QUEUE, never drop. A message typed while the Friend is still replying lands
      // in the transcript straight away with a quiet queued hint and is held here;
      // the `finally` below fires it the moment the current turn settles. Before
      // this, a mid-turn send was silently swallowed and the person had to notice
      // their own message had never happened.
      queueRef.current = [...queueRef.current, { text: msg }];
      setMessages((m) => [...m, { role: 'you', text: msg, queued: true }]);
      setInput('');
      return;
    }
    setInput('');
    // A queued message is already on screen: un-mark the first held bubble rather
    // than appending a duplicate of it.
    setMessages((m) => {
      if (!fromQueue) return [...m, { role: 'you', text: msg }];
      const i = m.findIndex((x) => x.queued);
      if (i < 0) return [...m, { role: 'you', text: msg }];
      return [...m.slice(0, i), { ...m[i], queued: false }, ...m.slice(i + 1)];
    });
    busyRef.current = true;
    setBusy(true);
    setStopping(false);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    // Guard this turn against an engine that goes silent and never settles. On stall
    // the controller is aborted, which rejects the await below, runs the finally, and
    // drains the queue rather than leaving the whole chat frozen. `stalled` lets the
    // catch tell an engine stall apart from the person pressing Stop.
    let stalled = false;
    const dog = startTurnWatchdog(ctrl, turnStallMs, () => {
      stalled = true;
    });
    try {
      let res: FriendAskResult;
      if (askStream) {
        // A streaming turn: the reply bubble appears at the first token and grows,
        // so a long turn (a Friend actually building something) shows its work
        // instead of holding a silent spinner. The bubble is appended ONCE, on the
        // first delta, then replaced in place. The signal is handed to the transport
        // so a stall or a Stop truly tears down its fetch, and each delta bumps the
        // watchdog so a live turn is never mistaken for a hung one.
        let started = false;
        res = await awaitOrAbort(
          askStream(msg, (text) => {
            if (ctrl.signal.aborted) return;
            dog.bump();
            setMessages((m) => {
              if (!started) {
                started = true;
                return [...m, { role: 'friend', text }];
              }
              const out = m.slice();
              const last = out[out.length - 1];
              if (last && last.role === 'friend') out[out.length - 1] = { ...last, text };
              return out;
            });
          }, ctrl.signal),
          ctrl.signal,
        );
        dog.clear();
        if (!res.friend_connected) {
          // The Friend is gone for this person: drop anything they had queued rather
          // than firing it into a transport that just told us it cannot serve them,
          // and un-freeze any bubbles still marked queued so none is left on screen
          // promising an answer that will never come.
          queueRef.current = [];
          unfreezeQueued();
          setDegraded(true);
          closeDrawer();
          return;
        }
        if (res.friendName) setName(res.friendName);
        // Settle on the final text + any per-reply extra. A turn that streamed nothing
        // (a tool-only turn) still lands its reply here rather than showing nothing.
        setMessages((m) => {
          const out = m.slice();
          const last = out[out.length - 1];
          const text = res.reply ?? (started && last?.role === 'friend' ? last.text : '...');
          if (started && last && last.role === 'friend') out[out.length - 1] = { role: 'friend', text, extra: res.extra };
          else out.push({ role: 'friend', text, extra: res.extra });
          return out;
        });
        return;
      }

      // A bare `ask` cannot be cancelled, so race it against the abort: on stall or
      // Stop the UI stops waiting and the turn settles even while the request runs on.
      res = await awaitOrAbort(ask!(msg), ctrl.signal);
      dog.clear();
      if (!res.friend_connected) {
        queueRef.current = [];
        unfreezeQueued();
        setDegraded(true);
        closeDrawer();
        return;
      }
      if (res.friendName) setName(res.friendName);
      setMessages((m) => [...m, { role: 'friend', text: res.reply ?? '...', extra: res.extra }]);
    } catch (err) {
      const aborted = ctrl.signal.aborted || (err instanceof DOMException && err.name === 'AbortError');
      if (stalled) {
        // The engine went silent and the watchdog tore the turn down. Replace an empty
        // partial bubble with a plain recovery line; keep any real text that did stream.
        setMessages((m) => {
          const last = m[m.length - 1];
          const line = `${name} went quiet just then. Try that again in a moment.`;
          if (last && last.role === 'friend' && !last.text.trim()) {
            return [...m.slice(0, -1), { role: 'friend', text: line }];
          }
          if (last && last.role === 'friend') return m;
          return [...m, { role: 'friend', text: line }];
        });
      } else if (aborted) {
        // The person stopped it. Keep whatever streamed so far; add a quiet marker
        // only if nothing had started.
        setMessages((m) => {
          const last = m[m.length - 1];
          if (last && last.role === 'friend') return m;
          return [...m, { role: 'friend', text: 'Stopped.' }];
        });
      } else {
        setMessages((m) => [...m, { role: 'friend', text: `I could not reach ${name} just then. Try again in a moment.` }]);
      }
    } finally {
      dog.clear();
      busyRef.current = false;
      setBusy(false);
      setStopping(false);
      abortRef.current = null;
      // Fire the next held message. Sequential by construction: the recursive send
      // sets busy again, so anything behind it keeps waiting its turn. Reached on
      // every settle path, a stopped turn included, so pressing stop still answers
      // what the person queued while the abandoned turn ran.
      const next = queueRef.current[0];
      if (next) {
        queueRef.current = queueRef.current.slice(1);
        void send(next.text, true);
      }
    }
  }

  // An outside surface (Studio's canvas: "Ask <Friend> about this element") pulling the
  // drawer open with a starter message. Keyed on the nonce so the same text can be sent
  // twice, and inert when the person has no Friend (they get the connect nudge instead).
  const seedNonce = seed?.nonce ?? 0;
  React.useEffect(() => {
    if (!seedNonce) return;
    openDrawer();
    if (!connected) return;
    const text = seed?.text ?? '';
    if (seed?.autosend && text.trim()) void send(text);
    else if (text) setInput(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seedNonce]);

  const headName = showConnect ? 'Friend' : name;
  const headSub = showConnect ? `in ${app}` : `here with you in ${app}`;

  return (
    <div className={`fc-root${modal ? '' : ' fc-nonmodal'}`} style={rootStyle}>
      {/* The scrim exists ONLY in modal mode. Non-modal does not render a
          transparent one: a 40% black blur over the page you are working in is
          unreadable even when it is click-through, so the fix is absence, not
          pointer-events: none. Closing stays reachable via the edge tab and the
          header X, both of which are always mounted. */}
      <AnimatePresence>
        {modal && open && (
          <motion.div key="fc-scrim" className="fc-scrim" onClick={closeDrawer} {...scrimMotion} />
        )}
      </AnimatePresence>

      <motion.div
        className="fc-drawer"
        style={{ x: drawerX }}
        drag="x"
        // Drag starts ONLY from the edge tab (dragControls), never from a press inside
        // the panel: a person must be able to select and copy the Friend's replies, and
        // a whole-panel drag listener eats the selection gesture (Tate 2026-07-16).
        dragListener={false}
        dragControls={dragControls}
        dragDirectionLock
        dragConstraints={{ left: 0, right: sheetW }}
        // Modest left rubber-band (past fully-open) so an over-pull stays inside the
        // right-edge bleed and never detaches; freer on the right (closing swipe).
        dragElastic={{ top: 0, bottom: 0, left: 0.08, right: 0.16 }}
        onDragEnd={(_, info) => {
          const goingClosed =
            info.velocity.x > 520 || (info.velocity.x > -520 && drawerX.get() > sheetW * 0.4);
          if (goingClosed) closeDrawer();
          else openDrawer();
        }}
      >
        {/* Always-present edge tab: a peeking black bookmark when collapsed, the grab
            handle on the sheet's left edge when open. Tap toggles; drag pulls. */}
        <button
          className="fc-tab"
          style={{ bottom: tabBottom }}
          onClick={toggleDrawer}
          onPointerDown={(e) => dragControls.start(e)}
          aria-label={open ? 'Close your Friend' : 'Open your Friend'}
        >
          <FriendMark size={24} {...markTone} />
        </button>

        {/* aria-modal only when it is true: a non-modal drawer leaves the rest of
            the page available to assistive tech, which is exactly the point. */}
        <div
          className="fc-drawer-inner"
          role="dialog"
          aria-modal={modal ? true : undefined}
          aria-label={headName}
        >
          <header className="fc-head">
            <span className="fc-head-mark">
              <FriendMark size={20} {...markTone} />
            </span>
            <div className="fc-head-txt">
              <span className="fc-head-name">{headName}</span>
              <span className="fc-head-sub">{headSub}</span>
            </div>
            {!showConnect &&
              (headerActions ??
                (onNewChat ? (
                  <button
                    className="fc-head-friend"
                    onClick={handleNewChat}
                    disabled={resetting}
                    title="Start a fresh chat. Your work is kept - only the conversation is cleared."
                  >
                    {resetting ? 'Starting...' : 'New chat'}
                  </button>
                ) : (
                  <button
                    className="fc-head-friend"
                    onClick={() => window.open('https://friend.ecodia.au', '_blank')}
                  >
                    Friend
                  </button>
                )))}
            <button className="fc-head-x" onClick={closeDrawer} aria-label="Close">
              ×
            </button>
          </header>

          {showConnect ? (
            <div className="fc-connect-body">
              <span className="fc-connect-mark">
                <FriendMark size={26} {...markTone} />
              </span>
              <h3 className="fc-connect-h">{connectTitle ?? `Unlock your ${app} Friend`}</h3>
              <p className="fc-connect-p">
                {connectBody ??
                  `Connect your Ecodia Friend and it shows up here inside ${app}: it knows you, and helps you get more out of every visit. One Friend, across everything Ecodia.`}
              </p>
              <button className="fc-connect-cta" onClick={onConnect}>
                <FriendMark size={16} {...markTone} /> Connect your Friend
              </button>
            </div>
          ) : renderBody ? (
            // The app brought its own conversation surface (Studio's agentic chat).
            // The drawer chrome above and around it is unchanged, so it is still the
            // one federated Friend drawer.
            <div className="fc-body">{renderBody()}</div>
          ) : (
            <>
              <div className="fc-stream" ref={streamRef}>
                {messages.length === 0 && !busy && (
                  <div className="fc-empty">
                    <p className="fc-empty-line">{emptyLine ?? `I am ${name}, here with you in ${app}. Ask me anything.`}</p>
                    {examples.length > 0 && (
                      <div className="fc-examples">
                        {examples.map((ex) => (
                          <button key={ex} className="fc-example" onClick={() => send(ex)}>
                            {ex}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {messages.map((m, i) =>
                  m.role === 'you' ? (
                    <div key={i} className="fc-turn">
                      <div className="fc-you">{m.text}</div>
                      {m.queued ? (
                        <div className="fc-queued" aria-live="polite">
                          queued: answered next
                        </div>
                      ) : null}
                    </div>
                  ) : (
                    <div key={i} className="fc-friend">
                      {renderReply(m.text)}
                      {renderExtra && m.extra != null ? renderExtra(m.extra) : null}
                    </div>
                  ),
                )}
                {busy && (
                  <div className="fc-friend fc-thinking" aria-live="polite">
                    <span className="fc-dot" />
                    <span className="fc-dot" />
                    <span className="fc-dot" />
                  </div>
                )}
              </div>
              <form
                className="fc-compose"
                onSubmit={(e) => {
                  e.preventDefault();
                  void send(input);
                }}
              >
                {/* Attach an image from the person's device: the host uploads it to the
                    site's own storage and returns a durable url, which drops into the
                    composer for the Friend to use. Hidden until a host wires onAttachImage. */}
                {onAttachImage ? (
                  <>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/*"
                      className="fc-attach-input"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        e.currentTarget.value = ''; // let the same file be picked again
                        if (!file) return;
                        setAttaching(true);
                        try {
                          const url = await onAttachImage(file);
                          if (url) setInput((prev) => (prev ? prev.trimEnd() + ' ' : '') + url);
                        } finally {
                          setAttaching(false);
                        }
                      }}
                    />
                    <button
                      type="button"
                      className="fc-attach"
                      onClick={() => fileRef.current?.click()}
                      disabled={attaching}
                      aria-label="Attach an image from your device"
                      title="Attach an image from your device"
                    >
                      {attaching ? <span className="fc-attach-dot" aria-hidden /> : (
                        <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                          <rect x="3" y="3" width="18" height="18" rx="2" />
                          <circle cx="8.5" cy="8.5" r="1.5" />
                          <path d="M21 15l-5-5L5 21" />
                        </svg>
                      )}
                    </button>
                  </>
                ) : null}
                {/* Never disabled, even mid-turn: the composer is how a message gets
                    queued, and a locked input is what made a mid-turn thought vanish. */}
                <input
                  className="fc-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder ?? `Ask ${name}...`}
                  autoComplete="off"
                />
                {/* With a reply in flight and nothing typed, the send button itself is
                    the stop square: one control, where the thumb is already going. The
                    moment they start typing, send comes back so the message can be
                    queued and stop steps aside into its own button beside it. */}
                {busy && input.trim() ? (
                  <button
                    className="fc-send fc-stop fc-stop-aside"
                    type="button"
                    onClick={stop}
                    disabled={stopping}
                    aria-label="Stop"
                    title="Stop"
                  >
                    <span className="fc-stop-sq" aria-hidden />
                  </button>
                ) : null}
                {busy && !input.trim() ? (
                  <button className="fc-send fc-stop" type="button" onClick={stop} disabled={stopping} aria-label="Stop" title="Stop">
                    <span className="fc-stop-sq" aria-hidden />
                  </button>
                ) : (
                  <button
                    className="fc-send"
                    type="submit"
                    disabled={!input.trim()}
                    aria-label="Send"
                    title={busy ? `${name} is still replying. Send now and it is answered next.` : 'Send'}
                  >
                    →
                  </button>
                )}
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
