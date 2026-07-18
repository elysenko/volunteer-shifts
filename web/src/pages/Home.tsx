import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export default function Home() {
  const [health, setHealth] = useState<string>('checking…');
  useEffect(() => {
    api<{ status: string }>('/api/health')
      .then((h) => setHealth(h.status))
      .catch(() => setHealth('backend unreachable'));
  }, []);
  return (
    <main>
      <h1 data-testid="home-title">Welcome</h1>
      <p data-testid="health-status">API: {health}</p>
    </main>
  );
}
