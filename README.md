# @ecodia/friend-chat

The one Ecodia Friend drawer. A slim tab at the right edge of the screen that pulls
out into a sheet, identical across Locals, Chambers, Glovebox, Studio and the wedge
apps. Each app passes only its own context: the transport, the room name, the accent.
The Friend signature (black tile, cream bar, white dot) and all geometry and motion
are invariant, on purpose. A person who has met the Friend in one app has met it in
all of them.

Consumers vendor this straight from git. There is no registry publish.

```json
"@ecodia/friend-chat": "github:EcodiaAU/friend-chat"
```

```tsx
import { FriendChat } from '@ecodia/friend-chat';
import '@ecodia/friend-chat/styles.css';

<FriendChat
  app="Locals"
  connected={hasFriend}
  askStream={askStream}
  onConnect={openFriendSSO}
  accent="#2f5d50"
/>;
```

`dist/` is committed. Any change to `src/` has to be followed by `npm run build` and
the rebuilt `dist/` committed with it, or every consumer keeps shipping the old code.

## Theme

Palette is CSS custom properties on the drawer root. Dark is a variable override
block; not one component knows it exists. There are two ways in, and they compose.

**Automatic.** Set nothing. The drawer follows the operating system through
`prefers-color-scheme`, the same as everything else on the person's screen.

**Explicit.** Put `data-fc-theme` on the drawer root or on any ancestor of it, which
is usually the element an app's own theme switch already writes to.

```html
<html data-fc-theme="dark">
  <!-- ... -->
</html>
```

```tsx
<FriendChat {...props} style={{ /* per-app vars */ } as React.CSSProperties} />
```

| value                    | result                                            |
| ------------------------ | ------------------------------------------------- |
| absent                   | follows the OS                                    |
| `data-fc-theme="dark"`   | dark, whatever the OS says                        |
| `data-fc-theme="light"`  | light, whatever the OS says                       |

An app that has never heard of the attribute keeps today's light drawer under a light
OS and picks up dark under a dark one. Nothing to migrate.

`--fc-accent` and `--fc-on-accent` are written as inline style by the component when
an app passes the `accent` prop, and inline style beats any stylesheet, so a branded
accent survives the theme switch untouched. Apps that pass no accent get the theme's
own default (ink on light, cream on dark).

Per-app overrides ride the same variables:

```tsx
<FriendChat
  {...props}
  style={{ ['--fc-font' as any]: '"Spectral", Garamond, serif' } as React.CSSProperties}
/>
```

The palette: `--fc-ink`, `--fc-paper`, `--fc-cream`, `--fc-line`, `--fc-muted`,
`--fc-surface`, `--fc-surface-2`, `--fc-code-bg`, `--fc-code-bar`, `--fc-tile`,
`--fc-mark-bar`, `--fc-mark-dot`, `--fc-accent`, `--fc-on-accent`. Plus `--fc-font`,
`--fc-ease` and `--fc-z` (stacking, for apps with their own overlay ladder).

## What a reply can render

`renderReply` is a small, dependency-free grammar. No markdown library, no syntax
highlighter, nothing that can arrive with a transitive supply chain.

- paragraphs, `#`/`##`/`###` headings, ordered and unordered lists
- `**bold**`, `*italic*`, `` `code` ``, `[label](url)`, `![alt](url)`
- fenced code blocks, with a language label, sideways scroll and a Copy button
- pipe tables, with `:---` column alignment
- task lists: `- [ ]` and `- [x]` become checkbox glyphs, read-only

Two rules are load-bearing.

**A raw URL never appears as prose text.** A bare link becomes a tidy clickable
label, a bare image URL becomes a thumbnail preview. The person sees a link or a
picture, never a wall of `https://`. The one deliberate carve-out is inside a fence,
where a URL is part of a command being handed over and every character survives
exactly as it arrived.

**A checklist in a reply is read-only.** A reply is a record of what the Friend
found, not a control surface where a person can tick something into being true.

## Queue, never drop

A message typed while the Friend is still replying is never swallowed. It lands in
the transcript straight away with a quiet `queued: answered next` hint, and fires the
moment the current turn settles, including a turn the person stopped. The composer
input is never disabled, because a locked composer is exactly what made a mid-turn
thought disappear.

With a reply in flight and nothing typed, the send button is the stop square. The
moment there is a draft, send returns and stop steps aside into its own button.

## Local

```
npm test    # render tests, esbuild + node, no framework
npm run build
npm run demo    # vite, http://localhost:5199
```

The demo carries a theme toggle, a streaming mock that answers with a code fence and
a table, and a slow answer for exercising the queue.
