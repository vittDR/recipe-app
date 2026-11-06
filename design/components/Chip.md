# Chip

Chips are for choosing; tags are for reading.

- **Choice chip** (`surface`, 14px semibold, `radius-chip`): unselected is white with a 1px shadow. **Selected is `accent-soft` with `accent-strong` text and a 1.5px `accent` inner ring**, never solid black. One-of or many-of in the same style; a "Tout" chip comes first when "any" is valid.
- **Unset / add** (dashed `line-strong` border, no fill): a value not set yet ("Temps") or an entry to more options ("Autres", "+ Ajouter").
- **Suggested** (`accent-soft`, sparkle): values the app filled in (recipe tags from ingredients). Removable with ×. Don't explain how it was inferred.
- **Fact chip** (`sunken` on cards, `surface` on paper): recipe facts with an icon: time, difficulty, kcal, protein. Max four in a row; no wrapping.
- **Tag** (`caption`, `radius-sm`): read-only state on rows. Colour by meaning: sage = à la maison, accent = à acheter, iris = about P, star = indispensable.
