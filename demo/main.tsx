import React from 'react';
import { createRoot } from 'react-dom/client';
import { FriendChat } from '../src/index';
import '../src/styles.css';

const mockAsk = async (m: string) => {
  await new Promise(r => setTimeout(r, 600));
  return { friend_connected: true, friendName: 'Chubz', reply: `You asked: "${m}".\n\nHere are a few ideas:\n- A good one\n- Another good one\n\nWant me to **narrow it down**?` };
};

function Demo() {
  const [connected, setConnected] = React.useState(true);
  return (<>
    <div style={{padding:24}}>
      <button onClick={()=>setConnected(c=>!c)}>toggle connected (now: {String(connected)})</button>
    </div>
    <FriendChat app="Locals" connected={connected} friendName="Chubz"
      ask={mockAsk} onConnect={()=>alert('connect')}
      examples={["A good local coffee spot?","Somewhere local for dinner tonight","Where can I take the kids this weekend?"]}
      connectTitle="Unlock your local guide"
      style={{ ['--fc-font' as any]: '"Spectral","Iowan Old Style",Garamond,serif' } as React.CSSProperties} />
  </>);
}
createRoot(document.getElementById('root')!).render(<Demo/>);
