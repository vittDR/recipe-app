# SwipeCard

The deck card for tonight's swipe session.

- Photo on top (flexible height), one glass badge only ("Parfait pour vous deux"). No source label, no explanation boxes.
- Below: recipe name (`title-s`), up to three fact chips, and the sage "à la maison" line.
- Tapping the card expands it into the full recipe (ingredients, steps, cookware) with the same action row floating at the bottom. There is no "Détails" button.
- A thin 12-segment progress bar sits above the deck; the next card peeks behind in `stack`.
- **Actions**, left to right: undo (44, takes back the last choice), pass (62), like (62, `accent`), indispensable (44, `star-soft` with the star).
- **A partner's must-have** comes first in the others' decks, with a gold edge, a soft glow and a star badge "{name} wants this" (it replaces the usual badge). Only must-haves are shared mid-deck; yes and pass stay hidden until you finish.
- **Motion**: yes/pass are thrown off along the swipe's angle and ease out (0.3 s); must-have lifts, a gold shimmer laps the edge, then it flies up (0.5 s); a short drag springs back with a little overshoot; the next card rises as you drag and settles as the top one leaves; undo flies the card back in from where it went.
