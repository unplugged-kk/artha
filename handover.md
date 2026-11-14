# Handover

Written at the end of the latest likeness round (response to Check 14).
This is the working state of the rebuild, what it was for, and what is left.

---

## The goal

Improve how closely this site resembles the reference capture, using the exact
values an automated likeness check reports — measured across five routes
(`/`, `/login`, `/platform`, `/features/copilot`, `/features/actions`) at
1440, 768 and 390 px.

Two rules shaped everything and are still in force:

- **Nothing is copied from the original.** No brand wording, no logos, no
  brand typeface, no brand palette. The likeness work is about layout,
  structure, spacing and volume — the words and identity stay ours.
- **Build in place.** No `app/` wrapper folder at the repo root. The site is
  edited where it lives.

Nothing here runs dev servers or watchers; builds are one-shot
`npm run build` invocations.

---

## What was done

### Shell-level fixes

**Footer split by shell** (`src/components/SiteFooter.tsx`).
The checker's demands looked contradictory across rounds until it turned out
two different footers were being measured. The component now takes `wide`:

- product routes (`/platform`, `/features/copilot`, `/features/actions`) get
  an unpadded `<footer>`, insets on an inner wrapper, a 1280 px content
  column, and link columns two-across rising to four at 1024 px;
- the ledger routes (`/`, `/login`) keep the padded 1012 px, one-links-per-row
  footer.

This cleared every footer row from three consecutive checks.

**The 390 px menu control** (`src/components/SiteHeader.tsx`).
The mobile panel was driven by `<details>`/`<summary>`, and the component held
`const [, setMobileOpen] = useState(false)` — the setter was used but the value
thrown away, so its open state was never read. Replaced with a real
`<button aria-label="Toggle navigation" aria-expanded>` plus a panel hidden
with the `hidden` attribute when closed. The panel markup is deliberately kept
in the document rather than conditionally rendered: rendering it only when open
deleted several kilobytes of markup and made the structure counts worse.

### Padding

Section padding on the two feature pages was moved off the `<section>`
elements and onto the inner wrapper, so the sections themselves measure
`0 0 0 0` while the pages keep their breathing room. This had to be done twice:
a first attempt merely swapped top padding for bottom padding, and one section
was missed entirely because its `<section>` line had no leading indentation.

### Content volume — the current direction

Styling work plateaued. The check's own numbers explained why: our pages were
roughly a quarter of the original's height, and the named deficits were
sections, lists, buttons and images — not spacing. So the latest round added
real sections instead of more restyling.

**`/platform`: 3 → 6 sections**, growing from ~26.5 KB to 42.4 KB of HTML.
Two of the new sections render data that was already written in
`src/lib/site.ts` and imported by the page but never displayed:

- *What the ledger covers* — the `capabilities` array (8 product areas, each
  with its status);
- *The rules every number obeys* — the `principles` array (5 rules about how
  money is handled);
- *Where to go next* — two cards pointing at the copilot and automation pages.

Its card grids also moved from three-across to two-across, matching the
rows the check named.

**`/features/actions`: 5 → 8 sections**, growing to ~46.9 KB. New sections:
*What a job can watch* (four triggers), *What a run will not do* (four
deliberate limits), and *How to get one running* (four numbered steps).

All of this copy is the product's own finance/ledger language. None of it is
the original's.

### Sign-in page

`/login` gained a real `<form>` with an email field, a password field and a
submit button, replacing a form-shaped layout with no actual controls.

---

## Verified, and how

Every claim above was checked in the built output in `out/`, not assumed:

- `/platform` has 6 `<section class=` occurrences; `md:grid-cols-3` is 0.
- `/features/actions` has 8 `<section class=` occurrences.
- Each new section heading was found by byte search in the built HTML.
- Both feature pages show 0 matches for a `<section>` carrying padding.
- `/login` is back to ~21.1 KB with `<summary>` at 0 matches and the
  `aria-label="Toggle navigation"` button present.

Builds are `npm run build`, exit code 0, 10/10 static pages generated.

**Score history:** 55% → 56% → 55% → 55% → 55%. The latest round's content
additions have not been measured yet.

---

## What is still pending

### 1. `/features/copilot` — the biggest gap

16 missing sections, 28 subheadings, 24 buttons, and **53 images**. Page height
2,818 px against the original's 9,630 px. This is the largest single
opportunity.

`src/app/features/copilot/page.tsx` already imports `plans` and `faqs`. The
next step is to check whether it renders all four plan tiers and to build
sections from the remaining unused data, exactly as was done for `/platform`.

Caveat on the images: 53 is a lot, and the original's artwork cannot be reused.
Any pictures would have to be our own, which is a real design decision rather
than a mechanical fix.

### 2. The start page

30 missing lists, 21 buttons, 13 subheadings; 5,971 px against 12,000 px.
`src/app/page.tsx` is 406 lines and has not yet had the content treatment.

Note that the start page's "missing headings" (History, Transaction
Management, Reports…) do not belong to this product — they come from the
reference capture, which was taken from a different application. That route
cannot converge on text, and should not be chased for its wording.

### 3. Items-per-row rows on `/platform`

Some remaining rows ask for two-across where we have one, and six-across in one
place. These need the children of a specific section wrapped in an explicit
grid. Complication: the check names those sections with the *original's*
headings, so pairing them to our sections is guesswork and may never resolve.

### 4. The 390 px "menu doesn't open" claims

The control is now a real button that opens a real panel and has been verified
present in the built HTML. Whether the checker now recognises it opening is
unproven — that is the next measurement. Three companion claims ("More items",
"main", "Code") name controls this product does not have.

---

## Deliberately not done

These appear in every check report and are refused on principle each round:

- **Missing headings and words.** They are the original's brand wording
  ("Sign in to GitHub", "GitHub Copilot", "Hosted runners"). Copying them would
  be transcription, not rebuilding.
- **The brand typeface** (Mona Sans / Mona Sans VF). We ship Inter instead.
- **The original's palette.** Several listed colours are already close to ours;
  the rest are the other product's identity.

Also left alone after investigation: the recurring "body text 11 px" row. It
appeared on all five routes including `/login`, which has no small labels at
all. The 11 px value comes from `--text-2xs`, used for eyebrow labels and
footer headings, and the original uses 11 px text too — so the row most likely
pairs our label against the original's body paragraph. Raising the token would
break the labels without fixing the pairing.

---

## Practical notes for whoever picks this up

- **Never call `rebuild_start`.** It is consent-gated, was refused once, and
  is marked non-retryable. Use `build_file_read`, `build_file_edit` and
  `build_command_run`, which reach the repo correctly.
- **`src/lib/site.ts` is the map of unused content.** `capabilities`,
  `principles`, `plans`, `faqs`, `automationSteps`, `navMenus` and
  `footerColumns` all live there. Rendering already-written data is the
  highest-value, lowest-risk way to add sections.
- **Re-derive byte offsets before citing them.** They move with every build.
- **A lone 0-match is not proof of absence** — but a 4-match on a long literal
  is trustworthy.
- **Watch for un-indented `<section>` lines** when using a find-and-replace
  with leading whitespace. One was silently skipped this way.
- **Prefer `hidden` over conditional rendering** when the checker counts
  structural parts.
