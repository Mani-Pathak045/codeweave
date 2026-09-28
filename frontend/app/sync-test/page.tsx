'use client';

import { useEffect, useRef, useState } from 'react';
import * as Y from 'yjs';
import { io, Socket } from 'socket.io-client';

export default function SyncTestPage() {
    const [text, setText] = useState('');
    const ydocRef = useRef<Y.Doc | null>(null);
    const ytextRef = useRef<Y.Text | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const roomId = 'sync-test-room';

    useEffect(() => {
        const ydoc = new Y.Doc();
        const ytext = ydoc.getText('shared-text');
        ydocRef.current = ydoc;
        ytextRef.current = ytext;

        const socket = io('http://localhost:4000');
        socketRef.current = socket;

        socket.emit('sync-join', roomId);

        socket.on('sync-init', (state: ArrayBuffer) => {
            Y.applyUpdate(ydoc, new Uint8Array(state));
            setText(ytext.toString());
        });

        socket.on('sync-update', (update: ArrayBuffer) => {
            Y.applyUpdate(ydoc, new Uint8Array(update));
        });

        ydoc.on('update', (update: Uint8Array, origin: any) => {
            if (origin === 'remote') return;
            socket.emit('sync-update', roomId, update);
        });

        const updateHandler = () => setText(ytext.toString());
        ytext.observe(updateHandler);

        return () => {
            ytext.unobserve(updateHandler);
            socket.disconnect();
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
        <div style={{ padding: 20, color: 'white' }}>
            <h1>Yjs + Own Backend Sync Test (2c)</h1>
            <textarea
                value={text}
                onChange={handleChange}
                rows={10}
                cols={60}
                style={{
                    fontFamily: 'monospace',
                    fontSize: 16,
                    color: 'black',
                    background: 'white',
                    padding: '8px',
                }}
            />
        </div>
    );
}