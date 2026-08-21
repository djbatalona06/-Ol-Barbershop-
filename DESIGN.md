# DESIGN.md — The Ol' Barbershop

## Theme decision

Scene sentence: *a guy checking his phone in a truck cab at 7am under grey Pacific
Northwest overcast, deciding whether he can get a cut before his shift.*

That forces **light**. A phone screen outdoors in flat daylight glare needs a bright ground,
and Katherine's counter iPad sits in window light all day. Burgundy and walnut are the
committed dark surfaces sitting on that light ground, not the ground itself.

## Color strategy: Committed

Burgundy carries roughly 40% of the surface: the header rail, the booking panel, the
calendar's active state, the footer. Oak is the ground and the grain. Brass is the hairline
that separates them and appears nowhere else. This is deliberately past the "one accent
under 10%" line, because a restrained palette would read as a booking widget rather than
as a room.

All values OKLCH. No pure black, no pure white. Every neutral is tinted toward oak hue 74.

```
Ground        --ground        oklch(0.958 0.014 74)    warm paper, page base
              --ground-sunk   oklch(0.928 0.018 72)    inset wells, table stripes
              --ground-lift   oklch(0.982 0.010 76)    raised panels

Ink           --ink           oklch(0.235 0.018 42)    body text
              --ink-soft      oklch(0.435 0.022 45)    secondary text
              --ink-faint     oklch(0.510 0.018 50)    meta, disabled

Burgundy      --burgundy-deep oklch(0.255 0.075 18)    footer, deepest panels
              --burgundy      oklch(0.335 0.105 20)    header rail, primary surface
              --burgundy-lit  oklch(0.415 0.128 22)    hover on burgundy
              --claret        oklch(0.505 0.155 24)    interactive accent, focus

Oak           --oak-pale      oklch(0.845 0.045 78)    grain highlight
              --oak           oklch(0.705 0.068 72)    panel wood
              --oak-deep      oklch(0.565 0.070 64)    grain shadow
              --walnut        oklch(0.375 0.045 52)    dark wood

Brass         --brass         oklch(0.755 0.115 88)    hairlines, trademark rule
              --brass-lit     oklch(0.845 0.105 92)    lit edge
              --brass-deep    oklch(0.510 0.095 84)    brass on light ground (contrast safe)

Signal        --ok            oklch(0.520 0.090 148)   confirmed, available
              --warn          oklch(0.640 0.110 68)    needs attention, sits near brass
              --danger        oklch(0.505 0.160 25)    destructive, sits in claret family
```

Brass at `--brass` fails contrast on the light ground, so text and icons use `--brass-deep`
there. `--brass` is for hairlines and for text on burgundy only, where it measures 5.7:1.

`--brass-deep` and `--ink-faint` were both darkened from an initial 0.595/0.600 after
measurement: at those values they rendered 3.2:1 to 3.6:1 against the page grounds, short
of the 4.5:1 body-text minimum. Both now sit at L 0.510, measured against `--ground-sunk`, which is the *darkest*
surface either lands on and therefore the worst case for dark text. Solving against the
lightest ground first was wrong and left them at roughly 4.0:1 on sunk panels.

The brass button is the inverse case: it carries dark ink, so its field uses `--brass`
rather than `--brass-deep`, giving 8.6:1. Contrast is verified by reading
rasterised pixels rather than parsing values, because Chromium keeps `oklch()` in computed
styles and any parser that assumes rgb will report nonsense.

## Oak grain

No image files. Three stacked `repeating-linear-gradient` layers at different frequencies
and low alpha, plus one wide `linear-gradient` for the plank seam. Renders at any size,
costs nothing, and never pixelates. Applied to the barber panel, footer, and closed
calendar dates.

## Typography

**Fraunces** for display. A variable serif with weight and optical-size axes that reads
sturdy and made rather than antique. Chosen specifically to dodge the Playfair reflex.

**Public Sans** for UI and body. Civic, plain, workmanlike, correct for Everett. Chosen to
dodge the Inter reflex.

System mono stack for the SQL console. No third font download.

Both loaded from Google Fonts with full fallback stacks, so a blocked or slow font request
degrades to Georgia and system-ui without layout shift.

Scale, ratio 1.28, fluid via `clamp()` between the 360px and 1536px breakpoints:

```
--t-xs .75rem   --t-sm .875rem  --t-base 1rem    --t-md 1.125rem
--t-lg 1.28rem  --t-xl 1.64rem  --t-2xl 2.1rem   --t-3xl 2.69rem  --t-4xl 3.44rem
```

Body copy capped at 68ch. Headings carry weight contrast of at least 300 units against
body, never scale alone. Tabular figures on every price, time, and metric.

## Layout

CSS Grid throughout, `auto-fit` plus `minmax()` so columns respond to available width
rather than to a guessed device class.

The signature arrangement is the **book**: barber roster and availability calendar as a
two-column grid that stays visually joined by a shared brass rule. Selecting a barber
repaints the calendar. At narrow widths the roster collapses above the calendar and the
rule becomes horizontal.

Services render as a **wall menu**, rows with leader dots running to a right-aligned price,
the way the price list actually hangs in a shop. Not cards. Card grids are banned here and
a service list is exactly the case where they would have been the lazy answer.

Spacing is deliberately uneven: generous above section heads, tight between a label and its
value, wide in the footer. Uniform padding everywhere is what makes a page read as generated.

## The barber pole

The one indulgence, and the only decorative object on the page.

An `overflow: hidden` cylinder containing an over-tall inner element striped with
`repeating-linear-gradient(45deg, ...)` in red, warm white and blue. The inner element is
animated with `transform: translateY()` only, so it stays on the compositor and never
touches layout. A `linear-gradient` overlay supplies the glass curve, and brass caps sit at
top and bottom with a soft shadow beneath.

Appears in the header at small size, in the customer dashboard as the loading and
empty-state motif, and once at full height beside the booking panel.
`@media (prefers-reduced-motion: reduce)` freezes it, which is both an accessibility
requirement and vestibular-safety basic.

## Motion

```
--ease-out-quart cubic-bezier(0.25, 1, 0.5, 1)
--ease-out-expo  cubic-bezier(0.16, 1, 0.3, 1)
--d-micro 120ms   --d-base 220ms   --d-enter 420ms
```

Transform and opacity only. No bounce, no elastic, no spring. Everything respects
`prefers-reduced-motion`.

## Component rules

- **No side-stripe borders.** Status on a pipeline card is a filled chip plus a dot, never
  a coloured left edge.
- **No gradient text**, anywhere, for any reason.
- **No glass panels.** Wood is opaque.
- **Admin dashboard is an agenda, not stat tiles.** Katherine at 10am needs the next four
  appointments in order with names and services. Counts appear inline in a sentence above
  the list, not as four big numbers in a row.
- **Modals only for destructive confirmation.** Everything else is inline or progressive.
- Focus rings are 2px `--claret` with a 2px `--ground` offset, visible on every surface.
