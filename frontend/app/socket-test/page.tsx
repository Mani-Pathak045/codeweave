'use client';

import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export default function SocketTestPage() {
    const [messages, setMessages] = useState<string[]>([]);
    const [input, setInput] = useState('');
    const socketRef = useRef<Socket | null>(null);
    const roomId = 'test-room-1';

    useEffect(() => {
        const socket = io('http://localhost:4000');
        socketRef.current = socket;

        socket.emit('join-room', roomId);

        socket.on('test-message', (message: string) => {
            setMessages((prev) => [...prev, message]);
        });

        return () => {
            socket.disconnect();
        };
    }, []);

    const sendMessage = () => {
        socketRef.current?.emit('test-message', roomId, input);
        setInput('');
    };

    return (
        <div style={{ padding: 20, color: 'white' }}>
            <h1>Socket.io Relay Test (2b) — no Yjs involved</h1>
            <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                style={{
                    color: 'black',
                    background: 'white',
                    padding: '8px',
                    fontSize: '16px',
                    marginRight: '8px',
                }}
            />
            <button onClick={sendMessage} style={{ padding: '8px 16px' }}>
                Send
            </button>
            <ul>
                {messages.map((m, i) => (
                    <li key={i}>{m}</li>
                ))}
            </ul>
        </div>
    );
}