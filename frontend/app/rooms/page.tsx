'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

interface Room {
  id: string;
  name: string;
  language: string;
  createdAt: string;
}

const API_URL = 'http://localhost:4000';

export default function RoomsPage() {
  const { user, accessToken, loading } = useAuth();
  const router = useRouter();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [newRoomName, setNewRoomName] = useState('');
  const [newRoomLanguage, setNewRoomLanguage] = useState('javascript');

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!accessToken) return;
    fetch(`${API_URL}/api/rooms/mine`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .then(setRooms);
  }, [accessToken]);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    const res = await fetch(`${API_URL}/api/rooms`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ name: newRoomName, language: newRoomLanguage }),
    });
    const room = await res.json();
    router.push(`/room/${room.id}`);
  };

  if (loading || !user) {
    return <div style={{ color: 'white', padding: 40 }}>Loading...</div>;
  }

  return (
    <div style={{ padding: 40, color: 'white' }}>
      <h1>Welcome, {user.name}</h1>

      <h2>Create a new room</h2>
      <form onSubmit={handleCreateRoom} style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        <input
          placeholder="Room name"
          value={newRoomName}
          onChange={(e) => setNewRoomName(e.target.value)}
          style={{ padding: 8, color: 'black' }}
        />
        <select
          value={newRoomLanguage}
          onChange={(e) => setNewRoomLanguage(e.target.value)}
          style={{ padding: 8, color: 'black' }}
        >
          <option value="javascript">JavaScript</option>
          <option value="python">Python</option>
          <option value="typescript">TypeScript</option>
        </select>
        <button type="submit">Create</button>
      </form>

      <h2>Your rooms</h2>
      <ul>
        {rooms.map((room) => (
          <li key={room.id}>
            <a href={`/room/${room.id}`} style={{ color: '#6bb6ff' }}>
              {room.name} ({room.language})
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}