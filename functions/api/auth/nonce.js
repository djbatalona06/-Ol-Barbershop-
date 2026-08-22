/* Issue a one-shot nonce for a sign-in attempt.
 *
 * The browser asks for this, hands it to Google, and Google echoes it back inside
 * the signed ID token. Comparing the two is what stops a token minted for another
 * page being replayed against this one. The nonce rides in its own short-lived
 * signed cookie so the server stays stateless. */
import { json } from '../../../lib/http.js';
import { mintSession, setCookie } from '../../../lib/session.js';

const NONCE_COOKIE = 'olb_nonce';
const NONCE_TTL = 10 * 60;

export async function onRequestGet({ env }) {
  if (!env.SESSION_SECRET) return json({ error: 'sign-in is not configured' }, 503);

  const nonce = crypto.randomUUID().replace(/-/g, '');
  const cookie = await mintSession(env.SESSION_SECRET, { nonce }, NONCE_TTL);

  return json({ nonce, clientId: env.GOOGLE_CLIENT_ID || '' }, 200, {
    'set-cookie': setCookie(cookie, NONCE_TTL, NONCE_COOKIE)
  });
}

export { NONCE_COOKIE };
