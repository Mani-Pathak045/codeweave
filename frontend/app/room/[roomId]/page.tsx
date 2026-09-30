'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { io, Socket } from 'socket.io-client';
import type { MonacoBinding } from 'y-monaco';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useAuth } from '@/lib/auth-context';

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = React.use(params);
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const [editorReady, setEditorReady] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!user || !accessToken) return;

    const ydoc = new Y.Doc();
    ydocRef.current = ydoc;

    const awareness = new Awareness(ydoc);
    awarenessRef.current = awareness;

    awareness.setLocalStateField('user', {
      name: user.name,
      color: stringToColor(user.id),
    });

    const socket = io('http://localhost:4000', {
      auth: { token: accessToken },
    });
    socketRef.current = socket;

    socket.emit('sync-join', roomId);

    socket.on('sync-init', (state: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(state), 'remote');
    });

    socket.on('sync-update', (update: ArrayBuffer) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), 'remote');
    });

    ydoc.on('update', (update: Uint8Array, origin: any) => {
      if (origin === 'remote') return;
      socket.emit('sync-update', roomId, update);
    });

    socket.on('awareness-update', (update: ArrayBuffer) => {
      applyAwarenessUpdate(awareness, new Uint8Array(update), 'remote');
    });

    awareness.on('update', ({ added, updated, removed }: any, origin: any) => {
      if (origin === 'remote') return;
      const changedClients = added.concat(updated).concat(removed);
      const update = encodeAwarenessUpdate(awareness, changedClients);
      socket.emit('awareness-update', roomId, update);
    });

    socket.on('sync-error', (msg: string) => {
      console.error('Sync error:', msg);
    });

    setEditorReady(true);

    return () => {
      bindingRef.current?.destroy();
      awareness.destroy();
      socket.disconnect();
      ydoc.destroy();
    };
  }, [roomId, user, accessToken]);

  const handleEditorMount = (editorInstance: editor.IStandaloneCodeEditor, monaco: Monaco) => {
    const ydoc = ydocRef.current;
    const awareness = awarenessRef.current;
    if (!ydoc || !awareness) return;

    const yText = ydoc.getText('monaco');

    import('y-monaco').then(({ MonacoBinding }) => {
      const binding = new MonacoBinding(
        yText,
        editorInstance.getModel()!,
        new Set([editorInstance]),
        awareness,
      );
      bindingRef.current = binding as any;
    });
  };

  if (loading || !user) {
    return <div style={{ color: 'white', padding: 40 }}>Loading...</div>;
  }

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: '10px', background: '#1e1e1e', color: 'white' }}>
        Room: {roomId} — {user.name}
      </div>
      {editorReady && (
        <Editor
          height="100%"
          defaultLanguage="javascript"
          theme="vs-dark"
          onMount={handleEditorMount}
        />
      )}
    </div>
  );
}

function stringToColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 60%)`;
}