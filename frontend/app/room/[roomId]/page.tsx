'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import * as Y from 'yjs';
import { Awareness } from 'y-protocols/awareness';
import { applyAwarenessUpdate, encodeAwarenessUpdate } from 'y-protocols/awareness';
import { io, Socket } from 'socket.io-client';
import type { MonacoBinding } from 'y-monaco';
import Editor, { Monaco } from '@monaco-editor/react';
import type { editor } from 'monaco-editor';
import { useAuth } from '@/lib/auth-context';

const API_URL = 'http://localhost:4000';

interface ExecutionResult {
  submissionId: string;
  status: string;
  stdout: string | null;
  stderr: string | null;
  judge0Token: string | null;
}

// Map Monaco editor language identifiers to the names our backend accepts.
const LANGUAGE_MAP: Record<string, string> = {
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  java: 'java',
  cpp: 'cpp',
  c: 'c',
  csharp: 'csharp',
  go: 'go',
  ruby: 'ruby',
  rust: 'rust',
  php: 'php',
  swift: 'swift',
  kotlin: 'kotlin',
};

export default function RoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = React.use(params);
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();

  const ydocRef = useRef<Y.Doc | null>(null);
  const awarenessRef = useRef<Awareness | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const bindingRef = useRef<MonacoBinding | null>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const [editorReady, setEditorReady] = useState(false);
  const [editorLanguage, setEditorLanguage] = useState('javascript');

  // ── Execution state ────────────────────────────────────────────────────────
  const [isRunning, setIsRunning] = useState(false);
  const [result, setResult] = useState<ExecutionResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

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
    editorRef.current = editorInstance;
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

  const handleRun = useCallback(async () => {
    if (!editorRef.current || !accessToken) return;

    const code = editorRef.current.getValue();
    if (!code.trim()) {
      setRunError('Editor is empty — nothing to run.');
      return;
    }

    const monacoLang = editorRef.current.getModel()?.getLanguageId() ?? editorLanguage;
    const language = LANGUAGE_MAP[monacoLang] ?? monacoLang;

    setIsRunning(true);
    setResult(null);
    setRunError(null);

    try {
      const res = await fetch(`${API_URL}/api/execution/submit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ code, language, roomId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Execution failed');
      setResult(data as ExecutionResult);
    } catch (err: any) {
      setRunError(err.message);
    } finally {
      setIsRunning(false);
    }
  }, [accessToken, roomId, editorLanguage]);

  if (loading || !user) {
    return <div style={{ color: 'white', padding: 40 }}>Loading...</div>;
  }

  const statusColor = result
    ? result.status === 'Accepted'
      ? '#4ade80'   /* green-400 */
      : result.stderr
      ? '#f87171'   /* red-400 */
      : '#facc15'   /* yellow-400 */
    : '#94a3b8';    /* slate-400 */

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0f1117' }}>
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 16px',
          background: '#1e1e2e',
          borderBottom: '1px solid #2a2a3d',
          flexShrink: 0,
        }}
      >
        <span style={{ color: '#c9d1d9', fontFamily: 'monospace', fontSize: 14 }}>
          📁 Room: <strong style={{ color: '#79c0ff' }}>{roomId}</strong>
          {' — '}
          <span style={{ color: '#8b949e' }}>{user.name}</span>
        </span>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Language selector */}
          <select
            id="language-selector"
            value={editorLanguage}
            onChange={(e) => setEditorLanguage(e.target.value)}
            style={{
              background: '#161b22',
              color: '#e6edf3',
              border: '1px solid #30363d',
              borderRadius: 6,
              padding: '4px 10px',
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {Object.keys(LANGUAGE_MAP).map((lang) => (
              <option key={lang} value={lang}>
                {lang}
              </option>
            ))}
          </select>

          {/* Run button */}
          <button
            id="run-code-btn"
            onClick={handleRun}
            disabled={isRunning}
            style={{
              background: isRunning ? '#1a472a' : '#238636',
              color: '#ffffff',
              border: 'none',
              borderRadius: 6,
              padding: '6px 18px',
              fontWeight: 700,
              fontSize: 14,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s',
              letterSpacing: '0.5px',
            }}
          >
            {isRunning ? '⏳ Running…' : '▶ Run'}
          </button>
        </div>
      </div>

      {/* ── Editor + Results split ──────────────────────────────────────────── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Monaco editor — takes up most of the space */}
        <div style={{ flex: 1, overflow: 'hidden' }}>
          {editorReady && (
            <Editor
              height="100%"
              language={editorLanguage}
              theme="vs-dark"
              onMount={handleEditorMount}
              options={{ fontSize: 14, minimap: { enabled: false } }}
            />
          )}
        </div>

        {/* ── Output panel ─────────────────────────────────────────────────── */}
        <div
          id="output-panel"
          style={{
            background: '#161b22',
            borderTop: '2px solid #21262d',
            minHeight: 160,
            maxHeight: 280,
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
          }}
        >
          {/* Panel header */}
          <div
            style={{
              padding: '6px 14px',
              background: '#0d1117',
              borderBottom: '1px solid #21262d',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
            }}
          >
            <span style={{ color: '#8b949e', fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>
              Output
            </span>
            {result && (
              <span
                style={{
                  color: statusColor,
                  fontSize: 12,
                  fontWeight: 700,
                  background: '#0d1117',
                  border: `1px solid ${statusColor}`,
                  borderRadius: 4,
                  padding: '1px 8px',
                }}
              >
                {result.status}
              </span>
            )}
            {result && (
              <span style={{ color: '#484f58', fontSize: 11, marginLeft: 'auto' }}>
                token: {result.judge0Token}
              </span>
            )}
          </div>

          {/* Panel body */}
          <div style={{ flex: 1, overflow: 'auto', padding: '10px 14px' }}>
            {/* Idle state */}
            {!isRunning && !result && !runError && (
              <span style={{ color: '#484f58', fontFamily: 'monospace', fontSize: 13 }}>
                Press ▶ Run to execute the code in the editor.
              </span>
            )}

            {/* Loading spinner */}
            {isRunning && (
              <span style={{ color: '#58a6ff', fontFamily: 'monospace', fontSize: 13 }}>
                ⏳ Sending to Judge0 sandbox…
              </span>
            )}

            {/* Network / validation error */}
            {runError && !isRunning && (
              <pre
                style={{
                  color: '#f85149',
                  fontFamily: 'monospace',
                  fontSize: 13,
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                  background: '#1c0c0c',
                  padding: '8px 12px',
                  borderRadius: 6,
                  border: '1px solid #4d1212',
                }}
              >
                {runError}
              </pre>
            )}

            {/* Successful execution result */}
            {result && !isRunning && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {/* stdout */}
                {result.stdout ? (
                  <div>
                    <div style={{ color: '#3fb950', fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      stdout
                    </div>
                    <pre
                      style={{
                        color: '#e6edf3',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        background: '#0d1117',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #21262d',
                      }}
                    >
                      {result.stdout}
                    </pre>
                  </div>
                ) : (
                  !result.stderr && (
                    <span style={{ color: '#484f58', fontFamily: 'monospace', fontSize: 13 }}>
                      (no stdout output)
                    </span>
                  )
                )}

                {/* stderr / compile errors */}
                {result.stderr && (
                  <div>
                    <div style={{ color: '#f85149', fontSize: 11, fontWeight: 700, marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                      stderr / errors
                    </div>
                    <pre
                      style={{
                        color: '#ffa198',
                        fontFamily: 'monospace',
                        fontSize: 13,
                        whiteSpace: 'pre-wrap',
                        margin: 0,
                        background: '#160b0b',
                        padding: '8px 12px',
                        borderRadius: 6,
                        border: '1px solid #4d1212',
                      }}
                    >
                      {result.stderr}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
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