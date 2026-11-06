# Card

A card groups one thing; its colour says what kind of thing.

- **Plain** (`surface`, `radius-xl`, `shadow-card`, 14px padding): recipes, list groups, settings groups.
- **Tinted** (soft colour, no shadow): a block about one meaning. `sage-soft` for groceries, `iris-soft` for P, `accent-soft` for "On a remarqué" suggestions. The block's action sits inside it, in the same colour family (compact `sage-strong` button on the Courses card).
- **Reminder** (`accent-wash` + 1.5px dashed `accent-dash`): reminders and scheduled nudges. Never yellow.
- Icon tile inside a tinted card is white; inside a plain card it is the section's soft colour.
- Don't nest cards. Don't tint more than two blocks on one screen.
