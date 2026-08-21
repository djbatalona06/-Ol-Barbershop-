-- The Ol' Barbershop — seed data
-- Mirrors the in-browser seed in index.html. Load after schema.sql.
--
-- IMPORTANT: every value here was recovered from public business listings
-- (Yelp, Yahoo Local, GlossGenius, BestProsInTown), not from the shop.
-- Prices were never publicly listed, so services carry needs_review = 1 and
-- placeholder amounts. Confirm all of it with Katherine before going live.

BEGIN;

-- Roster. Katherine only; more barbers are added from the admin panel.
INSERT INTO staff (id, display_name, title, bio, avatar_url, accent_color, sort_order, active)
VALUES ('staff-kat', 'Katherine Baldwin', 'Owner & Barber',
  'Twenty-five years behind the chair in Snohomish County. Opened The Ol'' Barbershop in 2017 to bring modern styles at a price that stays fair. Classic cuts finished with a straight razor neck shave.',
  '', 'oklch(0.335 0.105 20)', 0, 1);

-- Weekly hours. weekday 0 = Sunday. Closed Sunday and Monday.
INSERT INTO schedule_rules (id, staff_id, weekday, start_time, end_time, active) VALUES
  ('rule-tue', 'staff-kat', 2, '10:00', '16:00', 1),
  ('rule-wed', 'staff-kat', 3, '10:00', '18:00', 1),
  ('rule-thu', 'staff-kat', 4, '10:00', '18:00', 1),
  ('rule-fri', 'staff-kat', 5, '10:00', '18:00', 1),
  ('rule-sat', 'staff-kat', 6, '10:00', '16:00', 1);

-- Service menu. price_cents are PLACEHOLDERS pending confirmation.
INSERT INTO services (id, name, category, description, price_cents, duration_min,
                      buffer_min, is_addon, deposit_cents, sort_order, needs_review, active) VALUES
  ('svc-cut',      'Haircut',                    'Cuts', 'Classic cut finished with a straight razor neck shave.', 3000, 30,  5, 0, 0,  0, 1, 1),
  ('svc-cutbeard', 'Haircut & Razor Beard Trim', 'Cuts', 'Cut plus a shaped beard line with the straight razor.',   4500, 45,  5, 0, 0,  1, 1, 1),
  ('svc-cutscalp', 'Haircut & Scalp Massage',    'Cuts', 'Cut with a hot towel and scalp massage to finish.',       4000, 45,  5, 0, 0,  2, 1, 1),
  ('svc-cutshave', 'Haircut & Shave',            'Cuts', 'Full cut and a traditional hot towel shave.',             5500, 60, 10, 0, 0,  3, 1, 1),
  ('svc-senior',   'Senior Haircut, 62 and over','Cuts', '',                                                        2500, 30,  5, 0, 0,  4, 1, 1),
  ('svc-kids',     'Kids'' Cut, 12 and under',   'Cuts', '',                                                        2500, 30,  5, 0, 0,  5, 1, 1),
  ('svc-military', 'Military Cut',               'Cuts', 'Discount applied with valid ID.',                         2500, 30,  5, 0, 0,  6, 1, 1),
  ('svc-beard',    'Beard Trim',        'Beard & Shave', '',                                                        2000, 20,  5, 0, 0,  7, 1, 1),
  ('svc-shave',    'Straight Razor Shave','Beard & Shave','Hot towel, lather and a straight razor.',                3500, 40, 10, 0, 0,  8, 1, 1),
  ('svc-neck',     'Neck Shave',        'Beard & Shave', '',                                                        1200, 15,  0, 1, 0,  9, 1, 1),
  ('svc-brow',     'Eyebrow Trim',      'Beard & Shave', '',                                                        1000, 10,  0, 1, 0, 10, 1, 1);

-- CRM pipeline. Cards advance automatically on appointment status changes;
-- 'stg-lost' is a side lane rather than a step in the sequence.
INSERT INTO pipeline_stages (id, name, sort_order, color, is_lane) VALUES
  ('stg-lead',    'New Lead',             0, 'oklch(0.640 0.110 68)',  0),
  ('stg-booked',  'Booked',               1, 'oklch(0.505 0.155 24)',  0),
  ('stg-confirm', 'Confirmed',            2, 'oklch(0.415 0.128 22)',  0),
  ('stg-done',    'Completed',            3, 'oklch(0.520 0.090 148)', 0),
  ('stg-follow',  'Follow-Up',            4, 'oklch(0.595 0.095 84)',  0),
  ('stg-repeat',  'Repeat Client',        5, 'oklch(0.335 0.105 20)',  0),
  ('stg-lapsed',  'Lapsed',               6, 'oklch(0.600 0.018 50)',  0),
  ('stg-lost',    'No-Show / Cancelled',  7, 'oklch(0.505 0.160 25)',  1);

COMMIT;

-- Shop facts, kept here as reference rather than as a table:
--   The Ol' Barbershop, 1520 112th St SW, Everett, WA 98204
--   (425) 207-6840  ·  opened 2017
--   Booking app in use: https://theolbarbershopkat.glossgenius.com/
--   Walk-ins welcome, military discount, wheelchair accessible, cards accepted
