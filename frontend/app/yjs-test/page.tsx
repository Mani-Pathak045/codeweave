'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { WebrtcProvider } from 'y-webrtc';

export default function YjsTestPage() {
  const [text, setText] = useState('');
  const ydocRef = useRef<Y.Doc | null>(null);
  const ytextRef = useRef<Y.Text | null>(null);

  useEffect(() => {
    const ydoc = new Y.Doc();
    const provider = new WebrtcProvider('codeweave-yjs-test-room', ydoc);
    const ytext = ydoc.getText('shared-text');

    ydocRef.current = ydoc;
    ytextRef.current = ytext;

    setText(ytext.toString());

    const updateHandler = () => {
      setText(ytext.toString());
    };
    ytext.observe(updateHandler);

    return () => {
      ytext.unobserve(updateHandler);
      provider.destroy();
      ydoc.destroy();
    };
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const ytext = ytextRef.current;
    if (!ytext) return;

    ydocRef.current!.transact(() => {
      ytext.delete(0, ytext.length);
      ytext.insert(0, newValue);
    });
  };

  return (
    <div style={{ padding: 20 }}>
      <h1>Yjs Sync Test (2a) — no backend involved</h1>
      <textarea
        value={text}
        onChange={handleChange}
        rows={10}
        cols={60}
        style={{ fontFamily: 'monospace', fontSize: 16 }}
      />
    </div>
  );
}