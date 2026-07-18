import jwt from 'jsonwebtoken';
import { createHash } from 'crypto';

const SECRET = process.env.JWT_SECRET || 'dev-secret';

export function signToken(payload: object): string {
  return jwt.sign(payload, SECRET, { expiresIn: '24h' });
}

export function verifyToken(token: string): unknown {
  return jwt.verify(token, SECRET);
}

export function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

export function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}
