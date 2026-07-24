import React from 'react';
import { createRoot } from 'react-dom/client';
import { FriendChat } from '../src/index';
import '../src/styles.css';

// A streamed reply that carries every reply shape at once: prose, a fenced code
// block (with * and _ that must stay literal), a pipe table, and a task list. The
// stream arrives in chunks so the drawer shows it building.
const RICH = [
  'Here is what I would do this weekend.\n\n',
  '```js\n// keep the * and _ literal\nconst pick = (a, b) => a || b; // not *italic* or _under_\n```\n\n',
  '| Day | Spot | Time |\n| :-- | :-- | --: |\n| Sat | The Beach | 9am |\n| Sun | Farmers Market | 8am |\n\n',
  'Before you go:\n\n- [x] Fill the tank\n- [x] Charge the camera\n- [ ] Pack the esky\n\n',
  'Want me to **narrow it down** to one?',
].join('');

// A slow stream, so a person can send a second message mid-reply and watch it queue.
const askStream = async (
  _m: string,
  onDelta: (t: string) => void,
  signal?: AbortSignal,
) => {
  const words = RICH.split(/(\s+)/);
  let acc = '';
  for (const w of words) {
    if (signal?.aborted) break;
    acc += w;
    onDelta(acc);
    await new Promise((r) => setTimeout(r, 26));
  }
  return { friend_connected: true, friendName: 'Chubz', reply: RICH };
};

function Demo() {
  const [connected, setConnected] = React.useState(true);
  const [dark, setDark] = React.useState(false);
  const [seed, setSeed] = React.useState<{ text: string; autosend: boolean; nonce: number } | null>(null);

  React.useEffect(() => {
    document.documentElement.setAttribute('data-fc-theme', dark ? 'dark' : 'light');
    document.body.style.background = dark ? '#0d0d0f' : '#efece4';
    document.body.style.color = dark ? '#eee' : '#111';
  }, [dark]);

  return (
    <>
      <div style={{ padding: 24, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button onClick={() => setConnected((c) => !c)}>connected: {String(connected)}</button>
        <button data-testid="theme-toggle" onClick={() => setDark((d) => !d)}>theme: {dark ? 'dark' : 'light'}</button>
        <button data-testid="seed-rich" onClick={() => setSeed({ text: 'plan my weekend', autosend: true, nonce: Date.now() })}>
          ask (streams rich reply)
        </button>
      </div>
      <FriendChat
        app="Locals"
        connected={connected}
        friendName="Chubz"
        askStream={askStream}
        onConnect={() => alert('connect')}
        seed={seed}
        examples={['A good local coffee spot?', 'Somewhere local for dinner tonight']}
        connectTitle="Unlock your local guide"
        style={{ ['--fc-font' as any]: '"Spectral","Iowan Old Style",Garamond,serif' } as React.CSSProperties}
      />
    </>
  );
}
createRoot(document.getElementById('root')!).render(<Demo />);
