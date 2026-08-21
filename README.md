# The Ol' Barbershop

At your service in Everett, WA.

The whole website is one file: **`index.html`**. There is no build step, no
framework and no server. Open it, or put it on a host, and it works.

- **Live shop data** recovered from public listings and editable in the admin area
- **Availability calendar** that only shows dates Katherine is actually free
- **CRM pipeline** shaped like GlossGenius, with CSV import and export
- **SQL console** for querying the shop records
- **Two-person admin** for Katherine and DJ, encrypted on the device
- **Customer accounts** stored in each customer's own browser
- CCPA privacy tooling, Washington-specific compliance notes, WCAG 2.2 AA

---

## Running it on this computer

WebCrypto needs a real web address, so opening the file by double-clicking it
will not work for the login screens. Serve the folder instead:

```bash
cd -Ol-Barbershop-
python3 -m http.server 8000
```

Then open <http://localhost:8000>. Press Ctrl+C in the terminal to stop.

---

## Setting up with Katherine

Do these in order. It takes about twenty minutes.

### 1. Create the two admin accounts

Go to **Shop Admin**. The first time, it asks you to create two accounts:

| Account | Who | Can do |
|---|---|---|
| Owner | Katherine | Everything, including resetting the manager |
| Manager | DJ | Everything except resetting the owner |

Each passphrase needs 12 characters with an upper case letter, a lower case
letter and a number. **They must be different from each other.**

There is no "forgot my passphrase" link. There is no server holding an account
to reset. The next screen shows a **recovery code**, once. Print it or write it
down and keep it in the shop. If both passphrases are lost and the code is gone,
the records cannot be opened by anyone.

### 2. Set the real prices

The Services tab lists every service with a **confirm** flag. Those prices came
from public listings, not from Katherine, so the public menu shows the word
"ask" instead of a number until she sets it. Typing a real price clears the flag.

This is deliberate. Showing a price the shop will not honour is a deceptive
practice under Washington's Consumer Protection Act.

### 3. Check the hours

The Schedule tab is seeded with closed Sunday and Monday, 10 to 4 on Tuesday and
Saturday, 10 to 6 Wednesday through Friday. Fix anything that is wrong. Whatever
is saved here is exactly what customers can book.

Add days off, holidays and short days under **Days off and changes**. That beats
editing the weekly hours for a one-off.

### 4. Bring the clients across

In GlossGenius, export clients to CSV. In the **Import / Export** tab, drop the
file in. The screen matches the columns for you, then shows a preview of what
would be added, updated and skipped. **Nothing is saved until the preview is
approved.**

### 5. Take a backup

Same tab, **Full backup as JSON**. Do this after setup and every few weeks.
It restores everything, so it is the one habit worth keeping.

---

## Putting it online

The site is plain static files, so any static host works. Two free options:

### Cloudflare Pages (recommended)

Cloudflare's free tier allows commercial use, which matters here.

1. Sign in at <https://dash.cloudflare.com> and go to Workers & Pages
2. Create → Pages → Connect to Git, and pick this repository
3. Framework preset **None**, build command **empty**, output directory `/`
4. Save and Deploy

`_headers` and `_redirects` are picked up automatically.

### Vercel

**Check this first:** Vercel's free Hobby plan is for non-commercial personal
projects only. A barbershop taking bookings is commercial use, and the penalty is
account suspension. Either use Cloudflare Pages, or pay for Vercel Pro.

If you are on Pro: import the repository, framework preset **Other**, build
command empty, output directory the repository root. `vercel.json` handles the
rest.

---

## What this does not do

Worth being straight about, because it changes how the shop uses it.

**Booking sends a request, not a confirmation.** With no server, choosing a time
saves it on the customer's own phone and then hands off to a text message, an
email, a phone call, or GlossGenius. Katherine confirms in whichever app she is
already in and marks it confirmed in admin. The site says this plainly to
customers rather than implying a chair is held.

**The admin login is a gate, not a wall.** On a public web address, anyone can
read the page source and skip a JavaScript login screen. What actually protects
the records is that they are AES-GCM encrypted, so getting past the login screen
yields scrambled bytes. Two further things follow from that, both deliberate:

- No customer names or numbers are in the public half of the storage. The
  calendar works from time blocks that carry no identity.
- Customer accounts live in each customer's own browser and never reach the shop.

**Data lives per browser.** Katherine's iPad and the shop laptop hold separate
copies. Move data between them with backup and restore. Real sync needs a
backend, which `sql/schema.sql` is written to support without a redesign.

---

## Before it goes live

- [ ] Have a Washington attorney read the Privacy Policy, Terms and Accessibility
      pages. Every clause needing a decision is marked **LAWYER REVIEW**.
- [ ] Confirm the address, phone number and hours with Katherine. All of it came
      from public listings and none of it is verified.
- [ ] Set every price.
- [ ] Decide whether a late cancellation or no-show fee applies. If it does, it
      has to appear in the Terms and before booking, not after.
- [ ] Run an accessibility check against the live address.

---

## Files

```
index.html        the entire application
vercel.json       Vercel routing and security headers
_headers          the same headers for Cloudflare Pages
_redirects        Cloudflare Pages clean URLs
sql/schema.sql    the database schema, for a future backend
PRODUCT.md        who this is for and what it is trying to be
DESIGN.md         colour, type, layout and motion decisions
```

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
