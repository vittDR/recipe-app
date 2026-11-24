// Flavour notes and ingredient families (docs/recipe-classification.md,
// "Flavour, families and effort"): what a dish tastes like beyond its plate
// (plate.ts says how protein-led, rich, vegetable-heavy or carb-led it is) and
// which families of ingredient it leans on, from its required lines. Read by
// classify.ts; taste learning (style.ts) gives each note and family its own
// effect, so "loves fresh, zesty food" or "not keen on mushrooms" carries over
// to dishes never shown.
//
// Keyed on catalogue names (ingredient_catalog.name). A note counts when its
// ingredients add up to at least 1 point: a main one is 1, a supporting one ½.
// Rules, not data: bump CLASSIFICATION_VERSION when they change.

export const FLAVOURS = [
  'fresh_herbs', 'woody_herbs', 'citrus', 'umami', 'smoky', 'warm_spice', 'sweet', 'tangy', 'nutty', 'garlicky',
] as const;
export type Flavour = (typeof FLAVOURS)[number];

export const INGREDIENT_FAMILIES = ['mushrooms', 'cheese', 'olives_capers', 'nuts', 'coconut', 'pulses', 'alcohol', 'aubergine'] as const;
export type IngredientFamily = (typeof INGREDIENT_FAMILIES)[number];

const points = (main: string[], supporting: string[] = []) =>
  new Map<string, number>([...main.map((n) => [n, 1] as const), ...supporting.map((n) => [n, 0.5] as const)]);

export const FLAVOUR_INGREDIENTS: Record<Flavour, Map<string, number>> = {
  fresh_herbs: points(
    ['fresh basil', 'fresh coriander', 'fresh mint', 'dill', 'parsley', 'thai basil', 'tarragon', 'perilla leaves', 'sorrel', 'chives'],
    ['spring onion', 'curry leaves'],
  ),
  woody_herbs: points(
    ['rosemary', 'thyme', 'sage', 'dried oregano', 'herbes de provence', "za'atar"],
    ['bay leaf', 'bouquet garni', 'dried mint'],
  ),
  citrus: points(
    // A squeeze of lemon is everywhere: it takes two citrus things, or lime or orange, to be a note.
    ['orange', 'preserved lemon', 'lime'],
    ['lemon', 'kaffir lime leaves', 'lemongrass', 'sumac'],
  ),
  umami: points(
    ['soy sauce', 'dark soy sauce', 'miso paste', 'fish sauce', 'oyster sauce', 'anchovies', 'parmesan', 'pecorino',
      'dried porcini', 'worcestershire sauce', 'dashi', 'doenjang', 'msg', 'fermented black beans'],
    ['mushrooms', 'tomato paste', 'kecap manis', 'doubanjiang', 'hoisin sauce', 'gochujang', 'ssamjang', 'kimchi'],
  ),
  smoky: points(
    ['chipotle paste', 'bacon', 'smoked salmon', 'smoked haddock', 'smoked mackerel', 'smoked tofu', 'chorizo',
      'dried mexican chillies', 'barbecue sauce', 'andouille sausage'],
    ['paprika', 'kielbasa', 'salt pork', 'char siu', 'aji panca paste'],
  ),
  warm_spice: points(
    ['cumin', 'cinnamon', 'garam masala', 'curry powder', 'coriander seeds', 'ground coriander', 'cardamom', 'cloves',
      'allspice', 'ras el hanout', 'berbere', 'jerk seasoning', 'five-spice', 'star anise', 'curry paste', 'chaat masala',
      'cajun seasoning', 'khmeli suneli', 'nasi goreng paste'],
    ['turmeric', 'nutmeg', 'fennel seeds', 'mustard seeds', 'ajwain', 'nigella seeds', 'dried fenugreek leaves',
      'kashmiri chili powder', 'ground ginger', 'caraway seeds', 'saffron'],
  ),
  sweet: points(
    ['honey', 'maple syrup', 'sweet chilli sauce', 'dried apricots', 'raisins', 'prunes', 'pineapple', 'rice syrup', 'peach',
      'pear', 'apple', 'char siu'],
    ['mirin', 'kecap manis', 'hoisin sauce', 'ketchup', 'pomegranate molasses', 'barbecue sauce', 'sweet potato',
      'butternut squash', 'orange'],
  ),
  tangy: points(
    ['balsamic vinegar', 'black vinegar', 'capers', 'gherkins', 'tamarind paste', 'sauerkraut', 'kimchi', 'pickled ginger',
      'amba', 'preserved lemon'],
    ['vinegar', 'pomegranate molasses', 'sumac', 'olives', 'plain yogurt', 'greek yogurt', 'dijon mustard', 'mustard',
      'sorrel', 'lime', 'lemon'],
  ),
  nutty: points(
    ['peanuts', 'peanut butter', 'tahini', 'cashews', 'almonds', 'pine nuts', 'walnuts', 'pistachios'],
    ['sesame oil', 'sesame seeds', 'pesto', 'chestnuts'],
  ),
  // Garlic is in most recipes (products.ts avoidsGarlic): only a lot of it is a note.
  garlicky: new Map(),
};

