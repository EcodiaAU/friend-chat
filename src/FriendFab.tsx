import * as React from 'react';
import { motion, useReducedMotion } from 'framer-motion';
import { FriendMark } from './FriendMark';

/**
 * The one identical Friend FAB: a black circle carrying the cream bar + white
 * dot mark, no name and no label. Same on every Ecodia app (Tate spec
 * 2026-07-07). Exported standalone so Studio (which keeps its own dock body)
 * uses the exact same launcher. Wrap it in an element carrying the .fc-root
 * token scope, or import '@ecodia/friend-chat/styles.css' and place it inside
 * one. framer-motion enter + tap, reduced-motion gated.
 */
export function FriendFab({
  onClick,
  ariaLabel = 'Open your Friend',
  markSize = 24,
  className,
}: {
  onClick: () => void;
  ariaLabel?: string;
  markSize?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  const motionProps = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, transition: { duration: 0.18 } }
    : {
        initial: { opacity: 0, scale: 0.8 },
        animate: { opacity: 1, scale: 1 },
        transition: { type: 'spring' as const, stiffness: 420, damping: 26 },
        whileTap: { scale: 0.94 },
      };
  return (
    <motion.button
      type="button"
      className={className ? `fc-fab ${className}` : 'fc-fab'}
      onClick={onClick}
      aria-label={ariaLabel}
      {...motionProps}
    >
      <FriendMark size={markSize} barColor="var(--fc-mark-bar)" dotColor="var(--fc-mark-dot)" />
    </motion.button>
  );
}
