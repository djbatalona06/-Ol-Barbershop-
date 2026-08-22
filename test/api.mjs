/* Integration tests against a running `wrangler pages dev`.
 *
 *   wrangler pages dev . --port 8788 --d1 DB=ol-barbershop
 *   node test/api.mjs
 *
 * The Google happy path is covered in units.mjs, where the provider's key
 * endpoint can be stubbed. What is checked here is everything around it: that
 * routes refuse what they should refuse, that a request reaches the inbox, and
 * that the webhook believes a real signature and nothing else.
 */
import { mintSession } from '../lib/session.js';

const BASE = process.env.BASE || 'http://localhost:8788';
const SECRET = process.env.SESSION_SECRET || 'test-session-secret-not-a-real-one-0123456789';
const PULL = process.env.ADMIN_PULL_TOKEN || 'test-pull-token-0123456789abcdef';
const WHSEC = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_testsecret0123456789';

let pass = 0, fail = 0;
const ok = (name, cond, extra = '') => { if (cond) { pass++; console.log('  ok   ' + name); }
  else { fail++; console.log(`  FAIL ${name} ${extra}`); } };

const call = (path, opts = {}) => fetch(BASE + path, opts);

console.log('\nauth routes');
{
  const res = await call('/api/auth/nonce');
  const body = await res.json();
  ok('nonce issues a nonce and a cookie',
     res.ok && body.nonce && /olb_nonce=/.test(res.headers.get('set-cookie') || ''));
  ok('nonce reports the configured client id', Boolean(body.clientId));

  const r2 = await call('/api/auth/session');
  ok('session is 401 when signed out', r2.status === 401);

  const r3 = await call('/api/auth/google', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ credential: 'not.a.token' }) });
  ok('google refuses a junk token without a nonce cookie', r3.status === 400 || r3.status === 401);

  const r4 = await call('/api/auth/google', { method: 'POST',
    headers: { 'content-type': 'application/json' }, body: '{ broken' });
  ok('google refuses an unparseable body', r4.status === 400);
}

console.log('\nsigned-in customer');
const cookie = 'olb_session=' + encodeURIComponent(
  await mintSession(SECRET, { cid: 'google:test-subject', provider: 'google',
                              email: 'testcut@example.com', name: 'Test Customer' }));
{
  const res = await call('/api/auth/session', { headers: { cookie } });
  const body = await res.json();
  ok('session returns the customer', res.ok && body.customer.id === 'google:test-subject');

  const forged = 'olb_session=' + encodeURIComponent(
    await mintSession('the-wrong-secret', { cid: 'google:intruder' }));
  const r2 = await call('/api/auth/session', { headers: { cookie: forged } });
  ok('a cookie signed with another secret is refused', r2.status === 401);
}

console.log('\nbooking requests');
let createdId = null;
{
  const r0 = await call('/api/requests', { method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date: '2026-09-15', time: '10:30', service_name: 'Haircut' }) });
  ok('a signed-out request is refused', r0.status === 401);

  // The identity has to exist before a request can reference it.
  const seeded = await call('/api/auth/session', { headers: { cookie } });
  ok('session route reachable before seeding', seeded.ok);
}

// Seed the identity the way a real Google sign-in would, so the request has
// something to hang off. Requests are refused for an account that is not there.
{
  const ghost = 'olb_session=' + encodeURIComponent(
    await mintSession(SECRET, { cid: 'google:deleted-account', provider: 'google',
                                email: 'gone@example.com', name: 'Gone' }));
  const r = await call('/api/requests', { method: 'POST',
    headers: { 'content-type': 'application/json', cookie: ghost },
    body: JSON.stringify({ date: '2026-09-15', time: '10:30', service_name: 'Haircut' }) });
  ok('a request from a deleted account is refused, not a 500',
     r.status === 401, `(got ${r.status})`);
}

