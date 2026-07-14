import * as React from 'react';
import { AnimatePresence, animate, motion, useMotionValue, useReducedMotion } from 'framer-motion';
import { FriendMark } from './FriendMark';
import { renderReply } from './renderReply';

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
  askStream?: (message: string, onDelta: (textSoFar: string) => void) => Promise<FriendAskResult>;
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
}

type Msg = { role: 'you' | 'friend'; text: string; extra?: unknown };

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
  onOpenChange,
  seed,
  style,
  tabBottom = 116,
}: FriendChatProps) {
  const reduce = useReducedMotion();
  const [open, setOpen] = React.useState(false);
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [input, setInput] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [name, setName] = React.useState(initialName);
  const [degraded, setDegraded] = React.useState(false);
  const streamRef = React.useRef<HTMLDivElement>(null);

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

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy || (!ask && !askStream)) return;
    setInput('');
    setMessages((m) => [...m, { role: 'you', text: msg }]);
    setBusy(true);
    try {
      let res: FriendAskResult;
      if (askStream) {
        // A streaming turn: the reply bubble appears at the first token and grows,
        // so a long turn (a Friend actually building something) shows its work
        // instead of holding a silent spinner. The bubble is appended ONCE, on the
        // first delta, then replaced in place.
        let started = false;
        res = await askStream(msg, (text) => {
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
        });
        if (!res.friend_connected) {
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

      res = await ask!(msg);
      if (!res.friend_connected) {
        setDegraded(true);
        closeDrawer();
        return;
      }
      if (res.friendName) setName(res.friendName);
      setMessages((m) => [...m, { role: 'friend', text: res.reply ?? '...', extra: res.extra }]);
    } catch {
      setMessages((m) => [...m, { role: 'friend', text: `I could not reach ${name} just then. Try again in a moment.` }]);
    } finally {
      setBusy(false);
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
    <div className="fc-root" style={rootStyle}>
      <AnimatePresence>
        {open && <motion.div key="fc-scrim" className="fc-scrim" onClick={closeDrawer} {...scrimMotion} />}
      </AnimatePresence>

      <motion.div
        className="fc-drawer"
        style={{ x: drawerX }}
        drag="x"
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
          aria-label={open ? 'Close your Friend' : 'Open your Friend'}
        >
          <FriendMark size={24} {...markTone} />
        </button>

        <div className="fc-drawer-inner" role="dialog" aria-label={headName}>
          <header className="fc-head">
            <span className="fc-head-mark">
              <FriendMark size={20} {...markTone} />
            </span>
            <div className="fc-head-txt">
              <span className="fc-head-name">{headName}</span>
              <span className="fc-head-sub">{headSub}</span>
            </div>
            {!showConnect &&
              (headerActions ?? (
                <button
                  className="fc-head-friend"
                  onClick={() => window.open('https://friend.ecodia.au', '_blank')}
                >
                  Friend
                </button>
              ))}
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
                    <div key={i} className="fc-you">
                      {m.text}
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
                <input
                  className="fc-input"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={placeholder ?? `Ask ${name}...`}
                  disabled={busy}
                  autoComplete="off"
                />
                <button className="fc-send" type="submit" disabled={busy || !input.trim()} aria-label="Send">
                  →
                </button>
              </form>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
