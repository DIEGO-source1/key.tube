import { getDatabase } from './neon-db';
import { headers } from 'next/headers';
import { scryptAsync } from '@noble/hashes/scrypt';
import { bytesToHex, hexToBytes } from '@noble/hashes/utils';

export type AppUser = { userId: string; email: string; fullName: string; displayName: string };
export type UserRow = { id: string; email: string; name: string; password_hash: string | null; google_sub: string | null };
export const SESSION_COOKIE = 'keytube_session';
export const randomToken = () => bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
export async function digest(value: string) {
  return bytesToHex(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value))));
}
export function authDB() {
  return getDatabase();
}
export function cookieValue(cookie: string | null, name: string) {
  return (cookie || '').split(';').map(x => x.trim()).find(x => x.startsWith(name + '='))?.slice(name.length + 1) || '';
}
export async function getAppUser(): Promise<AppUser | null> {
  const token = cookieValue((await headers()).get('cookie'), SESSION_COOKIE);
  if (!/^[a-f0-9]{64}$/.test(token)) return null;
  const row = await authDB().prepare('SELECT u.id,u.email,u.name FROM sessions s JOIN users u ON u.id=s.user_id WHERE s.token_hash=? AND s.expires_at>?').bind(await digest(token), Date.now()).first<UserRow>();
  return row ? { userId: row.id, email: row.email, fullName: row.name, displayName: row.name } : null;
}
export function sessionCookie(req: Request, token: string, seconds = 604800) {
  return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${seconds}${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}`;
}
export async function createSession(req: Request, userId: string) {
  const token = randomToken();
  const old = cookieValue(req.headers.get('cookie'), SESSION_COOKIE);
  await authDB().batch([
    authDB().prepare('DELETE FROM sessions WHERE expires_at < ? OR token_hash=?').bind(Date.now(), await digest(old)),
    authDB().prepare('INSERT INTO sessions (token_hash,user_id,expires_at) VALUES (?,?,?)').bind(await digest(token), userId, Date.now()+604800000),
  ]);
  return sessionCookie(req, token);
}
// OWASP's scrypt profile: 16 MiB per derivation, p=5. One derivation per isolate
// at a time bounds memory under concurrent account requests on Workers.
let tail: Promise<unknown> = Promise.resolve();
function derive(password: string, salt: Uint8Array) {
  const result = tail.then(() => scryptAsync(password, salt, { N:16384, r:8, p:5, dkLen:32, asyncTick:20 }));
  tail = result.catch(() => undefined);
  return result;
}
export async function passwordHash(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  return `scrypt$16384$8$5$${bytesToHex(salt)}$${bytesToHex(await derive(password, salt))}`;
}
export async function checkPassword(password: string, encoded: string | null) {
  const parts = encoded?.split('$');
  const valid = parts?.length === 6 && parts[0] === 'scrypt' && parts[1] === '16384' && parts[2] === '8' && parts[3] === '5' && /^[a-f0-9]{32}$/.test(parts[4]) && /^[a-f0-9]{64}$/.test(parts[5]);
  const actual = await derive(password, valid ? hexToBytes(parts![4]) : new Uint8Array(16));
  const expected = valid ? hexToBytes(parts![5]) : new Uint8Array(32);
  let difference = 0;
  for (let i=0;i<32;i++) difference |= actual[i]^expected[i];
  return !!valid && difference === 0;
}
export async function authRateLimit(req: Request, email = '') {
  const now = Date.now(), window = Math.floor(now/600000);
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || req.headers.get('cf-connecting-ip') || 'local';
  const keys = [await digest(`ip:${ip}:${window}`), ...(email ? [await digest(`account:${email}:${window}`)] : [])];
  for (const key of keys) {
    const row = await authDB().prepare('INSERT INTO auth_limits (key,count,expires_at) VALUES (?,1,?) ON CONFLICT(key) DO UPDATE SET count=auth_limits.count+1 RETURNING auth_limits.count AS count').bind(key, now+1200000).first<{count:number}>();
    if ((row?.count||0) > (email ? 15 : 30)) throw new Error('Demasiados intentos. Espera 10 minutos para continuar.');
  }
  await authDB().prepare('DELETE FROM auth_limits WHERE expires_at < ?').bind(now).run();
}
export function googleConfig() {
  return {
    clientId: process.env.GOOGLE_CLIENT_ID,
    secret: process.env.GOOGLE_CLIENT_SECRET,
    origin: process.env.APP_ORIGIN,
  };
}
