/* Stripe over plain fetch.
 *
 * No SDK: this repo has no build step and no node_modules, and the two calls it
 * makes are a form post and a signature check. Adding a dependency tree to avoid
 * writing forty lines would be the more expensive choice. */
import { b64urlEncode, safeEqual } from './http.js';

const API = 'https://api.stripe.com/v1';

/** Stripe takes form-encoded bodies with bracketed keys, not JSON. */
export function encodeForm(obj, prefix = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') encodeForm(v, key, out);
    else out.append(key, String(v));
  }
  return out;
}

export async function stripe(env, path, body, method = 'POST') {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'content-type': 'application/x-www-form-urlencoded',
      'stripe-version': '2024-06-20'
    },
    body: body ? encodeForm(body).toString() : undefined
  });
  const data = await res.json();
  if (!res.ok) {
    const msg = (data && data.error && data.error.message) || `Stripe returned ${res.status}`;
    throw new Error(msg);
  }
  return data;
}

/**
 * Verify a webhook against the signing secret.
 *
 * Stripe signs `timestamp.rawBody`, so the raw text has to be checked, never a
 * re-serialised object — JSON.stringify does not round-trip byte for byte and the
 * signature would never match. The timestamp check is what makes a captured
 * request stop working rather than replaying forever.
 */
export async function verifyWebhook(rawBody, signatureHeader, secret, toleranceSeconds = 300) {
  if (!signatureHeader || !secret) return false;

  let timestamp = null;
  const offered = [];
  for (const part of signatureHeader.split(',')) {
    const [k, v] = part.trim().split('=');
    if (k === 't') timestamp = v;
    else if (k === 'v1') offered.push(v);
  }
  if (!timestamp || !offered.length) return false;

  const age = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(age) || age > toleranceSeconds) return false;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = await crypto.subtle.sign('HMAC', key,
    new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const hex = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');

  return offered.some(v => safeEqual(v, hex));
}

export { b64urlEncode };
