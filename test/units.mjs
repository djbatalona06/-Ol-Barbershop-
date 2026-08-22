/* Unit tests for the parts that must not be wrong: token verification, session
 * signing, and webhook signatures. Run with: node test/units.mjs
 *
 * These stub the provider's key endpoint rather than reaching Google, so the
 * failure cases can actually be produced. A test that only ever sees a valid
 * token proves nothing about the ones that matter.
 */
import { verifyIdToken } from '../lib/idtoken.js';
import { mintSession, readSession } from '../lib/session.js';
import { verifyWebhook } from '../lib/stripe.js';
import { safeEqual } from '../lib/http.js';

let pass = 0, fail = 0;
const ok = (name, cond) => { if (cond) { pass++; console.log('  ok   ' + name); }
                             else { fail++; console.log('  FAIL ' + name); } };
async function rejects(name, fn, match) {
  try { await fn(); fail++; console.log(`  FAIL ${name} (it was accepted)`); }
  catch (e) {
    const good = !match || new RegExp(match, 'i').test(e.message);
    if (good) { pass++; console.log(`  ok   ${name}  [${e.message}]`); }
    else { fail++; console.log(`  FAIL ${name} (wrong reason: ${e.message})`); }
  }
}

const b64url = buf => Buffer.from(buf).toString('base64url');
const CLIENT = 'test-client-id.apps.googleusercontent.com';

const { publicKey, privateKey } = await crypto.subtle.generateKey(
  { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048,
    publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
const jwk = { ...await crypto.subtle.exportKey('jwk', publicKey), kid: 'test-kid', use: 'sig', alg: 'RS256' };
delete jwk.key_ops; delete jwk.ext;

async function makeToken(claims, { kid = 'test-kid', tamper = false } = {}) {
  const header = b64url(JSON.stringify({ alg: 'RS256', kid, typ: 'JWT' }));
  const payload = b64url(JSON.stringify(claims));
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey,
    new TextEncoder().encode(`${header}.${payload}`));
  let s = b64url(sig);
  if (tamper) s = s.slice(0, -2) + (s.endsWith('AA') ? 'BB' : 'AA');
  return `${header}.${payload}.${s}`;
}

// Stub the key endpoint. Nothing here reaches the network.
globalThis.fetch = async url => new Response(JSON.stringify({ keys: [jwk] }), {
  status: 200, headers: { 'content-type': 'application/json', 'cache-control': 'max-age=3600' } });

const now = () => Math.floor(Date.now() / 1000);
const base = extra => ({ iss: 'https://accounts.google.com', aud: CLIENT, sub: '1122334455',
  email: 'katherine@example.com', email_verified: true, name: 'Katherine Baldwin',
  iat: now(), exp: now() + 3600, nonce: 'abc123', ...extra });
const env = { GOOGLE_CLIENT_ID: CLIENT };

console.log('\nverifyIdToken');
{
  const p = await verifyIdToken('google', await makeToken(base()), env, { nonce: 'abc123' });
  ok('a good token yields the profile', p.sub === '1122334455' && p.email === 'katherine@example.com');
}
await rejects('a tampered signature', async () =>
  verifyIdToken('google', await makeToken(base(), { tamper: true }), env, { nonce: 'abc123' }), 'signature');
await rejects('a token for another app', async () =>
  verifyIdToken('google', await makeToken(base({ aud: 'someone-else' })), env, { nonce: 'abc123' }), 'different application');
await rejects('a token from another issuer', async () =>
  verifyIdToken('google', await makeToken(base({ iss: 'https://evil.example' })), env, { nonce: 'abc123' }), 'wrong issuer');
await rejects('an expired token', async () =>
  verifyIdToken('google', await makeToken(base({ exp: now() - 3600 })), env, { nonce: 'abc123' }), 'expired');
await rejects('a replayed token from another sign-in', async () =>
  verifyIdToken('google', await makeToken(base()), env, { nonce: 'a-different-nonce' }), 'does not match');
await rejects('a token signed with an unpublished key', async () =>
  verifyIdToken('google', await makeToken(base(), { kid: 'not-published' }), env, { nonce: 'abc123' }), 'does not publish');
await rejects('a token that is not a token', async () =>
  verifyIdToken('google', 'nonsense', env), 'malformed');
await rejects('an unknown provider', async () =>
  verifyIdToken('apple', await makeToken(base()), env), 'unknown sign-in provider');
{
  // alg:none is the classic JWT hole. It must not be reachable.
  const header = b64url(JSON.stringify({ alg: 'none', kid: 'test-kid' }));
  const payload = b64url(JSON.stringify(base()));
  await rejects('alg:none', async () =>
    verifyIdToken('google', `${header}.${payload}.`, env, { nonce: 'abc123' }), 'unsupported');
}

console.log('\nsession cookies');
{
  const secret = 'a-long-test-secret-0123456789';
  const c = await mintSession(secret, { cid: 'google:123', email: 'a@b.co' });
  ok('round-trips', (await readSession(secret, c)).cid === 'google:123');
  ok('rejects a different secret', (await readSession('another-secret', c)) === null);
  ok('rejects a flipped payload byte',
     (await readSession(secret, 'X' + c.slice(1))) === null);
  ok('rejects a stripped signature', (await readSession(secret, c.split('.')[0])) === null);
  ok('rejects nothing at all', (await readSession(secret, '')) === null);
  const expired = await mintSession(secret, { cid: 'x' }, -10);
  ok('rejects an expired cookie', (await readSession(secret, expired)) === null);
}

console.log('\nstripe webhook signatures');
{
  const secret = 'whsec_test';
  const body = JSON.stringify({ id: 'evt_1', type: 'invoice.paid' });
  const t = Math.floor(Date.now() / 1000);
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${body}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');

  ok('accepts a real signature', await verifyWebhook(body, `t=${t},v1=${hex}`, secret));
  ok('rejects a wrong signature', !await verifyWebhook(body, `t=${t},v1=${'0'.repeat(64)}`, secret));
  ok('rejects a replay from an hour ago', !await verifyWebhook(body, `t=${t - 3600},v1=${hex}`, secret));
  ok('rejects a changed body', !await verifyWebhook(body + ' ', `t=${t},v1=${hex}`, secret));
  ok('rejects a missing header', !await verifyWebhook(body, null, secret));
}

console.log('\nsafeEqual');
ok('equal strings', safeEqual('abc', 'abc'));
ok('different strings', !safeEqual('abc', 'abd'));
ok('different lengths', !safeEqual('abc', 'abcd'));

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