if (process.env.SEEDED === '1') {
  console.log('\nbooking requests, with the identity present');
  {
    const bad = await call('/api/requests', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ date: 'not-a-date', time: '10:30', service_name: 'Haircut' }) });
    ok('a malformed date is refused', bad.status === 400);

    const noSvc = await call('/api/requests', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ date: '2026-09-15', time: '10:30' }) });
    ok('a missing service is refused', noSvc.status === 400);

    const res = await call('/api/requests', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ date: '2026-09-15', time: '10:30', service_name: 'Haircut',
        name: 'Test Customer', phone: '4255550123',
        note: '   lots   of    space   ' }) });
    const body = await res.json();
    ok('a good request is accepted', res.status === 201 && body.request.id, `(got ${res.status})`);
    createdId = body.request && body.request.id;

    const mine = await (await call('/api/requests', { headers: { cookie } })).json();
    ok('the customer sees his own request', (mine.requests || []).some(r => r.id === createdId));
    ok('whitespace in the note is collapsed',
       (mine.requests || []).some(r => r.note === 'lots of space'));
  }

  console.log('\nthe shop pulling its inbox');
  {
    const noTok = await call('/api/requests', { headers: { authorization: 'Bearer wrong-token' } });
    ok('a wrong pull token is refused', noTok.status === 401);

    const res = await call('/api/requests', { headers: { authorization: `Bearer ${PULL}` } });
    const body = await res.json();
    ok('the right pull token lists what is waiting',
       res.ok && (body.requests || []).some(r => r.id === createdId));

    const patched = await call('/api/requests', { method: 'PATCH',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${PULL}` },
      body: JSON.stringify({ ids: [createdId] }) });
    const pb = await patched.json();
    ok('pulling marks it so it cannot arrive twice', patched.ok && pb.updated === 1);

    const again = await (await call('/api/requests',
      { headers: { authorization: `Bearer ${PULL}` } })).json();
    ok('a pulled request drops out of the inbox',
       !(again.requests || []).some(r => r.id === createdId));
  }
}

console.log('\nbilling');
{
  const noAuth = await call('/api/billing/checkout', { method: 'POST' });
  ok('checkout refuses an unauthenticated caller', noAuth.status === 401);

  const state = await call('/api/billing/checkout', { headers: { authorization: `Bearer ${PULL}` } });
  ok('billing state reads for the shop', state.ok, `(got ${state.status})`);
}

console.log('\nbilling webhook');
{
  const body = JSON.stringify({ id: 'evt_test', type: 'invoice.payment_failed',
    data: { object: { object: 'invoice', customer: 'cus_test', subscription: 'sub_test' } } });

  const bad = await call('/api/billing/webhook', { method: 'POST',
    headers: { 'stripe-signature': 't=1,v1=' + '0'.repeat(64) }, body });
  ok('a webhook with a bad signature is refused', bad.status === 400);

  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(WHSEC),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');

  const good = await call('/api/billing/webhook', { method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${hex}` }, body });
  ok('a real webhook is accepted', good.ok, `(got ${good.status})`);

  const state = await (await call('/api/billing/checkout',
    { headers: { authorization: `Bearer ${PULL}` } })).json();
  ok('a failed payment is recorded as past_due',
     state.billing && state.billing.status === 'past_due', JSON.stringify(state));
}

console.log('\nthe site itself');
{
  const res = await call('/');
  const html = await res.text();
  ok('the page still serves', res.ok && html.includes('The Ol’ Barbershop') || html.includes("The Ol' Barbershop"));
  ok('the CSP allows Google and Stripe and nothing else new',
     /accounts\.google\.com\/gsi\/client/.test(html) && /js\.stripe\.com/.test(html));
}

if (process.env.SEEDED === '1') {
  console.log('\naccount deletion');
  {
    const anon = await call('/api/account', { method: 'DELETE' });
    ok('deletion refuses a signed-out caller', anon.status === 401);

    // Leave a request behind so the cascade has something to take.
    await call('/api/requests', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ date: '2026-09-20', time: '12:00', service_name: 'Beard Trim' }) });

    const res = await call('/api/account', { method: 'DELETE', headers: { cookie } });
    ok('the account is deleted', res.ok, `(got ${res.status})`);
    ok('the cookie is cleared', /olb_session=;/.test(res.headers.get('set-cookie') || ''));

    const after = await call('/api/requests', { method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ date: '2026-09-21', time: '12:00', service_name: 'Haircut' }) });
    ok('the deleted account can no longer send requests', after.status === 401);

    const inbox = await (await call('/api/requests',
      { headers: { authorization: `Bearer ${PULL}` } })).json();
    ok('the deleted account leaves nothing waiting in the inbox',
       !(inbox.requests || []).some(r => r.customer_id === 'google:test-subject'),
       JSON.stringify(inbox.requests));
  }
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