/** Grams of garlic a serving from which a dish is garlicky, rather than just seasoned with it. */
export const GARLICKY_MIN_G = 8;
/** Grams of sugar, honey or syrup a serving from which a dish reads sweet. */
export const SWEET_MIN_G = 8;
const SWEETENERS = new Set(['sugar', 'honey', 'maple syrup', 'rice syrup']);

/** Families: one ingredient of the family is enough, garnish (optional lines) aside. */
export const FAMILY_INGREDIENTS: Record<IngredientFamily, Set<string>> = {
  mushrooms: new Set(['mushrooms', 'dried porcini', 'wood ear mushrooms']),
  cheese: new Set(['blue cheese', 'cheddar', 'cheese curds', 'cottage cheese', 'cream cheese', 'emmental', 'feta', 'fontina',
    'goat cheese', 'halloumi', 'kefalotyri', 'mozzarella', 'paneer', 'parmesan', 'pecorino', 'queso fresco', 'reblochon',
    'ricotta']),
  olives_capers: new Set(['olives', 'capers', 'anchovies']),
  nuts: new Set(['almonds', 'cashews', 'peanuts', 'peanut butter', 'pine nuts', 'pistachios', 'walnuts', 'chestnuts', 'tahini']),
  coconut: new Set(['coconut milk', 'light coconut milk', 'desiccated coconut', 'coconut oil']),
  pulses: new Set(['black beans', 'black-eyed beans', 'butter beans', 'canned fava beans', 'chickpeas', 'dried chickpeas',
    'green lentils', 'kidney beans', 'red lentils', 'white beans', 'moong dal', 'broad beans', 'edamame']),
  alcohol: new Set(['beer', 'cider', 'marsala', 'red wine', 'sherry', 'white wine', 'rice wine']),
  aubergine: new Set(['eggplant']),
};

/** Cooking wine evaporates, a splash says little: from this much a serving it's an alcohol dish. */
const FAMILY_MIN_G: Partial<Record<IngredientFamily, number>> = { alcohol: 30, coconut: 30 };

export interface FlavourLine {
  name: string;
  /** Grams per serving, null when unknown. */
  grams: number | null;
}

/** The flavour notes and ingredient families of a dish, from its required lines (catalogue names). */
export function flavoursOf(lines: FlavourLine[]): { flavours: Flavour[]; families: IngredientFamily[] } {
  const score = new Map<Flavour, number>();
  const add = (f: Flavour, p: number) => score.set(f, (score.get(f) ?? 0) + p);
  let garlic = 0;
  let sugar = 0;
  const seen = new Set<string>();
  for (const l of lines) {
    if (l.name === 'garlic') garlic += l.grams ?? 0;
    if (SWEETENERS.has(l.name)) sugar += l.grams ?? 0;
    if (seen.has(l.name)) continue;
    seen.add(l.name);
    for (const f of FLAVOURS) {
      const p = FLAVOUR_INGREDIENTS[f].get(l.name);
      if (p) add(f, p);
    }
  }
  if (garlic >= GARLICKY_MIN_G) add('garlicky', 1);
  if (sugar >= SWEET_MIN_G) add('sweet', 1);
  const families = INGREDIENT_FAMILIES.filter((fam) => {
    const members = lines.filter((l) => FAMILY_INGREDIENTS[fam].has(l.name));
    if (!members.length) return false;
    const min = FAMILY_MIN_G[fam];
    return min === undefined || members.reduce((s, l) => s + (l.grams ?? min), 0) >= min;
  });
  return { flavours: FLAVOURS.filter((f) => (score.get(f) ?? 0) >= 1), families };
}
