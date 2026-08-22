/* Stripe tells us what happened to the subscription.
 *
 * Recording only. Nothing here can take the shop's website down: a past-due
 * subscription changes a badge on Katherine's billing page and nothing else. That
 * is a promise made on card 11 of the handover notes, and a website that goes dark
 * over a late invoice is both a bad way to treat a five-year client and an
 * unfair-practice complaint waiting to happen. */
import { json, fail, missingDb } from '../../../lib/http.js';
import { verifyWebhook } from '../../../lib/stripe.js';

const WATCHED = new Set([
  'checkout.session.completed',
  'customer.subscription.created',
  'customer.subscription.updated',
  'customer.subscription.deleted',
  'invoice.paid',
  'invoice.payment_failed'
]);

export async function onRequestPost({ request, env }) {
  if (!env.STRIPE_WEBHOOK_SECRET) return fail(503, 'Billing is not set up.');
  const noDb = missingDb(env);
  if (noDb) return noDb;

  // The raw text, byte for byte. Re-serialising a parsed object breaks the signature.
  const raw = await request.text();
  const ok = await verifyWebhook(raw, request.headers.get('stripe-signature'), env.STRIPE_WEBHOOK_SECRET);
  if (!ok) {
    console.warn('rejected a webhook with a bad or stale signature');
    return fail(400, 'Bad signature.');
  }

  let event;
  try { event = JSON.parse(raw); } catch { return fail(400, 'Bad payload.'); }
  if (!WATCHED.has(event.type)) return json({ ignored: event.type });

  const object = (event.data && event.data.object) || {};
  const subscriptionId = object.subscription || (object.object === 'subscription' ? object.id : null);
  const customerId = object.customer || null;

  let status = object.status || null;
  if (event.type === 'invoice.paid') status = 'active';
  if (event.type === 'invoice.payment_failed') status = 'past_due';
  if (event.type === 'customer.subscription.deleted') status = 'canceled';
  if (event.type === 'checkout.session.completed') status = 'active';

  const periodEnd = object.current_period_end
    ? new Date(object.current_period_end * 1000).toISOString()
    : null;

  await env.DB.prepare(
    `INSERT INTO billing_state (id, stripe_customer_id, stripe_subscription_id, status,
                                current_period_end, last_event, updated_at)
     VALUES ('shop', ?1, ?2, ?3, ?4, ?5, ?6)
     ON CONFLICT(id) DO UPDATE SET
       stripe_customer_id     = COALESCE(excluded.stripe_customer_id, billing_state.stripe_customer_id),
       stripe_subscription_id = COALESCE(excluded.stripe_subscription_id, billing_state.stripe_subscription_id),
       status                 = COALESCE(excluded.status, billing_state.status),
       current_period_end     = COALESCE(excluded.current_period_end, billing_state.current_period_end),
       last_event             = excluded.last_event,
       updated_at             = excluded.updated_at`
  ).bind(customerId, subscriptionId, status, periodEnd, event.type, new Date().toISOString()).run();

  return json({ received: true });
}
