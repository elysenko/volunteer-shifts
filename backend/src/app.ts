import express from 'express';
import { prisma } from './lib/prisma';
import { signToken, verifyPassword } from './lib/auth';

export const app = express();
app.use(express.json());

// Health probe: the platform's backend reachability check (descriptor backend_probe_path).
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.password)) {
    return res.status(401).json({ error: 'invalid credentials' });
  }
  return res.json({ token: signToken({ sub: user.id, role: user.role }), role: user.role });
});
