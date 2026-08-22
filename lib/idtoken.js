/* Verify a sign-in provider's ID token.
 *
 * Written as a table of providers rather than a Google-specific function, so
 * adding Sign in with Apple later is one more entry plus its token-exchange step,
 * not a refactor. Apple is deliberately absent: its client secret is an ES256 JWT
 * signed with a private key from a paid developer account, so it cannot ship until
 * that account exists.
 *
 * No JWT library. A verifier small enough to read is worth more here than one that
 * handles algorithms this code will never accept.
 */
import { b64urlDecode, b64urlToText } from './http.js';

const PROVIDERS = {
  google: {
    jwks: 'https://www.googleapis.com/oauth2/v3/certs',
    issuers: ['https://accounts.google.com', 'accounts.google.com'],
    clientIdEnv: 'GOOGLE_CLIENT_ID'
  }
};

/* Signing keys rotate, so they are cached but never pinned. The Cache API keeps
   them across requests on a colder isolate; the module-level map covers the warm one. */
const memo = new Map();

async function fetchJwks(url) {
  const hit = memo.get(url);
  if (hit && hit.until > Date.now()) return hit.keys;

  const res = await fetch(url, { cf: { cacheTtl: 3600, cacheEverything: true } });
  if (!res.ok) throw new Error(`could not reach the sign-in provider (${res.status})`);
  const { keys } = await res.json();
  if (!Array.isArray(keys) || !keys.length) throw new Error('provider returned no signing keys');

  // Honour the provider's own cache lifetime, floored so a bad header cannot
  // turn every sign-in into a fetch.
  const cc = res.headers.get('cache-control') || '';
  const maxAge = Number((cc.match(/max-age=(\d+)/) || [])[1] || 0);
  memo.set(url, { keys, until: Date.now() + Math.max(300, Math.min(maxAge, 86400)) * 1000 });
  return keys;
}

const ALGS = {
  RS256: { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
  ES256: { name: 'ECDSA', namedCurve: 'P-256', hash: 'SHA-256' }
};

/**
 * @returns {Promise<{sub:string,email:string,emailVerified:boolean,name:string,picture:string}>}
 * @throws if anything about the token fails to check out.
 */
export async function verifyIdToken(provider, token, env, { nonce } = {}) {
  const spec = PROVIDERS[provider];
  if (!spec) throw new Error(`unknown sign-in provider: ${provider}`);

  const clientId = env[spec.clientIdEnv];
  if (!clientId) throw new Error(`${spec.clientIdEnv} is not configured`);

  const parts = String(token || '').split('.');
  if (parts.length !== 3) throw new Error('malformed token');
  const [rawHeader, rawPayload, rawSig] = parts;

  let header, claims;
  try {
    header = JSON.parse(b64urlToText(rawHeader));
    claims = JSON.parse(b64urlToText(rawPayload));
  } catch { throw new Error('malformed token'); }

  const alg = ALGS[header.alg];
  if (!alg) throw new Error(`unsupported signature algorithm: ${header.alg}`);

  const jwk = (await fetchJwks(spec.jwks)).find(k => k.kid === header.kid);
  if (!jwk) throw new Error('token was signed with a key the provider does not publish');

  const key = await crypto.subtle.importKey('jwk', jwk, alg, false, ['verify']);
  const ok = await crypto.subtle.verify(
    alg.name === 'ECDSA' ? { name: 'ECDSA', hash: 'SHA-256' } : alg.name,
    key,
    b64urlDecode(rawSig),
    new TextEncoder().encode(`${rawHeader}.${rawPayload}`));
  if (!ok) throw new Error('signature does not verify');

  // Signature checked. Now the claims, which is where replay actually gets stopped.
  const now = Math.floor(Date.now() / 1000);
  const skew = 60;
  if (!spec.issuers.includes(claims.iss)) throw new Error('token came from the wrong issuer');
  if (claims.aud !== clientId) throw new Error('token was issued for a different application');
  if (typeof claims.exp !== 'number' || claims.exp + skew < now) throw new Error('token has expired');
  if (typeof claims.iat === 'number' && claims.iat - skew > now) throw new Error('token is not valid yet');
  if (!claims.sub) throw new Error('token carries no subject');
  if (nonce !== undefined && claims.nonce !== nonce) throw new Error('token does not match this sign-in attempt');

  return {
    sub: String(claims.sub),
    email: claims.email ? String(claims.email) : '',
    emailVerified: claims.email_verified === true,
    name: claims.name ? String(claims.name) : '',
    picture: claims.picture ? String(claims.picture) : ''
  };
}

export { PROVIDERS };
