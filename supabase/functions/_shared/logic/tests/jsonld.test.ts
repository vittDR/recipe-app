import { test } from 'node:test';
import assert from 'node:assert/strict';
import { durationToMinutes, extractJsonLdRecipe, pageText } from '../jsonld.ts';

const page = `<html lang="fr"><head>
<script type="application/ld+json">{"@context":"https://schema.org","@graph":[
 {"@type":"WebSite","name":"Site"},
 {"@type":["Recipe"],"name":"Poulet au citron &amp; épinards","recipeYield":["4","4 portions"],
  "totalTime":"PT1H5M","image":[{"@type":"ImageObject","url":"https://x/img.jpg"}],
  "recipeIngredient":["600 g de blanc de poulet","200 g d&#39;épinards"],
  "recipeInstructions":[{"@type":"HowToSection","name":"Prep","itemListElement":[{"@type":"HowToStep","text":"Couper le poulet."}]},
                        {"@type":"HowToStep","text":"Cuire <b>10 min</b>."}],
  "keywords":"rapide, poulet","recipeCategory":"Plat"}]}
</script></head><body><nav>menu</nav><p>Hello</p><p>World</p></body></html>`;

test('extracts a recipe from @graph JSON-LD', () => {
  const r = extractJsonLdRecipe(page)!;
  assert.equal(r.title, 'Poulet au citron & épinards');
  assert.deepEqual(r.ingredients, ['600 g de blanc de poulet', "200 g d'épinards"]);
  assert.deepEqual(r.steps, ['Couper le poulet.', 'Cuire 10 min .']);
  assert.equal(r.servings, 4);
  assert.equal(r.totalMin, 65);
  assert.equal(r.imageUrl, 'https://x/img.jpg');
  assert.deepEqual(r.tags, ['plat', 'rapide', 'poulet']);
  assert.equal(r.language, 'fr');
});

test('no recipe -> null; page text drops chrome', () => {
  assert.equal(extractJsonLdRecipe('<html><script type="application/ld+json">{"@type":"Article"}</script></html>'), null);
  assert.equal(pageText(page.replace(/<script[\s\S]*?<\/script>/, '')), 'Hello\nWorld');
});

test('durations', () => {
  assert.equal(durationToMinutes('PT45M'), 45);
  assert.equal(durationToMinutes('PT2H'), 120);
  assert.equal(durationToMinutes('nonsense'), null);
});
