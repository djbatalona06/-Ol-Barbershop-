# The Ol' Barbershop

At your service in Everett, WA.

The whole website is one file, `index.html`. No build step, no framework, no
server. Open it, or put it on a host, and it works.

The public side shows the shop, the price list, and a calendar that only offers
dates Katherine is actually free. Behind a login there's a client list shaped the
way GlossGenius shapes one, a pipeline board, and a query box for asking the
records questions. Katherine and DJ each get their own login, and the records sit
encrypted on the device. Customers who make an account keep it in their own
browser rather than on a server somewhere.

It also carries the privacy pages, the Washington compliance notes, and enough
accessibility work to meet WCAG 2.2 AA.

---

## Opening the site on your computer

Double-clicking the file won't work right. The login screens need the page to come
from a real web address, and a file opened off your desktop doesn't have one. So
run a small web server instead.

Open a terminal in the project folder and type:

```bash
cd -Ol-Barbershop-
python3 -m http.server 8000
```

Then go to <http://localhost:8000> in your browser. When you're done, click back
into the terminal and press Ctrl+C to stop it.

---

## Setting up with Katherine

Five steps, in order. Give it twenty minutes.

### 1. Make the two accounts

Click Shop Admin. The first time, it walks you through creating two logins.

| Account | Who | What they can do |
|---|---|---|
| Owner | Katherine | Everything, including resetting DJ's login |
| Manager | DJ | Everything except resetting Katherine's |

Each passphrase needs 12 characters or more, with a capital letter, a small
letter and a number. The two have to be different from each other.

There's no "forgot my passphrase" link, because there's no company holding the
account to reset it. Once both logins exist, the site shows a recovery code one
time only. Print it or write it on paper and leave it somewhere in the shop. If
both passphrases and that code are gone, nobody can open the records again.

### 2. Put in the real prices

Open the Services tab. Every price has a "confirm" tag on it, because those
numbers came off public listings rather than from Katherine. Until she types a
real one, the menu on the website shows the word "ask" instead of a number.
Typing a price clears the tag.

That's on purpose. In Washington, advertising a price you won't honour counts as
a deceptive practice, so the site says nothing rather than the wrong thing.

### 3. Check the hours

The Schedule tab starts out closed Sunday and Monday, 10 to 4 on Tuesday and
Saturday, 10 to 6 Wednesday through Friday. Fix whatever's wrong. What's saved
here is exactly what customers can book, so read it twice.

For one day off, a holiday, or an early close, use "Days off and changes" further
down the page instead of editing the weekly hours.

Two other things need a straight answer from Katherine while you have her:

- **Is she the only barber?** The roster seeds her alone. At least one directory
  lists the shop as having several independent contractors. If that's right, add
  them in the Barbers tab — each one gets their own hours and their own calendar.
- **What email should the shop use?** `hello@theolbarbershop.com` in the file is a
  placeholder nobody registered. Booking requests fall back to it, so mail sent
  there today goes nowhere. Either register it or use hers.

The name, address, phone, coordinates and hours are already confirmed against the
Google listing and don't need checking. The map links, the page and the structured
data all read from those same constants, so there's only one place to correct if
anything ever moves.

### 4. Move her clients over

In GlossGenius, export the client list as a spreadsheet file. The button says CSV.
Back on the site, open Import / Export and drop that file in.

The screen works out which column is which, then shows you a preview: who's new,
who already exists, and which rows it skipped and why. Read it before you agree.
Nothing gets written until you click the import button.

### 5. Take a backup

Same tab, the button marked "Full backup as JSON". Do it once setup is done, then
every few weeks. It puts everything back exactly as it was.

### 6. Turn on the website inbox

Only if the site is on Cloudflare with the steps under "Putting it online" done.

Open the Requests tab and paste the pull code. That is what lets her iPad ask the
website whether anyone has asked for a time. Press "Check for requests" and she
sees them; "Add to the book" copies one across as *requested*, not confirmed, and
she rings them back the way she always has.

The Billing tab is the other half: $100 once, $50 a month, cancel any month. Set it
up there and the card details are entered on Stripe's pages, never on this site. If
a payment ever fails the tab says so and nothing else happens — the website does not
go dark over a late invoice, and it is worth telling her that in those words.

---

## Putting it online

**Cloudflare Pages.** Not GitHub Pages, and not because of a preference. Two things
rule it out now:

- The sign-in and billing routes under `functions/` are server code. GitHub Pages
  serves files and nothing else, so on Pages they simply would not exist.
