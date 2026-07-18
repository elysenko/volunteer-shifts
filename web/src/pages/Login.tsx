import { useState } from 'react';
import { api } from '../lib/api';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    try {
      const res = await api<{ token: string }>('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      localStorage.setItem('token', res.token);
      setMessage('Logged in');
    } catch {
      setMessage('Login failed');
    }
  }

  return (
    <main>
      <h1>Login</h1>
      <form onSubmit={submit} data-testid="login-form">
        <input data-testid="login-email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" />
        <input data-testid="login-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" />
        <button type="submit">Sign in</button>
      </form>
      <p data-testid="login-message">{message}</p>
    </main>
  );
}
