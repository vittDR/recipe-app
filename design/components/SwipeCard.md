# SwipeCard

The deck card for tonight's swipe session.

- Photo on top (flexible height), one glass badge only ("Parfait pour vous deux"). No source label, no explanation boxes.
- Below: recipe name (`title-s`), up to three fact chips, and the sage "à la maison" line.
- Tapping the card expands it into the full recipe (ingredients, steps, cookware) with the same action row floating at the bottom. There is no "Détails" button.
- A thin 12-segment progress bar sits above the deck; the next card peeks behind in `stack`.
- **Actions**, left to right: undo (44, takes back the last choice), pass (62), like (62, `accent`), indispensable (44, `star-soft` with the star).
