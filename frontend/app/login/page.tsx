'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const { login } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
      router.push('/rooms');
    } catch {
      setError('Invalid email or password');
    }
  };

  return (
    <div style={{ padding: 40, color: 'white', maxWidth: 400 }}>
      <h1>Log in to CodeWeave</h1>
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={{ padding: 8, color: 'black' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          style={{ padding: 8, color: 'black' }}
        />
        {error && <div style={{ color: '#ff6b6b' }}>{error}</div>}
        <button type="submit" style={{ padding: 8 }}>Log in</button>
      </form>
    </div>
  );
}