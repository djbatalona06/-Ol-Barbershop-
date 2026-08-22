/* Exchange a Google ID token for a session on this site.
 *
 * The browser cannot do this itself. Verifying the token means checking a
 * signature against Google's published keys and then checking that the token was
 * issued for this application and this sign-in attempt — none of which is worth
 * anything if the code doing the checking is code the visitor controls. */
import { json, fail, readJson, missingDb } from '../../../lib/http.js';
import { verifyIdToken } from '../../../lib/idtoken.js';
import { mintSession, readSession, cookieValue, setCookie, clearCookie } from '../../../lib/session.js';
import { NONCE_COOKIE } from './nonce.js';

export async function onRequestPost({ request, env }) {
  if (!env.SESSION_SECRET || !env.GOOGLE_CLIENT_ID) {
    return fail(503, 'Signing in with Google is not set up on this site yet.');
  }
  const noDb = missingDb(env);
  if (noDb) return noDb;

  let body;
  try { body = await readJson(request); }
  catch { return fail(400, 'That request did not arrive in a form we could read.'); }

  const credential = body && body.credential;
  if (!credential) return fail(400, 'No sign-in token was sent.');

  const pending = await readSession(env.SESSION_SECRET, cookieValue(request, NONCE_COOKIE));
  if (!pending || !pending.nonce) {
    return fail(400, 'That sign-in took too long. Please try again.');
  }

  let profile;
  try {
    profile = await verifyIdToken('google', credential, env, { nonce: pending.nonce });
  } catch (err) {
    // The reason is useful in the log and useless to the visitor, who cannot act on it.
    console.warn('google id token rejected:', err.message);
    return fail(401, 'We could not verify that Google sign-in. Please try again.');
  }

  if (!profile.emailVerified) {
    return fail(403, 'That Google account has not confirmed its email address yet.');
  }

  const id = `google:${profile.sub}`;
  const now = new Date().toISOString();
  await env.DB.prepare(
    `INSERT INTO customer_identities (id, provider, subject, email, email_verified, display_name, created_at, last_seen_at)
     VALUES (?1, 'google', ?2, ?3, 1, ?4, ?5, ?5)
     ON CONFLICT(id) DO UPDATE SET
       email = excluded.email, display_name = excluded.display_name, last_seen_at = excluded.last_seen_at`
  ).bind(id, profile.sub, profile.email, profile.name, now).run();

  const session = await mintSession(env.SESSION_SECRET,
    { cid: id, provider: 'google', email: profile.email, name: profile.name });

  return json(
    { customer: { id, email: profile.email, name: profile.name, provider: 'google' } },
    200,
    { 'set-cookie': [setCookie(session), clearCookie(NONCE_COOKIE)].join(', ') }
  );
}
