/* Small response helpers. Every route answers JSON or nothing at all. */

export const json = (body, status = 200, headers = {}) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8',
               'cache-control': 'no-store', ...headers }
  });

export const fail = (status, message) => json({ error: message }, status);

/** Read a JSON body without letting a malformed one throw past the handler. */
export async function readJson(request, limit = 16 * 1024) {
  const text = await request.text();
  if (text.length > limit) throw new Error('body too large');
  try { return JSON.parse(text); } catch { throw new Error('body is not JSON'); }
}

/** Timing-safe compare for anything that gates access. */
export function safeEqual(a, b) {
  const x = new TextEncoder().encode(String(a));
  const y = new TextEncoder().encode(String(b));
  if (x.length !== y.length) return false;
  let diff = 0;
  for (let i = 0; i < x.length; i++) diff |= x[i] ^ y[i];
  return diff === 0;
}

export const b64urlEncode = bytes =>
  btoa(String.fromCharCode(...new Uint8Array(bytes)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function b64urlDecode(str) {
  const pad = str.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(pad + '='.repeat((4 - pad.length % 4) % 4));
  return Uint8Array.from(bin, c => c.charCodeAt(0));
}

export const b64urlToText = str => new TextDecoder().decode(b64urlDecode(str));
