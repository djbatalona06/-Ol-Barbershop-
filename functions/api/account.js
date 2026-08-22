/* Deleting a provider account.
 *
 * The privacy page promises this, so it has to be real and it has to be complete:
 * the identity goes, and booking_requests cascades with it. There is no soft
 * delete and no tombstone. A request already copied into Katherine's book stays in
 * her book — that is her business record, kept for the three years the policy
 * states, and it lives on her device rather than here. */
import { json, fail, missingDb } from '../../lib/http.js';
import { currentCustomer, clearCookie } from '../../lib/session.js';

export async function onRequestDelete({ request, env }) {
  const noDb = missingDb(env);
  if (noDb) return noDb;

  const claims = await currentCustomer(request, env);
  if (!claims) return fail(401, 'Please sign in first.');

  // booking_requests has ON DELETE CASCADE, so this takes the requests with it.
  await env.DB.prepare(`DELETE FROM customer_identities WHERE id = ?1`).bind(claims.cid).run();

  return json({ deleted: true }, 200, { 'set-cookie': clearCookie() });
}
