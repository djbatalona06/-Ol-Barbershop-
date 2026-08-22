/* Booking requests from signed-in customers.
 *
 * A request is still only a request. Katherine confirms it herself, exactly as she
 * would a phone call, and nothing here tells a customer he has an appointment.
 * That is a design principle in PRODUCT.md before it is a legal one: claiming a
 * booking the shop has not confirmed is exposure under Washington's Consumer
 * Protection Act.
 *
 * Her vault stays the system of record. This table is an inbox she empties. */
import { json, fail, readJson, safeEqual } from '../../lib/http.js';
import { currentCustomer } from '../../lib/session.js';

const MAX_NOTE = 500;

/* Free text is the one field that can carry something the shop should not hold.
   Washington's My Health My Data Act reaches notes like "sensitive scalp", so the
   form asks people to leave health details out and this trims what arrives anyway. */
const clean = (v, max) => String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max);

export async function onRequestPost({ request, env }) {
  const claims = await currentCustomer(request, env);
  if (!claims) return fail(401, 'Please sign in before sending a request.');

  let body;
  try { body = await readJson(request); }
  catch { return fail(400, 'That request did not arrive in a form we could read.'); }

  const date = clean(body.date, 10);
  const time = clean(body.time, 5);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return fail(400, 'Pick a date first.');
  if (!/^\d{2}:\d{2}$/.test(time)) return fail(400, 'Pick a time first.');

  const service = clean(body.service_name, 80);
  if (!service) return fail(400, 'Pick a service first.');

  // A cookie can outlive the account it names — someone asks for their data to be
  // deleted and keeps the tab open. Without this the insert trips a foreign key and
  // the customer gets a 500 telling him nothing. Check first, and say what to do.
  const identity = await env.DB.prepare(
    `SELECT id FROM customer_identities WHERE id = ?1`).bind(claims.cid).first();
  if (!identity) return fail(401, 'That account is no longer active. Please sign in again.');

  const row = {
    id: crypto.randomUUID(),
    customer_id: claims.cid,
    name: clean(body.name || claims.name, 80),
    phone: clean(body.phone, 20),
    email: clean(body.email || claims.email, 120),
    service_id: clean(body.service_id, 40),
    service_name: service,
    requested_date: date,
    requested_time: time,
    note: clean(body.note, MAX_NOTE),
    status: 'pending',
    created_at: new Date().toISOString()
  };

  await env.DB.prepare(
    `INSERT INTO booking_requests
       (id, customer_id, name, phone, email, service_id, service_name,
        requested_date, requested_time, note, status, created_at)
     VALUES (?1,?2,?3,?4,?5,?6,?7,?8,?9,?10,?11,?12)`
  ).bind(row.id, row.customer_id, row.name, row.phone, row.email, row.service_id,
         row.service_name, row.requested_date, row.requested_time, row.note,
         row.status, row.created_at).run();

  return json({ request: { id: row.id, status: row.status } }, 201);
}

/* Katherine pulling her inbox.
 *
 * There is no admin account on the server to check against, because her passphrase
 * has never left her device and adding a server-side one would undo that. Instead
 * DJ sets a pull token once; it lives inside her encrypted vault and travels as a
 * bearer header. Rotating the env var revokes it. */
export async function onRequestGet({ request, env }) {
  const offered = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');

  // Katherine, with the pull token: everything still waiting.
  if (offered) {
    if (!env.ADMIN_PULL_TOKEN || !safeEqual(offered, env.ADMIN_PULL_TOKEN)) {
      return fail(401, 'Not authorised.');
    }
    const { results } = await env.DB.prepare(
      `SELECT * FROM booking_requests WHERE status = 'pending' ORDER BY created_at ASC LIMIT 200`
    ).all();
    return json({ requests: results || [] });
  }

  // A customer, with a session cookie: only ever his own.
  const claims = await currentCustomer(request, env);
  if (!claims) return fail(401, 'Not authorised.');

  const { results } = await env.DB.prepare(
    `SELECT id, service_name, requested_date, requested_time, note, status, created_at
       FROM booking_requests WHERE customer_id = ?1 ORDER BY created_at DESC LIMIT 50`
  ).bind(claims.cid).all();

  return json({ requests: results || [] });
}

/* Mark requests pulled, so the same one is not imported into the book twice. */
export async function onRequestPatch({ request, env }) {
  const offered = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!env.ADMIN_PULL_TOKEN || !offered || !safeEqual(offered, env.ADMIN_PULL_TOKEN)) {
    return fail(401, 'Not authorised.');
  }

  let body;
  try { body = await readJson(request); }
  catch { return fail(400, 'That request did not arrive in a form we could read.'); }

  const ids = Array.isArray(body.ids) ? body.ids.filter(x => typeof x === 'string').slice(0, 200) : [];
  if (!ids.length) return json({ updated: 0 });

  const marks = ids.map((_, i) => `?${i + 2}`).join(',');
  const res = await env.DB.prepare(
    `UPDATE booking_requests SET status = 'pulled', pulled_at = ?1 WHERE id IN (${marks}) AND status = 'pending'`
  ).bind(new Date().toISOString(), ...ids).run();

  return json({ updated: res.meta ? res.meta.changes : 0 });
}
