/* Start Katherine's subscription.
 *
 * One Checkout Session covers both halves of the deal: the $50 monthly price as
 * the subscription, and the $100 setup fee added to the first invoice only. She is
 * charged $150 once and $50 a month after that.
 *
 * Stripe hosts the card form, so no card number ever reaches this site. That keeps
 * it at PCI SAQ A, which is the whole reason not to build a card field here.
 *
 * This bills the shop for the website. It has nothing to do with haircuts —
 * GlossGenius already takes those payments, and a second merchant account would
 * split her payouts and give her two sets of books to reconcile. */
import { json, fail, safeEqual } from '../../../lib/http.js';
import { stripe } from '../../../lib/stripe.js';

export async function onRequestPost({ request, env }) {
  const offered = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_PULL_TOKEN || !offered || !safeEqual(offered, env.ADMIN_PULL_TOKEN)) {
    return fail(401, 'Not authorised.');
  }
  if (!env.STRIPE_SECRET_KEY || !env.STRIPE_PRICE_MONTHLY) {
    return fail(503, 'Billing is not set up on this site yet.');
  }

  const origin = new URL(request.url).origin;

  const params = {
    mode: 'subscription',
    line_items: { 0: { price: env.STRIPE_PRICE_MONTHLY, quantity: 1 } },
    success_url: `${origin}/billing?started=1`,
    cancel_url: `${origin}/billing`,
    client_reference_id: 'the-ol-barbershop',
    subscription_data: { metadata: { shop: 'the-ol-barbershop' } },
    allow_promotion_codes: false
  };

  // The setup fee rides on the first invoice, so there is one card entry, not two.
  if (env.STRIPE_PRICE_SETUP) {
    params.subscription_data.add_invoice_items = { 0: { price: env.STRIPE_PRICE_SETUP, quantity: 1 } };
  }

  try {
    const session = await stripe(env, '/checkout/sessions', params);
    return json({ url: session.url });
  } catch (err) {
    console.error('stripe checkout failed:', err.message);
    return fail(502, 'Stripe would not start the checkout. Try again in a minute.');
  }
}

/** What the billing page shows: plan state, read from what the webhook recorded. */
export async function onRequestGet({ request, env }) {
  const offered = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_PULL_TOKEN || !offered || !safeEqual(offered, env.ADMIN_PULL_TOKEN)) {
    return fail(401, 'Not authorised.');
  }
  const row = await env.DB.prepare(
    `SELECT status, current_period_end, updated_at FROM billing_state WHERE id = 'shop'`
  ).first();
  return json({ billing: row || { status: 'none', current_period_end: null, updated_at: null } });
}
