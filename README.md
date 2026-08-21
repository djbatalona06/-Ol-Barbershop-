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

### 4. Move her clients over

In GlossGenius, export the client list as a spreadsheet file. The button says CSV.
Back on the site, open Import / Export and drop that file in.

The screen works out which column is which, then shows you a preview: who's new,
who already exists, and which rows it skipped and why. Read it before you agree.
Nothing gets written until you click the import button.

### 5. Take a backup

Same tab, the button marked "Full backup as JSON". Do it once setup is done, then
every few weeks. It puts everything back exactly as it was.

---

## Putting it online

The repo already has a GitHub Pages workflow (`.github/workflows/static.yml`). Every
push to `main` publishes the site. Nothing else to set up, and no build step to
configure.

Two things about Pages worth knowing, because they are not obvious.

**The header files do nothing there.** `_headers`, `_redirects` and `vercel.json` are
conventions belonging to Cloudflare and Vercel. GitHub Pages ignores all three and
serves its own headers instead. The redirects were never load-bearing, since the site
routes with `#/privacy` style links that work anywhere. The security policy did
matter, so it now travels inside `index.html` as a `<meta http-equiv>` tag and applies
on any host. One piece cannot survive that move: `frame-ancestors`, which browsers
ignore in a meta tag. On Cloudflare the `_headers` file still adds it back.

**Read GitHub's rules before you rely on it.** GitHub Pages is not allowed to run "your
online business, e-commerce site, or any other website that is primarily directed at
either facilitating commercial transactions." This site takes no money. There is no
cart, no checkout, no card field, and booking hands off to GlossGenius. That reads as a
shop's brochure page rather than a store, so it should be fine. It is still a judgment
call, and if it ever grows a payment button that judgment changes.

GitHub also says not to use Pages for sending passwords. Worth being precise: no
password on this site is ever sent anywhere. The login screens hash the passphrase in
the browser and compare it there. Nothing leaves the device, so there is no transmission
to protect.

Free Pages also needs the repository public, which means anyone can read `index.html`.
That was already true of the design and is covered under "What this does not do" below.

### If you want to move off GitHub Pages

Cloudflare Pages is the alternative with no ambiguity in its terms, and it honours the
`_headers` file so the full security policy applies.

1. Sign in at <https://dash.cloudflare.com> and open Workers & Pages
2. Create, then Pages, then Connect to Git, and pick this repository
3. Framework preset: None. Build command: leave empty. Output directory: /
4. Save and Deploy

Avoid Vercel's free Hobby plan. It bans commercial use outright, with no carve out for
brochure sites, and they suspend accounts over it. Vercel Pro is fine, and `vercel.json`
is already written for it.

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
index.html        the entire application, security policy included in its head
.github/workflows/static.yml   publishes to GitHub Pages on every push to main
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
