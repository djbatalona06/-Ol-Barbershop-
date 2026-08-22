/* Session cookies, signed and stateless.
 *
 * The shop has no session table on purpose: a cookie the server can verify but
 * did not have to store is one less thing to back up and one less thing to leak.
 * The trade is that signing out cannot invalidate an already-issued cookie before
 * it expires, which for a barbershop booking account is the right trade. Rotate
 * SESSION_SECRET to cut every session at once.
 */
import { b64urlEncode, b64urlDecode, b64urlToText, safeEqual } from './http.js';

const COOKIE = 'olb_session';
const TTL_SECONDS = 30 * 24 * 60 * 60;

const keyFor = secret => crypto.subtle.importKey(
  'raw', new TextEncoder().encode(secret),
  { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);

async function sign(secret, text) {
  const key = await keyFor(secret);
  return b64urlEncode(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(text)));
}

/** Serialise a claims object into a signed cookie value. */
export async function mintSession(secret, claims, ttl = TTL_SECONDS) {
  const now = Math.floor(Date.now() / 1000);
  const body = b64urlEncode(new TextEncoder().encode(
    JSON.stringify({ ...claims, iat: now, exp: now + ttl })));
  return `${body}.${await sign(secret, body)}`;
}

/** Verify and decode, or null. Never throws on malformed input. */
export async function readSession(secret, value) {
  if (!value || typeof value !== 'string') return null;
  const dot = value.lastIndexOf('.');
  if (dot < 1) return null;
  const body = value.slice(0, dot), mac = value.slice(dot + 1);
  if (!safeEqual(mac, await sign(secret, body))) return null;
  let claims;
  try { claims = JSON.parse(b64urlToText(body)); } catch { return null; }
  if (!claims || typeof claims.exp !== 'number') return null;
  if (claims.exp <= Math.floor(Date.now() / 1000)) return null;
  return claims;
}

export function cookieValue(request, name = COOKIE) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=');
    if (k === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}

/* Lax rather than Strict: the customer arrives back from Google's redirect and a
   Strict cookie would not be sent on that first navigation. */
export const setCookie = (value, maxAge = TTL_SECONDS, name = COOKIE) =>
  `${name}=${encodeURIComponent(value)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAge}`;

export const clearCookie = (name = COOKIE) =>
  `${name}=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;

/** The current customer, or null. */
export async function currentCustomer(request, env) {
  return readSession(env.SESSION_SECRET, cookieValue(request));
}

export { COOKIE, TTL_SECONDS };
