import * as React from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { FriendMark } from './FriendMark';
import { FriendFab } from './FriendFab';
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
  /** Per-app transport. The component never knows which edge fn / backend it hits. */
  ask: (message: string) => Promise<FriendAskResult>;
  /** Route to this app's "Connect your Friend" SSO. */
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
  /** Extra --fc-* palette overrides on the root. */
  style?: React.CSSProperties;
}

type Msg = { role: 'you' | 'friend'; text: string; extra?: unknown };

const SPRING_PANEL = { type: 'spring' as const, stiffness: 380, damping: 34 };

/**
 * The unified Ecodia Friend floating chat. One identical FAB (black circle,
 * cream bar + white dot) and one chat design across every app; each app passes
 * only its own context via `ask`, `friendName`, room copy and `accent`. Always
 * present: connected gives the chat, not connected gives the connect-to-buy
 * nudge that drives Friend subscriptions. Mount once at app scope; the app owns
 * route-based hiding (do not render it on marketing/auth surfaces).
 */
export function FriendChat({
  app,
  connected,
  ask,
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
  style,
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
  const panelMotion = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.18 } }
    : { initial: { opacity: 0, y: 40 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: 40 }, transition: SPRING_PANEL };

  const markTone = { barColor: 'var(--fc-mark-bar)', dotColor: 'var(--fc-mark-dot)' };

  async function send(text: string) {
    const msg = text.trim();
    if (!msg || busy) return;
    setInput('');
    setMessages((m) => [...m, { role: 'you', text: msg }]);
    setBusy(true);
    try {
      const res = await ask(msg);
      if (!res.friend_connected) {
        setDegraded(true);
        setOpen(false);
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

  return (
    <>
      <AnimatePresence>
        {open && <motion.div className="fc-scrim" onClick={() => setOpen(false)} {...scrimMotion} />}
      </AnimatePresence>
      <div className="fc-root" style={rootStyle}>
        <AnimatePresence>
          {open && showConnect && (
            <motion.div key="fc-connect" className="fc-connect" role="dialog" aria-label="Connect your Friend" {...panelMotion}>
              <button className="fc-connect-x" onClick={() => setOpen(false)} aria-label="Close">
                ×
              </button>
              <span className="fc-connect-mark">
                <FriendMark size={22} {...markTone} />
              </span>
              <h3 className="fc-connect-h">{connectTitle ?? `Unlock your ${app} Friend`}</h3>
              <p className="fc-connect-p">
                {connectBody ??
                  `Connect your Ecodia Friend and it shows up here inside ${app}: it knows you, and helps you get more out of every visit. One Friend, across everything Ecodia.`}
              </p>
              <button className="fc-connect-cta" onClick={onConnect}>
                <FriendMark size={16} {...markTone} /> Connect your Friend
              </button>
            </motion.div>
          )}
          {open && !showConnect && (
            <motion.div key="fc-sheet" className="fc-sheet" role="dialog" aria-label={`${name}, here with you in ${app}`} {...panelMotion}>
              <header className="fc-head">
                <span className="fc-head-mark">
                  <FriendMark size={20} {...markTone} />
                </span>
                <div className="fc-head-txt">
                  <span className="fc-head-name">{name}</span>
                  <span className="fc-head-sub">here with you in {app}</span>
                </div>
                <button className="fc-head-x" onClick={() => setOpen(false)} aria-label="Close">
                  ×
                </button>
              </header>
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
            </motion.div>
          )}
        </AnimatePresence>
        <FriendFab onClick={() => setOpen((o) => !o)} ariaLabel={open ? 'Close your Friend' : 'Open your Friend'} />
      </div>
    </>
  );
}
