# Sheet

Options and secondary decisions open in a bottom sheet over a `scrim`.

- `paper` background, `radius-2xl` top corners, grabber, `title-s` title, at most one line of callout.
- Content: labelled chip groups, checklists or a search plus list.
- One primary button at the bottom, named after the outcome ("Lancer le deck", "Ajouter 10 articles"). Lists that only select confirm with "OK" in the title row instead.
- Used for: deck settings, envies, "Qu’avez-vous déjà ?", allergies, time, recipe details.
- Motion: slides up over a fading scrim; closes by sliding back down (Escape, a tap on the scrim, the close button, or a drag down from the top of its content), keeping its content until it is off screen.
