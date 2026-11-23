// "Toujours à la maison" by category (onboarding, after the equipment, and
// household settings): each tile stands for catalogue ingredients the
// household keeps in. Ticking a tile makes them staples; unticking removes
// them. Anything else is learned from the grocery sheet (record_list_choices).

export const PANTRY_GROUPS = ['basics', 'spices', 'herbs', 'oils', 'stocks', 'asian', 'condiments', 'baking', 'fresh'] as const;
export type PantryGroup = (typeof PANTRY_GROUPS)[number];

/** Catalogue ingredient names (ingredient_catalog.name) per tile. */
export const PANTRY_ITEMS: Record<PantryGroup, string[]> = {
  // The strict staples (narrow_staples()): every household starts with them.
  basics: ['salt', 'black pepper', 'white pepper', 'olive oil', 'vegetable oil', 'sugar', 'flour', 'vinegar'],
  spices: [
    'cumin', 'paprika', 'chili flakes', 'chili powder', 'turmeric', 'cinnamon', 'nutmeg', 'ground coriander', 'ground ginger',
    'curry powder', 'garam masala', 'cardamom', 'cloves', 'allspice', 'five-spice', 'star anise', 'fennel seeds',
    'coriander seeds', 'mustard seeds', 'caraway seeds', 'kashmiri chili powder', 'ras el hanout', 'sumac', 'saffron',
    "za'atar", 'cajun seasoning',
  ],
  herbs: ['dried oregano', 'thyme', 'bay leaf', 'rosemary', 'herbes de provence', 'dried mint', 'sage', 'bouquet garni'],
  oils: ['sesame oil', 'coconut oil', 'balsamic vinegar'],
  stocks: ['chicken stock', 'vegetable stock', 'beef stock', 'fish stock', 'dashi'],
  asian: [
    'soy sauce', 'dark soy sauce', 'fish sauce', 'oyster sauce', 'hoisin sauce', 'mirin', 'rice wine', 'miso paste',
    'gochujang', 'sriracha', 'sesame seeds', 'kecap manis',
  ],
  condiments: [
    'dijon mustard', 'mustard', 'ketchup', 'hot sauce', 'worcestershire sauce', 'harissa',
    'tomato paste', 'honey', 'maple syrup',
  ],
  baking: ['baking powder', 'baking soda', 'cornstarch', 'dry yeast'],
  fresh: ['garlic', 'onion', 'shallot', 'butter'],
};

/** The drawings (32 px grid, like the appliances), one path each. */
export const PANTRY_PATHS: Record<PantryGroup, string> = {
  // Salt shaker.
  basics: 'M12 13h8l1.2 13.2a1.6 1.6 0 0 1-1.6 1.8h-7.2a1.6 1.6 0 0 1-1.6-1.8zM12 13a4 4 0 0 1 8 0M14.5 9.5h.01M17.5 9.5h.01M16 7.5h.01',
  // Spice jar.
  spices: 'M11 5h10v4H11zM10 9h12v16a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2zM10 15h12v6H10z',
  // Sprig.
  herbs: 'M16 28V6M16 11c-3 0-5-2-5-4.5c3 0 5 2 5 4.5zM16 11c3 0 5-2 5-4.5c-3 0-5 2-5 4.5zM16 18c-3.5 0-6-2.5-6-5.5c3.5 0 6 2.5 6 5.5zM16 18c3.5 0 6-2.5 6-5.5c-3.5 0-6 2.5-6 5.5z',
  // Oil bottle with a drop.
  oils: 'M13 4h6v4l2 3v15a2 2 0 0 1-2 2h-6a2 2 0 0 1-2-2V11l2-3zM16 15c-1.5 2-2.5 3.2-2.5 4.5a2.5 2.5 0 0 0 5 0c0-1.3-1-2.5-2.5-4.5z',
  // Stock cube.
  stocks: 'M16 5l10 5v12l-10 5l-10-5V10zM6 10l10 5l10-5M16 15v12',
  // Sauce bottle.
  asian: 'M14 4h4v5l2.5 3.5V26a2 2 0 0 1-2 2h-5a2 2 0 0 1-2-2V12.5L14 9zM11.5 17h9v5h-9z',
  // Jar with a lid.
  condiments: 'M9 9h14v3H9zM10 12h12v13a3 3 0 0 1-3 3h-6a3 3 0 0 1-3-3zM13 18h6',
  // Whisk.
  baking: 'M16 18v10M16 18c-4 0-6-5-6-8.5a6 6 0 0 1 12 0c0 3.5-2 8.5-6 8.5zM13 6.5c-.5 4 .5 8.5 3 11.5M19 6.5c.5 4-.5 8.5-3 11.5',
  // Garlic bulb.
  fresh: 'M16 5c.5 3 7.5 6 7.5 13.5a7.5 7.5 0 0 1-15 0C8.5 11 15.5 8 16 5zM16 12v14M12 16c-1.5 3.5-.5 8 3 10M20 16c1.5 3.5.5 8-3 10',
};
