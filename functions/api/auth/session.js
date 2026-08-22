/* Who is signed in, and signing out.
 *
 * The page asks this on load rather than trusting anything it kept in JavaScript:
 * the cookie is the only thing the server will accept as proof, so it should be
 * the only thing the page believes either. */
import { json } from '../../../lib/http.js';
import { currentCustomer, clearCookie } from '../../../lib/session.js';

export async function onRequestGet({ request, env }) {
  if (!env.SESSION_SECRET) return json({ customer: null });
  const claims = await currentCustomer(request, env);
  if (!claims) return json({ customer: null }, 401);
  return json({ customer: { id: claims.cid, email: claims.email, name: claims.name,
                            provider: claims.provider } });
}

export async function onRequestDelete() {
  return json({ ok: true }, 200, { 'set-cookie': clearCookie() });
}