- GitHub's terms bar "your online business, e-commerce site, or any other website
  that is primarily directed at either facilitating commercial transactions." The
  earlier version of this file argued the site was a brochure and took no money.
  It has a payment button now, so that argument is spent.

Avoid Vercel's free Hobby plan: it bans commercial use outright and they suspend
accounts over it. Vercel Pro is fine and `vercel.json` is already written for it,
but the functions are written for Cloudflare.

### 1. Create the project

1. Sign in at <https://dash.cloudflare.com> and open Workers & Pages
2. Create, then Pages, then Connect to Git, and pick this repository
3. Framework preset: None. Build command: leave empty. Output directory: `/`
4. Save and Deploy

### 2. Create the database

```bash
npx wrangler d1 create ol-barbershop
npx wrangler d1 execute ol-barbershop --remote --file sql/server.sql
```

Then **bind it in the dashboard**, which is the step that actually matters and the
one that looks optional: Pages project, Settings, Bindings, add a D1 binding with
variable name `DB` pointing at `ol-barbershop`. Do it for Production and Preview
both.

Editing `wrangler.toml` does not do this. A Pages project takes its binding from
the dashboard, and `wrangler pages dev` ignores the `[[d1_databases]]` block
entirely. Miss it and `env.DB` is undefined; the routes now answer "The booking
service is not finished being set up" rather than throwing, so if you see that
message this is why.

This database holds customer sign-ins, the requests they send, and the state of the
shop's own subscription. It does not hold Katherine's book. That stays encrypted on
her iPad, which is the point.

### 3. Set the secrets

In the Pages project, Settings, then Environment variables. None of these belong in
the repository.

| Name | What it is |
|---|---|
| `GOOGLE_CLIENT_ID` | OAuth client id, from step 4 |
| `SESSION_SECRET` | A long random string. Changing it signs every customer out. |
| `ADMIN_PULL_TOKEN` | A long random string. Katherine pastes this into admin once. |
| `STRIPE_SECRET_KEY` | `sk_live_…` (`sk_test_…` while you are testing) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…`, from step 5 |
| `STRIPE_PRICE_MONTHLY` | The $50/month recurring price id |
| `STRIPE_PRICE_SETUP` | The $100 one-time price id |

Generate the two random ones with `openssl rand -base64 32`.

### 4. Google sign-in

At <https://console.cloud.google.com/apis/credentials>, create an OAuth client id of
type Web application. Add the site's address as an authorised JavaScript origin —
the `*.pages.dev` one and the real domain if there is one. Paste the client id into
`GOOGLE_CLIENT_ID`.

Sign in with Apple is not here. It needs a paid Apple Developer membership and a
client secret that is a JWT signed with an Apple private key, so it cannot ship
without that account. `lib/idtoken.js` is written as a table of providers so adding
it later is one entry plus the key, not a rewrite.

### 5. Stripe

Two prices in the Stripe dashboard: a $50/month recurring one and a $100 one-time
one. Then a webhook endpoint pointing at `https://your-site/api/billing/webhook`,
subscribed to `checkout.session.completed`, `customer.subscription.*`,
`invoice.paid` and `invoice.payment_failed`. Copy its signing secret into
`STRIPE_WEBHOOK_SECRET`.

This bills the shop for the website. It has nothing to do with haircuts —
GlossGenius already takes those payments, and a second card processor would split
Katherine's payouts and leave her two sets of books at tax time.

Card details are entered on Stripe's own pages and never touch this site, which
keeps it at PCI SAQ A.

### 6. Give Katherine the pull code

Whatever you set as `ADMIN_PULL_TOKEN`. She pastes it once into admin, Requests tab.
It is stored inside her encrypted records rather than in the page, and it is what
lets her iPad ask the site for waiting requests. Rotating the variable revokes it.

### Running it locally

```bash
npx wrangler pages dev . --d1 DB=ol-barbershop
npx wrangler d1 execute ol-barbershop --local --file sql/server.sql
```

`--d1` is not optional, for the reason above. It also has to name the same value as
`database_id` in `wrangler.toml`, which is why that is set to `ol-barbershop`
rather than a UUID: the two commands otherwise write to two different local SQLite
files, the schema appears to apply, and every query fails with `no such table`.

Put the same variables in a `.dev.vars` file, which is git-ignored; the CI copy in
`.github/workflows/ci.dev.vars` shows the shape and contains only placeholders.

