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
export function FriendMark({
  size = 24,
  barColor = 'currentColor',
  dotColor = 'currentColor',
  className,
  style,
}: {
  size?: number;
  barColor?: string;
  dotColor?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg
      viewBox="288 288 448 448"
      width={size}
      height={size}
      fill="none"
      className={className}
      style={style}
      aria-hidden="true"
    >
      <rect x="293" y="332" width="76" height="360" rx="38" fill={barColor} />
      <circle cx="584" cy="512" r="147" fill={dotColor} />
    </svg>
  );
}
