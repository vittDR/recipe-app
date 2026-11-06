# Household Warm v2

The design system for our household dinner app: decide tonight's dinner together by swiping, then get the groceries sorted. The app is in French. It should feel warm and a little playful, like a good kitchen, never like a form.

v2 replaces v1. It adds colour by meaning, the decided/waiting states, sheets, chips with a softer selected state, and the rules we learned from review.

## Principles

1. **One main action per screen.** It is the terracotta button (`accent`). Everything else is secondary: a white button, a text link, or a compact button inside its card.
2. **Cut copy that explains.** No sentence that describes how the app works ("puisque…", "on exclut aussi…", "un seul deck à la fois"). If a label needs a paragraph, the design is wrong. Empty states can be empty.
3. **Smart defaults, silently.** Prefill from habits and the catalog (deck settings, units, tags, "probably at home") and never announce it ("Préréglé d’après vos mardis" was cut).
4. **Colour means something.** Paper and white carry the screen. Each colour has one job (below) and is used as a soft surface for a whole block, never as a random tint per icon.
5. **Fewer kinds of UI per screen.** If a screen mixes thumbnails, pills, date tiles and buttons in every row, it is a "Christmas tree": strip it to text, one control per row.

## Colour = meaning

| Colour | Tokens | Means |
| --- | --- | --- |
| Terracotta | `accent`, `accent-soft`, `accent-wash`, `accent-dash` | Ce soir, the main action, selection, switches on, reminders (dashed `accent-wash` block) |
| Sage | `sage`, `sage-strong`, `sage-soft` | Courses, "à la maison", done / cooked |
| Iris | `iris`, `iris-strong`, `iris-soft` | P, the partner: her avatar, her progress, her allergies |
| Star | `star`, `star-soft`, `star-text` | The "indispensable" star only. Never a background block |
| Paper & ink | `paper`, `surface`, `sunken`, `ink`, `ink-2`, `muted` | Everything else |

You (V) are `person-1`. Grey-only screens feel sad: a home screen should carry at least one coloured block (a hero in `accent`, groceries in `sage-soft`).

## Type

The system font (SF Pro). Titles bold with tight tracking (`title-l` 32, `title-m` 28, `title-s` 22, `section` 20), body 16, labels 13 semibold in `muted`. Sentence case everywhere, no capitals for labels. Numbers in tabular figures where they line up.

## Layout

- 390pt frame, `space-7` (20px) side gutter, blocks separated by `space-5` (14px).
- Tab screens: overline + `title-l` header, content, then the floating glass tab bar 26px from the bottom. Four tabs: Ce soir (steaming bowl), Recettes (book), Courses (basket), Nous (people).
- Detail pages: full-bleed photo (300px) with glass round buttons; the content sheet overlaps it by 28px with `radius-2xl` corners. One vertical scroll, no tabs: ingredients, then steps.
- Choices and options live in bottom sheets: grabber, `title-s`, optional one-line callout, content, one primary button at the bottom.

## Content

- French, `vous`, short. Buttons say what happens: "Lancer le deck", "Ajouter les ingrédients aux courses", "Commencer à cuisiner".
- Labels are questions or nouns: "Qui mange ?", "Temps", "Envie", "Vos oui · 4".
- The partner is named, never "your partner".
- Quantities: number + unit, French units (g, ml, c. à s., gousses, pcs).

## Iconography

Line icons, 24px grid, 2–2.2px stroke, round caps and joins, drawn in `ink-2` (or the meaning colour on a tinted block). Filled glyphs only for heart (like), star (indispensable) and sparkle (smart suggestion). No emoji. Icon tiles are 34px, `radius-md`, filled with the soft colour of their section (all Courses rows sage, all Notifications rows accent): never one colour per icon.

## Components

Button, Chip, Card, ListRow, Controls, Avatar, WeekStrip, SwipeCard, Sheet, TabBar. Each has a preview and a README with its rules.
