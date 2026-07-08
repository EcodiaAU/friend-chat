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
interface FriendChatProps {
    /** Room name, e.g. "Locals". Drives the subtitle "here with you in Locals". */
    app: string;
    /** Whether the person has connected their Friend. false shows the connect-to-buy nudge. */
    connected: boolean;
    /** Per-app transport. The component never knows which edge fn / backend it hits. */
    ask: (message: string) => Promise<FriendAskResult>;
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
    /** Extra --fc-* palette overrides on the root. */
    style?: React.CSSProperties;
    /**
     * Vertical offset (px) of the collapsed edge tab from the bottom, so it clears
     * this app's bottom tab bar. Default 116.
     */
    tabBottom?: number;
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
declare function FriendChat({ app, connected, ask, onConnect, friendName: initialName, examples, placeholder, emptyLine, connectTitle, connectBody, accent, onAccent, renderExtra, style, tabBottom, }: FriendChatProps): React.JSX.Element;

/** Minimal, dependency-free rendering of a Friend reply: paragraphs, bullets, bold. */
declare function renderReply(text: string): React.ReactNode;

export { type FriendAskResult, FriendChat, type FriendChatProps, FriendFab, FriendMark, renderReply };
