# ListRow

Rows live inside a card, separated by `line` hairlines.

- **Ingredient**: quantity in a fixed 84px column (semibold, no wrap), name, optional sage home icon for "probably at home". No tags per row on recipe pages; the legend sits once under the card.
- **Checklist** ("Qu’avez-vous déjà ?", allergies, days): 24px round check on the left. Unchecked = `line-strong` ring. Checked = `sage` when it means "I have it", `accent` when it means "selected". Owned items turn `muted`.
- **Settings**: 34px icon tile in the section's soft colour, title 15px semibold, value in `muted`, chevron in `faint`.
- Long names wrap to two lines; controls on the right never shrink.
