import * as React from 'react';

/**
 * The canonical Ecodia Friend mark: a vertical rounded bar (you) beside a solid
 * dot (your Friend), reading as "1" + "0". Geometry is verbatim from the Friend
 * app icon generator (friend/app/components/icons.tsx IconFriend), so every
 * surface renders the identical mark. This is the one constant visual signature
 * of the self, invariant across all apps.
 *
 * Two-tone: on the black FAB the bar is cream and the dot is white (Tate spec
 * 2026-07-07). Elsewhere both default to currentColor so the caller sets it.
 */
declare function FriendMark({ size, barColor, dotColor, className, style, }: {
    size?: number;
    barColor?: string;
    dotColor?: string;
    className?: string;
    style?: React.CSSProperties;
}): React.JSX.Element;

/**
 * The one identical Friend FAB: a black circle carrying the cream bar + white
 * dot mark, no name and no label. Same on every Ecodia app (Tate spec
 * 2026-07-07). Exported standalone so Studio (which keeps its own dock body)
 * uses the exact same launcher. Wrap it in an element carrying the .fc-root
 * token scope, or import '@ecodia/friend-chat/styles.css' and place it inside
 * one. framer-motion enter + tap, reduced-motion gated.
 */
declare function FriendFab({ onClick, ariaLabel, markSize, className, }: {
    onClick: () => void;
    ariaLabel?: string;
    markSize?: number;
    className?: string;
}): React.JSX.Element;

interface FriendAskResult {
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
/**
 * Non-text signs of life a streaming transport can report. `onDelta` only fires on
 * WORDS, and a turn spends most of its life not saying any: a tool frame, a thinking
 * token, or a server heartbeat all mean the turn is alive while the text stays frozen.
 * A transport that sees those should call `alive()` on each one, or the stall guard is
 * judging the turn on the one signal it cannot produce mid-tool. Optional and additive:
 * a transport that ignores it behaves exactly as before.
 */
interface TurnLife {
    /** Call on any frame from the engine, text or not. Re-arms the stall guard. */
    alive: () => void;
}
interface FriendChatProps {
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
    askStream?: (message: string, onDelta: (textSoFar: string) => void, signal?: AbortSignal, life?: TurnLife) => Promise<FriendAskResult>;
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
    seed?: {
        text: string;
        autosend?: boolean;
        nonce: number;
    } | null;
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
     * How long (ms) a turn may show no sign of life (no frame via `TurnLife.alive`, no
     * streamed token, no resolve, no reject) before it is treated as a stalled engine and
     * torn down: the turn settles, the person sees a quiet "went quiet, try again", and
     * anything they queued behind it is answered rather than frozen. The Friend engine
     * serialises turns per person, so a saturated engine can leave a socket silent
     * forever; without this the whole chat freezes.
     *
     * The old default was 60000 on the belief that a healthy long turn streams
     * continuously. It does not. A tool call emits a frame at its start and another when
     * it lands, nothing between, and one measured Friend turn ran 87.3 seconds of total
     * silence while working normally. So the default is now well clear of real tool work,
     * and the sharp signal comes from a transport wiring `TurnLife.alive` rather than from
     * a tight clock. Default 300000. Pass 0 to disable the guard.
     */
    turnStallMs?: number;
}
/**
 * The unified Ecodia Friend side-drawer. Not a floating blob: the Friend lives at
 * the right edge as a slim black tab (cream bar + white dot) and is physically
 * pulled out into a right-anchored sheet. One identical interaction across every
 * app; each app passes only its own context via `ask`, `friendName`, room copy and
 * `accent`. Connected gives the chat, not-connected gives the connect-to-buy nudge
 * whose CTA goes straight to the native Friend SSO. Mount once at app scope; the
 * app owns route-based hiding (do not render it on marketing/auth surfaces).
 */
declare function FriendChat({ app, connected, ask, askStream, onConnect, friendName: initialName, examples, placeholder, emptyLine, connectTitle, connectBody, accent, onAccent, renderExtra, renderBody, headerActions, onNewChat, onOpenChange, seed, style, tabBottom, modal, onAttachImage, turnStallMs, }: FriendChatProps): React.JSX.Element;

/** Minimal, dependency-free rendering of a Friend reply. */
declare function renderReply(text: string): React.ReactNode;

export { type FriendAskResult, FriendChat, type FriendChatProps, FriendFab, FriendMark, renderReply };