`python3 -m http.server` still works for everything except the sign-in and billing
routes; the page detects their absence and falls back to on-device accounts.

### Tests

```bash
node test/units.mjs                 # token, session and webhook verification
SEEDED=1 node test/api.mjs          # the routes, against a running wrangler
```

Both run on every push and pull request from `.github/workflows/test.yml`, which
starts a real worker and a real local database rather than mocking either.

---

## What this does not do

Worth being straight about, because it changes how the shop uses it.

**Booking sends a request, not a confirmation.** This is now a choice rather than a
limitation. A customer signed in with Google can send his request straight to the
shop, and it waits in the Requests tab until Katherine pulls it in. It is still a
request: nothing confirms a chair until she says so, because the site cannot know
whether she is running twenty minutes behind. Everyone else still hands off to a
text message, an email, a phone call, or GlossGenius. The site says all of this
plainly rather than implying a chair is held.

**The admin login is a gate, not a wall.** On a public web address, anyone can
read the page source and skip a JavaScript login screen. What actually protects
the records is that they are AES-GCM encrypted, so getting past the login screen
yields scrambled bytes. Two further things follow from that, both deliberate:

- No customer names or numbers are in the public half of the browser storage. The
  calendar works from time blocks that carry no identity.
- Passphrase accounts live in each customer's own browser and never reach the shop.
  Google sign-ins do reach the shop's database, and hold only a name, an email
  address and the requests that person sent. The Privacy Policy says so plainly.

**Katherine's own data still lives per browser.** Her iPad and the shop laptop hold
separate copies of the book. Move data between them with backup and restore. This
did not change when the server arrived, and it was not an oversight: her client
list is the most sensitive thing here, and keeping it encrypted on her own device
means no outage, no breach and no unpaid invoice can put it out of her reach.
`sql/schema.sql` is written to support syncing it later without a redesign.

---

## Before it goes live

- [ ] Have a Washington attorney read the Privacy Policy, Terms and Accessibility
      pages. Every clause needing a decision is marked **LAWYER REVIEW**.
- [ ] Confirm whether Katherine is the only barber, and what email the shop should
      use. Everything else — name, address, phone, coordinates, hours — is confirmed
      against the Google listing and three directories.
- [ ] Check the Privacy Policy describes the Google sign-in accurately once the
      Google project exists, and that processor terms with Cloudflare and Stripe
      are accepted.
- [ ] Set every price.
- [ ] Decide whether a late cancellation or no-show fee applies. If it does, it
      has to appear in the Terms and before booking, not after.
- [ ] Run an accessibility check against the live address.

---

## Files

```
.github/workflows/test.yml   runs both suites on every push and pull request
index.html        the whole page: markup, styles, application, security policy
functions/        the server routes, run by Cloudflare Pages
  api/auth/       nonce, Google token exchange, session
  api/requests.js the booking inbox, both ends of it
  api/account.js  deleting a sign-in account and everything attached
  api/billing/    the shop's subscription and Stripe's webhook
lib/              shared modules the routes import
  idtoken.js      verifies a provider's ID token; add Apple here
  session.js      signed, stateless session cookies
  stripe.js       Stripe over plain fetch, and webhook signatures
  http.js         responses, base64url, constant-time compare
test/units.mjs    token, session and webhook verification
test/api.mjs      the routes, against a running wrangler
sql/schema.sql    Katherine's tables, mirroring what her browser holds
sql/server.sql    the server tables, for D1
wrangler.toml     Cloudflare project and the D1 binding
vercel.json       Vercel routing and security headers
_headers          the same headers for Cloudflare Pages
_redirects        Cloudflare Pages clean URLs
PRODUCT.md        who this is for and what it is trying to be
DESIGN.md         colour, type, layout and motion decisions
```

The security policy is written out three times, in `index.html`, `_headers` and
`vercel.json`. They have to stay identical. Change one and change all three.

## Compliance notes for whoever maintains this

Three Washington rules drive choices in the code, and undoing them creates real
exposure:

- **My Health My Data Act** carries a private right of action, so individuals can
  sue directly. Client notes warn against health details on purpose. Do not add
  health tagging.
- **CEMA and the TCPA** turn on proving consent. The consent log records the
  exact policy version and timestamp. Only text clients whose consent row says
  yes, between 8am and 9pm, honouring STOP.
- **The Consumer Protection Act** treats an unhonoured advertised price as
  deceptive. That is why unconfirmed prices show "ask".
